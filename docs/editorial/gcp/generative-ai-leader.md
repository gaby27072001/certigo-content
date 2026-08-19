# Generative AI Leader (gcp:generative-ai-leader) — dossier éditorial

## Portée

Ce dossier documente la vague de contenu original (v3) pour la certification
Google Cloud **Generative AI Leader** (niveau foundational,
`gcp:generative-ai-leader`), rédigée en parallèle de la vague **Cloud Digital
Leader** (traitée par un autre agent, préservée telle quelle). Il couvre
uniquement :

- `content/public/questions/gcp/generative-ai-leader/**` (20 questions publiques)
- `content/answerKey/solutions/gcp/generative-ai-leader/**` (20 solutions answerKey)
- `content/public/coverage/gcp/generative-ai-leader.json` (matrice de couverture, statut `complete`)
- `content/public/catalog/certifications.json` (mise à jour de `provenance.checkedOn`
  pour cette seule certification, de 2026-08-17 à 2026-08-18)

Aucune autre certification ni aucun README partagé n'a été modifié. La fixture
générique du test catalogue est adaptée pour isoler les matrices déjà complètes
avant d'y injecter une paire synthétique. La provenance de
`gcp:cloud-digital-leader` (déjà avancée à 2026-08-18 dans cette vague) a été
strictement préservée sans être retouchée.

## Provenance

- **Page de certification officielle** :
  <https://cloud.google.com/learn/certification/generative-ai-leader>
- **Guide d'examen officiel (PDF)** :
  <https://services.google.com/fh/files/misc/generative_ai_leader_exam_guide_english.pdf>
- **Date de vérification** : 2026-08-18
- Le PDF officiel a été téléchargé depuis son URL `services.google.com` puis
  extrait localement en texte brut ; aucun miroir, dump, banque de questions
  ou site de formation tiers n'a été consulté à quelque étape que ce soit.
- `blueprintVersion` reste `2026-08-17` (version de snapshot du blueprint dans
  le catalogue) : ce dossier ne modifie ni la version du blueprint, ni les
  poids, ni aucune autre certification. Seul `provenance.checkedOn` de
  `gcp:generative-ai-leader` a été avancé de 2026-08-17 à 2026-08-18 pour
  refléter la date de cette vague éditoriale.

## Pondérations : approximations officielles préservées telles quelles

Le guide officiel Google Cloud marque explicitement chaque section avec le
préfixe **« ~ »** (approximatif), par exemple « Section 1: ... (~30% of the
exam) ». Ces pourcentages ne sont **pas** des poids exacts et n'ont **pas**
été recalculés, arrondis différemment, ni rééquilibrés par cet exercice. Ils
sont repris à l'identique dans le catalogue (`weightType: "approximate"`) et
dans la matrice de couverture, exactement comme publiés par Google.

## Sections et paires de questions

| Section | Titre officiel | Poids (approx.) | Paires créées |
| --- | --- | --- | --- |
| section-1 | Fundamentals of gen AI | ~30% | 6 |
| section-2 | Google Cloud's gen AI offerings | ~35% | 7 |
| section-3 | Techniques to improve gen AI model output | ~20% | 4 |
| section-4 | Business strategies for a successful gen AI solution | ~15% | 3 |
| **Total** | | ~100% | **20** |

La répartition 6/7/4/3 reflète exactement les poids approximatifs publiés
(30/35/20/15) à l'échelle de 20 questions, sans jamais dépasser ou inventer de
pondération non publiée.

## Couverture des objectifs et sous-objectifs

Le guide d'examen officiel comporte **15 sous-objectifs numérotés** (1.1 à
4.3 : 4 en section 1, 5 en section 2, 3 en section 3, 3 en section 4). Chacun
d'eux est couvert par au moins une question. La colonne « Section (matrice) »
est la seule valeur portée par `metadata.objective` (le schéma v3 ne modélise
que le niveau section) ; le sous-objectif précis (1.1, 1.2, ...) est
documenté ici pour la traçabilité éditoriale.

Le contenu entre parenthèses de la colonne « Sous-objectif (guide PDF) »
reprend l'énumération d'exemples telle que rédigée dans le guide officiel
pour identifier chaque sous-objectif ; il ne signifie pas que chaque exemple
cité (par exemple NLP, diffusion, ou les critères de sélection de modèle en
1.1) fait l'objet d'une question dédiée. L'engagement de couverture porte sur
le **sous-objectif numéroté dans son ensemble**, pas sur chacun de ses
exemples individuels.

