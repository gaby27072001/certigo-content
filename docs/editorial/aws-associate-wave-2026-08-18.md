# Vague editoriale AWS Associate - 2026-08-18

## Cadre commun de la vague

- **Sources officielles uniquement, arretees au 2026-08-18.** Seuls les domaines
  `aws.amazon.com`, `docs.aws.amazon.com` et `d1.awsstatic.com` sont utilises :
  page de certification, guide d'examen et pages de domaines officielles. Aucun
  site de preparation, forum, blog, banque de questions ou « dump » n'est
  consulte.
- **Contenu original, sans reproduction.** Les items sont des scenarios inedits
  rediges en francais, au niveau Associate/CloudOps. Les enonces des task
  statements officiels sont resumes fidelement dans ce document mais ne sont
  jamais recopies dans les questions, et aucune question d'examen reelle n'est
  reprise.
- **Separation des zones de confiance v3.** Chaque item est une paire :
  la question publique (`content/public/questions/<provider>/<slug>/<id>.json`)
  ne contient que `prompt` et `choices` ; la reponse et l'explication vivent
  exclusivement dans la solution privee
  (`content/answerKey/solutions/<provider>/<slug>/<id>.json`). Les identifiants,
  les chemins relatifs et les metadonnees (`provider`, `certification`,
  `blueprintVersion`, `objective`) sont identiques des deux cotes.
- **Equilibre des positions de reponse.** La cible est une repartition uniforme
  de la bonne reponse sur les quatre positions (25 % par position), avec un
  ordre volontairement melange d'un item a l'autre afin d'eviter tout motif
  exploitable.
- **Repartition par domaine.** Le nombre d'items par domaine suit les
  ponderations officielles publiees dans le guide d'examen.

## SOA-C03 - AWS Certified CloudOps Engineer - Associate

### References officielles

| Ressource | URL |
| --- | --- |
| Page de certification | https://aws.amazon.com/certification/certified-cloudops-engineer-associate/ |
| Guide d'examen (SOA-C03) | https://docs.aws.amazon.com/aws-certification/latest/sysops-administrator-associate-03/sysops-administrator-associate-03.html |
| Domaine 1 | https://docs.aws.amazon.com/aws-certification/latest/sysops-administrator-associate-03/sysops-administrator-associate-03-domain1.html |
| Domaine 2 | https://docs.aws.amazon.com/aws-certification/latest/sysops-administrator-associate-03/sysops-administrator-associate-03-domain2.html |
| Domaine 3 | https://docs.aws.amazon.com/aws-certification/latest/sysops-administrator-associate-03/sysops-administrator-associate-03-domain3.html |
| Domaine 4 | https://docs.aws.amazon.com/aws-certification/latest/sysops-administrator-associate-03/sysops-administrator-associate-03-domain4.html |
| Domaine 5 | https://docs.aws.amazon.com/aws-certification/latest/sysops-administrator-associate-03/sysops-administrator-associate-03-domain5.html |

Blueprint utilise : `2026-08-17` ; matrice de couverture :
[`content/public/coverage/aws/soa-c03.json`](../../content/public/coverage/aws/soa-c03.json).

### Domaines officiels et ponderations

| Domaine | Titre officiel | Ponderation |
| --- | --- | --- |
| domain-1 | Monitoring, Logging, Analysis, Remediation, and Performance Optimization | 22 % |
| domain-2 | Reliability and Business Continuity | 22 % |
| domain-3 | Deployment, Provisioning, and Automation | 22 % |
| domain-4 | Security and Compliance | 16 % |
| domain-5 | Networking and Content Delivery | 18 % |

### Resume fidele des task statements officiels

**Domaine 1 - Monitoring, Logging, Analysis, Remediation, and Performance
Optimization (22 %)**

- *Tache 1.1 - Mettre en oeuvre metriques, alarmes et filtres avec les services
  de surveillance et de journalisation AWS.* Configurer la surveillance et la
  journalisation des charges de travail (sans serveur, calcul, IA) avec
  CloudWatch, CloudTrail ou Amazon Managed Service for Prometheus ; configurer
  et gerer l'agent CloudWatch pour collecter metriques et journaux depuis EC2,
  Amazon ECS ou Amazon EKS ; configurer, identifier et depanner les alarmes
  CloudWatch, y compris les alarmes composites et leurs actions declenchables
  directement ou via EventBridge ; creer et partager des tableaux de bord
  CloudWatch couvrant plusieurs comptes et Regions ; faire envoyer des
  notifications vers Amazon SNS.
- *Tache 1.2 - Identifier et corriger les problemes a partir des metriques de
  surveillance et de disponibilite.* Analyser les metriques de performance et
  automatiser les strategies de remediation (CloudWatch, Lambda, AWS Systems
  Manager, CloudTrail) ; utiliser EventBridge pour router, enrichir et livrer
  les evenements et depanner les regles de bus d'evenements ; creer ou executer
  des runbooks Systems Manager Automation personnalises ou predefinis.
- *Tache 1.3 - Mettre en oeuvre des strategies d'optimisation des performances
  pour le calcul, le stockage et les bases de donnees.* Optimiser les ressources
  de calcul a partir des metriques, des etiquettes et des outils AWS ; analyser
  les metriques Amazon EBS, depanner et choisir le type de volume adapte ;
  optimiser Amazon S3 (DataSync, S3 Transfer Acceleration, chargements
  partitionnes, regles de cycle de vie) ; evaluer et optimiser les solutions de
  stockage partage (Amazon EFS, Amazon FSx) ; surveiller Amazon RDS
  (Performance Insights, alarmes CloudWatch, RDS Proxy) ; optimiser les
  instances EC2 et leurs capacites de stockage et de reseau.

**Domaine 2 - Reliability and Business Continuity (22 %)**

- *Tache 2.1 - Mettre en oeuvre l'evolutivite et l'elasticite.* Configurer et
  gerer les mecanismes de mise a l'echelle des environnements de calcul ;
  implementer la mise en cache (CloudFront, Amazon ElastiCache) ; configurer la
  mise a l'echelle des bases de donnees gerees (Amazon RDS, DynamoDB).
- *Tache 2.2 - Mettre en oeuvre des environnements hautement disponibles et
  resilients.* Configurer et depanner Elastic Load Balancing et les controles de
  sante Amazon Route 53 ; configurer des systemes tolerants aux pannes, par
  exemple des deploiements multi-AZ.
- *Tache 2.3 - Mettre en oeuvre les strategies de sauvegarde et de
  restauration.* Automatiser instantanes et sauvegardes (EC2, RDS, EBS, S3,
  DynamoDB) avec des services tels qu'AWS Backup ; restaurer des bases de
  donnees, notamment par restauration a un instant donne, en respectant RTO,
  RPO et contraintes de cout ; mettre en oeuvre la gestion des versions pour les
  services de stockage ; appliquer les procedures de reprise apres sinistre
  (sauvegarde et restauration, pilot light, warm standby, actif/actif).

**Domaine 3 - Deployment, Provisioning, and Automation (22 %)**

- *Tache 3.1 - Provisionner et maintenir les ressources cloud.* Creer et gerer
  AMI et images de conteneurs (EC2 Image Builder) ; creer et gerer des
  ressources avec CloudFormation et l'AWS CDK ; identifier et corriger les
  problemes de deploiement (dimensionnement de sous-reseaux, erreurs
  CloudFormation, autorisations) ; provisionner et partager des ressources entre
  Regions et comptes (AWS RAM, CloudFormation StackSets) ; mettre en oeuvre des
  strategies de deploiement ; utiliser des outils tiers d'automatisation
  (Terraform, Git).
- *Tache 3.2 - Automatiser la gestion des ressources existantes.* Automatiser
  les processus operationnels avec les services AWS, notamment Systems Manager ;
  mettre en oeuvre l'automatisation pilotee par les evenements (Lambda,
  notifications d'evenements S3, EventBridge).

**Domaine 4 - Security and Compliance (16 %)**

- *Tache 4.1 - Mettre en oeuvre et gerer les outils et politiques de securite et
  de conformite.* Implementer les fonctionnalites IAM (politiques de mot de
  passe, MFA, roles, identite federee, politiques de ressources, conditions) ;
  depanner et auditer les problemes d'acces (CloudTrail, IAM Access Analyzer,
  simulateur de politiques) ; mettre en oeuvre des strategies multi-comptes
  securisees (AWS Organizations, politiques de controle des services, IAM
  Identity Center) ; remedier aux resultats des controles de securite Trusted
  Advisor ; faire respecter les exigences de conformite et la surveillance
  continue (selection de Regions et de services, packs de conformite AWS
  Config).
- *Tache 4.2 - Mettre en oeuvre les strategies de protection des donnees et de
  l'infrastructure.* Appliquer un schema de classification des donnees ;
  configurer et depanner le chiffrement au repos (AWS KMS) ; configurer et
  depanner le chiffrement en transit (AWS Certificate Manager) ; stocker les
  secrets de maniere securisee ; configurer les rapports et corriger les
  resultats de Security Hub, Amazon GuardDuty, AWS Config et Amazon Inspector.

**Domaine 5 - Networking and Content Delivery (18 %)**

- *Tache 5.1 - Mettre en oeuvre et optimiser les fonctionnalites reseau et la
  connectivite.* Configurer un VPC (sous-reseaux, tables de routage, ACL reseau,
  groupes de securite, passerelles NAT, passerelle Internet, passerelle Internet
  sortante uniquement) ; configurer la connectivite privee (points de
  terminaison VPC, AWS PrivateLink, appairage de VPC) ; auditer les services de
  protection reseau (Route 53 Resolver DNS Firewall, AWS WAF, AWS Shield, AWS
  Network Firewall) dans un compte ; optimiser le cout des architectures reseau.
