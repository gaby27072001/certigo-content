# ADR-0001 — Manifeste de contenu immuable et adressable par hash

- Statut : Accepté (Phase 1, lot wp-p1-07)
- Date : 2025
- Portée : dépôt `gchambaud_microsoft/certigo-content`
- Lots liés : wp-p1-06 (pipeline CI content, mergé), wp-p1-05 (migration du contenu réel, concurrent), lot LIVE/OPS ultérieur (infra CDN réelle — Gabriel)

## Contexte

`certigo-content` héberge le contenu de Certigo :

- `content/public/questions/*.json` — énoncés publics ;
- `content/answerKey/solutions/*.json` — corrigés (answer key).

Ce contenu doit pouvoir être :

1. **vérifié en intégrité** côté client (garantir qu'un item servi n'a pas été altéré) ;
2. **immuable** une fois publié (un jeu de contenu publié ne change jamais « en place ») ;
3. **adressable par hash** (l'identifiant d'un jeu de contenu = un hash déterministe de ce contenu), pour un service via CDN où la clé/URL dérive du hash.

Il fallait un **format de manifeste** + un **générateur déterministe** + une **régénération/vérification en CI**, le tout **content-agnostique** : le contenu réel arrive en parallèle (wp-p1-05) et le mécanisme doit fonctionner quel que soit le contenu présent (aujourd'hui une seule paire de démo).

## Décision

### 1. Manifeste de contenu, format `certigo.content.manifest/v1`

Le générateur `tools/gen_manifest.mjs` parcourt `content/public/questions/*.json` et
`content/answerKey/solutions/*.json`, et produit un manifeste :

```jsonc
{
  "schema": "certigo.content.manifest/v1",
  "algorithm": "sha256",
  "canonicalization": "json-sorted-keys-compact-utf8",
  "itemCount": 2,
  "items": [
    { "channel": "public",    "id": "demo-0001", "path": "content/public/questions/demo-0001.json",  "hash": "<sha256>", "size": 123 },
    { "channel": "answerKey", "id": "demo-0001", "path": "content/answerKey/solutions/demo-0001.json", "hash": "<sha256>", "size": 45 }
  ],
  "manifestId": "sha256:<rootHash>",
  "rootHash": "<sha256>"
}
```

- **`hash` par item** = `SHA-256(canonical(JSON))` en hexadécimal.
- **`size`** = taille en octets de la forme **canonicalisée** (c'est la représentation servie/hashée).
- **`rootHash`** = `SHA-256(canonical(corps du manifeste))`, où le « corps » est le manifeste **sans** `rootHash`/`manifestId` et **sans** aucun champ dépendant de l'environnement (pas d'horodatage).
- **`manifestId`** = `sha256:<rootHash>` — le manifeste est **adressable par son propre hash**.

### 2. Canonicalisation déterministe

`canonicalization: "json-sorted-keys-compact-utf8"` :

- clés d'objet triées récursivement (ordre lexicographique) ;
- sérialisation compacte (aucun espace non significatif) ;
- UTF-8 ; un BOM UTF-8 en tête de fichier est retiré avant parsing.

Conséquence : **un même contenu sémantique → un même hash**, indépendamment de
l'ordre des clés sur disque, des espaces, ou d'un BOM. Le manifeste émis (fichier)
est sérialisé en pretty-print à ordre de clés fixe, donc reproductible **octet pour
octet** ; mais le `rootHash` porte sur la forme **canonicalisée**, pas sur le
pretty-print — le hash ne dépend donc pas de la mise en forme.

### 3. Immuabilité (append-only, jamais de mutation en place)

Un manifeste publié est **immuable** :

- son `manifestId` = `sha256:<rootHash>` identifie **exactement** un jeu de contenu ;
- toute évolution du contenu (ajout, retrait, modification d'un item) produit un
  **nouveau** manifeste avec un **nouveau** `rootHash`, donc un **nouveau**
  `manifestId` ;
- on ne réécrit jamais un manifeste existant sous la même adresse. La publication
  est append-only : anciens et nouveaux manifestes coexistent, chacun adressé par
  son hash.

### 4. Contrat de service via CDN + hash (documenté ici ; infra réelle = lot LIVE/OPS ultérieur)

Le service de contenu est **hash-addressable**. Convention de service recommandée :

- **items** servis à une clé dérivée du hash de l'item, p.ex. :

  ```
  https://<cdn>/content/items/sha256/<item.hash>          # objet immuable
  ```

- **manifeste** servi à une clé dérivée de son `rootHash`, p.ex. :

  ```
  https://<cdn>/content/manifests/sha256/<rootHash>       # manifeste immuable
  ```

Propriétés :

- comme la clé dérive du hash, un objet à une adresse donnée est **immuable** et
  peut être mis en cache **indéfiniment** (`Cache-Control: immutable`) ;
- un client **vérifie l'intégrité** en recalculant `SHA-256(canonical(payload))`
  et en comparant au `hash` (item) ou au `rootHash` (manifeste) attendu. Un item
  ne doit être considéré valide **que** si son hash correspond à l'entrée
  manifeste — c'est la garantie d'intégrité côté client ;
- la publication d'une nouvelle version consiste uniquement à publier le
  nouveau manifeste sous son propre hash. La promotion Azure definie par
  ADR-0003 n'utilise aucun alias mutable ; le consommateur selectionne
  explicitement un `manifestId`.

> L'infrastructure CDN concrète (bucket, distribution, invalidation) est
> **hors périmètre** de ce lot ; elle sera livrée par un lot
> LIVE/OPS ultérieur. Le présent lot fige le **format**, le **générateur**, la
> **régénération/vérification CI**, l'**intégrité** et le **contrat de service
> documenté**.

### 5. Régénération et vérification en CI

Workflow dédié `.github/workflows/ci-content-manifest.yml` (séparé de
`ci-content.yml` pour ne pas entrer en conflit avec les PR concurrentes) :

- **Gate strict et content-INDÉPENDANT** — `tools/manifest_selfcheck.mjs` :
  1. **déterminisme** : génère deux fois le corpus de fixtures → sortie identique ;
  2. **golden vector** : le corpus de fixtures figé (`tools/__fixtures__/manifest/`)
     doit reproduire un `rootHash` attendu codé en dur (détecte toute dérive
     involontaire de l'algorithme) ;
  3. **schéma** : le manifeste émis valide `schemas/manifest.schema.json`.

  Ces trois vérifications ne dépendent **pas** du contenu réel : l'arrivée du
  contenu de wp-p1-05 ne peut donc jamais casser ce gate.

- **Régénération LIVE** : le manifeste est régénéré à partir du contenu **présent**
  (`node tools/gen_manifest.mjs --out content/manifest.json`) et publié en
  **artifact** (`content-manifest`). Sur `push main`, il se met à jour
  automatiquement quand le contenu réel atterrit.

### 6. Choix : ne pas committer `content/manifest.json`

Pour rester content-agnostique et **ne pas casser wp-p1-05**, le manifeste live
**n'est pas committé** dans le dépôt : il est un **artifact** de CI, régénéré à la
demande. Committer un manifeste figé (démo) créerait une divergence dès que le
contenu réel arrive (le fichier committé ne serait plus reproductible). Le workflow
inclut une étape « committé == régénéré » qui reste **inerte** tant qu'aucun
`content/manifest.json` n'est suivi par git, et qui n'échoue que si quelqu'un
committe volontairement un manifeste divergent.

Un exemple **illustratif** (non-autoritatif) du format est fourni sous
`docs/examples/manifest.example.json` ; il n'est référencé par aucun gate.

## Conséquences

- **Positif** : intégrité vérifiable de bout en bout ; immuabilité et cache CDN
  agressif ; identifiants de version stables et vérifiables ; mécanisme
  content-agnostique compatible avec la migration de contenu concurrente ;
  vérification CI robuste et indépendante du corpus.
- **À noter** : la canonicalisation est propre à ce format (les consommateurs
  doivent réutiliser `canonicalize` de `tools/gen_manifest.mjs` pour recalculer un
  hash identique) ; l'infra CDN reste à livrer (lot LIVE/OPS). ADR-0003 interdit
  l'alias mutable automatique pour la promotion Azure.

## Références

- `tools/gen_manifest.mjs` — générateur déterministe (canonicalisation, hash par
  item, `rootHash`, `manifestId`).
- `tools/manifest_selfcheck.mjs` — gate CI (déterminisme + golden vector + schéma).
- `schemas/manifest.schema.json` — schéma du manifeste (`certigo.content.manifest/v1`).
- `tools/__fixtures__/manifest/` — corpus figé du golden vector.
- `.github/workflows/ci-content-manifest.yml` — workflow CI dédié.
