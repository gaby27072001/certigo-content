# Fixture lexicale — témoin du garde de fuite

Mini-racine de contenu, volontairement en dehors de `content/`, exercée par
`test/lexical_leak.test.mjs`.

Elle n'est **pas** validée par `npm run validate` ni empaquetée : tous les
globs du dépôt (`validate_content`, `package_content`, `gen_manifest`,
`compile_runtime`, `materialize_runtime`) partent de `content/`. Elle porte donc
le strict nécessaire à la lecture lexicale — `choices` côté public, `correct`
côté clé — et rien qui puisse dériver avec le schéma éditorial.

## Ce qu'elle prouve, et pourquoi ces trois cas

Trois questions suffisent à couvrir les trois issues du détecteur :

| famille      | sens | ampleur attendue | rôle                      |
|--------------|------|------------------|---------------------------|
| `manuel`     | `D`  | **3**            | rougit vers distracteurs  |
| `vague`      | `C`  | **3**            | rougit vers bonne réponse |
| `uniquement` | `D`  | **0**            | témoin négatif            |

`uniquement` est le témoin qui donne sa valeur aux deux autres : il est
**présent des deux côtés** (une bonne réponse, un distracteur). Un détecteur qui
signalerait n'importe quel mot fréquent le signalerait aussi. Sans lui, les deux
premières lignes ne prouvent pas que l'outil mesure une *exclusivité* plutôt
qu'une simple présence.

Le seuil étant de 3 questions, chaque cas est écrit exactement à 3 : la fixture
teste donc la frontière, et non un cas confortablement au-delà.

## Si un test échoue ici

Ce n'est pas du contenu à corriger. Une régression sur cette fixture signifie
que `tools/lex_leak.mjs` a cessé de mesurer ce qu'il annonce — corrigez l'outil,
jamais la fixture pour la faire passer.
