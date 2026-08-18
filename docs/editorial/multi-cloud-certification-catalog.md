# Catalogue AWS et Google Cloud au 2026-08-17

Ce document accompagne le fichier machine-readable
[`content/public/catalog/certifications.json`](../../content/public/catalog/certifications.json).
La recherche n'utilise que les catalogues, pages de certification et guides
d'examen officiels AWS et Google Cloud.

## Inventaire exact

### AWS - 12 certifications actives

| Code | Titre | Niveau | Statut | Guide |
| --- | --- | --- | --- | --- |
| AIF-C01 | AWS Certified AI Practitioner | Foundational | active | v1.1, 2026-04-30 |
| CLF-C02 | AWS Certified Cloud Practitioner | Foundational | active | version/date non publiees |
| SOA-C03 | AWS Certified CloudOps Engineer - Associate | Associate | active | v1.1, 2026-06-01 |
| DEA-C01 | AWS Certified Data Engineer - Associate | Associate | active | v1.1, 2025-12-12 |
| DVA-C02 | AWS Certified Developer - Associate | Associate | active jusqu'au 2026-11-30 | v2.1, 2024-12-12 |
| MLA-C01 | AWS Certified Machine Learning Engineer - Associate | Associate | active ; MLA-C02 annonce | version/date non publiees |
| SAA-C03 | AWS Certified Solutions Architect - Associate | Associate | active | version/date non publiees |
| DOP-C02 | AWS Certified DevOps Engineer - Professional | Professional | active | version/date non publiees |
| AIP-C01 | AWS Certified Generative AI Developer - Professional | Professional | active | version/date non publiees |
| SAP-C02 | AWS Certified Solutions Architect - Professional | Professional | active | version/date non publiees |
| ANS-C01 | AWS Certified Advanced Networking - Specialty | Specialty | active-retiring, derniere session 2026-08-25 | version/date non publiees |
| SCS-C03 | AWS Certified Security - Specialty | Specialty | active | v1.0, 2026-03-26 |

Domaines officiels :

| Code | Domaines et ponderations |
| --- | --- |
| AIF-C01 | Fundamentals of AI and ML 20% ; Fundamentals of GenAI 24% ; Applications of Foundation Models 28% ; Guidelines for Responsible AI 14% ; Security, Compliance, and Governance for AI Solutions 14% |
| CLF-C02 | Cloud Concepts 24% ; Security and Compliance 30% ; Cloud Technology and Services 34% ; Billing, Pricing, and Support 12% |
| SOA-C03 | Monitoring, Logging, Analysis, Remediation, and Performance Optimization 22% ; Reliability and Business Continuity 22% ; Deployment, Provisioning, and Automation 22% ; Security and Compliance 16% ; Networking and Content Delivery 18% |
| DEA-C01 | Data Ingestion and Transformation 34% ; Data Store Management 26% ; Data Operations and Support 22% ; Data Security and Governance 18% |
| DVA-C02 | Development with AWS Services 32% ; Security 26% ; Deployment 24% ; Troubleshooting and Optimization 18% |
| MLA-C01 | Data Preparation for Machine Learning 28% ; ML Model Development 26% ; Deployment and Orchestration of ML Workflows 22% ; ML Solution Monitoring, Maintenance, and Security 24% |
| SAA-C03 | Design Secure Architectures 30% ; Design Resilient Architectures 26% ; Design High-Performing Architectures 24% ; Design Cost-Optimized Architectures 20% |
| DOP-C02 | SDLC Automation 22% ; Configuration Management and IaC 17% ; Resilient Cloud Solutions 15% ; Monitoring and Logging 15% ; Incident and Event Response 14% ; Security and Compliance 17% |
| AIP-C01 | Foundation Model Integration, Data Management, and Compliance 31% ; Implementation and Integration 26% ; AI Safety, Security, and Governance 20% ; Operational Efficiency and Optimization for GenAI Applications 12% ; Testing, Validation, and Troubleshooting 11% |
| SAP-C02 | Design Solutions for Organizational Complexity 26% ; Design for New Solutions 29% ; Continuous Improvement for Existing Solutions 25% ; Accelerate Workload Migration and Modernization 20% |
| ANS-C01 | Network Design 30% ; Network Implementation 26% ; Network Management and Operation 20% ; Network Security, Compliance, and Governance 24% |
| SCS-C03 | Detection 16% ; Incident Response 14% ; Infrastructure Security 18% ; Identity and Access Management 20% ; Data Protection 18% ; Security Foundations and Governance 14% |

