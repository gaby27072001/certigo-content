# Vague AWS Foundational 1 au 2026-08-18

## Périmètre

Cette vague ajoute du contenu original pour les deux certifications AWS
Foundational actives du catalogue :

- `aws:aif-c01` — AWS Certified AI Practitioner ;
- `aws:clf-c02` — AWS Certified Cloud Practitioner.

Les questions publiques utilisent `certigo question/v3` sous
`content/public/questions/aws/<certification>/`. Les solutions et explications
pédagogiques utilisent `certigo solution/v3` dans le chemin privé miroir
`content/answerKey/solutions/aws/<certification>/`. Les matrices publiques
canoniques restent sous `content/public/coverage/aws/`.

Aucun dump, banque de questions, site de formation ou autre source tierce n'a
été consulté. Les scénarios, formulations et distracteurs sont des créations
éditoriales originales fondées uniquement sur les guides et documentations AWS.

## Provenance du blueprint

| Certification | Guide canonique | Révision vérifiée | Sources de structure |
| --- | --- | --- | --- |
| AIF-C01 | [Guide HTML AWS](https://docs.aws.amazon.com/aws-certification/latest/ai-practitioner-01/ai-practitioner-01.html) | v1.1 publiée le 2026-04-30, confirmée par l'[historique AWS](https://docs.aws.amazon.com/aws-certification/latest/ai-practitioner-01/aif-01-revisions.html) | [services inclus](https://docs.aws.amazon.com/aws-certification/latest/ai-practitioner-01/aif-01-in-scope-services.html), pages officielles des domaines 1 à 5 |
| CLF-C02 | [Guide HTML AWS](https://docs.aws.amazon.com/aws-certification/latest/cloud-practitioner-02/cloud-practitioner-02.html) et [PDF AWS](https://d1.awsstatic.com/onedam/marketing-channels/website/aws/en_US/certification/approved/pdfs/docs-cloud-practitioner/AWS-Certified-Cloud-Practitioner_Exam-Guide.pdf) | le PDF porte l'édition `May 2025`, sans jour de publication ni numéro de version ; le catalogue conserve donc `guide.version` et `guide.publishedOn` à `null` | [technologies et concepts](https://docs.aws.amazon.com/aws-certification/latest/cloud-practitioner-02/clf-technologies-concepts.html), [services inclus](https://docs.aws.amazon.com/aws-certification/latest/cloud-practitioner-02/clf-02-in-scope-services.html), pages officielles des domaines 1 à 4 |

La version interne de blueprint reste `2026-08-17`, car les objectifs et
pondérations hérités de la fondation #20 sont inchangés. La provenance des deux
entrées du catalogue est revérifiée au `2026-08-18`.

## Matrice AIF-C01

### Domaines et pondérations

| Domaine | Intitulé officiel | Pondération | Paires |
| --- | --- | ---: | ---: |
| 1 | Fundamentals of AI and ML | 20 % | 4 |
| 2 | Fundamentals of GenAI | 24 % | 5 |
| 3 | Applications of Foundation Models | 28 % | 6 |
| 4 | Guidelines for Responsible AI | 14 % | 2 |
| 5 | Security, Compliance, and Governance for AI Solutions | 14 % | 3 |

### Objectifs et couverture

| Objectif AWS | Portée éditoriale paraphrasée | Questions | Source |
| --- | --- | --- | --- |
| 1.1 | Terminologie IA/ML, types de données et apprentissage supervisé, non supervisé ou par renforcement | `001` | [Domaine 1](https://docs.aws.amazon.com/aws-certification/latest/ai-practitioner-01/ai-practitioner-01-domain1.html) |
| 1.2 | Valeur et cas d'usage IA, classification/régression/clustering, choix entre ML traditionnel et modèle fondamental | `002`, `003` | [Domaine 1](https://docs.aws.amazon.com/aws-certification/latest/ai-practitioner-01/ai-practitioner-01-domain1.html) |
| 1.3 | Cycle de développement, MLOps, métriques techniques et métier | `004` | [Domaine 1](https://docs.aws.amazon.com/aws-certification/latest/ai-practitioner-01/ai-practitioner-01-domain1.html) |
| 2.1 | Jetons, embeddings, modèles multimodaux, context engineering, agents, outils et orchestration | `005`, `006`, `007` | [Domaine 2](https://docs.aws.amazon.com/aws-certification/latest/ai-practitioner-01/ai-practitioner-01-domain2.html) |
| 2.2 | Capacités, limites, hallucinations, sélection de modèle et valeur métier | `008` | [Domaine 2](https://docs.aws.amazon.com/aws-certification/latest/ai-practitioner-01/ai-practitioner-01-domain2.html) |
| 2.3 | Services et infrastructure AWS pour GenAI, services gérés et compromis de coût | `009` | [Domaine 2](https://docs.aws.amazon.com/aws-certification/latest/ai-practitioner-01/ai-practitioner-01-domain2.html) |
| 3.1 | Sélection et paramètres d'un modèle fondamental, RAG, stockages vectoriels et agents | `010`, `011` | [Domaine 3](https://docs.aws.amazon.com/aws-certification/latest/ai-practitioner-01/ai-practitioner-01-domain3.html) |
| 3.2 | Prompt engineering, zero/few-shot, garde-fous, attaques et gestion de versions | `012`, `013` | [Domaine 3](https://docs.aws.amazon.com/aws-certification/latest/ai-practitioner-01/ai-practitioner-01-domain3.html) |
| 3.3 | Préentraînement, fine-tuning, distillation et préparation de données gouvernées | `014` | [Domaine 3](https://docs.aws.amazon.com/aws-certification/latest/ai-practitioner-01/ai-practitioner-01-domain3.html) |
| 3.4 | Évaluation humaine et automatique, benchmarks, métriques métier, RAG, agents et workflows | `015` | [Domaine 3](https://docs.aws.amazon.com/aws-certification/latest/ai-practitioner-01/ai-practitioner-01-domain3.html) |
| 4.1 | Équité, robustesse, sécurité, véracité, biais et analyse par sous-groupes | `016` | [Domaine 4](https://docs.aws.amazon.com/aws-certification/latest/ai-practitioner-01/ai-practitioner-01-domain4.html) |
| 4.2 | Transparence, explicabilité, Model Cards, compromis et conception centrée sur l'humain | `017` | [Domaine 4](https://docs.aws.amazon.com/aws-certification/latest/ai-practitioner-01/ai-practitioner-01-domain4.html) |
| 5.1 | IAM, chiffrement, sécurité des données et applications, prompt injection, validation de sortie et grounding | `018`, `019` | [Domaine 5](https://docs.aws.amazon.com/aws-certification/latest/ai-practitioner-01/ai-practitioner-01-domain5.html) |
| 5.2 | Gouvernance, conformité, audit, journalisation, résidence et rétention des données | `020` | [Domaine 5](https://docs.aws.amazon.com/aws-certification/latest/ai-practitioner-01/ai-practitioner-01-domain5.html) |

Les identifiants complets sont ceux de la matrice
`content/public/coverage/aws/aif-c01.json`. Les suffixes numériques ci-dessus
servent uniquement à rendre la lecture de cette matrice éditoriale compacte.

### Documentation AWS complémentaire utilisée

- [Tarification Amazon Bedrock](https://aws.amazon.com/bedrock/pricing/)
- [Amazon Bedrock Knowledge Bases](https://docs.aws.amazon.com/bedrock/latest/userguide/knowledge-base.html)
- [Agents for Amazon Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/agents.html)
- [Amazon Bedrock Guardrails](https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails.html)
- [Paramètres d'inférence Amazon Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/inference-parameters.html)
- [Amazon Bedrock Prompt Management](https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-management.html)
- [Détection de biais avec SageMaker Clarify](https://docs.aws.amazon.com/sagemaker/latest/dg/clarify-detect-post-training-bias.html)
- [SageMaker Model Cards](https://docs.aws.amazon.com/sagemaker/latest/dg/model-cards.html)
- [IAM pour Amazon Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/security-iam.html)
- [AWS CloudTrail](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-user-guide.html)

## Matrice CLF-C02

### Domaines et pondérations

| Domaine | Intitulé officiel | Pondération | Paires |
| --- | --- | ---: | ---: |
| 1 | Cloud Concepts | 24 % | 5 |
| 2 | Security and Compliance | 30 % | 6 |
| 3 | Cloud Technology and Services | 34 % | 8 |
| 4 | Billing, Pricing, and Support | 12 % | 3 |

### Objectifs et couverture

| Objectif AWS | Portée éditoriale paraphrasée | Questions | Source |
| --- | --- | --- | --- |
| 1.1 | Valeur du cloud, portée mondiale, haute disponibilité, élasticité et agilité | `001` | [Domaine 1](https://docs.aws.amazon.com/aws-certification/latest/cloud-practitioner-02/cloud-practitioner-02-domain1.html) |
| 1.2 | Principes du AWS Well-Architected Framework et distinction de ses six piliers | `002` | [Domaine 1](https://docs.aws.amazon.com/aws-certification/latest/cloud-practitioner-02/cloud-practitioner-02-domain1.html) |
| 1.3 | Stratégies et ressources de migration, AWS CAF et réplication de bases de données | `003`, `005` | [Domaine 1](https://docs.aws.amazon.com/aws-certification/latest/cloud-practitioner-02/cloud-practitioner-02-domain1.html) |
| 1.4 | Économie du cloud, coûts fixes/variables, rightsizing, licences et économies d'échelle | `004` | [Domaine 1](https://docs.aws.amazon.com/aws-certification/latest/cloud-practitioner-02/cloud-practitioner-02-domain1.html) |
| 2.1 | Modèle de responsabilité partagée et variation selon le service | `006` | [Domaine 2](https://docs.aws.amazon.com/aws-certification/latest/cloud-practitioner-02/cloud-practitioner-02-domain2.html) |
| 2.2 | Sécurité, gouvernance, conformité, chiffrement, audit, surveillance et rapports | `007`, `008` | [Domaine 2](https://docs.aws.amazon.com/aws-certification/latest/cloud-practitioner-02/cloud-practitioner-02-domain2.html) |
| 2.3 | IAM, protection du root user, moindre privilège, MFA, fédération, rôles et secrets | `009`, `010` | [Domaine 2](https://docs.aws.amazon.com/aws-certification/latest/cloud-practitioner-02/cloud-practitioner-02-domain2.html) |
| 2.4 | Services, ressources et documentation de sécurité AWS | `011` | [Domaine 2](https://docs.aws.amazon.com/aws-certification/latest/cloud-practitioner-02/cloud-practitioner-02-domain2.html) |
| 3.1 | Console, API, SDK, CLI, infrastructure as code et modèles de déploiement | `012` | [Domaine 3](https://docs.aws.amazon.com/aws-certification/latest/cloud-practitioner-02/cloud-practitioner-02-domain3.html) |
| 3.2 | Régions, Availability Zones, edge locations, haute disponibilité et multi-Région | `013` | [Domaine 3](https://docs.aws.amazon.com/aws-certification/latest/cloud-practitioner-02/cloud-practitioner-02-domain3.html) |
| 3.3 | Services de calcul, conteneurs, serverless, Auto Scaling et équilibrage de charge | `014` | [Domaine 3](https://docs.aws.amazon.com/aws-certification/latest/cloud-practitioner-02/cloud-practitioner-02-domain3.html) |
| 3.4 | Bases relationnelles, NoSQL, en mémoire et services de migration | `015` | [Domaine 3](https://docs.aws.amazon.com/aws-certification/latest/cloud-practitioner-02/cloud-practitioner-02-domain3.html) |
| 3.5 | VPC, subnets, passerelles, contrôles réseau, DNS et connectivité hybride | `016` | [Domaine 3](https://docs.aws.amazon.com/aws-certification/latest/cloud-practitioner-02/cloud-practitioner-02-domain3.html) |
| 3.6 | Stockage objet, bloc et fichiers, classes S3, cycle de vie et sauvegarde | `017` | [Domaine 3](https://docs.aws.amazon.com/aws-certification/latest/cloud-practitioner-02/cloud-practitioner-02-domain3.html) |
| 3.7 | Services AWS AI/ML et services d'analytique | `021` | [Domaine 3](https://docs.aws.amazon.com/aws-certification/latest/cloud-practitioner-02/cloud-practitioner-02-domain3.html) |
| 3.8 | Intégration applicative, applications métier, outils développeur, IoT et autres catégories incluses | `018` | [Domaine 3](https://docs.aws.amazon.com/aws-certification/latest/cloud-practitioner-02/cloud-practitioner-02-domain3.html) |
| 4.1 | Modèles de tarification du calcul et du stockage, engagements, capacité et transferts | `019` | [Domaine 4](https://docs.aws.amazon.com/aws-certification/latest/cloud-practitioner-02/cloud-practitioner-02-domain4.html) |
| 4.2 | Facturation, budgets, Cost Explorer, Pricing Calculator, Organizations, rapports et tags | `020` | [Domaine 4](https://docs.aws.amazon.com/aws-certification/latest/cloud-practitioner-02/cloud-practitioner-02-domain4.html) |
| 4.3 | Documentation, communautés, plans AWS Support, partenaires, Trusted Advisor et AWS Health | `022` | [Domaine 4](https://docs.aws.amazon.com/aws-certification/latest/cloud-practitioner-02/cloud-practitioner-02-domain4.html) |

Les identifiants complets sont ceux de la matrice
`content/public/coverage/aws/clf-c02.json`.

### Documentation AWS complémentaire utilisée

- [AWS Global Infrastructure](https://docs.aws.amazon.com/whitepapers/latest/aws-overview/global-infrastructure.html)
- [AWS Well-Architected Framework](https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html)
- [AWS Cloud Adoption Framework](https://docs.aws.amazon.com/whitepapers/latest/overview-aws-cloud-adoption-framework/welcome.html)
- [AWS Pricing](https://aws.amazon.com/pricing/)
- [AWS Database Migration Service](https://docs.aws.amazon.com/dms/latest/userguide/Welcome.html)
- [Modèle de responsabilité partagée](https://aws.amazon.com/compliance/shared-responsibility-model/)
- [AWS Artifact](https://docs.aws.amazon.com/artifact/latest/ug/what-is-aws-artifact.html)
- [AWS CloudTrail](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-user-guide.html)
- [Bonnes pratiques du root user](https://docs.aws.amazon.com/IAM/latest/UserGuide/root-user-best-practices.html)
- [Bonnes pratiques IAM](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [Amazon GuardDuty](https://docs.aws.amazon.com/guardduty/latest/ug/what-is-guardduty.html)
- [AWS CloudFormation](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/Welcome.html)
- [AWS Lambda](https://docs.aws.amazon.com/lambda/latest/dg/welcome.html)
- [Amazon DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html)
- [Security groups VPC](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-security-groups.html)
- [Cycle de vie Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lifecycle-mgmt.html)
- [Amazon SNS](https://docs.aws.amazon.com/sns/latest/dg/welcome.html)
- [Amazon EC2 Spot Instances](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-spot-instances.html)
- [AWS Cost Explorer](https://docs.aws.amazon.com/cost-management/latest/userguide/ce-what-is.html)

## Métriques et contrôles éditoriaux

| Certification | Paires | Répartition par domaine | Positions A/B/C/D | Objectifs de blueprint couverts |
| --- | ---: | --- | --- | --- |
| AIF-C01 | 20 | 4 / 5 / 6 / 2 / 3 | 5 / 5 / 5 / 5 | 14 sur 14 |
| CLF-C02 | 22 | 5 / 6 / 8 / 3 | 5 / 6 / 6 / 5 | 19 sur 19 |

Chaque question possède quatre choix distincts. Les distracteurs restent dans le
même domaine conceptuel que le scénario, mais échouent sur le service, la
responsabilité, la métrique ou le compromis demandé. Les explications privées
explicitent le choix attendu et l'inadéquation des trois distracteurs.

Les fichiers publics ne contiennent aucune clé de corrigé. Les chemins publics
et privés sont strictement isomorphes, les métadonnées v3 sont identiques, et
chaque identifiant apparaît une seule fois dans la matrice de sa certification.
Le packaging reste canonique et ne contient ni date d'exécution ni chemin
spécifique à une machine.