- *Tache 5.2 - Configurer les domaines, les services DNS et la distribution de
  contenu.* Configurer le DNS, notamment Route 53 Resolver ; mettre en oeuvre
  les strategies de routage Route 53, leurs configurations et la journalisation
  des requetes ; configurer la distribution de contenu et de services
  (CloudFront, AWS Global Accelerator).
- *Tache 5.3 - Depanner les problemes de connectivite reseau.* Depanner les
  configurations VPC (sous-reseaux, tables de routage, ACL reseau, groupes de
  securite, passerelles de transit, passerelles NAT) ; collecter et interpreter
  les journaux reseau (journaux de flux VPC, journaux d'acces ELB, journaux
  d'ACL web AWS WAF, journaux CloudFront, journaux de conteneurs) ; identifier
  et corriger les problemes de mise en cache CloudFront ; depanner la
  connectivite hybride et privee ; configurer et analyser les services de
  surveillance reseau CloudWatch.

### Couverture produite

20 paires publiques/privees v3, sequences `001` a `020`, chacune avec quatre
choix uniques.

| Domaine | Items | Sequences | Themes couverts |
| --- | --- | --- | --- |
| domain-1 | 5 | 001-005 | Reduction du bruit d'alertes correlees, indisponibilite des mesures d'hote sur une flotte, remediation automatisee et tracable d'un service defaillant, saturation du debit d'un stockage bloc, diagnostic de ralentissements intermittents sur une base relationnelle |
| domain-2 | 4 | 006-009 | Adaptation de capacite a un trafic imprevisible, continuite d'un service actif-passif entre deux Regions, centralisation des sauvegardes de plusieurs types de ressources, restauration apres suppression accidentelle avec RPO court |
| domain-3 | 4 | 010-013 | Diffusion d'un socle commun a de nombreux comptes et Regions, deblocage d'un deploiement apres derive manuelle, mise a disposition mensuelle d'un modele de serveur durci et teste, application de correctifs a une flotte multi-comptes avec suivi de conformite |
| domain-4 | 3 | 014-016 | Suppression des identifiants statiques presents sur des instances, detection de ressources exposees ou non chiffrees a l'echelle d'une organisation, diagnostic d'un acces refuse sur des objets chiffres |
| domain-5 | 4 | 017-020 | Interpretation de journaux reseau pour une reponse bloquee, reduction du cout de sortie reseau lors de lectures massives, service actif-actif optimisant le temps de reponse, anciennes versions servies apres une mise en production |

Repartition des positions de la bonne reponse (base 1), conforme a la cible
d'equilibre :

| Position | Nombre d'items | Part |
| --- | --- | --- |
| 1 | 5 | 25 % |
| 2 | 5 | 25 % |
| 3 | 5 | 25 % |
| 4 | 5 | 25 % |

Aucune reponse ni explication n'est reproduite dans ce document : elles restent
confinees a `content/answerKey/solutions/aws/soa-c03/`.

## DEA-C01 - AWS Certified Data Engineer - Associate

### References officielles

| Ressource | URL |
| --- | --- |
| Page de certification | https://aws.amazon.com/certification/certified-data-engineer-associate/ |
| Guide d'examen (DEA-C01) | https://docs.aws.amazon.com/aws-certification/latest/data-engineer-associate-01/data-engineer-associate-01.html |
| Domaine 1 | https://docs.aws.amazon.com/aws-certification/latest/data-engineer-associate-01/data-engineer-associate-01-domain1.html |
| Domaine 2 | https://docs.aws.amazon.com/aws-certification/latest/data-engineer-associate-01/data-engineer-associate-01-domain2.html |
| Domaine 3 | https://docs.aws.amazon.com/aws-certification/latest/data-engineer-associate-01/data-engineer-associate-01-domain3.html |
| Domaine 4 | https://docs.aws.amazon.com/aws-certification/latest/data-engineer-associate-01/data-engineer-associate-01-domain4.html |

Sources consultees le 2026-08-18. Blueprint utilise : `2026-08-17` ; matrice de
couverture :
[`content/public/coverage/aws/dea-c01.json`](../../content/public/coverage/aws/dea-c01.json).

### Domaines officiels et ponderations

| Domaine | Titre officiel | Ponderation |
| --- | --- | --- |
| domain-1 | Data Ingestion and Transformation | 34 % |
| domain-2 | Data Store Management | 26 % |
| domain-3 | Data Operations and Support | 22 % |
| domain-4 | Data Security and Governance | 18 % |

### Resume fidele des task statements officiels

**Domaine 1 - Data Ingestion and Transformation (34 %)**

- *Tache 1.1 - Realiser l'ingestion des donnees.* Lire des donnees depuis des
  sources en continu (Amazon Kinesis, Amazon MSK, Amazon DynamoDB Streams, AWS
  DMS, AWS Glue, Amazon Redshift) et depuis des sources par lots (Amazon S3, AWS
  Glue, Amazon EMR, AWS DMS, Amazon Redshift, AWS Lambda, Amazon AppFlow) ;
  choisir les options de configuration adaptees a l'ingestion par lots ;
  consommer des API de donnees ; mettre en place des planificateurs avec Amazon
  EventBridge, Apache Airflow ou des declenchements horaires pour les taches et
  les crawlers ; configurer des declencheurs evenementiels (notifications
  d'evenements Amazon S3, EventBridge) ; appeler une fonction Lambda depuis
  Kinesis ; creer des listes d'adresses IP autorisees pour joindre les sources ;
  gerer la limitation de debit et le depassement des quotas (DynamoDB, Amazon
  RDS, Kinesis) ; gerer la concentration et la diffusion des flux (fan-in et
  fan-out) ; decrire la relecture des pipelines d'ingestion ; distinguer les
  transactions avec et sans etat.
- *Tache 1.2 - Transformer et traiter les donnees.* Optimiser l'usage des
  conteneurs pour la performance (Amazon EKS, Amazon ECS) ; se connecter a
  differentes sources via JDBC ou ODBC ; integrer des donnees de plusieurs
  origines ; optimiser les couts de traitement ; mettre en oeuvre les services de
  transformation adaptes aux exigences (Amazon EMR, AWS Glue, Lambda, Amazon
  Redshift) ; convertir les donnees d'un format a un autre, par exemple de .csv
  vers Apache Parquet ; diagnostiquer et corriger les echecs de transformation et
  les problemes de performance courants ; creer des API de donnees pour exposer
  les donnees a d'autres systemes ; caracteriser le volume, la velocite et la
  variete des donnees (structurees et non structurees) ; integrer des grands
  modeles de langage dans le traitement des donnees.
- *Tache 1.3 - Orchestrer les pipelines de donnees.* Construire des flux de
  travail ETL avec les services d'orchestration (Lambda, EventBridge, Amazon
  MWAA, AWS Step Functions, flux de travail AWS Glue) ; concevoir des pipelines
  performants, disponibles, evolutifs, resilients et tolerants aux pannes ;
  mettre en oeuvre et maintenir des flux de travail sans serveur ; utiliser les
  services de notification pour emettre des alertes (Amazon SNS, Amazon SQS).
- *Tache 1.4 - Appliquer les concepts de programmation.* Optimiser le code pour
  reduire la duree d'execution de l'ingestion et de la transformation ;
  configurer la concurrence et la performance des fonctions Lambda ; utiliser les
  langages et cadres applicatifs de l'ingenierie de donnees (Python, SQL, Scala,
  R, Java, Bash, PowerShell) ; appliquer les bonnes pratiques du genie logiciel
  (gestion de versions, tests, journalisation, surveillance) ; deployer les
  solutions avec l'infrastructure sous forme de code ; empaqueter et deployer des
  pipelines sans serveur avec AWS SAM ; monter et utiliser des volumes de
  stockage depuis une fonction Lambda ; utiliser l'infrastructure sous forme de
  code pour des deploiements repetables (AWS CloudFormation, AWS CDK) ; decrire
  l'integration et la livraison continues appliquees aux pipelines de donnees ;
  definir le calcul distribue ; decrire les structures de donnees et les
  algorithmes, par exemple les graphes et les arbres.

**Domaine 2 - Data Store Management (26 %)**

- *Tache 2.1 - Choisir un magasin de donnees.* Mettre en oeuvre les services de
  stockage repondant aux exigences de cout et de performance (Amazon Redshift,
  Amazon EMR, AWS Lake Formation, Amazon RDS, Amazon DynamoDB, Amazon Kinesis
  Data Streams, Amazon MSK) ; configurer ces services selon les modeles d'acces
  attendus ; appliquer chaque service au cas d'usage pertinent, par exemple les
  algorithmes d'indexation HNSW avec Amazon Aurora PostgreSQL ou Amazon MemoryDB
  pour l'acces cle-valeur rapide ; integrer les outils de migration dans les
  systemes de traitement (AWS Transfer Family) ; mettre en oeuvre la migration ou
  l'acces distant (requetes federees Amazon Redshift, vues materialisees, Amazon
  Redshift Spectrum) ; gerer les verrous empechant l'acces aux donnees (Amazon
  Redshift, Amazon RDS) ; gerer les formats de table ouverts tels qu'Apache
  Iceberg ; decrire les types d'index vectoriels (HNSW, IVF).
- *Tache 2.2 - Comprendre les systemes de catalogage des donnees.* Utiliser les
  catalogues pour consommer les donnees a la source ; construire et referencer un
  catalogue technique (catalogue de donnees AWS Glue, metastore Apache Hive) ;
  decouvrir les schemas et alimenter les catalogues avec les crawlers AWS Glue ;
  synchroniser les partitions avec un catalogue ; creer de nouvelles connexions
  source ou cible pour le catalogage (AWS Glue) ; creer et gerer des catalogues
  metier, par exemple Amazon SageMaker Catalog.
