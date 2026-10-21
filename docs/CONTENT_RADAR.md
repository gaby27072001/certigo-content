# Content Radar : decouvrir sans publier aveuglement

## Perimetre livre

Le registre `config/content-radar-sources.json` couvre **35 groupes de fournisseurs**
dans les sept categories demandees. Le nom de travail « Top 30 » n'est pas un
classement mondial mesure. `linux-foundation-cncf` et `pmi-scrum` regroupent des
organismes distincts ; PMI et Scrum.org ne sont pas un organisme unique.
Une presence dans le registre ne prouve ni l'existence d'une certification,
ni une offre exhaustive, ni un partenariat avec Certigo.

Le CLI livre la validation du registre, la capture publique bornee, le rejeu
deterministe de snapshots, des deltas et des **brouillons de revue**. Il ne cree
aucun cours/question, ne modifie pas les 33 certifications du catalogue v1,
ne change pas le runtime, les goldens ou les artefacts public/private, et
ne publie rien. Les pages, liens et textes distants sont des donnees non fiables,
jamais des instructions a executer.

## Utilisation

Depuis la racine du depot, avec les dependances existantes :

```powershell
npm run radar:check
npm run radar:check -- --live --out ..\radar-first-capture
npm run radar:check -- --live --known ..\radar-first-capture\snapshot.json --out ..\radar-next-capture
npm run radar:check -- --known ..\radar-first-capture\snapshot.json --snapshot ..\radar-next-capture\snapshot.json --out ..\radar-replay
node --test test\content_radar.test.mjs
```

Sans argument, seule la validation hors ligne est executee : ce n'est pas
une preuve de disponibilite des sites. `--live` effectue des GET publics sans
compte, cookie, navigateur partage ou cle. Les sorties doivent etre hors du depot,
dans un **nouveau** dossier : `snapshot.json` contient les octets captures encodes
en base64 et `radar-delta-report.json` les constats et brouillons. Ne pas versionner
les captures de pages fournisseur. Ne pas remettre les brouillons dans `content/`.
Le parent du dossier de sortie doit deja exister ; les jonctions/liens du parent
sont resolus pour empecher une sortie indirecte dans le depot.

`--known` est un snapshot precedent conserve par l'operateur, pas le catalogue
de production : la promotion d'un nouveau baseline doit etre explicite apres
revue. Aucun baseline n'est ecrase automatiquement. Sans baseline pour un endpoint,
les liens sont un `initial_inventory`, pas de nouvelles annonces.

### Contrat des snapshots

`schemaVersion` vaut `certigo.content-radar-snapshot/v1`. `captures` contient
`providerId`, `endpointId`, URL finale `url`, `observedAt` ISO UTC canonique
(par exemple `2026-10-21T08:00:00.000Z`), `contentType`, `bodyBase64` et le
`sha256` des **octets decodes**. Les fixtures de test sont originales et fictives :
elles ne constituent pas une annonce OpenAI, Anthropic ou NVIDIA.

Les origines HTTPS sont exactes, sans sous-domaines implicites, authentification,
port ou fragment. Chaque redirection est revalidee avant tout appel ; trois sauts,
quatre requetes simultanees, dix secondes par endpoint et 2 Mio par reponse au
maximum. Un echec HTTP, de type, de hash ou d'analyse est explicite. Le CLI rend
un code non nul si une capture live echoue et conserve les echecs dans le rapport.
Ne jamais transformer un 403/404 ou un resultat vide en retrait de formation.

Un snapshot fourni hors ligne atteste l'integrite de ses octets, **pas leur
authenticite**. Le SHA256 n'est pas une signature du fournisseur. Conserver la
chaine de capture et faire verifier les annonces par un auteur.

### Adaptateurs et limites de couverture

- `html-links` lit les ancres citees dont le titre mentionne formation, course,
  training ou certification. Ce sont des **candidats heuristiques**, souvent des
  liens de navigation. Les liens externes sont ignores et jamais suivis. Les
  scripts ne sont pas executes. Une SPA, un lien sans mot-cle, une page protegee,
  une nouvelle langue ou une pagination peuvent cacher une offre.