L'index officiel AWS des exam guides est la source d'enumeration. Il inclut
DVA-C03 avec une note indiquant une ouverture au 2026-12-01 : DVA-C03 est donc
annonce mais non actif au snapshot. MLA-C02/ME1-C02 sont egalement annonces
mais non actifs. MLS-C01 est exclu : AWS indique une derniere session au
2026-03-31. SOA-C02 et SCS-C02 sont remplaces.

### Google Cloud - 14 certifications actives

Google Cloud ne publie aucun code examen comparable aux codes AWS. Le champ
`officialCode` vaut donc `null` et le slug officiel de page sert d'identite.

| Slug | Titre | Niveau | Guide |
| --- | --- | --- | --- |
| cloud-digital-leader | Cloud Digital Leader | Foundational | lance le 2026-08-12 |
| generative-ai-leader | Generative AI Leader | Foundational | version/date non publiees |
| cloud-engineer | Associate Cloud Engineer | Associate | version/date non publiees |
| data-practitioner | Associate Data Practitioner | Associate | v1.0 dans le nom officiel du guide |
| associate-google-workspace-administrator | Associate Google Workspace Administrator | Associate | version/date non publiees |
| cloud-architect | Professional Cloud Architect | Professional | version/date non publiees |
| data-engineer | Professional Data Engineer | Professional | v4.2 dans le titre PDF |
| cloud-developer | Professional Cloud Developer | Professional | version/date non publiees |
| cloud-devops-engineer | Professional Cloud DevOps Engineer | Professional | version/date non publiees |
| cloud-security-engineer | Professional Cloud Security Engineer | Professional | version/date non publiees |
| cloud-network-engineer | Professional Cloud Network Engineer | Professional | token officiel `042426`, non interprete comme date |
| machine-learning-engineer | Professional Machine Learning Engineer | Professional | guide au 2026-06-01, token `new` |
| cloud-database-engineer | Professional Cloud Database Engineer | Professional | v1.2 dans le titre PDF |
| security-operations-engineer | Professional Security Operations Engineer | Professional | version/date non publiees |

Les ponderations Google Cloud sont marquees approximatives dans les PDF
officiels :

