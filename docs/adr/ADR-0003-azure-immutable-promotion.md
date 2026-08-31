# ADR-0003 - Promotion explicite des artefacts immuables vers Azure Blob Storage

- Statut : Propose
- Date : 2026-08-16
- Portee : publication externe des paquets `public`, `answerKey` et du descripteur de release
- Complete : ADR-0001 et ADR-0002

## Contexte

ADR-0002 produit deux paquets independants, deterministes et verifies. Leur
retention dans GitHub Actions est limitee et ne constitue pas une livraison
durable. La publication Azure doit rester decouplee des deploiements Certigo
existants : ce depot ne provisionne aucune ressource et ne modifie aucune
configuration de backend, de CDN ou d'application.

Les noms des comptes Storage, des conteneurs et des identites ne sont pas connus
dans ce depot. Ils sont donc fournis par trois GitHub Environments proteges.

## Decision

### Promotion manuelle et revue

`.github/workflows/publish-content-azure.yml` est declenche uniquement par
`workflow_dispatch`. Tous ses jobs sont bloques si la ref n'est pas
`refs/heads/main`.

Le job `plan` reconstruit les deux paquets, execute toutes les gates et publie
leurs `manifestId` et le `releaseId` dans le resume du run. Les jobs de
publication dependent de ce plan et utilisent des environnements distincts :

- `azure-content-public` pour le paquet distribuable ;
- `azure-content-answer-key` pour le corrige reserve au backend ;
- `azure-content-release` pour le descripteur, publie uniquement apres succes et
  verification des deux paquets.

Chaque environnement doit exiger des reviewers, interdire l'auto-approbation,
interdire le bypass administrateur et autoriser uniquement la branche `main`.

### Adressage et immutabilite

Chaque canal est publie sous la cle suivante :

```text
content-public-releases/manifests/<publicManifestId>/manifest.json
content-public-releases/manifests/<publicManifestId>/<payload path>
content-private-releases/manifests/<privateManifestId>/manifest.json
content-private-releases/manifests/<privateManifestId>/<payload path>
content-release-descriptors/releases/<releaseId>/release.json
```

Les IDs conservent leur forme `sha256:<64-hex>` dans le chemin. Il n'existe
aucun pointeur `latest`, aucune copie de promotion et aucune reecriture d'une
cle existante. Les deux arbres sont publies et verifies avant le descripteur :
une panne partielle ne rend donc jamais une release importable.

Le script `tools/publish_blob_artifact.sh` :

1. refuse tout prefixe incoherent avec le `manifestId` ou `releaseId` source ;
2. refuse un conteneur avec acces anonyme ;
3. exige une politique WORM temporelle `Locked`, une retention positive et
   aucun append protege ;
4. cree uniquement les blobs absents avec `--overwrite false` et
   `--auth-mode login` ;
5. telecharge chaque blob et compare son SHA-256 aux octets locaux ;
6. exige un `versionId`, une policy de blob `Locked` et une immutabilite
   temporelle ou un legal hold ;
7. verifie `Content-Type`, `Cache-Control` et la liste exacte des blobs du
   prefixe.

Une relance est idempotente si et seulement si les blobs existants sont
strictement identiques. Un blob divergent ou supplementaire fait echouer la
promotion.

### Authentification et permissions

La connexion utilise GitHub OIDC avec un jeton court et `azure/login`. Aucune
cle Storage, chaine de connexion ou secret client n'est accepte. Les actions
GitHub et la version Azure CLI sont epinglees.

Trois UAMI Microsoft Entra distinctes sont requises. Chacune recoit un role
custom porte sur son conteneur, limite a la lecture de configuration et a
`blobs/read`/`blobs/write`. Ce role permet create, list, read et le controle
WORM, mais pas delete. Le role integre `Storage Blob Data Contributor` n'est
qu'un fallback soumis a acceptation de risque, car il inclut des operations de
suppression inutiles au workflow. Les identites ne recoivent aucun role au
niveau subscription, resource group ou compte Storage, et aucun droit de
modification de la politique d'immutabilite.

Le workflow demande seulement :

- `contents: read` pour reconstruire le paquet ;
- `id-token: write` dans le job de publication concerne.

### Retention et lifecycle

Les conteneurs doivent avoir une politique WORM de retention temporelle
verrouillee avant l'activation des environnements. La duree est une decision
OPS/compliance et doit etre documentee pour chaque canal avant verrouillage ;
elle ne peut pas etre reduite ensuite.

La baseline durable est :

- aucune suppression automatique ;
- tiering vers `cool` autorise apres une duree approuvee par OPS ;
- aucune option d'append protege ;
- soft delete active en defense supplementaire ;
- inventaire et journaux data-plane conserves selon la politique OPS.

Si une suppression lifecycle est ajoutee plus tard, son delai doit etre
strictement superieur a la retention WORM. Azure ne supprimera pas un blob
encore immutable. Cette modification exige une nouvelle decision d'architecture
car elle reduit la fenetre de rollback.

### Rollback

Un rollback ne modifie pas Blob Storage. Le proprietaire du consommateur
selectionne un ancien `manifestId` approuve et configure le backend ou la future
distribution CDN pour lire :

```text
https://<account>.blob.core.windows.net/content-public-releases/manifests/<publicManifestId>/manifest.json
```

