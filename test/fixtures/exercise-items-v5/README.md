# Exemples du contrat d'exercices v5

Ces 16 fichiers sont les exemples officiels du contrat v5, un couple question publique et
corrigé privé par type. Ils sont copiés à l'identique depuis
`gchambaud_microsoft/Certigo`, chemin `docs/contracts/exercise-items/v5/examples/`, à la
révision `6562c293852592f727d7b61e2d792070752a67cf` (lot `wp-p2-06`).

Ils ne sont pas du contenu : ils ne sont ni validés comme corpus, ni empaquetés. Ils servent
de témoins positifs à `test/exercise_items_v5.test.mjs`. Chaque couple doit passer les
schémas `schemas/question.schema.json` et `schemas/solution.schema.json`, ainsi que les
règles croisées X1 à X9 de `tools/lib/exercise_v5.mjs`. Les 17 contrôles négatifs du même
test sont construits en modifiant une seule propriété de ces fichiers.

Ne pas les modifier : s'ils divergent de la spécification, la recopier depuis une révision
nommée de Certigo et mettre à jour cette révision ici.