- *Tache 2.3 - Gerer le cycle de vie des donnees.* Realiser les operations de
  chargement et de dechargement entre Amazon S3 et Amazon Redshift ; gerer les
  regles de cycle de vie S3 pour changer la classe de stockage ; faire expirer les
  donnees a un age determine par ces memes regles ; gerer la gestion des versions
  S3 et la duree de vie (TTL) DynamoDB ; supprimer les donnees pour repondre aux
  exigences metier et legales ; proteger les donnees par une resilience et une
  disponibilite appropriees.
- *Tache 2.4 - Concevoir les modeles de donnees et l'evolution des schemas.*
  Concevoir les schemas pour Amazon Redshift, DynamoDB et Lake Formation ;
  prendre en compte les changements de caracteristiques des donnees ; realiser
  les conversions de schema (AWS SCT, conversion de schema AWS DMS) ; etablir la
  tracabilite des donnees avec les outils AWS (Amazon SageMaker ML Lineage
  Tracking, Amazon SageMaker Catalog) ; decrire les bonnes pratiques
  d'indexation, de partitionnement, de compression et d'optimisation ; decrire
  les concepts de vectorisation, par exemple les bases de connaissances Amazon
  Bedrock.

**Domaine 3 - Data Operations and Support (22 %)**

- *Tache 3.1 - Automatiser le traitement des donnees avec les services AWS.*
  Orchestrer les pipelines (Amazon MWAA, AWS Step Functions) ; depanner les flux
  de travail geres ; appeler les SDK pour acceder aux fonctionnalites AWS depuis
  le code ; exploiter les fonctionnalites des services de traitement (Amazon EMR,
  Amazon Redshift, AWS Glue) ; consommer et maintenir des API de donnees ;
  preparer les donnees en vue de leur transformation (AWS Glue DataBrew, Amazon
  SageMaker Unified Studio) ; interroger les donnees, par exemple avec Amazon
  Athena ; automatiser le traitement avec AWS Lambda ; gerer les evenements et
  les planificateurs avec Amazon EventBridge.
- *Tache 3.2 - Analyser les donnees avec les services AWS.* Visualiser les
  donnees (DataBrew, Amazon QuickSight) ; verifier et nettoyer les donnees
  (Lambda, Athena, QuickSight, carnets Jupyter, Amazon SageMaker Data Wrangler) ;
  utiliser SQL dans Amazon Redshift et Athena pour interroger les donnees ou
  creer des vues ; explorer les donnees avec les carnets Athena fondes sur Apache
  Spark ; decrire les compromis entre services provisionnes et services sans
  serveur ; definir l'agregation, la moyenne glissante, le regroupement et le
  pivotement.
- *Tache 3.3 - Maintenir et surveiller les pipelines de donnees.* Extraire les
  journaux a des fins d'audit ; deployer des solutions de journalisation et de
  surveillance facilitant l'audit et la tracabilite ; utiliser les notifications
  pour emettre des alertes ; depanner les problemes de performance ; suivre les
  appels d'API avec AWS CloudTrail ; depanner et maintenir les pipelines (AWS
  Glue, Amazon EMR) ; journaliser les donnees applicatives dans Amazon CloudWatch
  Logs en privilegiant la configuration et l'automatisation ; analyser les
  journaux avec les services AWS (Athena, Amazon EMR, Amazon OpenSearch Service,
  CloudWatch Logs Insights, journaux d'applications big data).
- *Tache 3.4 - Garantir la qualite des donnees.* Executer des controles de
  qualite pendant le traitement, par exemple la detection de champs vides ;
  definir des regles de qualite, notamment avec DataBrew ; investiguer la
  coherence des donnees avec DataBrew ; decrire les techniques
  d'echantillonnage ; mettre en oeuvre des mecanismes de traitement du
  desequilibre des donnees.

**Domaine 4 - Data Security and Governance (18 %)**

- *Tache 4.1 - Appliquer les mecanismes d'authentification.* Mettre a jour les
  groupes de securite VPC ; creer et mettre a jour les groupes, roles, points de
  terminaison et services IAM ; creer et faire tourner les identifiants pour la
  gestion des mots de passe (AWS Secrets Manager) ; definir des roles IAM pour
  l'acces (AWS Lambda, Amazon API Gateway, AWS CLI, AWS CloudFormation) ;
  appliquer des politiques IAM aux roles, points de terminaison et services
  (points d'acces S3, AWS PrivateLink) ; decrire les differences entre services
  geres et non geres ; utiliser domaines, unites de domaine et projets dans
  SageMaker Unified Studio.
- *Tache 4.2 - Appliquer les mecanismes d'autorisation.* Creer des politiques IAM
  personnalisees lorsque les politiques gerees ne suffisent pas ; stocker les
  identifiants d'application et de base de donnees (Secrets Manager, AWS Systems
  Manager Parameter Store) ; accorder acces et privileges aux utilisateurs,
  groupes et roles de base de donnees, par exemple dans Amazon Redshift ; gerer
  les permissions via AWS Lake Formation pour Amazon Redshift, Amazon EMR, Amazon
  Athena et Amazon S3 ; appliquer les methodes d'autorisation repondant aux
  besoins metier (par role, par etiquette, par attribut) ; construire des
  politiques personnalisees respectant le principe du moindre privilege.
- *Tache 4.3 - Assurer le chiffrement et le masquage des donnees.* Appliquer le
  masquage et l'anonymisation conformement aux lois de conformite ou aux
  politiques de l'entreprise ; utiliser des cles de chiffrement pour chiffrer ou
  dechiffrer les donnees (AWS KMS) ; configurer le chiffrement au-dela des
  frontieres de compte AWS ; activer le chiffrement en transit ou avant le
  transit.
- *Tache 4.4 - Preparer les journaux pour l'audit.* Suivre les appels d'API avec
  AWS CloudTrail ; stocker les journaux applicatifs dans Amazon CloudWatch Logs ;
  centraliser les requetes de journalisation avec AWS CloudTrail Lake ; analyser
  les journaux avec les services AWS (Athena, CloudWatch Logs Insights, Amazon
  OpenSearch Service) ; integrer plusieurs services AWS pour la journalisation,
  par exemple Amazon EMR pour de grands volumes de journaux.
- *Tache 4.5 - Comprendre la confidentialite et la gouvernance des donnees.*
  Accorder les permissions de partage de donnees, par exemple le partage de
  donnees Amazon Redshift ; mettre en oeuvre l'identification des donnees a
  caractere personnel (Amazon Macie avec Lake Formation) ; mettre en oeuvre des
  strategies empechant les sauvegardes ou les replications vers des Regions AWS
  non autorisees ; consulter les changements de configuration survenus dans un
  compte avec AWS Config ; maintenir la souverainete des donnees ; gerer l'acces
  aux donnees via les projets Amazon SageMaker Catalog ; decrire un cadre de
  gouvernance des donnees et les modeles de partage.

### Couverture produite

20 paires publiques/privees v3, sequences `001` a `020`, chacune avec quatre
choix uniques et plausibles.

| Domaine | Items | Sequences | Themes couverts |
| --- | --- | --- | --- |
| domain-1 | 7 | 001-007 | Rejeu d'evenements apres un bogue de consommateur, contention de lecture entre consommateurs multiples, cout des octets analyses sur des depots quotidiens, fragilite d'un enchainement d'etapes ETL, propagation des modifications transactionnelles vers un lac, alimentation d'un entrepot depuis une base hebergee sur site, cluster nocturne inactif mais facture |
| domain-2 | 5 | 008-012 | Echanges entre noeuds sur une jointure volumineuse, partitions horaires manquantes et cout de catalogage croissant, paliers de conservation de journaux sur sept ans, expiration automatique d'enregistrements perimes, corrections a la demande et relecture d'un etat anterieur |
| domain-3 | 4 | 013-016 | Retraitement de fichiers deja charges, echecs nocturnes decouverts trop tard, enregistrements non conformes recus d'un fournisseur externe, tache de melange unique interminable |
| domain-4 | 4 | 017-020 | Restriction de colonnes sensibles sans duplication du jeu de donnees, acces refuse en lecture entre comptes, mot de passe en clair dans un script de traitement, localisation de donnees personnelles dans un lac |

Repartition des positions de la bonne reponse (base 1), conforme a la cible
d'equilibre :

| Position | Nombre d'items | Part |
| --- | --- | --- |
| 1 | 5 | 25 % |
| 2 | 5 | 25 % |
| 3 | 5 | 25 % |
| 4 | 5 | 25 % |

Aucune reponse ni explication n'est reproduite dans ce document : elles restent
confinees a `content/answerKey/solutions/aws/dea-c01/`.

## DVA-C02 - AWS Certified Developer - Associate

### References officielles

| Ressource | URL |
| --- | --- |
| Page de certification | https://aws.amazon.com/certification/certified-developer-associate/ |
| Guide d'examen (DVA-C02) | https://docs.aws.amazon.com/aws-certification/latest/developer-associate-02/developer-associate-02.html |
| Domaine 1 | https://docs.aws.amazon.com/aws-certification/latest/developer-associate-02/developer-associate-02-domain1.html |
| Domaine 2 | https://docs.aws.amazon.com/aws-certification/latest/developer-associate-02/developer-associate-02-domain2.html |
| Domaine 3 | https://docs.aws.amazon.com/aws-certification/latest/developer-associate-02/developer-associate-02-domain3.html |
| Domaine 4 | https://docs.aws.amazon.com/aws-certification/latest/developer-associate-02/developer-associate-02-domain4.html |

Sources consultees le 2026-08-18. Blueprint utilise : `2026-08-17` ; matrice de
couverture :
[`content/public/coverage/aws/dva-c02.json`](../../content/public/coverage/aws/dva-c02.json).

Contexte de cycle de vie officiel, rappele ici a titre de perimetre uniquement :
DVA-C02 reste la version en vigueur jusqu'au 2026-11-30, aucun contenu DVA-C03
n'est produit et le catalogue n'est pas modifie par cette vague.

### Domaines officiels et ponderations

| Domaine | Titre officiel | Ponderation |
| --- | --- | --- |
| domain-1 | Development with AWS Services | 32 % |
| domain-2 | Security | 26 % |
| domain-3 | Deployment | 24 % |
| domain-4 | Troubleshooting and Optimization | 18 % |

### Resume fidele des task statements officiels

**Domaine 1 - Development with AWS Services (32 %)**

- *Tache 1.1 - Developper du code pour des applications hebergees sur AWS.*
  Decrire les modeles d'architecture (evenementiel, microservices, monolithe,
  choregraphie, orchestration, diffusion amplifiee) ; distinguer les concepts
  avec et sans etat, les composants fortement et faiblement couples, ainsi que
  les modeles synchrones et asynchrones ; ecrire des applications tolerantes aux
  pannes et resilientes dans un langage de programmation (Java, C#, Python,
  JavaScript, TypeScript, Go) ; creer, etendre et maintenir des API
  (transformations requete/reponse, regles de validation, remplacement des codes
  de statut) ; ecrire et executer des tests unitaires dans les environnements de
  developpement, par exemple avec AWS SAM ; ecrire du code utilisant les services
  de messagerie ; ecrire du code qui interagit avec les services AWS via leurs
  API et les SDK AWS ; traiter des donnees en continu avec les services AWS ;
  s'appuyer sur Amazon Q Developer pour assister le developpement ; mettre en
  oeuvre des modeles evenementiels avec Amazon EventBridge ; ecrire du code
  resilient pour les integrations de services tiers (logique de nouvelles
  tentatives, disjoncteurs, modeles de gestion des erreurs).
