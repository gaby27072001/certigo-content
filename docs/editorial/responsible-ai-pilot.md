# Pilote : utiliser un assistant IA pour un travail technique

Source de verite :
[`editorial/pilots/responsible-ai-assistants.json`](../../editorial/pilots/responsible-ai-assistants.json).
Le parcours est un brouillon original en francais de 18 minutes, sans compte
cloud requis. Ce n'est ni une preparation a une certification ni une promesse
de competence certifiee.

## Lecture et relecture

Lire les trois lessons dans l'ordre : verifier une affirmation, comprendre
recherche/contexte/entrainement, puis suspendre et escalader une action a risque.
Dans chaque lesson, lire le cas resolu, produire sa propre reponse au
`practice.prompt`, puis utiliser `successCriteria` et `feedback` pour la relire.
Les criteres ne sont pas un score ni une cle de correction du corpus existant.
Les durees sont des estimations editoriales, pas des mesures d'usage.

Tous les scenarios sont fictifs et rediges pour ce pilote. Ils ne reprennent
ni questions d'examen, ni passages fournisseurs, ni corriges Certigo.
Ne pas utiliser de vrais journaux, secrets ou documents internes pour essayer
les activites. Aucune commande ni action cloud n'est necessaire.

## Sources consultees au 2026-10-14

| Page officielle AWS | Appui et limite de formulation |
| --- | --- |
| [Knowledge Bases](https://docs.aws.amazon.com/bedrock/latest/userguide/knowledge-base.html) | Recherche, contexte et citations ; ne pas promettre qu'une citation garantit la verite ou que tous les types de bases ont les memes permissions. |
| [How knowledge bases work](https://docs.aws.amazon.com/bedrock/latest/userguide/kb-how-it-works.html) | Decoupage, embeddings, index, recherche et contexte dans le parcours vectoriel non structure ; ne pas generaliser a toutes les architectures RAG ni assimiler calcul de vecteurs et entrainement. |
| [Contextual grounding checks](https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails-contextual-grounding-check.html) | Appui sur une reference, pertinence et seuils ; ni preuve de verite externe ni garantie de confidentialite. La page exclut le chatbot conversationnel des usages pris en charge. |
| [Data protection](https://docs.aws.amazon.com/bedrock/latest/userguide/data-protection.html) | Responsabilite du client, permissions limitees, prudence avec champs libres et identifiants ; aucune autorisation generale de transmettre des donnees internes. |

Les champs `supports` et `limits` du JSON bornent la paraphrase de chaque
source. Les decisions de travail et les demandes de revue sont pedagogiques ;
elles doivent etre adaptees aux procedures de l'organisation.
Pour re-verifier le pilote, rouvrir chaque source, relire les affirmations et
limites, puis actualiser ensemble `asOf` et les `checkedOn`. Ne pas avancer
les dates sans relire. Aucun reseau ni horloge courante n'entre dans la validation.

## Controles et frontiere

```powershell
npm run editorial:validate
node --test test\editorial_pilot.test.mjs
```

Le schema ferme exige du texte non vide, des sources AWS datees et des
activites de relecture. Le validateur refuse les identifiants et URL dupliques,
les references inconnues ou inutilisees, les chemins divergents et les durees
incoherentes. Des tests negatifs couvrent ces rejets ; les tests de coexistence
verifient les octets apres regeneration et l'exclusion des manifestes/paquets.
`npm test` inclut ces controles en CI.

Ces controles ne sont pas une evaluation avec des apprenants. Avant de
qualifier le pilote de pret pour le produit, faire relire les faits et la
langue, puis observer si des debutants savent justifier leurs decisions sans
voir le retour pedagogique. Pas de promesse d'apprentissage mesure dans cette PR.

Le repertoire editorial n'est pas distribue. Ne pas copier le pilote dans
`content/public/runtime/` : le generateur remplace cet arbre. La contrainte
et la recommandation d'integration sont dans
[`ADR-0006`](../adr/ADR-0006-standalone-editorial-pilot.md).