- `json-items` attend un flux public deja compatible :
  `{"items":[{"url":"https://origine-autorisee/exemple","title":"Titre","kind":"training"}]}`.
  `kind` accepte `training` ou `certification`. Une API proprietaire exige un
  adaptateur explicite ; le CLI n'invente pas son mapping.
- `blueprint` surveille les octets d'un document configure, relie a `itemUrl`.
  Un changement produit `blueprint_changed`, **pas** une interpretation des
  ponderations, ni un nouveau pack. Aucun document supplementaire n'est explore
  automatiquement depuis les liens HTML.

Les endpoints initiaux sont des points d'entree officiels de decouverte, pas
35 connecteurs exhaustifs deja certifies en production. En particulier, Microsoft
Learn Browse est une SPA : pour une couverture exhaustive, integrer son API
publique avec pagination et mapping testes (le format brut de cette API n'est
pas `json-items`). Les portails LMS, redirections et protections anti-bot exigent
une verification operationnelle avant activation. Ne pas etendre l'allowlist
simplement pour contourner une erreur : verifier officiellement la destination.
Exemples resolus lors de la verification initiale : la page officielle
`https://www.anthropic.com/learn` redirige vers `https://academy.claude.com/` ;
`https://www.atlassian.com/university` vers
`https://community.atlassian.com/learning` ; le depot officiel
`https://github.com/skills` renvoie a `https://learn.github.com/skills`.
Le registre vise ces destinations, sans confiance automatique dans leurs autres
sous-domaines.
Le schema du registre, demande sous `schemas/`, est explicitement exclu de
l'assertion de parite des schemas importes par le backend : il n'est jamais un
payload livre. La copie backend, ses empreintes et tous les controles effectifs
de paquet restent inchanges.

Chaque rapport donne les endpoints observes/non observes et la nature limitee de
leur couverture. `source_changed` signale tout changement d'octets, y compris du
bruit dynamique ; `item_changed` signale titre/type change ; `new_item` signifie
nouveau dans cet endpoint par rapport au snapshot fourni, pas nouvelle offre
mondiale ou nouvelle date de lancement. L'absence ne produit jamais de retrait.
Un brouillon a `status: "announced"` comme **statut propose**, avec
`verificationState: "needs-editorial-review"`, `announcedOn: null`,
`publishable: false`, zero question et la provenance source/hash/date.
Il n'est pas une entree valide du schema ferme `certigo.certification-catalog/v1`.

## Objectif 08h00 → 08h05 → 08h30, pas une garantie

**08h00 Detection** : un scheduler futur consulte les sources selon leur cadence,
respecte robots/conditions, limites de requetes, backoff et indisponibilites,
archive les preuves et emet les deltas. Les cadences 15 a 60 minutes sont une
configuration cible, pas un service installe : elles ne garantissent ni detection
a la seconde ni meme avant 08h05. Aucun scheduler, webhook ou SLA n'est livre ici.
Sur fixture, les trois nouvelles formations sont detectees en moins de deux
secondes, sans reseau ; ce n'est pas une mesure de latence des sites reels.

**08h05 Fiche Announced** (`stage1_announced_card`) : apres verification humaine
du type d'offre, de l'annonce officielle, de son titre, de sa date, de la langue
et des droits de reutilisation, un brouillon peut etre propose. Une simple
nouvelle ancre ne suffit pas. Pas de fausse question, preparation officielle,
score de readiness ou promesse de disponibilite immediate dans l'app. Rendre cette
fiche visible demande encore un contrat backend/app compatible et une UX distincte
des parcours pratiques disponibles ; le present changement ne les livre pas.

**08h30 Pack Verifie OTA** (`stage2_blueprint_and_pack`) : objectif conditionnel,
jamais une publication programmee. Avant tout pack : lire le blueprint officiel,
verifier versions/domaines/langues/lifecycle, creer un contenu original (sans dumps
d'examen ni copie fournisseur), faire une revue factuelle/pedagogique, verifier
la separation questions/reponses, les schemas acceptes par le backend deploye,
les gardes produit, la couverture, les tests et les artefacts deterministes.
Ensuite seulement, approbation de publication et canal OTA existant. Si un gate
echoue ou si aucun blueprint n'existe, rester au brouillon avec le blocage documente.
Aucun generateur de questions ou bypass de publication n'est ajoute par le Radar.
