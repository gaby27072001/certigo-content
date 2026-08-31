# Runbook - publication des releases de contenu

Ce runbook couvre uniquement la construction et la publication. Il ne
provisionne aucune ressource Azure, ne configure aucun secret ou variable et
n'active aucune release dans Certigo.

## Contrat #290/#304

| Surface | Conteneur | Cle |
| --- | --- | --- |
| Public | `content-public-releases` | `manifests/<publicManifestId>/...` |
| Answer key | `content-private-releases` | `manifests/<privateManifestId>/...` |
| Descripteur | `content-release-descriptors` | `releases/<releaseId>/release.json` |

`<manifestId>` et `<releaseId>` incluent le prefixe `sha256:`. Les paquets
public et prive sont physiquement separes. Le descripteur est publie en dernier
et atteste que les deux arbres ont ete publies et relus avec succes.

Le publisher copie les octets produits par le packager sans les reformater. Les
contrats question/solution v2-v4, content manifest v1-v3, package manifest
v1-v3, leurs hashes et le descripteur `release/v1` restent donc inchanges. Une
release publiable exige `dist/release.json`; un corpus historique v1/v2 sans
descripteur est refuse fail-closed.

## Preuve locale sans Azure

Construire et verifier :

```bash
npm run package
npm run package:verify
npm run publish:dry-run -- --destination .local-publication
```

Le dry-run ne cree pas `.local-publication`. Pour exercer les ecritures
create-only :

```bash
npm run publish:local -- --destination .local-publication
```

Une seconde execution doit rapporter tous les fichiers `unchanged`. Un fichier
existant avec des octets differents provoque `collision immuable`. Le publisher
refuse les chemins absolus, `..`, les backslashes et les ancetres symboliques.
Si le public est ecrit puis le prive echoue, aucun descripteur n'est cree.
Sous Windows, le backend filesystem encode uniquement le `:` des IDs en
`%3A`; les chemins logiques affiches et les cles Azure restent strictement ceux
du contrat.

## Runtime v3 - construction locale

Materialiser les ressources runtime a partir du catalogue et de la couverture :

```bash
npm run runtime:materialize       # genere tracks/domains/concepts + couvertures Microsoft v2
npm run runtime:check             # verifie que les ressources committees sont a jour
```

Pipeline complete v3 (validate → test → package → verify → reproductibilite) :

```bash
npm run validate
npm test
npm run package
npm run package:verify
npm run package                   # seconde execution : releaseId identique = reproductible
npm run publish:dry-run -- --destination .local-publication
```

Le materializer est idempotent et deterministe. `runtime:check` echoue si les
fichiers generes ne correspondent pas au contenu committe (CI gate).

Les adaptateurs v2 vers v4 et v3 vers v4 (`tools/lib/schema_adapter.mjs`)
consignent `sourceSchema` dans `dist/runtime-adapter/adapter-report.json`. Ce
sidecar de preuve n'entre ni dans les documents runtime consommateurs, ni dans
les manifests public/prive. Leur configuration et leur provenance sont
documentees dans `config/source-adapters.json`.

## Gates GitHub

Le workflow `publish-content-azure` est uniquement manuel et uniquement depuis
`main`. Il ne contient aucun `upload-artifact`. Le job `plan` s'arrete avant
toute connexion lorsque :

- `CONTENT_PUBLISH_ENABLED` n'est pas exactement `true` ;
- un des trois targets ou Client IDs repository est absent ou invalide ;
- deux targets ou deux UAMI publisher sont identiques ;
- le package ne produit pas les trois IDs SHA-256 runtime ;
- une gate de validation, manifeste, anti-fuite ou politique echoue.

Les environnements contractuels sont :

- `azure-content-public` ;
- `azure-content-answer-key` ;
- `azure-content-release`.

Chacun fournit `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`,
`AZURE_SUBSCRIPTION_ID`, `AZURE_RESOURCE_GROUP`, `AZURE_STORAGE_ACCOUNT` et
`AZURE_STORAGE_CONTAINER`. Les valeurs compte/conteneur et Client ID sont
comparees au plan repository avant OIDC. Les trois jobs utilisent des UAMI
distinctes et des permissions limitees a `contents: read` et `id-token: write`.

## Verification Blob et WORM

Pour chaque prefixe, le script :

1. refuse les symlinks et une identite incoherente avec le chemin ;
2. refuse un conteneur anonyme ;
3. exige une policy WORM temporelle positive et `Locked`, sans append protege ;
4. cree uniquement les blobs absents avec OAuth et `--overwrite false` ;
5. relit chaque blob et compare son SHA-256 ;
6. exige `application/json`, le Cache-Control attendu, un `versionId`, une
   policy de blob `Locked` et une retention non vide ou un legal hold ;
7. compare la liste distante exacte au plan.

Le workflow ne supprime rien, ne modifie aucune policy et ne deplace aucun
alias. Une collision ou un blob supplementaire bloque la publication.

## Procedure operateur

1. Verifier que #290 est provisionne et que les trois Environments/variables
   correspondent exactement a ses outputs.
2. Verifier que les policies WORM sont `Locked` avant le pilote staging.
3. Lancer le workflow manuellement depuis `main` et approuver separement les
   environnements public, answer-key puis release.
4. Conserver les trois IDs du job summary et les logs de relecture.
5. Importer ensuite le `releaseId` en staging selon le runbook #304. La
   publication n'effectue ni import, ni promotion, ni bascule de feature flag.

En cas d'echec avant le descripteur, corriger la cause et relancer : les blobs
identiques sont acceptes idempotemment. En cas de collision, ne jamais
overwrite ou delete; produire une nouvelle release ou escalader l'anomalie.
