# ADR-0005 - Contrat canonique editorial et runtime

## Statut

Accepte le 2026-08-19.

## Contexte

La fondation multi-cloud de l'ADR-0004 publie des paires
question/solution, un catalogue de certifications et des matrices de
couverture. Son `package-manifest/v2` ne decrit toutefois pas le graphe
consomme par Certigo :

- `Track`, `ExamDomain` et `TrackUnit` ;
- `Lesson`, ses blocs ordonnes et leurs `conceptId` ;
- les options a identite stable, le type d'item et la difficulte ;
- `LessonAnswerKey`, garde cote serveur.

Le runtime historique compile des fichiers YAML riches puis les charge dans
Cosmos. Le script `tools/seed_content.py` du depot Certigo duplique aujourd'hui
les questions dans les lessons et extrait un document answer key. En parallele,
les nouvelles certifications AWS et Google Cloud sont naturellement des
banques rattachees a un blueprint et ne justifient pas toutes un parcours
pedagogique complet.

Une seule personne administre le contenu. Le contrat doit donc reduire les
editions synchrones et ne creer aucune seconde source de verite.

## Options evaluees

### Option A - bundle runtime complet course graph

Chaque release contient des tracks, units, lessons, blocs, questions integrees
et answer keys deja formes pour `CosmosContentRepository`.

Preuves en faveur :

- la forme correspond exactement aux records `Track`, `Lesson` et
  `LessonAnswerKey` du runtime ;
- aucun join n'est necessaire a l'import ;
- les quatre parcours Microsoft historiques sont deja auteurs sous cette forme.

Limites observees :

- une question et ses options sont repetees dans une lesson et une banque ;
- le rattachement domaine/concept/couverture peut diverger entre copies ;
- AWS/GCP devraient recevoir des units et lessons artificielles au niveau
  editorial, meme lorsque seule une banque est planifiee ;
- toute evolution du modele Cosmos deviendrait une evolution du contrat
  editorial canonique.

### Option B - question-bank/domain modules avec adaptation

La question publique, ses options stables, son concept et son domaine sont
canoniques. Les parcours riches ne stockent que des references. Une projection
deterministe reconstitue les anciens documents Cosmos.

Preuves en faveur :

- le catalogue et la couverture de l'ADR-0004 sont deja organises par
  certification et objectif de blueprint ;
- la paire question/solution est la seule donnee qui traverse les trust zones ;
- les questions AWS/GCP peuvent exister sans parcours artificiel ;
- un changement de stockage runtime ne reecrit pas le contenu editorial.

Limites :

- l'import doit executer un join valide et versionne ;
- le mode question-bank doit etre projete pour le runtime lesson-centrique.

## Decision

L'option B est retenue avec une couche de composition de parcours
**reference-only**. Cette couche est necessaire pour conserver la richesse des
parcours Microsoft, mais elle n'est pas une seconde source de verite :

- un bloc `check` contient seulement `questionId` ;
- les stems, options, types et difficultes vivent uniquement dans la question ;
- les bons `optionId` et l'explication vivent uniquement dans la solution ;
- le titre et le poids d'un domaine d'examen vivent uniquement dans le
  blueprint du catalogue ;
- une ressource `domain` ne fait que lier un `domainId` runtime stable a un
  `objectiveId` du blueprint.

Le contrat canonique est independant de Cosmos. `tools/compile_runtime.mjs` est
un adaptateur de compatibilite, pas un auteur de contenu.

## Contrat de ressources

### Resource types publics

| `resourceType` | Role canonique |
| --- | --- |
| `certificationCatalog` | Fournisseurs, certifications et blueprints |
| `coverageMatrix` | Liens objectifs vers questions publiques |
| `track` | Mode `guided` ou `questionBank`, ordre des domaines et units |
| `domain` | Lien stable vers un objectif du blueprint |
| `unit` | Groupe ordonne de lessons d'un parcours guide |
| `lesson` | Blocs ordonnes par reference |
| `concept` | Unite atomique de maitrise, rattachee a un domaine |
| `question` | Item public canonique et options stables |

Le canal prive n'accepte que `solution`. Il n'existe pas de graphe runtime
prive : l'adaptateur joint les solutions aux questions au moment de la
projection.

### Identifiants stables

Les IDs canoniques ne sont jamais reutilises :

```text
track    <provider>.<certification>.track.<slug>
domain   <provider>.<certification>.domain.<slug>
unit     <provider>.<certification>.unit.<slug>
lesson   <provider>.<certification>.lesson.<slug>
concept  <provider>.<certification>.concept.<slug>
block    <lessonId>.block.<sequence-3-chiffres>
question <provider>.<certification>.<objective>.<slug>.<sequence-3-chiffres>
```

Un `legacyId` optionnel preserve l'identite deja utilisee par la progression,
les tentatives et Cosmos. Il est unique et immutable. L'adaptateur le prefere a
l'ID canonique lors de la projection historique.