| Sous-objectif (guide PDF) | Section (matrice) | ID (suffixe) |
| --- | --- | --- |
| 1.1 Concepts fondamentaux de l'IA générative (IA/NLP/ML/gen AI, modèles de fondation et multimodaux, diffusion, LLM, apprentissage supervisé/non supervisé/par renforcement, cycle de vie du ML, sélection de modèle, créer/résumer/découvrir/automatiser) | section-1 | `concepts-fondamentaux-ia-generative` (001), `cycle-vie-machine-learning-approches` (002) |
| 1.2 Qualité et accessibilité des données (structurées/non structurées, étiquetées/non étiquetées) | section-1 | `qualite-donnees-structurees-non-structurees` (003) |
| 1.3 Paysage de l'IA générative en couches (infrastructure, modèles, plateformes, agents, applications) | section-1 | `couches-paysage-ia-generative` (004) |
| 1.4 Cas d'usage et forces de Gemini/Gemma/Imagen/Veo | section-1 | `choix-modele-fondation-imagen-veo` (005), `gemini-gemma-cas-usage-entreprise` (006) |
| 2.1 Écosystème Google IA-first, ouvert et prêt pour l'entreprise (AI Hypercomputer TPU/GPU, contrôle des données, démocratisation) | section-2 | `approche-ia-first-plateforme-entreprise` (007), `ai-hypercomputer-controle-donnees-democratisation` (008) |
| 2.2 Application Gemini/Gemini Advanced/Gems, Gemini Enterprise (Notebook API, recherche multimodale, agents personnalisés), Gemini pour Workspace | section-2 | `gemini-app-advanced-gems-personnalisation` (009), `gemini-enterprise-recherche-multimodale-agents` (010) |
| 2.3 Recherche externe (Agent Search/Google Search), composants de la Customer Engagement Suite | section-2 | `customer-engagement-suite-experience-client` (011) — les composants de l'offre Customer Engagement Suite (Conversational Agents, Agent Assist, Conversational Insights, Contact Center as a Service) sont mobilisés dans le scénario, aux côtés d'Agent Search et de Gemini pour Google Workspace comme distracteurs plausibles |
| 2.4 Agent Platform/Model Garden/AutoML, offres RAG, agents personnalisés | section-2 | `plateforme-agents-model-garden-rag-personnalise` (012) |
| 2.5 Outils d'agent et interaction externe (Cloud Storage/bases de données/Cloud Functions/Cloud Run/Agent Platform/API IA prédéfinies), Agent Studio vs Google AI Studio | section-2 | `outils-agents-agent-studio-vs-ai-studio` (013) |
| 3.1 Limitations (coupure des connaissances, biais, hallucinations, cas limites), ancrage/RAG/ingénierie de prompt/fine-tuning/HITL, surveillance/mises à jour/KPI/correctifs/versionnage/dérive/feature store | section-3 | `limitations-modeles-fondation-mitigation` (014), `surveillance-continue-derive-modele` (015) |
| 3.2 Zero-shot/one-shot/few-shot, rôle, enchaînement de prompts, chain-of-thought, ReAct | section-3 | `techniques-prompting-few-shot-chain-of-thought` (016) |
| 3.3 Ancrage entreprise/tiers/monde réel, effets du RAG, Agent Search/API RAG/Google Search, nombre de tokens, température, top-p, sécurité, longueur de sortie | section-3 | `ancrage-parametres-echantillonnage-temperature` (017) |
| 4.1 Types de solutions, besoins métier/techniques, sélection/intégration/mesure d'impact | section-4 | `selection-solution-ia-generative-impact` (018) |
| 4.2 Sécurité du cycle de vie du ML, SAIF, IAM/Security Command Center/surveillance des charges de travail/sécurité dès la conception | section-4 | `securite-ia-saif-iam-security-command-center` (019) |
| 4.3 IA responsable, transparence, confidentialité, anonymisation/pseudonymisation, qualité des données, biais, équité, redevabilité, explicabilité | section-4 | `ia-responsable-anonymisation-explicabilite` (020) |

Les 15 sous-objectifs publiés (1.1 à 4.3) sont donc tous couverts, et chaque
ID n'apparaît que dans une seule section de la matrice de couverture.

## Sources officielles effectivement utilisées

Seules deux sources Google Cloud de premier niveau ont été consultées pour
rédiger ces 20 paires ; aucune autre page produit n'a été récupérée pendant
cette vague, afin de garantir une provenance strictement traçable :

- <https://cloud.google.com/learn/certification/generative-ai-leader> (structure de l'examen, niveau, positionnement)
- <https://services.google.com/fh/files/misc/generative_ai_leader_exam_guide_english.pdf> (texte intégral des sections 1 à 4 et de leurs 15 sous-objectifs, noms de produits, terminologie officielle)

Tous les noms de produits Google Cloud mentionnés dans les questions
(Gemini, Gemini Advanced, Gems, Gemini Enterprise, Gemini Enterprise Agent
Platform / Agent Platform, Agent Search, Agent Studio, Google AI Studio,
Model Garden, AutoML, Customer Engagement Suite, AI Hypercomputer, Imagen,
Veo, Gemma, Cloud Storage, Cloud Functions, Cloud Run, IAM, Security Command
Center) proviennent exclusivement de l'énumération faite dans le guide
d'examen officiel ci-dessus, et non d'une documentation produit consultée
séparément.