- *Tache 1.2 - Developper du code pour AWS Lambda.* Decrire l'acces depuis le
  code Lambda a des ressources privees dans des VPC ; configurer les fonctions en
  definissant variables d'environnement et parametres (memoire, concurrence,
  delai d'expiration, environnement d'execution, gestionnaire, couches,
  extensions, declencheurs, destinations) ; gerer par le code le cycle de vie des
  evenements et les erreurs (destinations Lambda, files d'attente de lettres
  mortes) ; ecrire et executer du code de test avec les services et outils AWS ;
  integrer les fonctions Lambda aux services AWS ; regler les fonctions pour
  obtenir des performances optimales ; utiliser Lambda pour traiter et
  transformer des donnees en quasi temps reel.
- *Tache 1.3 - Utiliser des magasins de donnees dans le developpement
  applicatif.* Decrire l'interet des cles de partition a cardinalite elevee pour
  un acces equilibre aux partitions ; decrire les modeles de coherence des bases
  de donnees (fortement coherent, coherence eventuelle) ; distinguer les
  operations Query et Scan ; definir les cles et l'indexation Amazon DynamoDB ;
  serialiser et deserialiser les donnees pour les persister ; utiliser, gerer et
  maintenir les magasins de donnees ; gerer les cycles de vie des donnees ;
  utiliser des services de mise en cache des donnees ; recourir a des magasins
  specialises selon les motifs d'acces, par exemple Amazon OpenSearch Service.

**Domaine 2 - Security (26 %)**

- *Tache 2.1 - Mettre en oeuvre l'authentification et l'autorisation pour les
  applications et les services AWS.* Utiliser un fournisseur d'identite pour
  l'acces federe (Amazon Cognito, IAM) ; securiser les applications avec des
  jetons du porteur ; configurer l'acces programmatique a AWS ; effectuer des
  appels authentifies vers les services AWS ; assumer un role IAM ; definir les
  autorisations des principaux IAM ; mettre en oeuvre une autorisation au niveau
  applicatif pour un controle d'acces fin ; gerer l'authentification entre
  services dans les architectures de microservices.
- *Tache 2.2 - Mettre en oeuvre le chiffrement avec les services AWS.* Definir
  le chiffrement au repos et en transit ; decrire la gestion des certificats,
  par exemple avec AWS Private CA ; distinguer chiffrement cote client et
  chiffrement cote serveur ; utiliser des cles de chiffrement pour chiffrer ou
  dechiffrer des donnees ; generer certificats et cles SSH a des fins de
  developpement ; utiliser le chiffrement au-dela des frontieres de compte ;
  activer et desactiver la rotation des cles.
- *Tache 2.3 - Gerer les donnees sensibles dans le code applicatif.* Decrire la
  classification des donnees, par exemple les informations personnelles
  identifiables (PII) et les informations de sante protegees (PHI) ; chiffrer les
  variables d'environnement contenant des donnees sensibles ; utiliser des
  services de gestion des secrets ; assainir les donnees sensibles ; mettre en
  oeuvre le masquage et l'assainissement des donnees au niveau applicatif ;
  mettre en oeuvre des motifs d'acces aux donnees pour les applications
  multi-locataires.

**Domaine 3 - Deployment (24 %)**

- *Tache 3.1 - Preparer les artefacts applicatifs a deployer sur AWS.* Gerer les
  dependances du module de code au sein du paquet (variables d'environnement,
  fichiers de configuration, images de conteneur) ; organiser les fichiers et
  l'arborescence pour le deploiement ; utiliser des depots de code dans les
  environnements de deploiement ; appliquer les besoins de l'application en
  ressources (memoire, coeurs) ; preparer les configurations applicatives
  propres a chaque environnement, par exemple avec AWS AppConfig.
- *Tache 3.2 - Tester les applications dans les environnements de
  developpement.* Tester le code deploye avec les services et outils AWS ; ecrire
  des tests d'integration et simuler les API des dependances externes ; tester
  les applications via des points de terminaison de developpement, par exemple en
  configurant des etages Amazon API Gateway ; deployer des mises a jour de pile
  applicative sur des environnements existants, par exemple un modele AWS SAM sur
  un autre environnement de preproduction ; tester les applications
  evenementielles.
- *Tache 3.3 - Automatiser les tests de deploiement.* Creer des evenements de
  test applicatifs (charges utiles JSON pour tester AWS Lambda, API Gateway ou
  des ressources AWS SAM) ; deployer les ressources d'API sur differents
  environnements ; creer des environnements applicatifs utilisant des versions
  approuvees pour les tests d'integration (alias Lambda, etiquettes d'images de
  conteneur, branches AWS Amplify, environnements AWS Copilot) ; mettre en oeuvre
  et deployer des modeles d'infrastructure en tant que code (modeles AWS SAM,
  modeles AWS CloudFormation) ; gerer les environnements dans chaque service AWS,
  par exemple distinguer developpement, test et production dans API Gateway ;
  utiliser Amazon Q Developer pour generer des tests automatises.
- *Tache 3.4 - Deployer du code avec les services AWS d'integration et de
  livraison continues (CI/CD).* Decrire les options d'empaquetage de deploiement
  de Lambda ; decrire les etages et les domaines personnalises d'API Gateway ;
  mettre a jour des modeles d'infrastructure en tant que code existants (AWS SAM,
  CloudFormation) ; gerer les environnements applicatifs avec les services AWS ;
  deployer une version d'application selon des strategies de deploiement ;
  valider du code dans un depot pour declencher les actions de construction, de
  test et de deploiement ; utiliser des flux orchestres pour deployer le code sur
  differents environnements ; realiser des retours arriere applicatifs a l'aide
  des strategies de deploiement existantes ; utiliser etiquettes et branches pour
  la gestion des versions et des livraisons ; exploiter les configurations
  d'execution existantes pour creer des deploiements dynamiques, par exemple des
  variables d'etage API Gateway utilisees par les fonctions Lambda ; configurer
  les strategies de deploiement (bleu/vert, canari, progressif) pour les mises en
  production.

**Domaine 4 - Troubleshooting and Optimization (18 %)**

- *Tache 4.1 - Participer a une analyse des causes racines.* Deboguer le code
  pour identifier les defauts ; interpreter les metriques, les journaux et les
  traces applicatives ; interroger les journaux pour retrouver les donnees
  pertinentes ; mettre en oeuvre des metriques personnalisees, par exemple avec
  le format de metriques integre (EMF) d'Amazon CloudWatch ; examiner l'etat de
  sante de l'application a l'aide de tableaux de bord et d'analyses ; depanner
  les echecs de deploiement a partir des journaux produits par les services ;
  deboguer les problemes d'integration entre services.
- *Tache 4.2 - Instrumenter le code pour l'observabilite.* Distinguer
  journalisation, surveillance et observabilite ; mettre en oeuvre une strategie
  de journalisation efficace decrivant le comportement et l'etat de
  l'application ; ecrire du code qui emet des metriques personnalisees ; ajouter
  des annotations pour le suivi des services ; mettre en place des notifications
  pour des actions precises, par exemple les limites de quota ou la fin d'un
  deploiement ; mettre en oeuvre le suivi (tracing) avec les services et outils
  AWS ; mettre en oeuvre une journalisation structuree des evenements applicatifs
  et des actions des utilisateurs ; configurer les controles de sante et les
  sondes de disponibilite de l'application.
- *Tache 4.3 - Optimiser les applications avec les services et fonctionnalites
  AWS.* Definir la concurrence ; profiler les performances de l'application ;
  determiner la memoire et la puissance de calcul minimales necessaires ;
  utiliser des politiques de filtrage des abonnements pour optimiser la
  messagerie ; mettre en cache le contenu en fonction des en-tetes de requete ;
  mettre en oeuvre une mise en cache au niveau applicatif pour ameliorer les
  performances ; optimiser l'utilisation des ressources par l'application ;
  analyser les problemes de performance ; exploiter les journaux applicatifs pour
  identifier les goulets d'etranglement.

### Couverture produite

