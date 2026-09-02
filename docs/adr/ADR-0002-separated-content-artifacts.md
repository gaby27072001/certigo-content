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

Les push sur `main` et les pull requests construisent et verifient toujours les
deux paquets, leurs manifestes et leurs hashes. La supply chain reste bloquante :
tests, validation du corpus, invariants du manifeste, `npm audit`, scan OSV et
generation du SBOM sont executes sans masquer les erreurs.

GitHub Artifact n'est plus une sortie automatique. Un lancement
`workflow_dispatch` peut demander explicitement `upload_github_artifacts=true`
si le quota est disponible. Cette option publie temporairement :

- `certigo-content-public-sha256-<hash>` pendant 90 jours ;
- `certigo-content-private-sha256-<hash>` pendant 30 jours ;
- `certigo-content-tooling-sbom` pendant 30 jours.

L'upload reste strict : une demande explicite echoue si le quota est indisponible
ou si un fichier manque. Sans cette option, les etapes d'upload sont sautees et
toutes les gates precedentes restent executees.

Le suffixe `sha256-<hash>` est la representation GitHub-compatible du
`manifestId` `sha256:<hash>` (le caractere `:` est interdit dans un nom
d'artefact GitHub). Un nom donne identifie des octets immuables. Une evolution
du contenu produit un nouveau nom ; aucune release ni alias `latest` n'est
active automatiquement.

Le workflow historique conserve seulement le self-check de l'ancien manifeste
pour la compatibilite et le rollback. Il ne publie plus l'artefact mixte.

## Reconstruction et publication durable

1. Executer `npm ci`, `npm test`, `npm run package` et
   `npm run package:verify`.
2. Fusionner sur `main` apres passage des gates.
3. Reconstruire le contenu actif depuis sa revision approuvee : la serialisation
   canonique reproduit les memes octets, `manifestId` et hashes sans dependre
   d'un artefact GitHub conserve.
4. Si un diagnostic ponctuel exige un artefact GitHub, lancer manuellement le
   workflow avec `upload_github_artifacts=true` et utiliser le nom exact derive
   du `manifestId`.

La cible durable est Azure Blob Storage immuable. Elle remplacera GitHub
Artifact apres la mise en service de
[`Certigo#290`](https://github.com/gchambaud_microsoft/Certigo/pull/290).
Le workflow `publish-content-azure` reste separe, manuel et limite a `main` ;
il reconstruit et reverifie les paquets au lieu de telecharger un artefact
GitHub.

La frontiere d'execution est elle aussi separee. Les workflows CI utilisent
uniquement le label statique `certigo-pr-ci`, sans environment ni identite. Les
quatre jobs du publisher utilisent uniquement `certigo-publisher`, avec un
environment protege par job. Aucun selecteur dynamique, fallback ou reusable
workflow ne peut faire converger les pools. Le contrat physique et
l'attestation prealable sont fixes par ADR-0003 et le runbook de publication.

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

La publication durable externe est definie separement par
[`ADR-0003`](ADR-0003-azure-immutable-promotion.md). Elle conserve les deux
canaux, ne telecharge pas les artefacts GitHub et ne modifie pas le corpus.
