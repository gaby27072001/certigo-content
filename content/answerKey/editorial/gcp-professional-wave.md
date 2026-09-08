# Vague Google Cloud Professional

Snapshot editorial : `2026-08-17`

## Perimetre

Cette vague couvre les neuf certifications Google Cloud Professional actives :

- Professional Cloud Architect
- Professional Data Engineer
- Professional Cloud Developer
- Professional Cloud DevOps Engineer
- Professional Cloud Security Engineer
- Professional Cloud Network Engineer
- Professional Machine Learning Engineer
- Professional Cloud Database Engineer
- Professional Security Operations Engineer

Chaque blueprint est dense. La vague contient donc 24 scenarios originaux v3
par certification, soit 216 paires question/solution. Les scenarios ont ete
rediges a partir des guides d'examen et de la documentation produit Google
officiels, sans reutiliser de question d'examen, de question exemple ou de
cas d'etude officiel.

## Frontiere de confiance

- Le canal public contient uniquement les questions et les matrices de
  couverture operationnelles requises par le validateur. Ces matrices
  exposent seulement les identifiants et objectifs, jamais les reponses.
- Le canal `answerKey` contient les reponses exactes, les rationales, les URL
  de provenance et la presente matrice editoriale.
- Chaque solution v3 exige une provenance HTTPS. Le validateur refuse tout
  hote hors de l'allow-list Google officielle.

## Matrice editoriale privee

| Certification | Repartition par section | Paires | Positions et rangs | References / URL distinctes |
| --- | --- | ---: | --- | ---: |
| Cloud Architect | 6/4/4/4/3/3 | 24 | 6/6/6/6 | 81 / 34 |
| Data Engineer | 5/6/5/4/4 | 24 | 6/6/6/6 | 77 / 29 |
| Cloud Developer | 8/5/6/5 | 24 | 6/6/6/6 | 74 / 28 |
| Cloud DevOps Engineer | 5/6/4/6/3 | 24 | 6/6/6/6 | 73 / 26 |
| Cloud Security Engineer | 6/5/6/4/3 | 24 | 6/6/6/6 | 75 / 29 |
| Cloud Network Engineer | 5/5/4/4/3/3 | 24 | 6/6/6/6 | 77 / 31 |
| Machine Learning Engineer | 3/4/5/5/4/3 | 24 | 6/6/6/6 | 76 / 29 |
| Cloud Database Engineer | 8/6/5/5 | 24 | 6/6/6/6 | 74 / 26 |
| Security Operations Engineer | 3/3/5/5/5/3 | 24 | 6/6/6/6 | 78 / 27 |
| **Total** | Tous les domaines | **216** | **54/54/54/54** | **685 / 241** |

Les 685 references privees se repartissent entre les hotes autorises :
`services.google.com` (216) et `cloud.google.com` (469). Chaque solution cite
son guide d'examen, la page de certification et au moins une documentation
produit qui justifie la decision technique. Les 241 URL distinctes ont toutes
retourne HTTP 200 pendant le controle de la vague.

## Guides officiels

| Certification | Guide |
| --- | --- |
| Cloud Architect | `https://services.google.com/fh/files/misc/professional_cloud_architect_exam_guide_english.pdf` |
| Data Engineer | `https://services.google.com/fh/files/misc/professional_data_engineer_exam_guide_english.pdf` |
| Cloud Developer | `https://services.google.com/fh/files/misc/professional_cloud_developer_exam_guide_english.pdf` |
| Cloud DevOps Engineer | `https://services.google.com/fh/files/misc/professional_cloud_devops_engineer_exam_guide_english.pdf` |
| Cloud Security Engineer | `https://services.google.com/fh/files/misc/professional_cloud_security_engineer_exam_guide_english.pdf` |
| Cloud Network Engineer | `https://services.google.com/fh/files/misc/042426_professional_cloud_network_engineer_exam_guide_english.pdf` |
| Machine Learning Engineer | `https://services.google.com/fh/files/misc/professional_machine_learning_engineer_exam_guide_english_new.pdf` |
| Cloud Database Engineer | `https://services.google.com/fh/files/misc/professional_cloud_database_engineer_exam_guide_english.pdf` |
| Security Operations Engineer | `https://services.google.com/fh/files/misc/professional_security_operations_engineer_exam_guide_english.pdf` |

## Controles editoriaux

- 216 identifiants uniques et 216 correspondances public/prive strictes.
- Quatre choix uniques par question et une reponse exacte presente dans les
  choix.
- Tous les domaines officiels couverts selon une allocation proche des
  ponderations approximatives publiees.
- Equilibre exact des positions de reponse pour chaque certification.
- Equilibre exact des rangs de longueur des reponses, avec six reponses a
  chaque rang et un ratio reponse/distracteurs compris entre 0,85 et 1,15.
- Aucun champ `correct`, `rationale` ou `provenance` dans le canal public.
- Identifiants publics fondes sur la situation, sans nommer la solution.
- Aucun prompt duplique dans la vague.
- Scenarios de niveau professionnel fondes sur des contraintes, compromis et
  objectifs operationnels, plutot que sur la memorisation de definitions.

## Risques residuels

1. Les guides Google sont des documents mutables. Le catalogue est fige au
   `2026-08-17` et doit etre recontrole au plus tard le `2026-09-16`.
2. Les guides Data Engineer et Cloud Database Engineer annoncent une evolution
   de marque. Le contenu reste aligne sur les guides lies par le snapshot.
3. Le guide Machine Learning Engineer du `2026-06-01` utilise la terminologie
   Gemini Enterprise Agent Platform. Une evolution de produit peut imposer une
   mise a jour editoriale avant le prochain cycle.
4. Le token `042426` du guide Cloud Network Engineer est conserve comme
   revision opaque et n'est pas interprete comme une date.

Cette vague est destinee a une PR draft empilee sur la fondation multi-cloud.
Elle ne declenche ni publication ni fusion.

## Ce que l'equilibrage d'axes ne prouve pas (mesure du 2026-09-07)

Cette vague satisfait les sept heuristiques d'axe connues : la bonne reponse
est la plus longue dans exactement 25,0 % des cas, la plus courte dans 25,0 %,
et les rangs de longueur sont equilibres par certification.

Un classifieur logit conditionnel entraine sur onze traits de surface, valide
par une validation croisee decoupee par question, la separe malgre tout a
**59,7 %** pour une chance de 25 %. Le meme classifieur, labels permutes,
retombe a 23-29 % : il sait donc atteindre le hasard, et sa valeur haute n'est
pas un artefact de surapprentissage.

Le poids dominant est la **ponctuation** (+1,22), un axe que personne n'avait
nomme. La bonne reponse enumere ; avec les longueurs plafonnees, l'enumeration
ressort en virgules au lieu de caracteres.

Consequence pour la redaction a venir : equilibrer un axe nomme apres l'autre
ne converge pas vers l'indiscernabilite, cela **deplace la fuite**. On contraint
une mesure, pas la propriete sous-jacente. La conformite a cette liste de
regles est un plancher, jamais une preuve.

Corollaire : le classifieur doit rester un detecteur et ne jamais devenir une
fonction objectif, sinon la fuite migre vers le douzieme trait. Garder deux ou
trois traits hors du modele pendant la redaction, puis les mesurer, est le seul
controle disponible contre ce biais.
