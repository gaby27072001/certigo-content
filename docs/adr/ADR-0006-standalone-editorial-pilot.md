# ADR-0006 - Pilote guide hors des ressources de release

## Statut

Propose le 2026-10-14. Le pilote reste un brouillon a relire, pas une release.

## Contexte constate sur main

`tools/materialize_runtime.mjs` produit exclusivement des tracks
`questionBank`, des domains et des concepts a partir du catalogue et de la
couverture. En mode ecriture, il supprime puis recree tout
`content/public/runtime/`. Son mode `--check` refuse les fichiers supplementaires.
Une lesson redigee a la main dans cet arbre serait donc effacee a la prochaine
generation, meme si le schema runtime sait representer des parcours guides.

`schemas/runtime-resource.schema.json` et le validateur de graphe exigent
une certification et son blueprint. Notre parcours de bonnes pratiques IA ne
prepare pas a un examen : lui attribuer artificiellement une certification
deformerait son intention. Le backend accepte ses propres schemas fermes ;
une extension publiee exige d'abord son expand, sa fusion et son deploiement.

## Decision bornee

Conserver la source de verite auteur dans `editorial/pilots/`, **hors de
`content/`**, sous un schema ferme `certigo.editorial.pilot/v1`.
Ne changer ni le generateur, ni les globs de distribution, ni le catalogue.

Le schema vit dans `editorial/schemas/`, pas dans `schemas/` : les tests du
contrat backend exigent une copie acceptee de chaque schema de release a la
racine de ce dernier repertoire. Ce contrat purement editorial n'en est pas un.

Le pilote comprend des objectifs observables, des idees expliquees, un cas
resolu, une pratique ouverte, ses criteres d'auto-relecture et un retour
pedagogique. Ce ne sont pas des paires question/solution du corpus de
certification. Le retour reste editorial, sans tentative ni notation serveur.
Il ne faut pas copier ces ressources dans l'espace des questions publiques.

Les references sont des pages officielles AWS effectivement consultees,
avec date, faits soutenus et limites. Chaque lesson reference ses sources.
Les conseils organisationnels sont des choix pedagogiques, pas des exigences
AWS inventees. Le schema limite les URL a la documentation Bedrock :
ce choix est volontairement propre a ce pilote, pas un registre universel.

`npm run editorial:validate` controle hors reseau le schema, les identifiants,
les chemins, les references, la coherence des dates et des durees.
`npm test` relit aussi le pilote reel. Des tests en repertoire temporaire
regenerent le runtime deux fois, exigent la preservation des octets du pilote,
puis comparent manifestes et octets des paquets avec et sans le pilote.
Aucune nouvelle dependance ni generation de lesson runtime n'est ajoutee.

## Consequences et limites

- Le travail auteur ne peut pas etre efface par la regeneration actuelle.
- Le pilote est reviewable en JSON ; il n'est ni visible dans l'application,
  ni importe par le backend, ni inclus dans les artefacts public/prive.
- La validation structurelle ne prouve ni la qualite pedagogique ni la
  fidelite aux sources. La date est un snapshot, pas une attestation de
  fraicheur permanente ; le controle ne consulte pas AWS a chaque execution.
- Aucun schema accepte par le backend, garde de publication, blueprint,
  question existante ou solution existante n'est modifie.

## Recommandation pour une integration future (hors de cette PR)

Decider d'abord comment representer un parcours d'apprentissage sans
certification dans le backend et l'application, puis appliquer expand avant
usage. Ne pas recycler une certification comme conteneur.

Ensuite, definir deux racines d'auteur explicites : banques derivees et
compositions guidees. Un assembleur deterministe devra ecrire seulement une
sortie generee, refuser les collisions d'identifiants et de chemins, valider
les references et conserver la separation public/prive pour les futurs
exercices notes. Il ne devra jamais supprimer une racine auteur.

Avant publication, prouver la preservation du contenu auteur apres
regeneration, la parite du contrat deploye, les controles anti-fuite et
l'accessibilite du parcours dans l'application. Cette decision ne lance pas
cette migration, ne promet pas sa compatibilite et n'autorise aucune release.
