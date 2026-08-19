# Couverture editoriale AZ-104

## Referentiel

Le corpus s'appuie exclusivement sur le guide officiel Microsoft Learn
**AZ-104: Microsoft Azure Administrator**, dans sa version
**Skills measured as of April 17, 2026**, et sur la documentation Azure
officielle. Les questions sont des scenarios originaux d'administration et ne
reproduisent aucun contenu d'examen.

Ponderations du referentiel :

| Domaine | Fourchette officielle |
| --- | ---: |
| Gerer les identites et la gouvernance Azure | 20-25 % |
| Implementer et gerer le stockage | 15-20 % |
| Deployer et gerer les ressources de calcul Azure | 20-25 % |
| Implementer et gerer les reseaux virtuels | 15-20 % |
| Superviser et maintenir les ressources Azure | 10-15 % |

## Audit et evolution

L'audit des 12 paires existantes n'a releve ni fuite de reponse dans le canal
public, ni rupture de bijection, ni contenu devenu incompatible avec le
referentiel du 17 avril 2026. Les questions existantes sont exactes mais
concentrent chacune leur domaine sur un petit nombre d'objectifs. La
supervision representait en outre 16,7 % du petit corpus, legerement au-dessus
de la fourchette officielle.

Huit scenarios ont ete ajoutes sur les lacunes prioritaires : pilote SSPR,
Azure Policy a l'echelle d'un groupe de gestion, cycle de vie Blob, prevision
What-If Bicep, mise a l'echelle de Container Apps, regles NSG effectives,
private endpoint et alertes Azure Monitor.

| Domaine | Avant | Apres | Part apres | Fourchette |
| --- | ---: | ---: | ---: | ---: |
| Identites et gouvernance | 3 | 5 | 25 % | 20-25 % |
| Stockage | 2 | 3 | 15 % | 15-20 % |
| Calcul | 3 | 5 | 25 % | 20-25 % |
| Reseaux virtuels | 2 | 4 | 20 % | 15-20 % |
| Supervision et sauvegarde | 2 | 3 | 15 % | 10-15 % |
| **Total** | **12** | **20** | **100 %** | |

## Matrice de couverture

La matrice est volontairement agregee : elle documente les objectifs couverts
sans associer un identifiant public a une reponse attendue. Un scenario peut
mobiliser plusieurs competences connexes sans etre compte plusieurs fois.

| Domaine | Objectifs couverts | Existantes | Nouvelles | Total |
| --- | --- | ---: | ---: | ---: |
| Identites et gouvernance | Utilisateurs et groupes Entra ; roles et portees RBAC ; verrous ; SSPR ; Azure Policy et groupes de gestion | 3 | 2 | 5 |
| Stockage | SAS ; redondance et niveaux ; gestion du cycle de vie Blob | 2 | 1 | 3 |
| Calcul | Disques de VM ; VMSS et disponibilite ; App Service ; deploiements Bicep ; Container Apps | 3 | 2 | 5 |
| Reseaux virtuels | Appairage ; repartition de charge ; regles NSG effectives ; points de terminaison prives | 2 | 2 | 4 |
| Supervision et sauvegarde | Journaux Azure Monitor ; Site Recovery ; alertes et groupes d'actions | 2 | 1 | 3 |

## Sources officielles

- [Guide d'etude officiel AZ-104 - competences mesurees a compter du 17 avril 2026](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/az-104)
- [Activer Microsoft Entra SSPR pour un groupe pilote](https://learn.microsoft.com/en-us/entra/identity/authentication/tutorial-enable-sspr)
- [Comprendre la portee dans Azure Policy](https://learn.microsoft.com/en-us/azure/governance/policy/concepts/scope)
- [Controle d'acces Azure RBAC](https://learn.microsoft.com/en-us/azure/role-based-access-control/overview)
- [Verrouiller les ressources Azure](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/lock-resources)
- [Vue d'ensemble de la securite reseau Azure Storage](https://learn.microsoft.com/en-us/azure/storage/common/storage-network-security-overview)
- [Gestion du cycle de vie Azure Blob Storage](https://learn.microsoft.com/en-us/azure/storage/blobs/lifecycle-management-overview)
- [Redondance Azure Storage](https://learn.microsoft.com/en-us/azure/storage/common/storage-redundancy)
- [Previsualiser les changements d'un deploiement Bicep avec What-If](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/deploy-what-if)
- [Regles de mise a l'echelle Azure Container Apps](https://learn.microsoft.com/en-us/azure/container-apps/scale-app)
- [Diagnostiquer le filtrage reseau avec les regles NSG effectives](https://learn.microsoft.com/en-us/azure/virtual-network/diagnose-network-traffic-filter-problem)
- [Vue d'ensemble des points de terminaison prives](https://learn.microsoft.com/en-us/azure/private-link/private-endpoint-overview)
- [Groupes d'actions Azure Monitor](https://learn.microsoft.com/en-us/azure/azure-monitor/alerts/action-groups)
- [Azure Site Recovery](https://learn.microsoft.com/en-us/azure/site-recovery/site-recovery-overview)

## Regles editoriales

- Le canal public ne contient que `id`, `schemaVersion`, `kind`, `prompt` et
  `choices`.
- La reponse et la rationale operationnelle restent exclusivement dans la
  solution privee de meme ID.
- Toute evolution conserve une bijection stricte entre question publique et
  solution privee.
- Les scenarios evaluent des decisions d'administration et de depannage, sans
  pretendre reproduire des questions d'examen.
