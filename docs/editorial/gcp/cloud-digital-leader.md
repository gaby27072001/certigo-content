# Cloud Digital Leader (gcp:cloud-digital-leader) — dossier éditorial

## Portée

Ce dossier documente la première vague de contenu original (v3) pour la
certification Google Cloud **Cloud Digital Leader** (niveau foundational,
`gcp:cloud-digital-leader`). Il couvre uniquement :

- `content/public/questions/gcp/cloud-digital-leader/**` (22 questions publiques)
- `content/answerKey/solutions/gcp/cloud-digital-leader/**` (22 solutions answerKey)
- `content/public/coverage/gcp/cloud-digital-leader.json` (matrice de couverture, statut `complete`)
- `content/public/catalog/certifications.json` (mise à jour de `provenance.checkedOn` pour cette seule certification)

Aucune autre certification ni aucun README partagé n'a été modifié. La fixture
générique du test catalogue est adaptée pour isoler les matrices déjà complètes
avant d'y injecter une paire synthétique.

## Provenance

- **Page de certification officielle** :
  <https://cloud.google.com/learn/certification/cloud-digital-leader>
- **Guide d'examen officiel (PDF)** :
  <https://services.google.com/fh/files/misc/cloud_digital_leader_exam_guide_english.pdf>
- **Date de vérification** : 2026-08-18
- Le PDF a été téléchargé directement depuis son URL officielle
  `services.google.com` puis extrait localement en texte brut ; aucun miroir,
  dump, banque de questions ou site de formation tiers n'a été consulté.
- Le PDF indique explicitement que cette version du guide a été lancée le
  12 août 2026 (« launched on August 12, 2026 »), ce qui est déjà reflété dans
  `certifications.json` (`guide.publishedOn`, `lifecycle.note`).
- `blueprintVersion` reste `2026-08-17` (version de snapshot du blueprint dans
  le catalogue) : ce dossier ne modifie ni la version du blueprint, ni les
  poids, ni aucune autre certification. Seul `provenance.checkedOn` de
  `gcp:cloud-digital-leader` a été avancé de 2026-08-17 à 2026-08-18 pour
  refléter la date de cette vague éditoriale.

## Pondérations : approximations officielles préservées telles quelles

Le guide officiel Google Cloud marque explicitement chaque section avec le
préfixe **« ~ »** (approximatif), par exemple « Section 1 : ... (~18% of the
exam) ». Ces pourcentages ne sont **pas** des poids exacts et n'ont **pas**
été recalculés, arrondis différemment, ni rééquilibrés par cet exercice. Ils
sont repris à l'identique dans le catalogue (`weightType: "approximate"`) et
dans la matrice de couverture, exactement comme publiés par Google.

## Sections et paires de questions

| Section | Titre officiel | Poids (approx.) | Paires créées |
| --- | --- | --- | --- |
| section-1 | Digital Transformation with Google Cloud | ~18% | 4 |
| section-2 | Exploring Data Transformation with Google Cloud | ~18% | 4 |
| section-3 | Innovating with Google Cloud Artificial Intelligence | ~18% | 4 |
| section-4 | Modernize Infrastructure and Applications with Google Cloud | ~18% | 4 |
| section-5 | Trust and Security with Google Cloud | ~18% | 4 |
| section-6 | Scaling with Google Cloud Operations | ~10% | 2 |
| **Total** | | ~100% | **22** |

La répartition 4/4/4/4/4/2 reflète d'aussi près que possible les poids
approximatifs publiés (18/18/18/18/18/10), sans jamais dépasser ou inventer de
pondération non publiée.

## Couverture des objectifs et sous-objectifs