20 paires publiques/privees v3, sequences `001` a `020`, chacune avec quatre
choix uniques et plausibles.

| Domaine | Items | Sequences | Themes couverts |
| --- | --- | --- | --- |
| domain-1 | 6 | 001-006 | Appels perdus lors des pics de trafic, couplage synchrone avec trois consommateurs, evenements perdus apres echec d'invocation asynchrone, latence au centile eleve d'une API interne, recherche couteuse de commandes par client, lecture immediate apres ecriture renvoyant une valeur ancienne |
| domain-2 | 5 | 007-011 | Authentification des utilisateurs d'une application mobile, ecriture entre comptes sans cle statique, valeur sensible lisible par un operateur, identifiants de base fixes depuis le deploiement, journaux contenant des donnees clients |
| domain-3 | 5 | 012-016 | Bibliotheque commune qui alourdit huit fonctions, application creee a la main a reproduire par environnement, exposition progressive d'une nouvelle version, regression detectee le lendemain, ajustement de seuils sans redeploiement |
| domain-4 | 4 | 017-020 | Identification du maillon lent d'un parcours distribue, recherche d'erreurs par identifiant de correlation, publication de metriques ralentissant les invocations, lectures repetitives sur un catalogue de produits |

Repartition des positions de la bonne reponse (base 1), conforme a la cible
d'equilibre :

| Position | Nombre d'items | Part |
| --- | --- | --- |
| 1 | 5 | 25 % |
| 2 | 5 | 25 % |
| 3 | 5 | 25 % |
| 4 | 5 | 25 % |

L'ordre des positions est volontairement melange d'un item a l'autre, sans
repetition consecutive.

Aucune reponse ni explication n'est reproduite dans ce document : elles restent
confinees a `content/answerKey/solutions/aws/dva-c02/`.

## MLA-C01 - AWS Certified Machine Learning Engineer - Associate

### References officielles

| Ressource | URL |
| --- | --- |
| Page de certification | https://aws.amazon.com/certification/certified-machine-learning-engineer-associate/ |
| Guide d'examen (MLA-C01) | https://docs.aws.amazon.com/aws-certification/latest/machine-learning-engineer-associate-01/machine-learning-engineer-associate-01.html |
| Domaine 1 | https://docs.aws.amazon.com/aws-certification/latest/machine-learning-engineer-associate-01/machine-learning-engineer-associate-01-domain1.html |
| Domaine 2 | https://docs.aws.amazon.com/aws-certification/latest/machine-learning-engineer-associate-01/machine-learning-engineer-associate-01-domain2.html |
| Domaine 3 | https://docs.aws.amazon.com/aws-certification/latest/machine-learning-engineer-associate-01/machine-learning-engineer-associate-01-domain3.html |
| Domaine 4 | https://docs.aws.amazon.com/aws-certification/latest/machine-learning-engineer-associate-01/machine-learning-engineer-associate-01-domain4.html |

Sources consultees le 2026-08-18. Blueprint utilise : `2026-08-17` ; matrice de
couverture :
[`content/public/coverage/aws/mla-c01.json`](../../content/public/coverage/aws/mla-c01.json).

Contexte de cycle de vie officiel, rappele ici a titre de perimetre uniquement :
MLA-C01 est la version en vigueur a la date d'arret des sources, la version
MLA-C02 est annoncee mais aucun contenu MLA-C02 n'est produit et le catalogue
n'est pas modifie par cette vague.

### Domaines officiels et ponderations

| Domaine | Titre officiel | Ponderation |
| --- | --- | --- |
| domain-1 | Data Preparation for Machine Learning (ML) | 28 % |
| domain-2 | ML Model Development | 26 % |
| domain-3 | Deployment and Orchestration of ML Workflows | 22 % |
| domain-4 | ML Solution Monitoring, Maintenance, and Security | 24 % |

### Resume fidele des task statements officiels

**Domaine 1 - Data Preparation for Machine Learning (ML) (28 %)**

- *Tache 1.1 - Ingerer et stocker les donnees.* Connaitre les formats de donnees
  et les mecanismes d'ingestion (formats valides ou non, Apache Parquet, JSON,
  CSV, Apache ORC, Apache Avro, RecordIO), les sources de donnees AWS
  fondamentales (Amazon S3, Amazon EFS, Amazon FSx for NetApp ONTAP), les
  sources de donnees en flux (Amazon Kinesis, Apache Flink, Apache Kafka) ainsi
  que les options de stockage AWS, leurs cas d'usage et leurs compromis.
  Extraire les donnees depuis le stockage (Amazon S3, Amazon EBS, Amazon EFS,
  Amazon RDS, Amazon DynamoDB) avec les options adaptees (Amazon S3 Transfer
  Acceleration, IOPS provisionnees Amazon EBS) ; choisir le format selon les
  modeles d'acces ; ingerer dans SageMaker Data Wrangler et SageMaker Feature
  Store ; fusionner des sources multiples (techniques de programmation, AWS
  Glue, Apache Spark) ; depanner les problemes d'ingestion et de stockage lies a
  la capacite et a la mise a l'echelle ; arbitrer les decisions initiales de
  stockage selon le cout, la performance et la structure des donnees.
- *Tache 1.2 - Transformer les donnees et realiser l'ingenierie des
  caracteristiques.* Connaitre les techniques de nettoyage et de transformation
  (detection et traitement des valeurs aberrantes, imputation des valeurs
  manquantes, combinaison, dedoublonnage), les techniques d'ingenierie de
  caracteristiques (mise a l'echelle et standardisation, division de
  caracteristiques, discretisation, transformation logarithmique,
  normalisation), les techniques d'encodage (un-parmi-n, binaire, par etiquette,
  tokenisation), les outils d'exploration, de visualisation et de transformation
  (SageMaker Data Wrangler, AWS Glue, AWS Glue DataBrew), les services de
  transformation de donnees en flux (AWS Lambda, Spark) et les services
  d'annotation et d'etiquetage. Transformer les donnees avec les outils AWS (AWS
  Glue, DataBrew, Spark sur Amazon EMR, SageMaker Data Wrangler) ; creer et
  gerer des caracteristiques avec SageMaker Feature Store ; valider et etiqueter
  les donnees avec SageMaker Ground Truth et Amazon Mechanical Turk.
- *Tache 1.3 - Garantir l'integrite des donnees et les preparer pour la
  modelisation.* Connaitre les metriques de biais avant entrainement pour les
  donnees numeriques, textuelles et images (desequilibre de classes [CI],
  difference de proportions d'etiquettes [DPL]), les strategies de traitement du
  desequilibre de classes (generation de donnees synthetiques,
  reechantillonnage), les techniques de chiffrement, la classification,
  l'anonymisation et le masquage des donnees, ainsi que les implications des
  exigences de conformite (donnees personnelles, donnees de sante, residence des
  donnees). Valider la qualite des donnees (DataBrew, AWS Glue Data Quality) ;
  identifier et attenuer les sources de biais (biais de selection, biais de
  mesure) avec SageMaker Clarify ; preparer les donnees pour reduire le biais de
  prediction (partitionnement, brassage, augmentation) ; configurer le
  chargement des donnees vers la ressource d'entrainement (Amazon EFS, Amazon
  FSx).

**Domaine 2 - ML Model Development (26 %)**

- *Tache 2.1 - Choisir une approche de modelisation.* Connaitre les capacites et
  les usages appropries des algorithmes de ML, l'emploi des services d'IA AWS
  (Amazon Translate, Amazon Transcribe, Amazon Rekognition, Amazon Bedrock), la
  prise en compte de l'interpretabilite dans le choix du modele ou de
  l'algorithme, et les algorithmes integres d'Amazon SageMaker AI. Evaluer les
  donnees disponibles et la complexite du probleme pour juger de la faisabilite
  d'une solution de ML ; comparer et selectionner modeles et algorithmes ;
  choisir des algorithmes integres, des modeles de fondation et des modeles de
  solution (SageMaker JumpStart, Amazon Bedrock) ; selectionner selon les couts ;
  retenir les services d'IA repondant aux besoins metier courants.
- *Tache 2.2 - Entrainer et affiner les modeles.* Connaitre les elements du
  processus d'entrainement (epoque, pas, taille de lot), les methodes de
  reduction du temps d'entrainement (arret anticipe, entrainement distribue),
  les facteurs influant sur la taille du modele, les methodes d'amelioration des
  performances, l'apport des techniques de regularisation (abandon de neurones,
  decroissance des poids, L1 et L2), les techniques de reglage
  d'hyperparametres (recherche aleatoire, optimisation bayesienne), l'effet des
  hyperparametres sur les performances et les methodes d'integration dans
  SageMaker AI de modeles construits a l'exterieur. Developper des modeles avec
  les algorithmes integres et les bibliotheques courantes ; utiliser le mode
  script avec les frameworks pris en charge (TensorFlow, PyTorch) ; affiner des
  modeles pre-entraines sur des jeux de donnees personnalises (Amazon Bedrock,
  SageMaker JumpStart) ; realiser le reglage d'hyperparametres, notamment avec
  le reglage automatique de modele (AMT) et l'optimisation automatisee ; prevenir
  le surapprentissage, le sous-apprentissage et l'oubli catastrophique ; combiner
  plusieurs modeles (agregation, empilement, amplification) ; reduire la taille
  du modele (types de donnees, elagage, selection de caracteristiques,
  compression) ; gerer les versions de modeles a des fins de repetabilite et
  d'audit avec le SageMaker Model Registry.
