# certigo-content

Source editoriale privee du contenu Certigo. Le depot conserve deux espaces :

- `content/public/questions/` contient les questions distribuables sans reponse ;
- `content/public/catalog/` et `content/public/coverage/` contiennent le
  catalogue officiel et les matrices de couverture distribuables ;
- `content/public/runtime/` contient le graphe canonique reference-only ;
- `content/answerKey/solutions/` contient les corriges sensibles.

Cette separation est aussi une frontiere de distribution : l'outillage produit
des artefacts `public` et `private` independants, avec des manifestes et hashes
distincts. La gate machine inspecte la sortie publique finale avant publication.

## Prerequis

- Node.js `20.20.2` (voir `.nvmrc`) ;
- npm `10.8.2`, fourni avec cette version de Node.

Les versions des dependances sont exactes dans `package.json` et leur graphe
complet est verrouille dans `package-lock.json`.

## Installation locale

```bash
nvm use
npm ci
```

`runtime:compile` est un adaptateur local : il projette un contrat canonique
runtime v3 vers les documents historiques `Track`, `Lesson` et
`LessonAnswerKey`. Il n'effectue aucun upload ni acces Cosmos. Le contrat et sa
migration sont documentes dans
[`ADR-0005`](docs/adr/ADR-0005-canonical-runtime-content-contract.md).

`npm ci` est la seule commande d'installation utilisee en CI. Elle refuse un
ecart entre `package.json` et le lockfile et reproduit donc le meme graphe pour
un commit donne.

## Commandes

| Commande | Role |
| --- | --- |
| `npm test` | Execute les tests avec la couverture native Node et, si le runtime les supporte, les seuils lignes 80 %, fonctions 75 %, branches 70 %. |
| `npm run validate` | Valide le corpus reel : schemas, bijection et anti-fuite. |
| `npm run catalog:freshness` | Controle sans reseau l'age du snapshot et les transitions de cycle de vie ; accepte `-- --as-of YYYY-MM-DD`. |
| `npm run manifest:check` | Verifie le determinisme, le vecteur golden et le schema du manifeste. |
| `npm run manifest:generate` | Genere le manifeste mixte historique, reserve au rollback. |
| `npm run package` | Nettoie `dist/`, valide le corpus et produit les deux artefacts. |
| `npm run package:public` | Nettoie et regenere `dist/public` sans supprimer `dist/private`. |
| `npm run package:private` | Nettoie et regenere `dist/private` sans supprimer `dist/public`. |
| `npm run package:verify` | Revalide fichiers, tailles, hashes et gate anti-fuite dans `dist/`. |
| `npm run runtime:compile` | Projette localement le contrat canonique vers les documents runtime historiques. |
| `npm run policy:artifact-access` | Exige un nom pour chaque download-artifact et refuse le prive hors allow-list explicite. |

Les payloads publies sont canonises et les manifestes n'incluent ni timestamp
ni chemin dependant de la machine. Deux executions sur le meme commit sont
identiques octet pour octet. Les artefacts GitHub temporaires sont uniquement
crees par lancement manuel avec l'option explicite d'upload ; leurs noms
integrent leur `manifestId`. Voir
[`ADR-0002`](docs/adr/ADR-0002-separated-content-artifacts.md) pour la
retention, l'immutabilite, la publication et le rollback.

## Contribution

1. Modifier les paires JSON correspondantes dans les deux espaces.
2. Executer `npm test`.
3. Executer `npm run validate`.
4. Executer `npm run manifest:check`.
5. Executer `npm run package` puis `npm run package:verify`.

Une question publique, le catalogue et les matrices ne doivent contenir aucune
cle `correct` ou `rationale`.
Chaque identifiant public doit posseder exactement une solution et
reciproquement. Pour v2/v3, `solution.correct` doit etre une valeur de
`question.choices`. Pour v4, chaque `solution.correctOptionIds` doit referencer
un `question.options[].id`. Les comparaisons sont strictes : aucune conversion de casse, aucun trim et
aucune normalisation Unicode ne sont appliques. Le manifeste est deterministe :
toute modification semantique
du corpus change son hash, tandis que l'ordre des cles et la mise en forme JSON
ne le changent pas.

Les payloads historiques `v2` restent valides et a plat. Les paires
multi-cloud metadata-only utilisent `v3`; le contrat runtime utilise `v4`. Les
deux variantes namespacees utilisent un ID
`provider.certification.objective.slug.sequence` et des chemins symetriques
`questions/<provider>/<certification>/` /
`solutions/<provider>/<certification>/`.

Les matrices editoriales et leurs sources officielles sont consolidees dans
[`docs/coverage/certifications/`](docs/coverage/certifications/README.md). Cet
index couvre AI-901, AZ-900, AZ-104, DP-900, ainsi que le catalogue et les 26
matrices AWS / Google Cloud du snapshot 2026-08-17.

Les choix d'identite, provenance, versioning et cycle de vie sont fixes par
[`ADR-0004`](docs/adr/ADR-0004-multi-cloud-editorial-foundation.md).

Le manifeste de paquet couple strictement `artifact`, `channel`, le repertoire
du `path`, l'identifiant du nom de fichier et `payload.id`. La politique
`.github/artifact-access-policy.json` est globale a tous les workflows ; toute
exception de telechargement prive doit y nommer exactement le workflow, le job
et l'artefact. Les jobs producteurs autorises sont eux aussi listes exactement
par workflow/job. Toute autre reference au canal prive dans une definition
complete de job ou d'action locale (`gh`, `curl`, action tierce, chemin prive,
etc.) est refusee.

## Promotion Azure

La promotion durable vers Azure Blob Storage est manuelle, limitee a `main` et
protegee par deux GitHub Environments independants. Elle utilise GitHub OIDC,
publie chaque canal sous son `manifestId`, verifie les SHA-256 apres upload et
ne cree aucun alias mutable. Elle ne provisionne aucune ressource et
n'interagit pas avec les deploiements Certigo existants.

Les prerequis Azure/GitHub, la retention WORM, le lifecycle et le rollback sont
documentes dans
[`ADR-0003`](docs/adr/ADR-0003-azure-immutable-promotion.md).

## Securite de l'outillage

La CI execute `npm audit` et OSV Scanner sur `package-lock.json`. Les alertes
restent visibles meme lorsqu'aucune version corrigee n'est encore publiee ;
les vulnerabilites critiques sont bloquantes. La CI genere egalement un SBOM
CycloneDX de l'outillage et le publie comme artefact.
