# Remediation editoriale — conventions et regle d'arret

**Cette note existe pour empecher un travail, pas pour en documenter un.**

Le programme de remediation a mesure plusieurs facons dont la bonne reponse se
distingue de ses distracteurs. Deux ont ete corrigees, les autres sont
volontairement laissees en l'etat. Sans cette note, une session future
retrouvera les memes chiffres, les croira neufs, et les corrigera — c'est-a-dire
optimisera le detecteur au lieu d'ameliorer le contenu.

## La regle d'arret

> On corrige les heuristiques qu'un candidat peut executer de tete en lisant.
> On mesure et on consigne les autres. On n'en corrige aucune autre.

Le critere n'est pas la significativite statistique, c'est **l'exploitabilite
par quelqu'un qui ne connait pas la matiere**. Personne ne compte les
conjonctions de quatre options avant de cocher ; tout le monde voit que la
reponse la plus longue gagne.

La question qui compte n'est donc pas « le corpus est-il separable » — un
classifieur a onze traits n'est pas un apprenant — mais « quelqu'un qui ignore
la matiere peut-il faire mieux que le hasard ».

## Les deux axes corriges, et ou ils sont controles

| Axe | Exploitable de tete | Controle dans le depot |
| --- | --- | --- |
| Position de la bonne reponse | oui | `tools/validate_content.mjs`, invariant de cohorte |
| Longueur de la bonne reponse | oui | `tools/validate_content.mjs`, ratio par question + rang de cohorte |

Le controle par question (quatre choix, quatre longueurs distinctes, ratio
`correct / moyenne(distracteurs)` dans `[0.85, 1.15]`) est desactive question
par question par `config/editorial-debt.json` et se rallume des qu'un
identifiant sort du registre.

Le controle d'equilibre des rangs est un invariant **de cohorte** : il ne
s'execute que lorsque la certification n'a plus aucune question dispensee. Son
activation est donc anti-correlee a la probabilite du defaut — c'est un
arbitrage assume et commente dans le code, pas un oubli. Consequence
operationnelle :

> Un `npm run validate` vert **avant** le retrait des entrees ne prouve rien sur
> l'axe des rangs. C'est le retrait qui allume le controle. L'ordre est donc
> impose : retrait d'abord, validation ensuite.

## Le residu mesure, et pourquoi il n'est pas corrige

    node tools/audit_answer_leak.mjs <provider> <slug>

L'outil n'est pas un gate : la CI ne l'execute pas et il ne bloque rien. Il
compte, sur chaque question, si la bonne reponse porte un trait plus que la
moyenne de ses distracteurs, et compare le resultat a un controle negatif qui
rejoue le meme calcul sur une option tiree selon une permutation **equilibree**.

Trois traits sont suivis : densite de conjonctions, nombre d'acronymes,
longueur du mot le plus long. Aucun n'est corrige.

Mesure du 2026-09-07 sur quatre cohortes AWS (`saa-c03`, `dea-c01`, `ans-c01`,
`scs-c03`), soit douze tests : **deux ressortent sous 5 %, tous deux sur les
acronymes**. Sous l'hypothese nulle on en attend 0,6 ; en observer deux sur
douze n'a rien de surprenant, et aucune correction pour tests multiples n'a ete
appliquee. **Le residu est donc mesure, pas etabli.** Les valeurs exactes
changent a chaque corpus : les relire avec la commande plutot que de les figer
ici.

Corriger un trait sur un seuil brut reviendrait a editer le contenu jusqu'a ce
que le detecteur se taise. C'est optimiser l'instrument, pas le corpus.

## Pourquoi le processus ne converge pas de lui-meme

Une bonne reponse bien specifiee enumere des etapes, et les etapes se joignent
par des conjonctions ; nommer precisement un service coute un acronyme. **La
fuite n'est pas un artefact a eliminer : c'est une consequence de la justesse.**
Une reponse correcte differe reellement d'une reponse plausible et fausse, et
toute difference mesurable est un indice potentiel.

