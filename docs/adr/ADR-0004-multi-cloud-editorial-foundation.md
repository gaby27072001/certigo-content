# ADR-0004 - Fondation editoriale multi-cloud

## Statut

Accepte le 2026-08-17.

## Contexte

Le corpus historique utilise des paires JSON `v2` a plat :

- `content/public/questions/<id>.json` ;
- `content/answerKey/solutions/<id>.json`.

Ces payloads ne portent pas de reference normalisee vers un fournisseur, une
certification ou un objectif de blueprint. Une extension multi-cloud doit
eviter les collisions, conserver la frontiere public/answerKey et ne pas
modifier les 146 paires existantes.

## Decision

### Catalogue et matrices

Le catalogue public canonique est
`content/public/catalog/certifications.json`. Il utilise le schema
`certigo.certification-catalog/v1` et contient :

- un snapshot date (`asOf`) ;
- les fournisseurs et leurs seuls hotes de provenance autorises ;
- les certifications actives a cette date ;
- le code officiel lorsqu'il existe, sinon `null` ;
- le slug stable, le titre, le niveau, le statut et les URL officielles ;
- une version interne immuable de blueprint ;
- la version/date officielle du guide lorsqu'elle est publiee ;
- les domaines ou sections et leurs ponderations officielles ;
- les sources officielles verifiees et les transitions de cycle de vie.

Chaque certification active possede exactement une matrice sous
`content/public/coverage/<provider>/<slug>.json`. Une matrice duplique les
objectifs du snapshot pour rendre les ecarts visibles en revue. Elle ne
contient que des identifiants de questions publiques, jamais de reponse.

### Identifiants et namespaces

Les namespaces fournisseurs reserves sont :

| Fournisseur | Namespace |
| --- | --- |
| Amazon Web Services | `aws` |
| Google Cloud | `gcp` |
| Microsoft | `microsoft` |

L'identifiant stable d'une certification est
`<provider>:<certification-slug>`, par exemple `aws:clf-c02`,
`gcp:cloud-digital-leader` ou `microsoft:az-900`.

Le code officiel AWS est normalise en minuscules pour le slug. Google Cloud
ne publie pas de code examen : le segment officiel de l'URL de certification
devient le slug stable. Un renommage marketing ne change jamais un identifiant
deja publie.

Une future question `v3` utilise :

`<provider>.<certification-slug>.<objective>.<editorial-slug>.<sequence>`

Exemple de forme, sans question reelle :

`aws.clf-c02.domain-1.cloud-value.001`

Les chemins `v3` sont :

- `content/public/questions/<provider>/<certification-slug>/<id>.json` ;
- `content/answerKey/solutions/<provider>/<certification-slug>/<id>.json`.

Le validateur exige la meme metadata dans les deux canaux, le meme chemin
relatif, une certification et un objectif presents dans le catalogue, et une
reference dans la matrice de couverture.

### Compatibilite

Les schemas question et solution acceptent deux variantes fermees par
`additionalProperties: false` :

- `v2`, strictement identique au contrat historique ;
- `v3`, avec `metadata.provider`, `metadata.certification`,
  `metadata.blueprintVersion` et `metadata.objective`.

Aucune paire Microsoft existante n'est migree dans cette fondation. Les 146
paires `v2`, y compris les parcours Microsoft deja distribues, restent
byte-identical. La migration peut donc etre progressive, paire par paire,
dans une PR editoriale dediee.

Le manifeste historique et les manifestes de paquet conservent leur `v1`
lorsqu'aucun catalogue n'est present. En presence du catalogue, ils emettent
une `v2` avec `resourceType` et, si disponible, provider/certification/
blueprint/objective. Les schemas acceptent simultanement `v1` et `v2`.

Le paquet public contient questions, catalogue et matrices. Le paquet prive
ne contient que les solutions. Les deux paquets gardent des hashes et
manifestes distincts.

### Provenance et blueprint

Seules les sources de premiere partie sont autorisees :

- AWS : `aws.amazon.com`, `docs.aws.amazon.com`, `d1.awsstatic.com` ;
- Google Cloud : `cloud.google.com`, `services.google.com`,
  `support.google.com` ;
- Microsoft : `learn.microsoft.com` pour une migration future.

`blueprint.version` identifie le snapshot editorial interne. Il ne pretend pas
etre une version officielle. `guide.version` et `guide.publishedOn` restent
`null` si le fournisseur ne les publie pas. `versionSource` distingue une
table de revisions, un en-tete, un titre PDF ou un token de nom de fichier.

Les ponderations AWS sont exactes. Les guides Google les publient avec `~` :
elles sont donc stockees comme `approximate`. Une somme de 99 a 101 est
acceptee pour conserver les arrondis officiels.

### Fraicheur et retrait automatique

`npm run catalog:freshness -- --as-of YYYY-MM-DD` est un controle local sans
reseau. Il compare la date demandee au snapshot, a la prochaine revue globale
et aux transitions particulieres.

Une certification avec `lifecycle.lastExamOn` est consideree active jusqu'a
cette date incluse. Elle est automatiquement exclue de la liste active le
lendemain. Ainsi `aws:ans-c01` est actif au 2026-08-17 et au 2026-08-25, puis
exclu a compter du 2026-08-26. Le controle devient aussi bloquant pour forcer
une revue et la transition explicite de son statut/matrice.

Le controle de fraicheur n'entre pas dans les octets packages et n'ajoute
aucun timestamp au manifeste. Ses tests utilisent une date injectee.

### Retrait, remplacement et renommage

1. Re-verifier uniquement les pages catalogue, certification et guide
   officielles.
2. Conserver l'ancien enregistrement ; ne jamais reutiliser son identifiant.
3. Passer le statut a `retired` ou `replaced`, renseigner la derniere date et
   le successeur officiel lorsqu'il existe.
4. Passer la matrice a `retired` et geler ses IDs ; ne supprimer aucune paire
   encore distribuee dans la meme PR.
5. Creer un nouvel identifiant seulement si le code ou credential officiel
   change. Un simple renommage de titre conserve l'identifiant.
6. Creer un nouveau `blueprint.version` pour tout changement d'objectifs ou de
   ponderations ; les questions existantes restent rattachees a leur snapshot.
7. Regenerer et verifier les deux paquets. Aucun alias mutable n'est publie.

Le cas SOA-C03 illustre la regle : le titre devient CloudOps Engineer, le
chemin du guide conserve `sysops-administrator`, mais l'identite stable reste
`aws:soa-c03`.

## Consequences

- Les questions pourront etre ajoutees par vagues sans collision.
- Le catalogue et les matrices sont publics et soumis a la gate anti-fuite.
- Les consommateurs historiques peuvent continuer a lire les payloads `v2`.
- Les consommateurs de manifestes doivent accepter la `v2` avant de demander
  les ressources catalogue/couverture.
- Une transition de cycle de vie exige une PR de maintenance du snapshot ; elle
  ne modifie jamais silencieusement le contenu source.