- *Tache 2.3 - Analyser les performances du modele.* Connaitre les techniques et
  metriques d'evaluation (matrice de confusion, cartes de chaleur, score F1,
  exactitude, precision, rappel, RMSE, courbe ROC, aire sous la courbe ROC), les
  methodes de creation de references de performance, les methodes
  d'identification du surapprentissage et du sous-apprentissage, les metriques
  disponibles dans SageMaker Clarify et les problemes de convergence.
  Selectionner et interpreter les metriques d'evaluation et detecter le biais du
  modele ; arbitrer entre performance, temps d'entrainement et cout ; mener des
  experiences reproductibles avec les services AWS ; comparer les performances
  d'une variante fantome a celles d'une variante de production ; interpreter les
  sorties du modele avec SageMaker Clarify ; deboguer la convergence avec
  SageMaker Model Debugger.

**Domaine 3 - Deployment and Orchestration of ML Workflows (22 %)**

- *Tache 3.1 - Choisir l'infrastructure de deploiement en fonction de
  l'architecture existante et des exigences.* Connaitre les bonnes pratiques de
  deploiement (gestion des versions, strategies de retour arriere), les services
  de deploiement AWS (Amazon SageMaker AI), les methodes de service des modeles
  en temps reel et par lots, le provisionnement des ressources de calcul en
  production et en test (CPU, GPU), les exigences des points de terminaison
  (sans serveur, temps reel, asynchrones, inference par lots), le choix des
  conteneurs fournis ou personnalises et les methodes d'optimisation des modeles
  sur les peripheriques de peripherie (SageMaker Neo). Evaluer les compromis
  entre performance, cout et latence ; choisir l'environnement de calcul adapte
  a l'entrainement et a l'inference (specifications GPU ou CPU, famille de
  processeurs, bande passante reseau) ; choisir l'orchestrateur de deploiement
  (Apache Airflow, SageMaker Pipelines) ; retenir des deploiements
  multi-modeles ou multi-conteneurs ; choisir la cible de deploiement (points de
  terminaison SageMaker AI, Kubernetes, Amazon ECS, Amazon EKS, AWS Lambda) et
  la strategie de deploiement (temps reel, par lots).
- *Tache 3.2 - Creer et scripter l'infrastructure en fonction de l'architecture
  existante et des exigences.* Connaitre la difference entre ressources a la
  demande et ressources provisionnees, la comparaison des politiques de mise a
  l'echelle, les compromis et cas d'usage des options d'infrastructure sous
  forme de code (AWS CloudFormation, AWS CDK), les concepts de conteneurisation
  et les services de conteneurs AWS, ainsi que les politiques de mise a
  l'echelle automatique des points de terminaison SageMaker AI (selon la demande
  ou selon l'horaire). Appliquer les bonnes pratiques pour des solutions
  maintenables, evolutives et economes (mise a l'echelle automatique des points
  de terminaison, ajout dynamique d'instances Spot, instances Amazon EC2, Lambda
  derriere les points de terminaison) ; automatiser le provisionnement du calcul
  et la communication entre piles (CloudFormation, AWS CDK) ; construire et
  maintenir des conteneurs (Amazon ECR, Amazon EKS, Amazon ECS, conteneur
  personnalise avec SageMaker AI) ; configurer les points de terminaison
  SageMaker AI au sein du reseau VPC ; deployer et heberger des modeles avec le
  SDK SageMaker AI ; choisir les metriques de mise a l'echelle automatique
  (latence du modele, utilisation CPU, invocations par instance).
- *Tache 3.3 - Utiliser des outils d'orchestration automatisee pour mettre en
  place des pipelines d'integration et de livraison continues (CI/CD).*
  Connaitre les capacites et les quotas d'AWS CodePipeline, AWS CodeBuild et AWS
  CodeDeploy, l'automatisation et l'integration de l'ingestion de donnees avec
  les services d'orchestration, les systemes de gestion de versions et leur
  usage de base (Git), les principes CI/CD appliques aux flux de travail de ML,
  les strategies de deploiement et actions de retour arriere (bleu/vert, canari,
  lineaire) et l'articulation entre depots de code et pipelines. Configurer et
  depanner CodeBuild, CodeDeploy et CodePipeline, y compris leurs etapes ;
  appliquer des structures de flux de deploiement continu (Gitflow, GitHub
  Flow) ; automatiser l'orchestration avec les services AWS (deploiement de
  modeles, automatisation de la construction de modeles) ; configurer les jobs
  d'entrainement et d'inference (regles Amazon EventBridge, SageMaker Pipelines,
  CodePipeline) ; creer des tests automatises dans les pipelines CI/CD (tests
  d'integration, unitaires, de bout en bout) ; construire et integrer des
  mecanismes de reentrainement.

**Domaine 4 - ML Solution Monitoring, Maintenance, and Security (24 %)**

- *Tache 4.1 - Surveiller l'inference des modeles.* Connaitre la derive des
  modeles de ML, les techniques de surveillance de la qualite des donnees et des
  performances des modeles, ainsi que les principes de conception des lentilles
  ML pertinents pour la surveillance. Surveiller les modeles en production avec
  Amazon SageMaker Model Monitor ; surveiller les flux de travail pour detecter
  anomalies et erreurs dans le traitement des donnees ou l'inference ; detecter
  les changements de distribution des donnees susceptibles d'affecter les
  performances, notamment avec SageMaker Clarify ; suivre les performances en
  production par des tests A/B.
- *Tache 4.2 - Surveiller et optimiser l'infrastructure et les couts.* Connaitre
  les indicateurs cles de performance de l'infrastructure de ML (utilisation,
  debit, disponibilite, evolutivite, tolerance aux pannes), les outils de
  surveillance et d'observabilite pour depanner la latence et les performances
  (AWS X-Ray, Amazon CloudWatch Lambda Insights, Amazon CloudWatch Logs
  Insights), l'usage d'AWS CloudTrail pour journaliser, surveiller et declencher
  des activites de reentrainement, les differences entre types d'instances
  (optimise memoire, optimise calcul, usage general, optimise inference), les
  capacites des outils d'analyse des couts (AWS Cost Explorer, AWS Billing and
  Cost Management, AWS Trusted Advisor) et les techniques de suivi et de
  repartition des couts par etiquetage des ressources. Configurer et utiliser
  les outils de depannage et d'analyse (journaux et alarmes CloudWatch) ; creer
  des pistes CloudTrail ; mettre en place des tableaux de bord de suivi des
  performances (Amazon Quick Sight, tableaux de bord CloudWatch) ; surveiller
  l'infrastructure avec les evenements Amazon EventBridge ; dimensionner au plus
  juste les familles et tailles d'instances (SageMaker AI Inference Recommender,
  AWS Compute Optimizer) ; surveiller et resoudre les problemes de latence et de
  mise a l'echelle ; preparer l'infrastructure au suivi des couts par une
  strategie d'etiquetage ; depanner les questions de capacite liees au cout et a
  la performance (concurrence provisionnee, quotas de service, mise a l'echelle
  automatique) ; optimiser les couts et fixer des quotas avec les outils adaptes
  (AWS Cost Explorer, AWS Trusted Advisor, AWS Budgets) ; optimiser les couts
  d'infrastructure par le choix des options d'achat (instances Spot, a la
  demande, reservees, SageMaker AI Savings Plans).
- *Tache 4.3 - Securiser les ressources AWS.* Connaitre les roles, politiques et
  groupes IAM qui controlent l'acces aux services AWS (IAM, politiques de
  bucket, SageMaker Role Manager), les fonctionnalites de securite et de
  conformite de SageMaker AI, les controles d'acces reseau aux ressources de ML
  et les bonnes pratiques de securite des pipelines CI/CD. Configurer un acces
  au moindre privilege aux artefacts de ML ; configurer les politiques et roles
  IAM pour les utilisateurs et les applications qui interagissent avec les
  systemes de ML ; surveiller, auditer et journaliser les systemes de ML pour
  garantir la securite et la conformite dans la duree ; depanner les problemes
  de securite ; construire des VPC, sous-reseaux et groupes de securite pour
  isoler les systemes de ML.

### Couverture produite

20 paires publiques/privees v3, sequences `001` a `020`, chacune avec quatre
choix uniques et plausibles.

| Domaine | Items | Sequences | Themes couverts |
| --- | --- | --- | --- |
| domain-1 | 6 | 001-006 | Relecture integrale de journaux a chaque preparation, atterrissage continu d'evenements de navigation, divergence des calculs entre entrainement et inference, modalites sans ordre codees en entiers, colonnes nulles atteignant l'entrainement, documentation des ecarts de population exigee par la conformite |
| domain-2 | 5 | 007-011 | Transcription et analyse d'appels sans corpus annote, recherche d'hyperparametres hors budget, perte de validation qui remonte apres quelques epoques, exactitude trompeuse sur un phenomene rare, tracabilite des versions servies en production |
| domain-3 | 4 | 012-015 | Documents volumineux traites par rafales espacees, pic quotidien et nuits inactives sur un point de terminaison, reentrainement hebdomadaire sur un nouveau lot annote, bascule progressive vers une nouvelle version de modele |
| domain-4 | 5 | 016-020 | Degradation lente apres une evolution de formulaire, temps de reponse au-dela de la cible, suivi des couts dans un compte unique, role d'execution trop permissif, traitement de donnees de sante sans exposition Internet |

Repartition des positions de la bonne reponse (base 1), conforme a la cible
d'equilibre :

| Position | Nombre d'items | Part |
| --- | --- | --- |
| 1 | 5 | 25 % |
| 2 | 5 | 25 % |
| 3 | 5 | 25 % |
| 4 | 5 | 25 % |

L'ordre des positions est volontairement melange d'un item a l'autre, sans
repetition consecutive.

Aucune reponse ni explication n'est reproduite dans ce document : elles restent
confinees a `content/answerKey/solutions/aws/mla-c01/`.

## SAA-C03 - AWS Certified Solutions Architect - Associate

### References officielles