La matrice de couverture (`content/public/coverage/gcp/cloud-digital-leader.json`)
ne modélise que le **niveau section** (`section-1` à `section-6`), car c'est le
seul niveau de granularité défini par `certification.blueprint.objectives`
dans le catalogue — cette structure n'est pas modifiée par ce dossier. Le
tableau ci-dessous documente, pour traçabilité éditoriale uniquement, à quel
sous-objectif numéroté du guide officiel (1.1 à 6.2) chaque question se
rattache principalement.

**Important — ce que ce tableau affirme et ce qu'il n'affirme pas** : la
présence d'un sous-objectif dans la colonne de gauche signifie qu'**au moins
un aspect** de ce sous-objectif est exercé par une question de cette vague.
Elle ne signifie **pas** que chaque exemple, produit ou puce entre parenthèses
listé par le guide officiel pour ce sous-objectif est individuellement évalué.
La colonne « Scénario/compétence évalué dans cette vague (sans résolution) »
précise, question par question, quel scénario ou quelle compétence est
exercé — sans jamais indiquer le produit, la stratégie ou la combinaison
retenue comme bonne réponse — c'est cette colonne qu'il faut lire pour
connaître le périmètre réel, pas le libellé officiel du sous-objectif.

| Sous-objectif (guide PDF) | Section (matrice) | Scénario/compétence évalué dans cette vague (sans résolution) |
| --- | --- | --- |
| 1.1 Pourquoi et comment le cloud transforme les entreprises | section-1 | `001` : identification de l'avantage cloud pertinent face à des pics de demande saisonniers imprévisibles, sans surinvestissement matériel. `002` : identification des différenciateurs pertinents pour des charges de travail d'IA à grande échelle, en évitant le verrouillage propriétaire. |
| 1.2 Concepts cloud fondamentaux | section-1 | `003` : choix d'architecture pour des charges réglementées maintenues sur site combinées à des charges analytiques ponctuelles dans le cloud. `004` : choix d'approche pour réduire la latence perçue par des utilisateurs mondiaux sans administrer soi-même les serveurs sous-jacents. |
| 2.1 Rôle des données dans la transformation numérique | section-2 | `005` : cartographie de la chaîne d'approvisionnement des données et clarification des responsabilités de gouvernance avant un déploiement d'IA. |
| 2.2 Produits de gestion des données Google Cloud | section-2 | `006` : comparaison de services de données pour des transactions relationnelles mondiales nécessitant une forte cohérence. `007` : choix de gestion automatique des classes de stockage selon la fréquence d'accès à des archives. |
| 2.3 Analytique intelligente, BI et streaming | section-2 | `008` : conception d'une chaîne de traitement de données quasi temps réel à partir de télémétrie continue. |
| 3.1 Concepts IA/ML fondamentaux et valeur métier | section-3 | `009` : priorisation des dimensions de qualité des données affectant la performance d'un modèle de machine learning. `010` : conciliation entre automatisation par IA agentique et exigence d'explicabilité réglementaire des décisions. |
| 3.2 Valeur métier des offres IA Google Cloud | section-3 | `011` : arbitrage entre rapidité de mise en production et personnalisation pour un besoin de traduction sans équipe ML dédiée. `012` : identification de la capacité permettant d'entraîner un modèle de machine learning en SQL standard sans exporter les données de l'entrepôt. |
| 4.1 Stratégies de migration et concepts de calcul | section-4 | `013` : choix de stratégie de migration privilégiant une première étape rapide avant un refactoring ultérieur. |
| 4.2 Offres d'infrastructure Google Cloud | section-4 | `014` : choix de plateforme pour des conteneurs à trafic irrégulier sans administration de serveurs ou de clusters. `015` : choix d'offres pour gérer des conteneurs et analyser des données de façon cohérente dans un contexte hybride et multicloud. |
| 4.3 Valeur métier des API | section-4 | `016` : conception d'une API partenaire nécessitant limitation de débit, analytique d'usage et facturation. |
| 5.1 Concepts fondamentaux de sécurité cloud | section-5 | `017` : évaluation de la protection des données pendant une migration selon la triade confidentialité/intégrité/disponibilité et la responsabilité partagée entre cloud et sur site. `018` : combinaison de principes de moindre privilège, de vérification continue des requêtes et de chiffrement selon les états d'usage des données. |
| 5.2 Sécurité en profondeur avec Google | section-5 | `019` : centralisation de la détection des mauvaises configurations, de la priorisation des risques et de l'accélération de la détection/réponse aux menaces. `020` : combinaison d'offres pour protéger des modèles d'IA contre des attaques ciblées, sécuriser la connectivité, restreindre l'accès aux données sensibles et démontrer la conformité/résidence des données. |
| 6.1 Maîtrise des coûts cloud | section-6 | `021` : démarche couvrant la transition CapEx/OpEx, la structuration des ressources, la définition de budgets avec alertes et la maîtrise du coût des tâches par lots interruptibles. |
| 6.2 Opérations modernes, fiabilité et résilience | section-6 | `022` : définition d'objectifs de fiabilité mesurables, surveillance continue des services et garantie d'une architecture résiliente. |