| Slug | Sections et ponderations |
| --- | --- |
| cloud-digital-leader | Digital Transformation 18% ; Data Transformation 18% ; Artificial Intelligence 18% ; Modernize Infrastructure and Applications 18% ; Trust and Security 18% ; Scaling with Operations 10% |
| generative-ai-leader | Fundamentals of gen AI 30% ; Google Cloud's gen AI offerings 35% ; Improve model output 20% ; Business strategies 15% |
| cloud-engineer | Setting up an environment 20% ; Planning and implementing 30% ; Successful operation 30% ; Access and security 20% |
| data-practitioner | Data Preparation and Ingestion 30% ; Data Analysis and Presentation 27% ; Data Pipeline Orchestration 18% ; Data Management 25% |
| associate-google-workspace-administrator | User accounts/domains/Directory 20% ; Core services 23% ; Governance/compliance 15% ; Security/access 20% ; Browsers/endpoints 10% ; Monitoring/troubleshooting 13% |
| cloud-architect | Design/plan 25% ; Provision infrastructure 17.5% ; Security/compliance 17.5% ; Optimize processes 15% ; Implementation 12.5% ; Excellence 12.5% |
| data-engineer | Design systems 22% ; Ingest/process 25% ; Store 20% ; Prepare/use for analysis 15% ; Maintain/automate 18% |
| cloud-developer | Design applications 32% ; Build/test 23% ; Configure deployment 24% ; Integrate services 21% |
| cloud-devops-engineer | Organization 20% ; CI/CD 25% ; SRE 18% ; Observability/troubleshooting 25% ; Performance/cost 12% |
| cloud-security-engineer | Access 25% ; Communications/boundaries 22% ; Data protection 23% ; Operations 19% ; Compliance 11% |
| cloud-network-engineer | VPC design 21% ; VPC implementation 20% ; Managed services 16% ; Hybrid/multicloud 16% ; Operations 14% ; Network security 13% |
| machine-learning-engineer | Low-code AI 13% ; Data/models collaboration 16% ; Scale prototypes 21% ; Serve/scale 20% ; Pipelines 18% ; Monitoring 13% |
| cloud-database-engineer | Design database solutions 32% ; Multiple technologies 25% ; Migrate 23% ; Deploy databases 20% |
| security-operations-engineer | Platform operations 14% ; Data management 14% ; Threat hunting 19% ; Detection engineering 22% ; Incident response 21% ; Observability 10% |

Le sitemap officiel Google Cloud confirme ces 14 pages actives. Professional
Google Workspace Administrator est exclu (retrait officiel au 2024-12-31).
Professional Collaboration Engineer et LookML Developer ne sont plus des
certifications actives. Aucun examen beta n'est liste comme disponible au
snapshot.

## Provenance

- AWS : index et guides HTML `docs.aws.amazon.com`, pages de cycle de vie
  `aws.amazon.com`.
- Google Cloud : catalogue/pages `cloud.google.com`, guides PDF
  `services.google.com`, politiques `support.google.com`.
- Les 14 PDF Google ont ete telecharges directement depuis leur URL officielle
  et extraits localement. Aucun miroir, dump ou fournisseur de formation n'a
  ete utilise.
- Les URL exactes et la date de verification sont conservees par certification
  dans le catalogue JSON.

## Plan de vagues

| Vague | Perimetre |
| --- | --- |
| 0 | Cette fondation : schemas, catalogue, matrices vides, validateurs, manifests et documentation. |
| 1 | Fondamentaux : AIF-C01, CLF-C02, Cloud Digital Leader, Generative AI Leader. |
| 2 | Coeur Associate : SAA-C03, DVA-C02, SOA-C03, Cloud Engineer, Data Practitioner, Associate Google Workspace Administrator. |
| 3 | Data et AI : DEA-C01, MLA-C01, AIP-C01, Professional Data Engineer, Cloud Database Engineer, Machine Learning Engineer. |
| 4 | Architecture, developpement, DevOps, securite et reseau : SAP-C02, DOP-C02, SCS-C03 et les six Professional Google correspondantes. |
| Specialty | SCS-C03 et ANS-C01 tant que ce dernier reste `active-retiring`, avec conservation historique apres retrait. |

ANS-C01 recoit une vague bornee de scenarios originaux pendant sa phase
`active-retiring`. `lifecycle.recommendThrough` vaut `2026-08-25` : le gate
`isCertificationRecommendedOn` l'exclut des recommandations a compter du
2026-08-26. Les paires restent conservables comme contenu historique et la
matrice passera a `retired` lors de la revue de cycle de vie.

Chaque vague :

1. cree des paires public/answerKey `v3` ;
2. reference chaque ID dans une seule section de matrice ;
3. couvre les objectifs sans inventer de ponderation ;
4. execute les gates schema, bijection, anti-fuite et determinisme ;
5. ne modifie jamais un blueprint sans creer une nouvelle version de snapshot.