| Ressource | URL |
| --- | --- |
| Page de certification | https://aws.amazon.com/certification/certified-solutions-architect-associate/ |
| Guide d'examen (SAA-C03) | https://docs.aws.amazon.com/aws-certification/latest/solutions-architect-associate-03/solutions-architect-associate-03.html |
| Domaine 1 | https://docs.aws.amazon.com/aws-certification/latest/solutions-architect-associate-03/solutions-architect-associate-03-domain1.html |
| Domaine 2 | https://docs.aws.amazon.com/aws-certification/latest/solutions-architect-associate-03/solutions-architect-associate-03-domain2.html |
| Domaine 3 | https://docs.aws.amazon.com/aws-certification/latest/solutions-architect-associate-03/solutions-architect-associate-03-domain3.html |
| Domaine 4 | https://docs.aws.amazon.com/aws-certification/latest/solutions-architect-associate-03/solutions-architect-associate-03-domain4.html |

Sources consultees le 2026-08-18. Blueprint utilise : `2026-08-17` ; matrice de
couverture :
[`content/public/coverage/aws/saa-c03.json`](../../content/public/coverage/aws/saa-c03.json).

### Domaines officiels et ponderations

| Domaine | Titre officiel | Ponderation |
| --- | --- | --- |
| domain-1 | Design Secure Architectures | 30 % |
| domain-2 | Design Resilient Architectures | 26 % |
| domain-3 | Design High-Performing Architectures | 24 % |
| domain-4 | Design Cost-Optimized Architectures | 20 % |

### Resume fidele des task statements officiels

**Domaine 1 - Design Secure Architectures (30 %)**

- *Tache 1.1 - Concevoir un acces securise aux ressources AWS.* Connaissances
  attendues : controles d'acces et gestion des acces sur plusieurs comptes,
  services d'acces federe et d'identite AWS (par exemple IAM, AWS IAM Identity
  Center), infrastructure mondiale AWS (zones de disponibilite, Regions AWS),
  bonnes pratiques de securite AWS (principe du moindre privilege) et modele de
  responsabilite partagee. Competences attendues : appliquer les bonnes
  pratiques de securite aux utilisateurs IAM et a l'utilisateur racine (par
  exemple l'authentification multifacteur) ; concevoir un modele d'autorisation
  souple integrant utilisateurs, groupes, roles et politiques IAM ; concevoir
  une strategie de controle d'acces fondee sur les roles (AWS STS, changement de
  role, acces inter-comptes) ; concevoir une strategie de securite pour
  plusieurs comptes AWS (AWS Control Tower, politiques de controle des
  services) ; determiner l'usage approprie des politiques de ressources des
  services AWS ; determiner quand federer un service d'annuaire avec des roles
  IAM.
- *Tache 1.2 - Concevoir des charges de travail et des applications
  securisees.* Connaissances attendues : securite de la configuration et des
  identifiants applicatifs, points de terminaison des services AWS, controle des
  ports, protocoles et flux reseau sur AWS, acces applicatif securise, services
  de securite et cas d'usage associes (par exemple Amazon Cognito, Amazon
  GuardDuty, Amazon Macie), vecteurs de menace externes a AWS (deni de service
  distribue, injection SQL). Competences attendues : concevoir des architectures
  de VPC comportant des composants de securite (groupes de securite, tables de
  routage, ACL reseau, passerelles NAT) ; determiner les strategies de
  segmentation reseau (sous-reseaux publics et prives) ; integrer les services
  AWS pour securiser les applications (AWS Shield, AWS WAF, IAM Identity Center,
  AWS Secrets Manager) ; securiser les connexions reseau externes vers et depuis
  le cloud AWS (VPN, AWS Direct Connect).
- *Tache 1.3 - Determiner les controles de securite des donnees appropries.*
  Connaissances attendues : acces aux donnees et gouvernance, recuperation des
  donnees, retention et classification des donnees, chiffrement et gestion
  appropriee des cles. Competences attendues : aligner les technologies AWS sur
  les exigences de conformite ; chiffrer les donnees au repos (par exemple AWS
  KMS) ; chiffrer les donnees en transit (par exemple AWS Certificate Manager
  avec TLS) ; mettre en oeuvre des politiques d'acces pour les cles de
  chiffrement ; mettre en oeuvre les sauvegardes et les replications de
  donnees ; mettre en oeuvre des politiques d'acces, de cycle de vie et de
  protection des donnees ; assurer la rotation des cles de chiffrement et le
  renouvellement des certificats.

**Domaine 2 - Design Resilient Architectures (26 %)**

- *Tache 2.1 - Concevoir des architectures evolutives et faiblement couplees.*
  Connaissances attendues : creation et gestion d'API (par exemple Amazon API
  Gateway, API REST), services geres AWS et cas d'usage associes (AWS Transfer
  Family, Amazon SQS, AWS Secrets Manager), strategies de mise en cache,
  principes de conception des microservices (charges sans etat comparees aux
  charges avec etat), architectures pilotees par les evenements, mise a
  l'echelle horizontale et verticale, usage approprie des accelerateurs de
  peripherie (reseau de diffusion de contenu), migration d'applications vers des
  conteneurs, concepts de repartition de charge (Application Load Balancer),
  architectures multiniveaux, concepts de file d'attente et de messagerie
  (publication et abonnement), technologies et motifs sans serveur (AWS Fargate,
  AWS Lambda), types de stockage et caracteristiques associees (objet, fichier,
  bloc), orchestration de conteneurs (Amazon ECS, Amazon EKS), usage des
  replicas en lecture, orchestration de flux de travail (AWS Step Functions).
  Competences attendues : concevoir des architectures pilotees par les
  evenements, en microservices ou multiniveaux selon les exigences ; determiner
  les strategies de mise a l'echelle des composants ; determiner les services
  AWS necessaires a un couplage faible ; determiner quand utiliser des
  conteneurs ; determiner quand utiliser les technologies et motifs sans
  serveur ; recommander les technologies de calcul, de stockage, de reseau et de
  base de donnees adaptees aux exigences ; utiliser les services AWS specialises
  pour chaque charge de travail.
- *Tache 2.2 - Concevoir des architectures hautement disponibles ou tolerantes
  aux pannes.* Connaissances attendues : infrastructure mondiale AWS (zones de
  disponibilite, Regions AWS, Amazon Route 53), services geres AWS et cas
  d'usage associes (Amazon Comprehend, Amazon Polly), concepts reseau de base
  (tables de routage), strategies de reprise apres sinistre (sauvegarde et
  restauration, lumiere pilote, veille tiede, bascule actif/actif, objectif de
  point de reprise, objectif de temps de reprise), motifs de conception
  distribues, strategies de bascule, infrastructure immuable, concepts de
  repartition de charge, concepts de proxy (Amazon RDS Proxy), quotas de service
  et limitation de debit, options de stockage et caracteristiques (durabilite,
  replication), visibilite des charges de travail (AWS X-Ray). Competences
  attendues : determiner les strategies d'automatisation garantissant
  l'integrite de l'infrastructure ; determiner les services AWS necessaires a
  une architecture hautement disponible ou tolerante aux pannes, entre Regions
  ou entre zones de disponibilite ; identifier les metriques issues des
  exigences metier pour livrer une solution hautement disponible ; mettre en
  oeuvre des conceptions attenuant les points uniques de defaillance ; mettre en
  oeuvre des strategies garantissant la durabilite et la disponibilite des
  donnees (sauvegardes) ; selectionner une strategie de reprise apres sinistre
  repondant aux exigences metier ; utiliser les services AWS ameliorant la
  fiabilite des applications historiques et non concues pour le cloud lorsque
  leur modification est impossible ; utiliser les services AWS specialises pour
  chaque charge de travail.

**Domaine 3 - Design High-Performing Architectures (24 %)**

- *Tache 3.1 - Determiner des solutions de stockage performantes ou
  evolutives.* Connaissances attendues : solutions de stockage hybrides
  repondant aux exigences metier, services de stockage et cas d'usage associes
  (Amazon S3, Amazon EFS, Amazon EBS), types de stockage et caracteristiques
  associees (objet, fichier, bloc). Competences attendues : determiner les
  services et configurations de stockage repondant aux exigences de
  performance ; determiner les services de stockage capables de suivre les
  besoins futurs.