Fermer un axe ne supprime donc rien — cela deplace la meme information vers la
mesure suivante. `saa-c03` en est la demonstration la plus nette : ses positions
etaient deja parfaitement equilibrees alors que dix-neuf de ses vingt bonnes
reponses etaient l'option la plus longue.

Il en decoule qu'on ne peut pas atteindre l'indiscernabilite en contraignant la
bonne reponse. On ne peut y arriver qu'en rendant les distracteurs aussi
corrects d'apparence — c'est-a-dire en investissant dans les mauvaises reponses,
pas en rabotant la bonne. **Ce chantier est consigne ici et n'est pas
commence.**

Corollaire pour la redaction : bien sourcer et bien justifier une bonne reponse
l'allonge. Il faut donc allonger les distracteurs d'autant, sans quoi chaque
amelioration de fond creuse la fuite de forme.

## Verification des sources

`tools/validate_content.mjs` ne verifie que la **forme** des URL de provenance,
contre une liste d'hotes officiels par editeur. Aucun outil du depot ne
telecharge de page : ce serait une entree reseau dans une chaine qui doit rester
deterministe. La verification du contenu d'une source est donc manuelle.

Propriete mesuree du site de documentation AWS, rencontree une dizaine de fois
sur ce programme : certaines URL de domaine d'examen repondent **HTTP 200** avec
un corps de 1000 a 1400 octets qui n'est qu'une redirection JavaScript vers un
index. Un controle qui ne regarde que le code de statut les accepte toutes.

> Le code HTTP ne varie pas avec ce qu'on veut mesurer : il varie avec
> l'existence d'une reponse, pas avec celle d'un contenu.

Consequence pratique : recuperer la page en **octets bruts**, verifier une
taille plancher (de l'ordre de 6000 octets) **et** une chaine attendue dans le
corps avant de conclure quoi que ce soit. Chercher un fait dans un talon et
chercher un fait dans une vraie page qui ne le contient pas rendent la meme
sortie vide, et les deux conclusions sont opposees : *la source ne dit pas ca*
contre *je n'ai pas lu la source*.

Un rendu markdown d'une page editeur peut supprimer silencieusement une
banniere ; lire le HTML brut.

## Encadrer une contradiction plutot que l'arbitrer

Quand deux pages officielles se contredisent, le catalogue **pose les deux
bornes et nomme ce que chacune signifie** au lieu de choisir. Le cas de
reference est `aws:dva-c02` dans `content/public/catalog/certifications.json` :
`recommendThrough` est la derniere date ou les deux sources s'accordent,
`lastExamOn` la plus tardive revendiquee, et `lifecycle.note` cite les deux
sources.

Le champ conservateur sert a **recommander**, le champ large a borner l'ultime
possibilite : l'incertitude pese sur celui qui decide, pas sur l'apprenant.

Corollaire : classer des certifications « par duree de vie restante » n'est pas
une operation unique. Il faut nommer le champ, sinon l'ordre depend d'un choix
non declare.

## Falaise d'expiration des registres

`config/editorial-debt.json` et `config/legacy-coverage-inventory.json`
partagent aujourd'hui une date d'expiration unique : leurs entrees cessent de
dispenser le meme jour et la validation passe au rouge d'un bloc. C'est une
propriete d'une fenetre d'expiration uniforme, pas un accident — des entrees
creees ensemble expirent ensemble.

Pour constater l'etat a une date future sans attendre l'echeance :

    node tools/validate_content.mjs --as-of AAAA-MM-JJ

Le compte varie avec la date et n'est volontairement pas fige ici.

Constat non tranche : `test/catalog.test.mjs` interdit ce regroupement sur
`config/catalog-transition-exemptions.json` (au moins trois dates distinctes des
dix entrees, douze au plus par date) et n'exige rien d'equivalent sur les deux
autres registres. Trois registres, deux regimes, raison non documentee.