Les option IDs sont locaux a une question, descriptifs, uniques et independants
de l'ordre d'affichage. Reordonner les options ne change donc jamais la bonne
reponse.

### Question et solution v4

`question/v4` ajoute :

- `metadata.domainId` et `metadata.conceptId` ;
- `itemType` ferme a `mcq`, `multi`, `scenario` et `spotTheIssue` ;
- `difficulty` de 1 a 3 ;
- `options[]` fermees avec `id` et `label`.

`matchPairs`, `cloze`, `ordering` et `applied` restent hors de v4 : le modele
runtime historique ne porte pas encore leur structure ou leur notation
complete. Ils exigeront un contrat versionne et une adaptation runtime
explicite plutot qu'un encodage ambigu dans `options`.

`solution/v4` contient uniquement le meme `id`, `correctOptionIds` et
`rationale`. La metadata n'est pas dupliquee dans le canal prive.

### Question et solution v5 (expand du 2026-09-25)

`question/v5` et `solution/v5` sont la variante « un contrat par type » specifiee
par Certigo : `docs/contracts/exercise-items/v5/README.md` de
`gchambaud_microsoft/Certigo`, revision
`6562c293852592f727d7b61e2d792070752a67cf`, et son ADR-022. Les schemas
de ce depot en integrent les propositions a l'identique dans leurs `oneOf` ; v2,
v3 et v4 ne changent pas.

- `itemType` couvre les huit types : `mcq`, `multi`, `scenario`,
  `spotTheIssue`, `ordering`, `applied`, `cloze` et `matchPairs`.
- `matches[]` porte la colonne droite, **uniquement** pour `matchPairs`.
- Le corrige porte aussi `itemType`, ce qui permet au schema seul d'imposer les
  cardinalites par type. Pour `matchPairs`, `correctOptionIds` contient des
  jetons `"<idGauche>:<idDroite>"`.
- `applied` est un sous-ensemble ordonne d'au moins deux etapes : les options
  absentes du corrige sont des distracteurs.
- La cle `pairs` rejoint les cles interdites cote public.

Les regles croisees X1 a X9 (section 5 du contrat) sont codees une seule fois dans
`tools/lib/exercise_v5.mjs`. Le validateur les applique aux sources, et le
packager les rejoue sur les artefacts construits (`verifyExercisePairs`). Rien ne
reordonne les options a la publication : X8 (`ordering`, `applied`) et X9
(`matchPairs`) exigent que l'ordre publie ne donne pas la reponse. Elles
remplacent la publication « triee par id » de la premiere version d'ADR-022, qui
revelait la reponse des que les id encodaient le rang.

Aucun contenu v5 n'est publie tant que le backend ne l'accepte pas. La garde
`npm run contract:backend` refuse tout paquet v5 jusqu'a la resynchronisation de
`config/backend-accepted-schemas/`, apres que Certigo a embarque et deploye v5.

**Garde provisoire de publication (2026-09-25).** L'app ne sait pas encore valider
une selection partielle : un item `applied` avec distracteurs, conforme au contrat
(X5), serait impossible a reussir. Le packager le refuse donc a la publication
(`[v5:garde-applied]`) tant que `allowAppliedDistractors` vaut `false` dans
`config/exercise-publication-guards.json`. C'est la valeur du depot, et un fichier
ou un reglage absent laisse aussi la garde active. Le validateur ne l'applique pas,
parce que ce n'est pas une regle du contrat. On la leve en passant le reglage a
`true`, une fois que Certigo a livre et deploye cette interface ; Certigo applique
la meme garde cote legacy.

L'appariement bijectif est exige **uniquement** entre question et solution. Les
autres ressources publiques utilisent des references validees mais n'ont aucun
miroir prive.

### Parcours guides et banques

Un track `guided` exige au moins une unit. Chaque lesson contient des blocs
ordonnes `hook`, `concept`, `example`, `code`, `check` ou `recap`. Un bloc
`check` reference exactement une question v4 du meme concept et du meme
domaine.

Un track `questionBank` ne contient ni unit ni lesson canonique. Pour maintenir
la compatibilite avec le runtime actuel, l'adaptateur synthese
deterministiquement une unit et une lesson de pratique par domaine. Cette
projection ne revient jamais dans le depot editorial.

## Blueprint et cycle de vie

Toutes les ressources d'une certification portent le meme
`blueprintVersion`. Un `domain.objectiveId` doit exister dans ce snapshot, et
la question doit porter le meme `metadata.objective`.

Le cycle de vie runtime est ferme :

- `planned` : non actif pour l'apprentissage ;
- `active` : distribuable ;
- `retiring` : distribuable jusqu'a la transition catalogue ;
- `retired` : conserve pour historique/rollback, avec `retiredOn` ;
- `replaced` : conserve avec `replacedBy`.

Une ressource active sous une certification retiree ou remplacee est invalide.
Une nouvelle version de blueprint ne modifie pas silencieusement les ressources
existantes : elle exige une migration explicite et une nouvelle release.

