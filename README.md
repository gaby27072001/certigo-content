# certigo-content

Source editoriale privee du contenu Certigo. Le depot conserve deux espaces :

- `content/public/questions/` contient les questions distribuables sans reponse ;
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

`npm ci` est la seule commande d'installation utilisee en CI. Elle refuse un
ecart entre `package.json` et le lockfile et reproduit donc le meme graphe pour
un commit donne.

## Commandes

| Commande | Role |
| --- | --- |
| `npm test` | Execute les tests avec la couverture native Node et, si le runtime les supporte, les seuils lignes 80 %, fonctions 75 %, branches 70 %. |
| `npm run validate` | Valide le corpus reel : schemas, bijection et anti-fuite. |
| `npm run manifest:check` | Verifie le determinisme, le vecteur golden et le schema du manifeste. |
| `npm run manifest:generate` | Genere le manifeste mixte historique, reserve au rollback. |
| `npm run package` | Nettoie `dist/`, valide le corpus et produit les deux artefacts. |
| `npm run package:public` | Nettoie et regenere `dist/public` sans supprimer `dist/private`. |
| `npm run package:private` | Nettoie et regenere `dist/private` sans supprimer `dist/public`. |
| `npm run package:verify` | Revalide fichiers, tailles, hashes et gate anti-fuite dans `dist/`. |
| `npm run policy:artifact-access` | Exige un nom pour chaque download-artifact et refuse le prive hors allow-list explicite. |

Les payloads publies sont canonises et les manifestes n'incluent ni timestamp
ni chemin dependant de la machine. Deux executions sur le meme commit sont
identiques octet pour octet. Les noms d'artefacts CI integrent leur
`manifestId`; voir
[`ADR-0002`](docs/adr/ADR-0002-separated-content-artifacts.md) pour la
retention, l'immutabilite, la publication et le rollback.

## Contribution

1. Modifier les paires JSON correspondantes dans les deux espaces.
2. Executer `npm test`.
3. Executer `npm run validate`.
4. Executer `npm run manifest:check`.
5. Executer `npm run package` puis `npm run package:verify`.

Une question publique ne doit contenir aucune cle `correct` ou `rationale`.
Chaque identifiant public doit posseder exactement une solution et
reciproquement. `solution.correct` doit etre une valeur de `question.choices`
selon l'egalite stricte JavaScript (`===`) : aucune conversion de casse, aucun
trim et aucune normalisation Unicode ne sont appliques. Le manifeste est
deterministe : toute modification semantique
du corpus change son hash, tandis que l'ordre des cles et la mise en forme JSON
ne le changent pas.

Le manifeste de paquet couple strictement `artifact`, `channel`, le repertoire
du `path`, l'identifiant du nom de fichier et `payload.id`. La politique
`.github/artifact-access-policy.json` est globale a tous les workflows ; toute
exception de telechargement prive doit y nommer exactement le workflow, le job
et l'artefact. Les jobs producteurs autorises sont eux aussi listes exactement
par workflow/job. Toute autre reference au canal prive dans une definition
complete de job ou d'action locale (`gh`, `curl`, action tierce, chemin prive,
etc.) est refusee.

## Securite de l'outillage

La CI execute `npm audit` et OSV Scanner sur `package-lock.json`. Les alertes
restent visibles meme lorsqu'aucune version corrigee n'est encore publiee ;
les vulnerabilites critiques sont bloquantes. La CI genere egalement un SBOM
CycloneDX de l'outillage et le publie comme artefact.