- *Tache 3.2 - Concevoir des solutions de calcul performantes et elastiques.*
  Connaissances attendues : services de calcul AWS et cas d'usage associes (AWS
  Batch, Amazon EMR, AWS Fargate), concepts de calcul distribue soutenus par
  l'infrastructure mondiale et les services de peripherie, concepts de file
  d'attente et de messagerie, capacites de mise a l'echelle et cas d'usage
  (Amazon EC2 Auto Scaling, AWS Auto Scaling), technologies et motifs sans
  serveur (AWS Lambda, Fargate), orchestration de conteneurs (Amazon ECS, Amazon
  EKS). Competences attendues : decoupler les charges de travail afin que les
  composants evoluent independamment ; identifier les metriques et conditions
  declenchant les actions de mise a l'echelle ; selectionner les options et
  fonctionnalites de calcul adaptees (types d'instances Amazon EC2) ;
  selectionner le type et la taille de ressource adaptes (par exemple la
  quantite de memoire d'une fonction AWS Lambda).
- *Tache 3.3 - Determiner des solutions de base de donnees performantes.*
  Connaissances attendues : infrastructure mondiale AWS, strategies et services
  de mise en cache (Amazon ElastiCache), modeles d'acces aux donnees (charges
  dominees par la lecture ou par l'ecriture), planification de capacite des
  bases de donnees (unites de capacite, types d'instances, IOPS provisionnees),
  connexions et proxys de bases de donnees, moteurs de bases de donnees et cas
  d'usage associes (migrations heterogenes ou homogenes), replication (replicas
  en lecture), types et services de bases de donnees (sans serveur, relationnel
  compare a non relationnel, en memoire). Competences attendues : configurer des
  replicas en lecture repondant aux exigences metier ; concevoir des
  architectures de bases de donnees ; determiner le moteur adapte (par exemple
  MySQL compare a PostgreSQL) ; determiner le type de base adapte (Amazon
  Aurora, Amazon DynamoDB) ; integrer la mise en cache pour repondre aux
  exigences metier.
- *Tache 3.4 - Determiner des architectures reseau performantes ou evolutives.*
  Connaissances attendues : services reseau de peripherie et cas d'usage
  associes (Amazon CloudFront, AWS Global Accelerator), conception
  d'architecture reseau (etages de sous-reseaux, routage, adressage IP),
  concepts de repartition de charge (Application Load Balancer), options de
  connexion reseau (AWS VPN, AWS Direct Connect, AWS PrivateLink). Competences
  attendues : creer une topologie reseau adaptee a differentes architectures
  (globale, hybride, multiniveaux) ; determiner des configurations reseau
  capables de suivre les besoins futurs ; determiner le placement approprie des
  ressources selon les exigences metier ; selectionner la strategie de
  repartition de charge adaptee.
- *Tache 3.5 - Determiner des solutions performantes d'ingestion et de
  transformation des donnees.* Connaissances attendues : services d'analyse et
  de visualisation et cas d'usage associes (Amazon Athena, AWS Lake Formation,
  Amazon QuickSuite), motifs d'ingestion de donnees (frequence), services de
  transfert de donnees et cas d'usage (AWS DataSync, AWS Storage Gateway),
  services de transformation de donnees et cas d'usage (AWS Glue), acces
  securise aux points d'ingestion, tailles et debits necessaires aux exigences
  metier, services de donnees en flux et cas d'usage (Amazon Kinesis).
  Competences attendues : construire et securiser des lacs de donnees ;
  concevoir des architectures de diffusion de donnees en flux ; concevoir des
  solutions de transfert de donnees ; mettre en oeuvre des strategies de
  visualisation ; selectionner les options de calcul adaptees au traitement des
  donnees (Amazon EMR) ; selectionner les configurations d'ingestion
  appropriees ; transformer les donnees d'un format a un autre (par exemple .csv
  vers .parquet).

**Domaine 4 - Design Cost-Optimized Architectures (20 %)**

- *Tache 4.1 - Concevoir des solutions de stockage optimisees en cout.*
  Connaissances attendues : options d'acces (par exemple un compartiment Amazon
  S3 en mode Requester Pays), fonctionnalites de gestion des couts AWS
  (etiquettes de repartition des couts, facturation multi-comptes), outils de
  gestion des couts et cas d'usage (AWS Cost Explorer, AWS Budgets, AWS Cost and
  Usage Report), services de stockage et cas d'usage (Amazon FSx, Amazon EFS,
  Amazon S3, Amazon EBS), strategies de sauvegarde, options de stockage bloc
  (types de volumes sur disque dur ou sur disque a semi-conducteurs), cycles de
  vie des donnees, options de stockage hybride (AWS DataSync, AWS Transfer
  Family, AWS Storage Gateway), modeles d'acces au stockage, hierarchisation du
  stockage (paliers froids pour le stockage objet), types de stockage et
  caracteristiques associees. Competences attendues : concevoir des strategies
  de stockage adaptees (chargements par lots vers Amazon S3 compares aux
  chargements unitaires) ; determiner la taille de stockage correcte pour une
  charge de travail ; determiner la methode de transfert la moins couteuse vers
  le stockage AWS ; determiner quand la mise a l'echelle automatique du stockage
  est necessaire ; gerer le cycle de vie des objets Amazon S3 ; selectionner la
  solution de sauvegarde ou d'archivage appropriee ; selectionner le service
  adapte a la migration des donnees ; selectionner le palier de stockage
  approprie ; selectionner le cycle de vie correct ; selectionner le service de
  stockage le plus economique pour une charge de travail.
- *Tache 4.2 - Concevoir des solutions de calcul optimisees en cout.*
  Connaissances attendues : fonctionnalites et outils de gestion des couts AWS,
  infrastructure mondiale AWS, options d'achat AWS (instances Spot, instances
  reservees, Savings Plans), strategies de calcul distribue (traitement en
  peripherie), options de calcul hybride (AWS Outposts), types, familles et
  tailles d'instances (optimise memoire, optimise calcul, virtualisation),
  optimisation de l'utilisation du calcul (conteneurs, calcul sans serveur,
  microservices), strategies de mise a l'echelle (mise a l'echelle automatique,
  hibernation). Competences attendues : determiner la strategie de repartition
  de charge adaptee (Application Load Balancer de couche 7 compare au Network
  Load Balancer de couche 4 et au Gateway Load Balancer) ; determiner les
  methodes et strategies de mise a l'echelle des charges elastiques (horizontale
  comparee a verticale, hibernation Amazon EC2) ; determiner les services de
  calcul AWS economiques et leurs cas d'usage (AWS Lambda, Amazon EC2, AWS
  Fargate) ; determiner la disponibilite requise selon la classe de charge
  (production ou hors production) ; selectionner la famille d'instances adaptee ;
  selectionner la taille d'instance adaptee.
- *Tache 4.3 - Concevoir des solutions de bases de donnees optimisees en cout.*
  Connaissances attendues : fonctionnalites et outils de gestion des couts AWS,
  strategies de mise en cache, politiques de retention des donnees,
  planification de capacite des bases de donnees (unites de capacite),
  connexions et proxys, moteurs de bases de donnees et cas d'usage (migrations
  heterogenes ou homogenes), replication (replicas en lecture), types et
  services de bases de donnees (relationnel compare a non relationnel, Amazon
  Aurora, Amazon DynamoDB). Competences attendues : concevoir des politiques de
  sauvegarde et de retention adaptees (frequence des instantanes) ; determiner
  le moteur adapte ; determiner les services de bases de donnees AWS economiques
  et leurs cas d'usage (Amazon DynamoDB compare a Amazon RDS, sans serveur) ;
  determiner les types de bases economiques (format serie temporelle, format
  colonnaire) ; migrer schemas et donnees vers d'autres emplacements ou d'autres
  moteurs.
- *Tache 4.4 - Concevoir des architectures reseau optimisees en cout.*
  Connaissances attendues : fonctionnalites et outils de gestion des couts AWS,
  concepts de repartition de charge, passerelles NAT (cout d'une instance NAT
  compare a celui d'une passerelle NAT), connectivite reseau (lignes privees,
  lignes dediees, VPN), routage, topologie et appairage (AWS Transit Gateway,
  appairage de VPC), services reseau et cas d'usage (DNS). Competences
  attendues : configurer les types de passerelles NAT adaptes (passerelle
  partagee unique comparee a une passerelle par zone de disponibilite) ;
  configurer les connexions reseau adaptees (AWS Direct Connect compare au VPN
  et a Internet) ; configurer des routes minimisant les couts de transfert
  (Region a Region, zone a zone, prive vers public, AWS Global Accelerator,
  points de terminaison VPC) ; determiner les besoins strategiques en reseaux de
  diffusion de contenu et en mise en cache de peripherie ; reexaminer les
  charges existantes pour optimiser le reseau ; selectionner une strategie de
  limitation de debit ; selectionner l'allocation de bande passante adaptee a un
  equipement reseau (VPN unique compare a plusieurs VPN, debit AWS Direct
  Connect).

### Couverture produite

20 paires publiques/privees v3, sequences `001` a `020`, chacune avec quatre
choix uniques et plausibles.

| Domaine | Items | Sequences | Themes couverts |
| --- | --- | --- | --- |
| domain-1 | 6 | 001-006 | Garde-fous imposes aux comptes de production, acces console multi-comptes depuis un annuaire existant, isolation des niveaux d'une application web, identifiants de base en clair sur des instances, attaques applicatives et volumetriques cumulees, separation des roles sur des donnees de sante archivees |
| domain-2 | 5 | 007-011 | Pics commerciaux et commandes perdues, trois traitements independants declenches par une parution, service mono-zone face a des objectifs de reprise, plan de reprise en seconde Region a cout modere, saturation des connexions lors d'une montee en concurrence |
| domain-3 | 5 | 012-016 | Arborescence de fichiers partagee entre trois zones, pagination permanente d'un moteur d'analyse, charge dominee par des lectures repetees, latence et bascule lente pour un jeu multiregion, myriade de petits fichiers de telemetrie |
| domain-4 | 4 | 017-020 | Documents aux profils d'acces evolutifs, trois profils distincts de consommation de calcul, base quasi inactive hors pics trimestriels, frais inter-zones et point unique de defaillance |

Repartition des positions de la bonne reponse (base 1), conforme a la cible
d'equilibre :

| Position | Nombre d'items | Part |
| --- | --- | --- |
| 1 | 5 | 25 % |
| 2 | 5 | 25 % |
| 3 | 5 | 25 % |
| 4 | 5 | 25 % |

L'ordre des positions est volontairement melange d'un item a l'autre, sans
repetition consecutive.

Aucune reponse ni explication n'est reproduite dans ce document : elles restent
confinees a `content/answerKey/solutions/aws/saa-c03/`.

## Totaux de la vague

| Indicateur | Valeur |
| --- | --- |
| Certifications traitees | 5 (SOA-C03, DEA-C01, DVA-C02, MLA-C01, SAA-C03) |
| Paires publiques/privees v3 produites | 100 |
| Domaines officiels couverts | 21 |
| Bonne reponse en position 1 | 25 |
| Bonne reponse en position 2 | 25 |
| Bonne reponse en position 3 | 25 |
| Bonne reponse en position 4 | 25 |

Chaque certification apporte 20 paires reparties selon les ponderations
officielles de son guide d'examen, et la repartition agregee des positions de
la bonne reponse reste uniforme sur les quatre positions.