## Manifestes et releases

### Compatibilite

| Corpus | Question/solution | Content manifest | Package manifest |
| --- | --- | --- | --- |
| Historique sans catalogue | `v2` | `v1` | `v1` |
| Fondation catalogue/couverture | `v2` ou `v3` | `v2` | `v2` |
| Contrat runtime canonique | `v2`, `v3`, `v4` et `v5` | `v3` | `v3` |

La presence d'au moins une ressource sous `content/public/runtime/**` active le
mode v3. Le simple ajout du catalogue ne change donc pas les manifestes v2 de
la PR #20. Les packages v1/v2 restent byte-identical et n'emettent pas de
`release.json`; le descripteur de release est propre au mode runtime v3.

### Canonicalisation, hashes et tailles

Les payloads du content manifest utilisent
`json-sorted-keys-compact-utf8` :

- hash item = SHA-256 du JSON canonique sans LF ;
- taille item = nombre d'octets UTF-8 de ce JSON ;
- root hash = SHA-256 du corps canonique sans `rootHash` ni `manifestId`.

Les fichiers de package utilisent
`json-sorted-keys-compact-utf8-lf` :

- chaque fichier se termine par un LF ;
- `hash` et `size` couvrent les octets effectivement distribues, LF inclus ;
- le manifeste de canal est adresse par le hash de son corps canonique.

`dist/release.json` reste hors des racines `public` et `private` pour eviter un
cycle. Son corps contient :

```json
{
  "schema": "certigo.content.release/v1",
  "algorithm": "sha256",
  "canonicalization": "json-sorted-keys-compact-utf8",
  "publicManifestId": "sha256:...",
  "privateManifestId": "sha256:..."
}
```

`releaseId` est le SHA-256 canonique de ce corps. Le public peut etre active et
cache par `publicManifestId`; l'import atomique public/prive est idempotent par
`releaseId`.

## Projection vers Certigo

`tools/compile_runtime.mjs` produit :

- documents publics `Track` et `Lesson` sans reponse ;
- documents prives `LessonAnswerKey` avec `correctOptionIds`, explication,
  type et difficulte ;
- IDs historiques lorsqu'un `legacyId` est fourni ;
- units/lessons de pratique derivees pour les tracks `questionBank`.

La projection refuse un corpus invalide et passe la gate anti-fuite sur sa
sortie publique. Elle ne publie ni ne charge Cosmos.

## Impact sur Certigo #244

L'import backend doit :

1. verifier les schemas v1/v2/v3 acceptes ;
2. verifier tous les hashes et tailles avant mutation ;
3. joindre public/prive par la release et projeter les documents runtime ;
4. rendre l'import idempotent par `releaseId` ;
5. enregistrer `releaseId`, `publicManifestId` et la release precedente ;
6. garder les containers/acces public et answer key distincts ;
7. promouvoir ou restaurer un pointeur de release, jamais reecrire un artefact.

## Impact sur Certigo #243

Le mobile ne telecharge que le package public. Il doit :

1. comparer le `publicManifestId` actif au cache ;
2. accepter package-manifest v1/v2/v3 ;
3. verifier hash et taille de chaque fichier ;
4. activer atomiquement un cache complet ;
5. conserver le dernier `publicManifestId` valide ;
6. ne jamais recevoir `privateManifestId`, solution ou answer key.

Une tentative historique continue d'utiliser les `legacyId`. Le
`publicManifestId` associe a la tentative permet au backend de resoudre le
contenu exact meme apres une promotion.

## Migration du contenu historique

La migration est progressive et n'edite pas les vagues existantes dans cette
PR :

1. ajouter au catalogue les certifications Microsoft et leur blueprint ;
2. creer les ressources `track/domain/unit/lesson/concept` en conservant les
   IDs runtime dans `legacyId` ;
3. convertir chaque paire v2 en v4 sans changer son texte, avec des option IDs
   stables ;
4. remplacer les checks integres par des `questionId` dans les lessons
   canoniques ;
5. verifier que la projection est semantiquement equivalente aux documents
   historiques ;
6. publier une nouvelle release immuable seulement apres adaptation de #244 et
   #243 ;
7. conserver les anciennes releases pour tentatives, rollback et audit.

Les fixtures de ce depot prouvent la forme avec AZ-900, AI-900, DP-900, SC-900
et une banque AWS CLF-C02 planifiee. Elles sont minimales et ne copient aucun
dump historique.

## Consequences

- Questions, options, difficultes et solutions ont une seule source canonique.
- Les parcours Microsoft riches restent exprimables.
- AWS/GCP peuvent commencer comme banques puis devenir guides sans casser les
  IDs de questions.
- Le runtime actuel reste compatible via une projection testee.
- Les consommateurs doivent adopter manifest/package v3 avant la premiere
  release runtime.
- Toute publication ou fusion reste hors du perimetre de cette decision.
