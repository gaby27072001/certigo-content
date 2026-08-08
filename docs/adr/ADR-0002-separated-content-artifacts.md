# ADR-0002 - Artefacts public et answerKey strictement separes

- Statut : Accepte (Phase 2, lot wp-p2-03)
- Date : 2026-08-06
- Portee : empaquetage et publication CI de `certigo-content`

## Contexte

Les repertoires editoriaux `content/public` et `content/answerKey` etaient
distincts, mais l'ancien manifeste et son artefact CI melangeaient encore les
deux canaux. Une erreur de publication pouvait donc exposer un corrige.

## Decision

`node tools/package_content.mjs` valide d'abord le corpus, supprime entierement
la sortie cible, puis genere :

- `dist/public` : questions canonisees et manifeste public ;
- `dist/private` : solutions canonisees et manifeste `answerKey` ;
- `dist/reports` : resume machine et rapport de gate anti-fuite.

Les deux artefacts ne partagent aucun fichier ni manifeste. Chaque manifeste
declare tous les fichiers de payload de son repertoire ; seul `manifest.json`
est exclu de cette liste, car son `manifestId` est le hash du corps canonique du
manifeste. Chaque entree porte le SHA-256 et la taille des octets effectivement
publies. La verification refuse tout fichier absent, supplementaire ou altere. Le schema
et le verificateur imposent aussi les couples `public/public/questions` et
`private/answerKey/solutions`, puis exigent l'egalite entre l'id du manifeste,
le nom du fichier et `payload.id`.

Les payloads JSON sont serialises avec les cles triees, sans espace, en UTF-8 et
avec un LF final. Aucun timestamp ni chemin absolu n'est emis. Deux executions
sur le meme commit sont donc identiques octet pour octet.

## Gate anti-fuite

La gate inspecte recursivement la sortie finale `dist/public`, pas seulement les
sources. Elle refuse :

- tout lien symbolique ou type de fichier non regulier ;
- tout segment de chemin contenant `answerKey` ;
- toute cle JSON `correct` ou `rationale`, a n'importe quelle profondeur ;
- les memes motifs dans les octets bruts ;
- tout fichier non declare ou dont le hash/taille diverge.

`tools/check_artifact_access.mjs` analyse tous les jobs de tous les workflows
ainsi que toutes les actions composites locales, independamment de leur nom.
Chaque `actions/download-artifact` doit fournir un `with.name` non vide et
statique. Un artefact prive n'est permis que si le triplet exact
workflow/job/name (ou action/runs/name) figure dans
`.github/artifact-access-policy.json`. Le controle parcourt aussi toutes les
autres valeurs de la definition complete et refuse les references privees via
commande `gh`, appel `curl`, action tierce, chemin `dist/private` ou
`answerKey`; seule la valeur `with.name` du `download-artifact` explicitement
allow-listee est exclue de ce scan.
Les jobs qui produisent legitimement le canal prive doivent apparaitre dans
`privateReferenceScopes` par leur couple workflow/job exact. Cette autorisation
de scope ne dispense jamais un `download-artifact` prive de sa propre entree
exacte dans `privateArtifactDownloads`.

## Publication, retention et immutabilite

`.github/workflows/ci-content-package.yml` publie :

- `certigo-content-public-sha256-<hash>` pendant 90 jours ;
- `certigo-content-private-sha256-<hash>` pendant 30 jours.

Les deux publications ont lieu uniquement sur `main` ou lancement manuel,
jamais depuis une pull request. Les PR executent la construction et toutes les
gates mais ne consomment pas le quota de stockage d'artefacts.

Le suffixe `sha256-<hash>` est la representation GitHub-compatible du
`manifestId` `sha256:<hash>` (le caractere `:` est interdit dans un nom
d'artefact GitHub). Un nom donne identifie des octets immuables. Une evolution
du contenu produit un nouveau nom ; aucune release ni alias `latest` n'est
active automatiquement.

Le workflow historique conserve seulement le self-check de l'ancien manifeste
pour la compatibilite et le rollback. Il ne publie plus l'artefact mixte.

## Procedure de publication

1. Executer `npm ci`, `npm test`, `npm run package` et
   `npm run package:verify`.
2. Fusionner sur `main` apres passage des gates.
3. Recuperer les deux artefacts par leur nom complet derive du `manifestId`.
4. Pour un consommateur mobile, allow-lister exclusivement le nom
   `certigo-content-public-sha256-*`; ne jamais telecharger tous les artefacts
   d'un run.

## Rollback

Desactiver `.github/workflows/ci-content-package.yml` et restaurer les etapes de
generation/publication de `.github/workflows/ci-content-manifest.yml` depuis le
commit anterieur a wp-p2-03. Les repertoires `dist/` sont ephemeres et ignores
par Git ; aucune release, aucun pointeur mutable et aucun deploiement externe
n'etant active par ce lot, le rollback ne requiert aucune migration de donnees.

## Hors perimetre

Ce lot ne modifie ni le backend (#244), ni le mobile (#243), ni les formats de
contenu (#245). Il fournit uniquement les artefacts et les gates que ces lots
consommeront plus tard.