Les 14 sous-objectifs publiés (1.1 à 6.2) sont donc tous représentés par au
moins une question, chaque ID n'apparaît que dans une seule section de la
matrice de couverture, mais **aucune affirmation n'est faite quant à une
couverture exhaustive de chaque exemple ou produit cité entre parenthèses par
le guide officiel** pour un sous-objectif donné : seule la colonne «
Scénario/compétence évalué dans cette vague (sans résolution) » fait foi du
périmètre testé.

## Sources officielles effectivement utilisées

Seules deux sources Google Cloud de premier niveau ont été consultées pour
rédiger ces 22 paires ; aucune autre page produit n'a été récupérée pendant
cette vague, afin de garantir une provenance strictement traçable :

- <https://cloud.google.com/learn/certification/cloud-digital-leader> (structure de l'examen, niveau, positionnement)
- <https://services.google.com/fh/files/misc/cloud_digital_leader_exam_guide_english.pdf> (texte intégral des sections 1 à 6 et de leurs sous-objectifs, noms de produits, terminologie officielle)

Tous les noms de produits Google Cloud mentionnés dans les questions
(Compute Engine, GKE, GKE Enterprise, Cloud Run, Spanner, Cloud SQL, AlloyDB,
Bigtable, BigQuery, BigQuery ML, BigQuery Omni, Cloud Storage/Autoclass,
Pub/Sub, Dataflow, Looker, Apigee, Security Command Center, Google Security
Operations, Model Armor, Cloud Interconnect, IAM, API Cloud Translation,
AutoML sur Agent Platform, Agent Studio sur Agent Platform, AI Hypercomputer,
Cloud Monitoring) proviennent exclusivement de l'énumération faite
dans le guide d'examen officiel ci-dessus, et non d'une documentation produit
consultée séparément. Chaque nom n'est utilisé que dans le contexte où le
guide le mentionne réellement, sans extension vers des capacités ou des
produits non couverts par le sous-objectif correspondant. Cette cohérence a
été vérifiée pour chacune des 22 questions ; le détail question par question
n'est volontairement pas reproduit ici afin de ne pas exposer, même
indirectement, la combinaison retenue comme bonne réponse.

## Originalité et contrôle anti-dump

- Chaque question est un scénario métier original (contexte d'entreprise
  fictif, problème concret, décision à prendre) construit pour illustrer un
  sous-objectif précis du guide, et non une reformulation ou une
  reconstruction d'une question d'examen réelle, d'un dump ou d'une banque de
  questions tierce.
- Aucune source tierce (site de préparation, forum, dump PDF non officiel,
  banque de questions commerciale) n'a été consultée ou utilisée à quelque
  étape que ce soit.
- Les quatre choix de chaque question sont plausibles et du même domaine que
  la bonne réponse (mêmes familles de services ou de concepts Google Cloud),
  sans formulation piège, double négation trompeuse ni humour déplaçant
  l'attention du contenu technique.
