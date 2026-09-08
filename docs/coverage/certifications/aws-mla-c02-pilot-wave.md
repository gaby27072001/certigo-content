# Vague pilote AWS MLA-C02 au 2026-09-04

## Périmètre

Cette vague ajoute une matrice de couverture **partielle/pilote** et un
premier lot de 8 questions originales pour une certification qui n'existait
pas encore dans le catalogue :

- `aws:mla-c02` — AWS Certified Machine Learning Engineer - Associate
  (version bêta, mise à jour de `aws:mla-c01`).

Il ne s'agit délibérément **pas** d'une vague complète : l'objectif est de
prouver le pipeline éditorial de bout en bout (catalogue, blueprint sourcé,
matrice, questions/solutions, gates) sur une certification tout juste
annoncée, avant d'investir dans une couverture exhaustive une fois l'examen
stabilisé en disponibilité générale.

Les questions publiques utilisent `certigo question/v3` sous
`content/public/questions/aws/mla-c02/`. Les solutions et explications
pédagogiques utilisent `certigo solution/v3` dans le chemin privé miroir
`content/answerKey/solutions/aws/mla-c02/`. La matrice publique canonique est
`content/public/coverage/aws/mla-c02.json`.

Aucun dump, banque de questions, site de formation ou autre source tierce
n'a été consulté. Les scénarios, formulations et distracteurs sont des
créations éditoriales originales fondées uniquement sur le guide d'examen et
la documentation AWS officiels.

**Cette vague ne modifie aucun champ existant de `aws:mla-c01`** : la
certification prédécesseure et son propre travail de mise à jour du cycle de
vie relèvent d'un effort indépendant et ne sont pas repris ici.

## Provenance du blueprint

| Ressource | URL | Rôle |
| --- | --- | --- |
| Page de certification | <https://aws.amazon.com/certification/certified-machine-learning-engineer-associate/> | confirme le statut bêta et les dates clés |
| Annonce officielle | <https://aws.amazon.com/blogs/training-and-certification/september-2026-new-offerings/> | bêta ouverte le 2026-09-01, dernier jour MLA-C01 anglais le 2026-09-28, disponibilité générale le 2027-01-14 |
| Guide d'examen MLA-C02 | <https://docs.aws.amazon.com/aws-certification/latest/machine-learning-engineer-associate-02/machine-learning-engineer-associate-02.html> | 4 domaines et pondérations exactes |
| Domaines 1 à 4 | `.../machine-learning-engineer-associate-02-domain{1,2,3,4}.md` | tâches et compétences officielles par domaine |
| Services concernés | `.../mla-02-in-scope-services.md`, `.../mla-02-out-of-scope-services.md` | vocabulaire de services autorisé |

Sources consultées et revérifiées le 2026-09-04. Blueprint interne utilisé :
`2026-09-04` (nouveau, propre à `aws:mla-c02` — aucune paire existante n'y
est rattachée).

Le statut catalogue est `announced` : le guide d'examen est publié et
l'inscription à la bêta est ouverte, mais la disponibilité générale n'est
atteinte que le 2027-01-14. Ce statut exempte la certification des contrôles
de fraîcheur et de l'obligation de matrice appliqués aux certifications
`active`/`active-retiring` ; la matrice ci-dessous est fournie volontairement,
en avance sur cette exigence.

## Domaines officiels et pondérations

Le guide MLA-C02 conserve la même structure en 4 domaines que MLA-C01, mais
avec des intitulés et des pondérations révisés (domaines 2 et 3) pour
refléter l'IA générative, les agents et les modèles de fondation :

| Domaine | Intitulé officiel | Pondération | Paires (pilote) |
| --- | --- | ---: | ---: |
| 1 | Data Preparation for ML and AI | 28 % | 2 |
| 2 | ML Model and Foundation Model (FM) Development | 24 % | 2 |
| 3 | Deployment and Orchestration of ML and AI Workflows | 24 % | 2 |
| 4 | Operating, Monitoring, and Securing ML and AI Solutions | 24 % | 2 |

## Objectifs et couverture (pilote)

Les 8 thèmes ont été choisis pour porter spécifiquement sur les compétences
**nouvelles ou révisées** par rapport à MLA-C01 (RAG, agents, Amazon
Bedrock, évaluation de sorties génératives), afin que ce lot ne soit pas un
doublon du corpus MLA-C01 déjà écrit.

| Question | Domaine | Portée éditoriale | Compétence officielle source |
| --- | --- | --- | --- |
| `001` | domain-1 | Découpage structurel et métadonnées de section pour un corpus RAG | Skill 1.2.7 |
| `002` | domain-1 | Dimensionnement d'une base vectorielle à l'échelle de dizaines de millions de blocs | Skill 1.1.7 |
| `003` | domain-2 | Arbitrage entre réentraînement, prompt statique et récupération augmentée pour un contenu source volatile | Skills 2.1.2 / 2.1.5 |
| `004` | domain-2 | Choix de métriques d'évaluation automatique (ROUGE, BERTScore) pour des résumés générés | Skill 2.3.8 |
| `005` | domain-3 | Reclassement (reranking) après récupération vectorielle dans une base de connaissances Bedrock | Skill 3.2.7 |
| `006` | domain-3 | Gestion d'état d'un agent conversationnel multi-tours | Skills 3.1.6 / 3.2.9 |
| `007` | domain-4 | Observabilité et détection des échecs de coordination d'agents en production | Skills 4.1.1 / 4.1.5 |
| `008` | domain-4 | Moindre privilège et choix du type d'identifiant pour l'accès à Amazon Bedrock | Skills 4.3.2 / 4.3.8 |

Les identifiants complets sont ceux de la matrice
`content/public/coverage/aws/mla-c02.json`, avec le statut `in-progress`
(partiel), pas `complete`.

## Métriques et contrôles éditoriaux

| Certification | Paires | Répartition par domaine | Positions A/B/C/D | Objectifs de blueprint couverts |
| --- | ---: | --- | --- | --- |
| MLA-C02 (pilote) | 8 | 2 / 2 / 2 / 2 | 2 / 2 / 2 / 2 | 4 sur 4 (couverture partielle par objectif) |

Chaque question possède quatre choix distincts. Chaque solution porte un
champ `provenance` référençant des pages officielles `docs.aws.amazon.com`,
et sa `rationale` explique pourquoi les trois distracteurs échouent avant de
citer explicitement ses sources. Parce que `provenance` est renseigné, le
contrôle d'équilibre éditorial du validateur (`npm run validate`) s'applique
pleinement à ce lot : la position du choix correct dans le tableau public et
le rang de longueur de sa réponse parmi les quatre choix sont tous deux
répartis exactement 2/2/2/2, pour qu'aucun signal de longueur ou de position
ne permette de deviner la bonne réponse sans lire les choix.

Les fichiers publics ne contiennent aucune clé de corrigé. Les chemins
publics et privés sont strictement isomorphes, les métadonnées v3 sont
identiques, et chaque identifiant apparaît une seule fois dans la matrice.

## Trajectoire vers une couverture complète

Ce pilote couvre les 4 domaines mais seulement 8 objectifs édition sur un
total qui restera à définir une fois la disponibilité générale de MLA-C02
atteinte (2027-01-14) et le guide d'examen stabilisé. Une vague ultérieure
pourra étendre chaque domaine jusqu'à une allocation proportionnelle aux
pondérations officielles (comme pratiqué pour les autres certifications
`complete` du catalogue) et faire passer le statut de la matrice à
`complete`.