Le manifeste et ses payloads sont verifies avant le changement de configuration.
La promotion precedente reste disponible ; aucun alias mutable n'est deplace.
Le changement du consommateur reste realise par son pipeline existant, hors de
ce depot.

## Prerequis manuels obligatoires

Les operations suivantes sont executees par les proprietaires Azure/GitHub,
jamais par ce workflow.

1. Creer ou designer deux conteneurs prives. Le conteneur public est une origine
   privee destinee a un futur CDN, pas un endpoint Blob anonyme.
2. Desactiver l'acces public Blob et l'autorisation Shared Key sur chaque compte
   Storage. Conserver TLS 1.2 minimum et Secure transfer required.
3. Configurer puis verrouiller une politique WORM container-level sur chaque
   conteneur, sans append protege. Tester la duree avant verrouillage.
4. Configurer le lifecycle approuve. Ne pas activer de suppression tant que la
   duree de rollback n'a pas ete formellement decidee.
5. Creer trois user-assigned managed identities dediees.
6. Ajouter une credential federee GitHub par identite avec audience
   `api://AzureADTokenExchange` et sujet lie a l'environnement :

   ```text
   repo:gchambaud_microsoft/certigo-content:environment:azure-content-public
   repo:gchambaud_microsoft/certigo-content:environment:azure-content-answer-key
   repo:gchambaud_microsoft/certigo-content:environment:azure-content-release
   ```

   Si le depot utilise les claims OIDC immuables GitHub introduits en 2026,
   utiliser le sujet emis par ce depot avec les IDs owner/repository plutot que
   le format historique ci-dessus.
7. Creer un role custom avec `notActions: []`, `notDataActions: []`, les
   lectures de configuration requises et uniquement les data actions Blob
   requises :

   ```json
   {
     "actions": [
       "Microsoft.Storage/storageAccounts/blobServices/containers/read",
       "Microsoft.Storage/storageAccounts/blobServices/containers/immutabilityPolicies/read"
     ],
     "dataActions": [
       "Microsoft.Storage/storageAccounts/blobServices/containers/blobs/read",
       "Microsoft.Storage/storageAccounts/blobServices/containers/blobs/write"
     ],
     "notActions": [],
     "notDataActions": []
   }
   ```

   La definition peut etre assignable au niveau subscription ou resource group,
   mais l'attribution a chaque identite reste au scope exact du conteneur :

   ```text
   /subscriptions/<subscription>/resourceGroups/<resource-group>/providers/Microsoft.Storage/storageAccounts/<account>/blobServices/default/containers/<container>
   ```

8. Creer les trois GitHub Environments et y definir les variables suivantes,
   avec des valeurs propres a chaque canal :

   | Variable | Valeur |
   | --- | --- |
   | `AZURE_CLIENT_ID` | Client ID de l'identite dediee |
   | `AZURE_TENANT_ID` | Tenant Microsoft Entra |
   | `AZURE_SUBSCRIPTION_ID` | Subscription contenant le compte Storage |
   | `AZURE_RESOURCE_GROUP` | Resource group du compte Storage |
   | `AZURE_STORAGE_ACCOUNT` | Nom du compte Storage |
   | `AZURE_STORAGE_CONTAINER` | Nom du conteneur cible |

9. Definir les quatre variables repository non secretes suivantes. Elles
   constituent la topologie attendue et rendent toute collision bloquante :

   | Variable | Format |
   | --- | --- |
   | `CONTENT_PUBLISH_ENABLED` | Doit valoir exactement `true` |
   | `AZURE_RELEASE_STORAGE_TARGET` | `<account>/content-release-descriptors` |
   | `AZURE_PUBLIC_STORAGE_TARGET` | `<account>/content-public-releases` |
   | `AZURE_ANSWER_KEY_STORAGE_TARGET` | `<account>/content-private-releases` |
   | `AZURE_RELEASE_CLIENT_ID` | Client ID de l'identite descripteur |
   | `AZURE_PUBLIC_CLIENT_ID` | Client ID de l'identite publique |
   | `AZURE_ANSWER_KEY_CLIENT_ID` | Client ID de l'identite answer key |

   Les trois cibles et les trois Client IDs doivent etre distincts. Chaque valeur
   d'environnement est comparee aux outputs normalises du job `plan` avant
   connexion. Ne pas dupliquer ces quatre variables dans les environnements :
   la topologie de reference est exclusivement au niveau repository.
10. Configurer les protections GitHub Environment decrites plus haut. Ne pas
   ajouter de secret ou de cle Azure.
11. Executer une premiere promotion du canal `public`, verifier le manifeste et
    les logs, puis repeter separement pour `answer-key`.

## Non-objectifs

- aucun provisionnement Azure ;
- aucune lecture ou modification d'un environnement Azure live par cette PR ;
- aucune integration avec les deploiements backend/mobile actuels ;
- aucune creation de CDN ou d'alias mutable ;
- aucune modification du corpus editorial.

## References

- [GitHub OIDC vers Azure](https://docs.github.com/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-azure)
- [Azure Login avec OIDC](https://learn.microsoft.com/azure/developer/github/connect-from-azure-openid-connect)
- [Immutable storage WORM](https://learn.microsoft.com/azure/storage/blobs/immutable-storage-overview)
- [Lifecycle Blob Storage](https://learn.microsoft.com/azure/storage/blobs/lifecycle-management-overview)
- [RBAC data-plane Blob](https://learn.microsoft.com/azure/storage/blobs/assign-azure-role-data-access)