- Séparation stricte public/privé : chaque fichier public
  (`content/public/questions/...`) ne contient que `id`, `schemaVersion`,
  `kind`, `metadata`, `prompt`, `choices` — jamais `correct` ni `rationale`,
  ni aucun indice de réponse. Chaque fichier privé
  (`content/answerKey/solutions/...`) miroir contient `id`, `schemaVersion`,
  `kind`, `metadata`, `correct` et une `rationale` substantielle qui explique
  pourquoi la bonne réponse convient et pourquoi chacun des trois distracteurs
  ne convient pas.
- Les chemins sont strictement miroirs
  (`content/public/questions/gcp/cloud-digital-leader/<id>.json` ↔
  `content/answerKey/solutions/gcp/cloud-digital-leader/<id>.json`), le nom de
  fichier est identique à l'`id`, et `metadata` (provider, certification,
  blueprintVersion, objective) est strictement identique entre la question
  publique et sa solution.

## Métriques de la vague

- **22 paires** question/solution v3 créées, IDs
  `gcp.cloud-digital-leader.section-N.<slug-francais-ascii>.001` à `.022`
  (suffixes globalement séquentiels).
- **Répartition par section** : 4 / 4 / 4 / 4 / 4 / 2 (sections 1 à 6),
  reflétant au plus près les poids approximatifs 18/18/18/18/18/10.
- **Répartition des positions de bonne réponse** parmi les 4 choix (comptages
  agrégés uniquement — volontairement sans liste par identifiant, pour ne pas
  divulguer la clé de réponse) :
  - Position A (1ᵉʳ choix) : 6 questions
  - Position B (2ᵉ choix) : 6 questions
  - Position C (3ᵉ choix) : 5 questions
  - Position D (4ᵉ choix) : 5 questions
  - Total : 22, répartition équilibrée (6/6/5/5) sans position dominante.
- **Contrôle anti-périodicité** : la séquence des positions de bonne réponse,
  prise dans l'ordre des identifiants 001 à 022, a été générée et vérifiée
  algorithmiquement pour qu'elle ne suive **aucun motif périodique** (aucune
  période de longueur 2 à 11 ne reproduit la séquence sur une fenêtre
  significative), qu'elle ne comporte **aucune répétition de plus de deux**
  positions consécutives identiques, et qu'**aucun bloc de 4 questions aligné
  sur une section** ne forme une permutation complète et prévisible des
  quatre positions (A, B, C, D). Elle diffère, position par position, d'une
  séquence cyclique simple sur plus de 16 des 22 questions. Aucune régularité
  exploitable par un candidat n'a été identifiée.
- **Longueur des choix** : les quatre choix de chaque question ont été
  rédigés pour rester de longueur globalement comparable ; la bonne réponse
  n'est la plus longue des quatre choix que sur une minorité des 22
  questions (5/22), afin d'éliminer l'indice positionnel « la réponse la plus
  longue est toujours correcte ». Elle ne figure également parmi les deux
  choix les plus courts que sur 11 des 22 questions — une répartition par
  rang de longueur statistiquement équilibrée (test binomial bilatéral,
  p = 1, contre p ≈ 0,004 pour une répartition 18/22 non corrigée) —
  ce qui exclut tout indice exploitable fondé sur la longueur relative des
  choix, dans un sens comme dans l'autre.
- **Couverture des sous-objectifs** : les 14 sous-objectifs officiels
  (1.1, 1.2, 2.1, 2.2, 2.3, 3.1, 3.2, 4.1, 4.2, 4.3, 5.1, 5.2, 6.1, 6.2) sont
  tous couverts par au moins une question, comme détaillé dans le tableau
  ci-dessus.
- **Statut de la matrice de couverture** : `complete` (toutes les sections
  ont au moins une question, chaque ID référencé une seule fois).
