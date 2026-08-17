# Couverture editoriale AI-900

Etat de la revue : **17 aout 2026**.

## Statut de l'examen et base normative

Microsoft a retire AI-900 le **30 juin 2026** et demande desormais de passer
AI-901 pour obtenir Azure AI Fundamentals. Ce corpus reste volontairement
aligne sur le **dernier blueprint AI-900**, dont les competences sont effectives
depuis le **2 mai 2025**. Il ne doit pas etre presente comme une preparation a
un examen encore planifiable.

Le change log officiel du 2 mai 2025 indique notamment :

- une baisse de la ponderation du machine learning a 15-20 % ;
- une hausse de l'IA generative a 20-25 % ;
- un elargissement majeur d'Azure OpenAI vers les services et capacites
  d'IA generative dans Azure ;
- un changement majeur de la description des charges de travail IA communes.

La terminologie des questions suit les pages Microsoft Learn 2026 lorsque le
service existe toujours. Ainsi, **Azure AI Foundry** dans le blueprint
historique est nomme **Microsoft Foundry**, et **Azure AI Services** est nomme
**Foundry Tools**. Les formulations historiques indispensables sont explicitees
dans les questions ou rationales concernees.

## Audit avant/apres

| Mesure | Avant | Apres |
| --- | ---: | ---: |
| Paires question/solution AI-900 | 12 | 41 |
| Objectifs du blueprint directement couverts | 14/40 | 40/40 |
| Principes d'IA responsable couverts | 1/6 | 6/6 |
| Domaines avec tous leurs objectifs couverts | 0/5 | 5/5 |

Repartition editoriale principale apres enrichissement :

| Domaine | Ponderation officielle | Questions |
| --- | ---: | ---: |
| Charges de travail IA et considerations | 15-20 % | 9 |
| Principes fondamentaux du ML sur Azure | 15-20 % | 11 |
| Vision par ordinateur sur Azure | 15-20 % | 6 |
| NLP sur Azure | 15-20 % | 8 |
| IA generative sur Azure | 20-25 % | 7 |

Le nombre de questions reflete d'abord la granularite des objectifs et les
lacunes du corpus initial ; il ne constitue pas une simulation statistique de
la ponderation de l'examen. Un assemblage d'entrainement doit appliquer les
ponderations officielles independamment de cette banque.

La question `ai900-l-ml-metrics-check-1` apporte une extension pedagogique sur
le rappel. Cette metrique n'est pas un objectif nomme du dernier blueprint, mais
elle reste utile pour comprendre l'evaluation d'un classifieur.

## Matrice de couverture

### Charges de travail IA et considerations (15-20 %)

| Objectif officiel | Question(s) |
| --- | --- |
| Identifier les charges de travail de vision | `ai900-l-vision-workloads-check-1` |
| Identifier les charges de travail NLP | `ai900-l-ai-workloads-check-1` |
| Identifier le traitement de documents | `ai900-l-azure-vision-check-1` |
| Identifier les fonctions d'IA generative | `ai900-l-ai-generative-workload-check-1` |
| Equite | `ai900-l-responsible-ai-check-1` |
| Fiabilite et surete | `ai900-l-responsible-reliability-check-1` |
| Confidentialite et securite | `ai900-l-responsible-privacy-security-check-1` |
| Inclusion | `ai900-l-responsible-inclusiveness-check-1` |
| Transparence | `ai900-l-responsible-transparency-check-1` |
| Responsabilite | `ai900-l-responsible-accountability-check-1` |

### Principes fondamentaux du machine learning sur Azure (15-20 %)

| Objectif officiel | Question(s) |
| --- | --- |
| Regression | `ai900-l-ml-types-check-1` |
| Classification | `ai900-l-ml-classification-check-1` |
| Clustering | `ai900-l-ml-clustering-check-1` |
| Deep learning | `ai900-l-ml-deep-learning-check-1` |
| Architecture Transformer | `ai900-l-ml-transformer-check-1` |
| Features et labels | `ai900-l-ml-process-check-1` |
| Jeux d'entrainement et de validation | `ai900-l-ml-validation-check-1` |
| Machine learning automatise | `ai900-l-azure-ml-check-1` |
| Services de donnees et de calcul | `ai900-l-azure-ml-data-compute-check-1` |
| Gestion et deploiement des modeles | `ai900-l-azure-ml-model-deployment-check-1` |

### Vision par ordinateur sur Azure (15-20 %)

| Objectif officiel | Question(s) |
| --- | --- |
| Classification d'images | `ai900-l-vision-image-classification-check-1` |
| Detection d'objets | `ai900-l-vision-workloads-check-1` |
| OCR | `ai900-l-vision-ocr-check-1` |
| Detection et analyse de visages | `ai900-l-vision-face-workload-check-1` |
| Capacites Azure AI Vision | `ai900-l-azure-vision-service-check-1` |
| Service de detection Azure AI Face | `ai900-l-azure-face-check-1` |

