# Couverture éditoriale DP-900

## Référentiel

Cette banque cible le guide officiel **Exam DP-900: Microsoft Azure Data
Fundamentals**, compétences mesurées à compter du **21 juillet 2026**. Les
questions sont des scénarios originaux rédigés à partir des objectifs et de la
documentation produit Microsoft. Aucun dump d'examen ni aucune question
d'évaluation officielle n'a été utilisé ou reproduit.

Le guide répartit les compétences en quatre domaines :

| Domaine officiel | Pondération |
| --- | ---: |
| Concepts fondamentaux des données | 25-30 % |
| Données relationnelles sur Azure | 20-25 % |
| Données non relationnelles sur Azure | 15-20 % |
| Charge analytique sur Azure | 25-30 % |

## Audit des 12 questions initiales

Les 12 paires initiales respectaient les schémas v2, la bijection des IDs et la
frontière public/answerKey. Elles étaient exactes, mais ne couvraient que trois
scénarios par domaine et laissaient plusieurs objectifs 2026 sans question
dédiée. La rationale Cosmos DB a été précisée pour retirer l'affirmation trop
générale selon laquelle les services relationnels seraient seulement régionaux.

| ID initial | Domaine | Objectif principal | Résultat |
| --- | --- | --- | --- |
| `dp900-l-data-types-check-1` | Concepts | Données semi-structurées | Conforme |
| `dp900-l-transactional-analytical-check-1` | Concepts | Charge transactionnelle | Conforme |
| `dp900-l-data-roles-check-1` | Concepts | Rôle de l'ingénieur de données | Conforme |
| `dp900-l-relational-concepts-check-1` | Relationnel | Clés et intégrité référentielle | Conforme |
| `dp900-l-azure-sql-check-1` | Relationnel | Azure SQL Database | Conforme |
| `dp900-l-relational-services-check-1` | Relationnel | Service PostgreSQL managé | Conforme |
| `dp900-l-azure-storage-check-1` | Non relationnel | Azure Blob Storage | Conforme |
| `dp900-l-cosmos-db-check-1` | Non relationnel | Cas d'usage et API Cosmos DB | Rationale précisée |
| `dp900-l-nonrelational-concepts-check-1` | Non relationnel | Modèle graphe | Conforme |
| `dp900-l-analytics-concepts-check-1` | Analytique | Ingestion et ELT | Conforme |
| `dp900-l-azure-synapse-check-1` | Analytique | Service analytique Azure | Conforme |
| `dp900-l-data-visualization-check-1` | Analytique | Capacités Power BI | Conforme |

## Matrice objectifs-domaines

La matrice associe chaque groupe d'objectifs 2026 à ses questions. La colonne
« ajoutées » recense les nouvelles paires de cette mise à jour.

| Domaine | Groupe d'objectifs du guide | Questions initiales | Questions ajoutées |
| --- | --- | --- | --- |
| Concepts | Représenter les données | `dp900-l-data-types-check-1` | `dp900-l-unstructured-data-check-1` |
| Concepts | Options de stockage et formats | - | `dp900-l-parquet-format-check-1`, `dp900-l-database-store-check-1` |
| Concepts | Charges transactionnelles et analytiques | `dp900-l-transactional-analytical-check-1` | `dp900-l-analytical-workload-check-1` |
| Concepts | Rôles et responsabilités | `dp900-l-data-roles-check-1` | `dp900-l-dba-responsibilities-check-1`, `dp900-l-data-analyst-responsibilities-check-1` |
| Relationnel | Concepts relationnels, normalisation, SQL et objets | `dp900-l-relational-concepts-check-1` | `dp900-l-normalization-check-1`, `dp900-l-sql-select-check-1`, `dp900-l-database-view-check-1` |
| Relationnel | Famille Azure SQL | `dp900-l-azure-sql-check-1` | `dp900-l-sql-managed-instance-check-1`, `dp900-l-sql-vm-check-1` |
| Relationnel | Bases open source managées | `dp900-l-relational-services-check-1` | - |
| Non relationnel | Blob, Files et Table | `dp900-l-azure-storage-check-1` | `dp900-l-azure-files-check-1`, `dp900-l-table-storage-check-1` |
| Non relationnel | Cas d'usage et API Azure Cosmos DB | `dp900-l-cosmos-db-check-1`, `dp900-l-nonrelational-concepts-check-1` | `dp900-l-cosmos-mongodb-api-check-1` |
| Analytique | Ingestion, traitement et magasins analytiques | `dp900-l-analytics-concepts-check-1` | `dp900-l-columnar-analytics-store-check-1` |
| Analytique | Services à grande échelle | `dp900-l-azure-synapse-check-1` | `dp900-l-fabric-onelake-check-1`, `dp900-l-databricks-spark-check-1` |
| Analytique | Lots, streaming et temps réel | - | `dp900-l-batch-streaming-check-1`, `dp900-l-fabric-realtime-check-1` |
| Analytique | Power BI, modèles et visuels | `dp900-l-data-visualization-check-1` | `dp900-l-power-bi-semantic-model-check-1`, `dp900-l-power-bi-line-chart-check-1` |

## Répartition après enrichissement

| Domaine | Initiales | Ajoutées | Total | Part de la banque |
| --- | ---: | ---: | ---: | ---: |
| Concepts fondamentaux | 3 | 6 | 9 | 27,3 % |
| Relationnel sur Azure | 3 | 5 | 8 | 24,2 % |
| Non relationnel sur Azure | 3 | 3 | 6 | 18,2 % |
| Analytique sur Azure | 3 | 7 | 10 | 30,3 % |
| **Total** | **12** | **21** | **33** | **100 %** |

Les proportions reflètent les fourchettes du guide à l'arrondi près imposé par
un corpus de 33 questions. Chaque question publique ne contient que l'énoncé et
les choix ; la réponse et la rationale restent exclusivement dans answerKey.

## Sources officielles

- [Guide d'étude DP-900 - compétences mesurées à compter du 21 juillet 2026](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/dp-900#skills-measured-as-of-july-21,-2026)
- [Vue d'ensemble Azure SQL](https://learn.microsoft.com/en-us/azure/azure-sql/azure-sql-iaas-vs-paas-what-is-overview)
- [Azure Files](https://learn.microsoft.com/en-us/azure/storage/files/storage-files-introduction)
- [Azure Table Storage](https://learn.microsoft.com/en-us/azure/storage/tables/table-storage-overview)
- [Azure Cosmos DB et ses API](https://learn.microsoft.com/en-us/azure/cosmos-db/)
- [Vue d'ensemble Microsoft Fabric](https://learn.microsoft.com/en-us/fabric/fundamentals/microsoft-fabric-overview)
- [Vue d'ensemble Azure Databricks](https://learn.microsoft.com/en-us/azure/databricks/introduction/)
- [Real-Time Intelligence dans Microsoft Fabric](https://learn.microsoft.com/en-us/fabric/real-time-intelligence/overview)
- [Modèles sémantiques Power BI](https://learn.microsoft.com/en-us/power-bi/connect-data/service-datasets-understand)
- [Types de visualisations Power BI](https://learn.microsoft.com/en-us/power-bi/visuals/power-bi-visualization-types-for-reports-and-q-and-a)