## Notes de terminologie

- **Gemini Enterprise** (et non un ancien nom de produit) désigne l'offre
  d'entreprise couvrant la recherche multimodale, la Notebook API et la
  création d'agents personnalisés (sous-objectif 2.2).
- **Gemini Enterprise Agent Platform** / **Agent Platform** désigne la
  plateforme de construction et d'hébergement d'agents (Model Garden, AutoML,
  RAG, agents personnalisés — sous-objectif 2.4), distincte des outils
  d'interaction externe des agents (sous-objectif 2.5).
- **Agent Search** désigne l'offre de RAG (génération augmentée par
  récupération) prête à l'emploi de Google Cloud, permettant d'ancrer les
  réponses d'un agent sur des données d'entreprise/de première partie sans
  développement RAG personnalisé ; elle est distincte du grounding avec
  Google Search, qui ancre les réponses sur des données publiques du monde
  réel (sous-objectifs 2.3, 2.4, 3.3).
- **Agent Studio** (construction d'agents dans l'écosystème Google Cloud) est
  explicitement distingué de **Google AI Studio** (prototypage de modèles de
  fondation) dans le sous-objectif 2.5 ; les deux noms sont utilisés tels
  quels, sans les confondre ni les substituer par un nom hérité absent du
  guide actuel. Le guide d'examen demande seulement de savoir *quand* choisir
  Agent Studio plutôt que Google AI Studio (2.5) ; il ne définit pas lui-même
  en détail leur positionnement fonctionnel respectif. Dans la question 013,
  Agent Studio et Google AI Studio apparaissent tous deux parmi les choix
  proposés ; l'attribution fonctionnelle détaillée de chaque outil au
  scénario décrit relève d'une inférence éditoriale, non d'une citation
  directe du guide, et n'est documentée que dans la rationale privée
  correspondante.
- Aucun nom de produit hérité ou obsolète non présent dans le guide actuel
  n'a été utilisé.

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
  la bonne réponse (mêmes familles de services ou de concepts Google Cloud
  d'IA générative), sans formulation piège, double négation trompeuse ni
  élément hors sujet destiné à distraire artificiellement.
- Séparation stricte public/privé : chaque fichier public
  (`content/public/questions/...`) ne contient que `id`, `schemaVersion`,
  `kind`, `metadata`, `prompt`, `choices` — jamais `correct` ni `rationale`,
  ni aucun indice de réponse. Chaque fichier privé
  (`content/answerKey/solutions/...`) miroir contient `id`, `schemaVersion`,
  `kind`, `metadata`, `correct` et une `rationale` substantielle qui explique
  pourquoi la bonne réponse convient et pourquoi chacun des trois distracteurs
  ne convient pas.
- Les chemins sont strictement miroirs
  (`content/public/questions/gcp/generative-ai-leader/<id>.json` ↔
  `content/answerKey/solutions/gcp/generative-ai-leader/<id>.json`), le nom de
  fichier est identique à l'`id`, et `metadata` (provider, certification,
  blueprintVersion, objective) est strictement identique entre la question
  publique et sa solution.

## Métriques de la vague

- **20 paires** question/solution v3 créées, IDs
  `gcp.generative-ai-leader.section-N.<slug-francais-ascii>.001` à `.020`
  (suffixes globalement séquentiels).
- **Répartition par section** : 6 / 7 / 4 / 3 (sections 1 à 4), reflétant
  exactement les poids approximatifs publiés 30/35/20/15 à l'échelle de 20
  questions.
- **Répartition des positions de bonne réponse** parmi les 4 choix :
  équilibre parfait 5/5/5/5 (A/B/C/D) sur les 20 questions, selon une
  séquence irrégulière et non périodique construite spécifiquement pour
  éviter toute corrélation numérique prévisible (par exemple avec l'ID ou son
  reste modulo 4). Au-delà de cet équilibre global, la séquence est
  également contrôlée par blocs alignés de quatre questions consécutives
  (001-004, 005-008, ..., 017-020) : aucun de ces blocs ne forme une
  permutation complète des quatre positions A/B/C/D, et aucune position ne se
  répète plus de deux fois d'affilée dans l'ordre des suffixes numériques, ce
  qui écarte tout motif localement devinable en plus de l'équilibre
  d'ensemble. Le détail exact de la position de la bonne réponse pour
  chaque ID n'est **volontairement pas publié** dans ce dossier éditorial :
  l'énumérer reviendrait à publier l'intégralité du corrigé et romprait la
  séparation public/privé que ce dossier a précisément pour but de
  documenter sans divulguer.
- **Couverture des sous-objectifs** : les 15 sous-objectifs officiels
  (1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3)
  sont tous couverts par au moins une question, comme détaillé dans le
  tableau ci-dessus.
- **Statut de la matrice de couverture** : `complete` (toutes les sections
  ont au moins une question, chaque ID référencé une seule fois).
