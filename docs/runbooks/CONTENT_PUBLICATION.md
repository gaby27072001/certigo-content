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
`main`. Il ne contient aucun `upload-artifact`. Ses quatre jobs exigent
simultanement `CONTENT_PUBLISH_ENABLED=true` et
`CONTENT_PUBLISHER_ATTESTED=true`; si une valeur est absente ou differente, aucun
job n'est planifie sur le pool publisher. Le job `plan` s'arrete avant toute
connexion lorsque :

- `CONTENT_PUBLISH_ENABLED` n'est pas exactement `true` ;
- `CONTENT_PUBLISHER_ATTESTED` n'est pas exactement `true` ;
- un des trois targets ou Client IDs repository est absent ou invalide ;
- deux targets ou deux UAMI publisher sont identiques ;
- le package ne produit pas les trois IDs SHA-256 runtime ;
- une gate de validation, manifeste, anti-fuite ou politique echoue.

Le plan checkout explicitement le SHA `main` porte par l'evenement, verifie
HEAD et expose `approved_sha`. Les trois jobs suivants checkout ce seul SHA,
reverifient HEAD et reconstruisent les paquets. Les jobs public et answer-key
comparent uniquement leur `manifestId`; le job descripteur compare `releaseId`
et les deux `manifestId` aux outputs du plan. Le graphe est ferme :
`publish-public` et `publish-answer-key` dependent de `plan`; `publish-release`
depend de ces trois jobs sans `always()`.

Les environments contractuels sont :

- `content-publish-plan`, sans variable, secret ni OIDC ;
- `azure-content-public` ;
- `azure-content-answer-key` ;
- `azure-content-release`.

Chacun fournit `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`,
`AZURE_SUBSCRIPTION_ID`, `AZURE_RESOURCE_GROUP`, `AZURE_STORAGE_ACCOUNT` et
`AZURE_STORAGE_CONTAINER`. Les valeurs compte/conteneur et Client ID sont
comparees au plan repository avant OIDC. Les trois jobs utilisent des UAMI
distinctes et des permissions limitees a `contents: read` et `id-token: write`.

## Contrat des pools physiques

| Usage | Selecteur workflow exact | Contrat hote |
| --- | --- | --- |
| CI PR/push/manuelle non privilegiee | `[self-hosted, Linux, X64, certigo-pr-ci]` | aucun environment, secret, OIDC, identite Azure, IMDS ou acces publisher |
| Plan et publication trusted | `[self-hosted, Linux, X64, certigo-publisher]` | runner ephemere/JIT, un job puis destruction, runner group limite au workflow publisher sur `main` |

Les labels sont litteraux et mutuellement exclusifs. `PR_RUNNER_LABELS`,
`fromJSON`, tout fallback, le label historique `certigo-ci` et un job reusable
sans `runs-on` classe sont interdits par les tests. Aucun hote ne porte les deux
labels uniques. Les hosts, disques, homes, work directories, tool/npm caches,
daemons ou sockets Docker, reseaux et service users sont distincts.

La CI utilise `pull_request_target` uniquement comme dispatcher base-trusted.
Le garde job refuse tout `head.repo.full_name` different du depot courant avant
allocation d'un runner. Une PR interne autorisee checkout ensuite son
`head.sha` exact avec `persist-credentials: false`; un fork ne peut donc ni
modifier le garde effectif, ni atteindre le pool. Ce mecanisme ne doit jamais
etre reutilise dans `publish-content-azure`.

Un runner ayant execute une pull request est considere contamine. Il reste dans
le pool PR apres reimage approuvee ou il est detruit ; il ne devient jamais
publisher par relabellisation ou cleanup. Le pool PR ne possede aucune identite
Azure, credential stockee, route vers le publisher, acces IMDS ou moyen
d'administrer ses hosts/conteneurs. Le publisher bloque IMDS et toute identite
ambiante, ne conserve aucune credential cloud et ne partage aucun daemon Docker.
`AZURE_LOGIN_PRE_CLEANUP` et `AZURE_LOGIN_POST_CLEANUP` restent des defenses
secondaires.

Deux registrations GitHub ne prouvent pas deux hosts. L'inventaire doit mapper
chaque registration a l'ID de son instance compute/VM et demontrer qu'aucun
runner PR, publisher ou d'un autre depot ne partage l'instance. Le pool PR est
ephemere ou reimage entre charges non fiables ; sa destruction ou
deallocation ne doit jamais rendre un publisher indisponible.

Avant toute activation, archiver :

1. le mapping registration vers instance compute, l'inventaire et les labels
   exclusifs des deux pools, sans cohabitation inter-depot ;
2. la provenance de l'image publisher et la preuve de destruction apres un job ;
3. les comptes de service, permissions filesystem et politiques reseau, IMDS et Docker ;
4. la restriction du runner group au workflow publisher sur `refs/heads/main` ;
5. les protections des quatre environments : reviewers, pas d'auto-approbation ou bypass administrateur, deployment branch `main` uniquement ;
6. les sujets OIDC exacts, l'audience, les trois UAMI distinctes et leurs roles container-scoped sans delete.

Tant que chaque preuve n'est pas revue, laisser
`CONTENT_PUBLISHER_ATTESTED` et `CONTENT_PUBLISH_ENABLED` absentes ou fausses.

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

1. Verifier que l'attestation des pools et des quatre environments est complete,
   archivee et approuvee.
2. Verifier que #290 est provisionne et que les trois environments
   Azure/variables correspondent exactement a ses outputs.
3. Verifier que les policies WORM sont `Locked` avant le pilote staging.
4. Activer d'abord la gate d'attestation, puis la gate de publication.
5. Lancer le workflow manuellement depuis `main` et approuver separement le
   plan, puis les environments public, answer-key et release.
6. Conserver le SHA approuve, les trois IDs du job summary et les logs de
   relecture.
7. Importer ensuite le `releaseId` en staging selon le runbook #304. La
   publication n'effectue ni import, ni promotion, ni bascule de feature flag.

En cas d'echec avant le descripteur, corriger la cause et relancer : les blobs
identiques sont acceptes idempotemment. En cas de collision, ne jamais
overwrite ou delete; produire une nouvelle release ou escalader l'anomalie.
