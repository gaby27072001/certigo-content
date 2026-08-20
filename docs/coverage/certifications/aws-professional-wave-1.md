# Vague AWS Professional active

## Perimetre

Cette vague ajoute 72 scenarios originaux en francais pour les trois
certifications AWS Professional actives du snapshot editorial
`2026-08-17` :

| Certification | Paires v3 | Niveau |
| --- | ---: | --- |
| DOP-C02 | 24 | Professional |
| AIP-C01 | 24 | Professional |
| SAP-C02 | 24 | Professional |

Chaque scenario possede un fichier public sans reponse et une solution privee
en miroir. Les rationales et les sources qui justifient la reponse restent
dans `content/answerKey/solutions/aws/`. Les matrices publiques ne contiennent
que les identifiants et les objectifs, conformement a l'ADR-0004.

## Provenance officielle

La vague repose uniquement sur les pages de certification, guides d'examen et
documentations de services de premiere partie AWS. Les guides de reference
sont :

- DOP-C02 :
  <https://docs.aws.amazon.com/aws-certification/latest/devops-engineer-professional-02/devops-engineer-professional-02.html>
- AIP-C01 :
  <https://docs.aws.amazon.com/aws-certification/latest/ai-professional-01/ai-professional-01.html>
- SAP-C02 :
  <https://docs.aws.amazon.com/aws-certification/latest/solutions-architect-professional-02/solutions-architect-professional-02.html>

Les pages de domaines liees depuis ces guides fixent les taches et
ponderations. Les comportements de services cites dans une solution sont
justifies dans sa rationale par une ou plusieurs URL `docs.aws.amazon.com` ou
`aws.amazon.com`. Aucun dump, miroir, forum, fournisseur de formation ou
source tierce n'est utilise.

## Allocation par ponderation

Les 24 questions de chaque certification sont allouees par la methode du plus
fort reste. L'ecart indique la difference entre la part du corpus et la
ponderation officielle.

### DOP-C02

| Domaine | Poids | Questions | Part | Ecart |
| --- | ---: | ---: | ---: | ---: |
| SDLC Automation | 22 % | 5 | 20,83 % | -1,17 pt |
| Configuration Management and IaC | 17 % | 4 | 16,67 % | -0,33 pt |
| Resilient Cloud Solutions | 15 % | 4 | 16,67 % | +1,67 pt |
| Monitoring and Logging | 15 % | 4 | 16,67 % | +1,67 pt |
| Incident and Event Response | 14 % | 3 | 12,50 % | -1,50 pt |
| Security and Compliance | 17 % | 4 | 16,67 % | -0,33 pt |

### AIP-C01

| Domaine | Poids | Questions | Part | Ecart |
| --- | ---: | ---: | ---: | ---: |
| Foundation Model Integration, Data Management, and Compliance | 31 % | 7 | 29,17 % | -1,83 pt |
| Implementation and Integration | 26 % | 6 | 25,00 % | -1,00 pt |
| AI Safety, Security, and Governance | 20 % | 5 | 20,83 % | +0,83 pt |
| Operational Efficiency and Optimization for GenAI Applications | 12 % | 3 | 12,50 % | +0,50 pt |
| Testing, Validation, and Troubleshooting | 11 % | 3 | 12,50 % | +1,50 pt |

### SAP-C02

| Domaine | Poids | Questions | Part | Ecart |
| --- | ---: | ---: | ---: | ---: |
| Design Solutions for Organizational Complexity | 26 % | 6 | 25,00 % | -1,00 pt |
| Design for New Solutions | 29 % | 7 | 29,17 % | +0,17 pt |
| Continuous Improvement for Existing Solutions | 25 % | 6 | 25,00 % | 0,00 pt |
| Accelerate Workload Migration and Modernization | 20 % | 5 | 20,83 % | +0,83 pt |

## Exigences editoriales

- exactement quatre choix distincts et une seule meilleure reponse ;
- scenarios professionnels fondes sur plusieurs contraintes simultanees ;
- arbitrages explicites entre gouvernance, securite, resilience, cout,
  performance et charge operationnelle ;
- distracteurs plausibles mais incompatibles avec au moins une contrainte ;
- aucun indice systematique fonde sur la longueur, le vocabulaire ou le nombre
  de services cites dans un choix ;
- aucune question de memorisation isolee et aucune reprise de contenu d'examen ;
- six reponses correctes a chaque position de choix par certification ;
- rationales privees expliquant la reponse retenue et les trois distracteurs ;
- couverture de chaque domaine dans une matrice marquee `complete`.

Le test de vague controle le nombre de paires, l'allocation par domaine,
l'equilibre des positions, la bijection des matrices, l'absence de doublons de
prompts et la provenance AWS des rationales.