### Traitement du langage naturel sur Azure (15-20 %)

| Objectif officiel | Question(s) |
| --- | --- |
| Extraction de phrases cles | `ai900-l-nlp-key-phrases-check-1` |
| Reconnaissance d'entites | `ai900-l-nlp-workloads-check-1` |
| Analyse de sentiment | `ai900-l-nlp-sentiment-check-1` |
| Modelisation du langage | `ai900-l-nlp-language-modeling-check-1` |
| Reconnaissance et synthese vocales | `ai900-l-azure-speech-recognition-check-1` |
| Traduction | `ai900-l-azure-translator-check-1` |
| Capacites Azure AI Language | `ai900-l-azure-language-service-check-1` |
| Capacites Azure AI Speech | `ai900-l-azure-language-check-1` |

### IA generative sur Azure (20-25 %)

| Objectif officiel | Question(s) |
| --- | --- |
| Fonctions des modeles generatifs | `ai900-l-genai-models-check-1` |
| Scenarios d'IA generative | `ai900-l-azure-openai-check-1` |
| IA responsable pour la generation | `ai900-l-genai-concepts-check-1`, `ai900-l-genai-responsible-check-1` |
| Capacites Azure AI Foundry | `ai900-l-microsoft-foundry-check-1` |
| Capacites Azure OpenAI Service | `ai900-l-azure-openai-service-check-1` |
| Catalogue de modeles Azure AI Foundry | `ai900-l-foundry-model-catalog-check-1` |

## Sources Microsoft Learn officielles

### Blueprint et statut

- [Guide d'etude AI-900 et change log](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/ai-900)
- [Page de l'examen AI-900 et avis de retrait](https://learn.microsoft.com/en-us/credentials/certifications/exams/ai-900/)
- [Guide d'etude AI-901, remplacement effectif en 2026](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/ai-901)

### IA responsable et machine learning

- [What is Responsible AI?](https://learn.microsoft.com/en-us/azure/machine-learning/concept-responsible-ai?view=azureml-api-2)
- [Introduction to machine learning concepts](https://learn.microsoft.com/en-us/training/modules/fundamentals-machine-learning/)
- [What is Azure Machine Learning?](https://learn.microsoft.com/en-us/azure/machine-learning/overview-what-is-azure-machine-learning?view=azureml-api-2)
- [What is automated machine learning?](https://learn.microsoft.com/en-us/azure/machine-learning/concept-automated-ml?view=azureml-api-2)

### Vision et documents

- [What is Azure Vision in Foundry Tools?](https://learn.microsoft.com/en-us/azure/ai-services/computer-vision/overview)
- [What is the Azure Face service?](https://learn.microsoft.com/en-us/azure/ai-services/face/overview-identity)
- [What is Azure Document Intelligence in Foundry Tools?](https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/overview?view=doc-intel-4.0.0)

### Langage, parole et traduction

- [What is Azure Language in Foundry Tools?](https://learn.microsoft.com/en-us/azure/ai-services/language-service/overview)
- [What is Azure Speech?](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/overview)
- [What is Azure Translator in Foundry Tools?](https://learn.microsoft.com/en-us/azure/ai-services/translator/overview)

### IA generative

- [Introduction to generative AI and agents](https://learn.microsoft.com/en-us/training/modules/fundamentals-generative-ai/)
- [What is Microsoft Foundry?](https://learn.microsoft.com/en-us/azure/foundry/what-is-foundry)
- [Microsoft Foundry Models overview](https://learn.microsoft.com/en-us/azure/foundry/concepts/foundry-models-overview)
- [Azure OpenAI in Microsoft Foundry Models](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/working-with-models)
- [Responsible AI practices for Azure OpenAI](https://learn.microsoft.com/en-us/azure/foundry/responsible-ai/openai/overview)

## Limites de fraicheur

- AI-900 est un blueprint historique ; AI-901 couvre les competences actuelles
  de certification et ajoute notamment l'implementation, les agents et Content
  Understanding.
- Content Understanding n'est pas ajoute a la matrice AI-900, car il n'apparait
  pas dans son dernier blueprint.
- Azure Vision Image Analysis 4.0 est deprecie et doit etre retire le
  25 septembre 2028. Les questions associees servent a couvrir le blueprint
  historique, pas a recommander ce service pour un nouveau projet.
- Dans Azure Language, l'extraction de phrases cles et l'analyse de sentiment
  restent prises en charge mais sont classees parmi les capacites historiques
  pour les implementations existantes.
- Les modeles disponibles et leurs regions evoluent. Les questions portent donc
  sur les capacites du catalogue et non sur une liste figee de noms de modeles.
