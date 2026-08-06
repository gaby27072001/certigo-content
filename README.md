# certigo-content

Source editoriale privee du contenu Certigo. Le depot conserve deux espaces :

- `content/public/questions/` contient les questions distribuables sans reponse ;
- `content/answerKey/solutions/` contient les corriges sensibles.

Cette separation est validee dans le depot, mais ne constitue pas encore une
frontiere de distribution. La production de paquets `public` et `answerKey`
distincts appartient au lot `wp-p2-03` et n'est pas implementee ici.

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
| `npm test` | Execute les tests de regression du validateur et du manifeste. |
| `npm run validate` | Valide le corpus reel : schemas, bijection et anti-fuite. |
| `npm run manifest:check` | Verifie le determinisme, le vecteur golden et le schema du manifeste. |
| `npm run manifest:generate` | Genere `content/manifest.json`, sortie locale non suivie par Git. |
| `npm run package` | Valide le corpus puis genere le manifeste actuel. |

La commande `package` ne produit pas de paquet de distribution et ne copie
aucun contenu vers `dist/`. Elle reste volontairement limitee au socle
reproductible de ce depot.

## Contribution

1. Modifier les paires JSON correspondantes dans les deux espaces.
2. Executer `npm test`.
3. Executer `npm run validate`.
4. Executer `npm run manifest:check`.

Une question publique ne doit contenir aucune cle `correct` ou `rationale`.
Chaque identifiant public doit posseder exactement une solution et
reciproquement. Le manifeste est deterministe : toute modification semantique
du corpus change son hash, tandis que l'ordre des cles et la mise en forme JSON
ne le changent pas.

## Securite de l'outillage

La CI execute `npm audit` et OSV Scanner sur `package-lock.json`. Les alertes
restent visibles meme lorsqu'aucune version corrigee n'est encore publiee ;
les vulnerabilites critiques sont bloquantes. La CI genere egalement un SBOM
CycloneDX de l'outillage et le publie comme artefact.
