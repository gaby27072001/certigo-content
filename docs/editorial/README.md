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

### D'ou vient le desequilibre : mesure, et non reconstitution

On pourrait croire qu'une campagne passee a rattrape les positions sur tout le
corpus en oubliant `ans-c01`. **La mesure dit autre chose.** En relisant chaque
certification au commit qui l'a introduite :

| cohorte | premier commit | positions a l'origine | positions au HEAD |
| --- | --- | --- | --- |
| `aws:soa-c03` | `7d950f7` | 5/5/5/5 | 5/5/5/5 |
| `aws:dva-c02` | `6146ec2` | 5/5/5/5 | 5/5/5/5 |
| `aws:aif-c01` | `d38a0e1` | 5/5/5/5 | 5/5/5/5 |
| `aws:ans-c01` | `e2d371b` | **24/0/0/0** | 6/6/6/6 |

Les trois premieres sont **identiques a l'origine et aujourd'hui** : elles n'ont
jamais ete rattrapees, elles ont ete **redigees** equilibrees. L'equilibre des
positions est donc une convention de redaction, pas une remediation ; et
`ans-c01`, seule a 24/0/0/0 des son premier commit, vient d'un procede de
redaction different. La ligne `ans-c01` sert aussi de temoin positif : elle
prouve que la mesure sait imprimer autre chose qu'un equilibre, sans quoi une
colonne entiere de `5/5/5/5` serait indiscernable d'un instrument casse.

Ce que cela confirme malgre tout : **fermer un axe ne supprime pas la fuite.**
Des corpus equilibres en position depuis leur premiere ligne presentaient des
rangs de longueur aussi degrades que `0/0/0/20`. L'attention portee a un axe
visible n'a rien appris sur l'autre.

Portee de la mesure : 4 cohortes relues au premier commit sur les 26 qui
possedent des paires v3 a quatre choix. Les 6 certifications restantes sont en
v2 heritee et ne sont pas mesurables ainsi.

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

Une mesure anterieure de ces memes traits a circule avec des valeurs beaucoup
plus tranchees — de l'ordre de 7 cas sur 8 pour les conjonctions. **Elles ne se
reproduisent pas** avec la commande ci-dessus, et la difference n'est pas un
desaccord d'echantillon : l'instrument d'alors tirait son controle negatif par
`sort()` a comparateur aleatoire, ce qui ne produit pas une permutation uniforme,
et ne verifiait pas l'equilibre du tirage. Sur un corpus dont toutes les bonnes
reponses occupaient le meme index, ce controle preservait donc une part du signal
qu'il etait cense detruire. **C'est la premiere mesure qui etait fausse, pas la
seconde.** Si ces anciens nombres reapparaissent dans un historique ou une
discussion, ils n'ont pas ete reproduits et ne doivent pas etre repris.

### Serie par cohorte, a tenir a jour

L'axe des acronymes est celui qui ressort le plus souvent. Une valeur isolee ne
decide de rien ; c'est la **serie** qui informe. Releve du 2026-09-08, cohortes
entierement remediees, controle negatif entre parentheses :

| cohorte | acronymes | conjonctions | mot le plus long |
| --- | --- | --- | --- |
| `aws:dea-c01` | 14/18 **p=0,015** (0,76) | 11/16 p=0,105 (0,30) | 10/19 p=0,500 (0,92) |
| `aws:saa-c03` | 11/14 **p=0,029** (0,93) | 6/15 p=0,849 (0,87) | 9/18 p=0,593 (0,98) |
| `aws:ans-c01` | 12/21 p=0,332 (0,67) | 8/15 p=0,500 (0,94) | 13/21 p=0,192 (0,42) |
| `aws:scs-c03` | 8/19 p=0,820 (0,59) | 8/14 p=0,395 (0,91) | 9/21 p=0,808 (0,67) |

**L'axe ne se generalise pas** : deux cohortes sur quatre ressortent sous 5 %,
les deux autres sont franchement au-dessus (0,33 et 0,82). Douze tests, deux
sous le seuil, aucune correction pour tests multiples — on en attendait 0,6.
Les controles negatifs, eux, restent tous entre 0,59 et 0,98, ce qui est le
comportement attendu d'un controle qui ne detecte rien.

Regle de relecture : **ne pas ajouter de ligne sans relancer la commande sur
toutes les cohortes deja listees.** Les comptes bougent quand une cohorte est
remediee — une meme cohorte mesuree a mi-parcours et une fois terminee ne donne
pas le meme couple `reel/total`. Une ligne recopiee d'un rapport anterieur est
une affirmation, pas une mesure.

Le seuil de decision n'est pas statistique : si l'axe ressortait sur une large
majorite de cohortes, il cesserait d'etre un residu et deviendrait une propriete
du corpus, qu'il faudrait alors trancher en connaissance de cause. Ce n'est pas
le cas aujourd'hui.

Corriger un trait sur un seuil brut reviendrait a editer le contenu jusqu'a ce
que le detecteur se taise. C'est optimiser l'instrument, pas le corpus.

## Troisieme axe : l'exclusivite lexicale

Une famille de mots presente **uniquement dans les distracteurs** est un indice
utilisable sans connaitre la matiere : on elimine ce qui parle de travail
manuel. C'est un axe distinct de la position et de la longueur, et il se mesure
separement.

    node tools/lex_leak.mjs <editeur> <certification>     # etat sur disque
    node tools/lex_diff.mjs <editeur> <certification> <ref>  # disque vs un ref git

`lex_diff` distingue `INTRODUITE PAR MOI` d'une dette heritee et ne sort en
erreur que dans le premier cas : une dette preexistante n'est pas une
regression, et confondre les deux rend l'outil inutilisable comme garde.

Les deux outils sortent en erreur sur la **famille**, jamais sur un token isole,
et `lex_leak --selftest` refuse de servir tant qu'il n'a pas separe deux cas
connus (marqueur exclusif -> vu ; marqueur non exclusif -> ignore).

### Le mecanisme suppose, et la prediction qui n'a pas ete confirmee

**Observation** : a la mesure du 2026-09-08, les corpus qui fuient sur cet axe
sont largement ceux qui ont deja ete remedies en longueur. La dette de longueur
et la dette lexicale apparaissent **anti-correlees**.

**Explication supposee** : corriger la longueur consiste a rallonger les
distracteurs, et ce qui rallonge naturellement une mauvaise reponse
d'architecture cloud, c'est la description d'un procede manuel.

Cette explication est une hypothese, pas un resultat, et elle a ete **testee** :

    dfbe433 rallonge les distracteurs de aws:aif-c01
    longueur moyenne des distracteurs  34.2 -> 50.2  (20 questions)
    prediction : la fuite lexicale doit augmenter
    mesure     : 0 famille avant, 0 famille apres  -> NON CONFIRMEE

Le test est **confondu** : l'auteur de ce commit suivait les memes conventions
et a pu eviter deliberement ce vocabulaire. Il ne refute donc pas proprement
l'explication — mais il ne la soutient pas non plus, et c'etait le seul test
naturel disponible.

**A retenir : la correlation est mesuree, le mecanisme ne l'est pas.** Ne pas
citer ce mecanisme comme un acquis, et ne pas construire de garde dessus.

### Ce qui ne depend pas du mecanisme

La consequence pratique tient meme si l'explication est fausse, parce qu'elle ne
depend que de la correlation observee : conditionner une garde lexicale a
`exemptCount === 0`, comme le sont les gardes de rang et de position,
**inverse** ici. Les corpus sans dispense sont precisement ceux qui fuient. La
garde protectrice serait le declencheur.

### L'experience naturelle : la propreté vient du test, pas du merite

`test/aws_professional_wave.test.mjs` porte deja une garde lexicale, de motif
`/\bmanuel(?:le)?(?:ment)?\b/i`, mais **codee en dur sur cinq certifications**
(`expectedDomains`). A la mesure du 2026-09-08 : les cinq gardees etaient a
zero, et treize des vingt et une non gardees fuyaient. Le compte n'est pas fige
ici — la commande l'est.

**Les corpus propres le sont parce qu'un test a refuse de passer.** Ce n'est pas
un constat de qualite editoriale.

**Correction du 2026-09-08 — cette phrase a ete surinterpretee.** Elle a servi
d'argument principal en faveur d'une extension de la garde, jusqu'a ce qu'on
verifie le cas qu'elle citait : `aws:saa-c03`, passe de zero a trois familles en
fuite dans une PR fusionnee, est **verte** au regard de cette garde. Une de ses
bonnes reponses contient `manuel`, donc la condition `keyedCount === 0` est
fausse et la garde se tait. **Elle n'aurait pas attrape la regression qu'on lui
attribuait.**

Pire : les cinq certifications gardees sont a zero *occurrence*, pas a zero
*desequilibre*. La remediation n'a pas equilibre le mot, elle l'a supprime — la
garde passe parce que le mot n'existe plus. **Elle n'a jamais eu l'occasion de
mordre depuis sa mise en service.** Le contraste entre cohortes gardees et non
gardees subsiste ; ce qu'il prouve, non.

Et le resultat qui condamne l'approche par liste de motifs : **deux des cinq
certifications gardees fuient une famille differente** — `tableur` et `ticket`
sur l'une, `un a un` sur l'autre. Fermer `manuel` n'a pas supprime l'indice, il
l'a **deplace vers le mot suivant**. C'est le mecanisme central de ce programme,
observe ici a l'interieur d'un seul axe, et il precede tout travail de cette
session.

Etendre la garde a `tableur` deplacerait donc la fuite une fois de plus. La
seule sortie est d'investir dans les distracteurs jusqu'a ce qu'aucun
vocabulaire ne leur soit exclusif — **chantier consigne, non commence**.

### Comment on corrige, quand on corrige

La semantique de la garde est la **non-exclusivite**, pas le bannissement :
elle echoue sur `keyedCount === 0 && distractorCount > 0`. On fait donc
apparaitre la famille dans **au moins une bonne reponse**, naturellement, a
`String.length` **strictement identique** — sinon le rang et le ratio bougent et
on rouvre l'axe qu'on venait de fermer. La modification porte en meme temps sur
le `choices` public et le `correct` prive.

Ne pas deviner la chaine : calculer la longueur de queue requise depuis la tete,
puis construire pour tenir.

### Residu mesure sur cet axe, non corrige

En architecture cloud, le travail manuel **est** l'anti-modele. Toute mention
naturelle de `manuel` dans une bonne reponse est donc une negation, et un
candidat pourrait en principe apprendre « l'option qui rejette le travail manuel
gagne ».

Ce residu n'est pas corrige, et la raison tient a la regle d'arret : executer
cette heuristique suppose de **savoir deja** que le procede manuel est
l'anti-modele. C'est de la connaissance du sujet, pas un indice sans contenu.
Le corriger reviendrait a retirer la matiere de la question.

### La garde differentielle, livree le 2026-09-08

La condition posee plus haut — *« la garde s'etend dans la PR meme qui amene la
mesure a zero partout, et pas avant »* — supposait qu'une garde ne peut exister
qu'en **niveau absolu**. C'est cette supposition qui etait fausse, pas la
condition.

Mesure prealable, sur les 33 corpus (734 questions) :

| | valeur |
|---|---|
| corpus qui rougiraient en niveau absolu | **17 sur 33** |
| attendu sous rebattage (3000 tirages, graine fixe) | 6.3 `[p5=3 p95=9]` |
| p | 0.000 |

Le taux de base explique donc ~6 des 17 ; les ~11 autres portent un signal reel.
Une garde absolue exigerait onze campagnes avant que la CI reverdisse, et **une
garde rouge en permanence dresse a passer outre** : elle ne protege rien.

La garde livree compare a une **reference figee** (`config/lexical-baseline.json`)
et n'echoue que sur une **aggravation**. Elle est verte le jour un par
construction, n'exige aucune remediation prealable, et attrape exactement le cas
`saa-c03` que la garde par motif laissait passer.

    npm test                      # inclut test/lexical_leak.test.mjs
    npm run lex:baseline          # resserre la reference apres une amelioration

**Trois regimes, et le troisieme est la decouverte.** Voir `FAMILLES_CLASSEES`
dans `tools/lex_leak.mjs` :

| regime | exemple | traitement |
|---|---|---|
| `JUGEMENT` | `manuel`, `script`, `absolu`, `uniquement`, `vague` | **gate** |
| `INHERENT` | `tout-le-reste` | mesure, **jamais bloquant** |
| `TECHNO` | `cron`, `ticket` | mesure, sous le bruit |

`tout-le-reste` (`tous les`, `l'ensemble des`) est la fuite **la plus forte du
depot** — 21 corpus contre 7.4 attendus — devant `manuel`. Elle n'est pourtant
pas gatee : en cloud, « accorder a tous les utilisateurs » n'est pas une
maladresse de style, **c'est l'erreur que la question teste**. Le mot correle
avec la faussete parce que le concept correle avec la faussete. La gater
punirait une question neuve et correcte. **Toute fuite lexicale statistiquement
reelle n'est pas a corriger.**

#### La periodicite : une seconde fuite inherente, a NE PAS reparer

Le motif `tout-le-reste` apparie deux tournures que le francais confond et que
le domaine separe : `tous les utilisateurs` (quantificateur) et
`toutes les 5 minutes` (periodicite). Un appariement sur cinq etait temporel, ce
qui a d'abord ete pris pour une contamination du motif. **Mesure par rebattage
d'etiquettes, 3000 tirages, graine fixe, controle d'identite verifie :**

| sens du motif | observe | attendu sous rebattage | p |
|---|---|---|---|
| `tout-le-reste` entier | 21 | 7.1 `[p95=10]` | 0.000 |
| quantificateur seul | 21 | 7.5 `[p95=11]` | 0.000 |
| periodicite seule | 10 | 6.2 `[p95=8]` | 0.005 |

**Les deux sens portent.** Le chiffre de 21 corpus tient au seul sens
quantificateur : la periodicite ne l'a pas gonfle. Et les ensembles de corpus
concernes sont **disjoints** — ce sont deux phenomenes, pas un motif large.

**Le mecanisme, lu dans les phrases appariees et non postule.** L'hypothese de
depart — « le sondage periodique contre l'evenementiel » — s'est revelee trop
etroite : c'est le cas majoritaire pris pour le tout. Ce que les distracteurs
font reellement, c'est **substituer une cadence fixe a un mecanisme reactif ou
gere** :

- interroger une table, une API ou un prefixe `toutes les minutes` au lieu de
  reagir a un evenement — le cas le plus frequent ;
- relancer un appel `toutes les 50 millisecondes`, sans plafond ni gigue ;
- redeployer un service `toutes les heures` sans validation fonctionnelle ;
- prendre des instantanes `toutes les 12 heures` comme **seul** mecanisme de
  durabilite ;
- faire tourner un secret `tous les 90 jours` **par un ingenieur**.

Le vocabulaire temporel suit donc l'erreur qu'il decrit. **C'est une propriete
du domaine, pas du motif** : en cloud, une boucle d'interrogation est presque
toujours la mauvaise architecture.

> **Avertissement a qui lira « fuite temporelle, p=0.005 » et voudra la
> corriger : reformuler les periodicites abimerait le corpus.** Ces cadences
> sont l'erreur que la question enseigne a reconnaitre, au meme titre que
> « accorder l'acces a tous les utilisateurs ». La famille est en regime
> `INHERENT` : **mesuree et rapportee, jamais bloquante.**

#### Exclusivite mesuree et seuil de la garde ne sont pas le meme comptage

Les effectifs ci-dessus, comme les 17 corpus du niveau absolu, comptent
l'**exclusivite** — le mot absent des bonnes reponses et present dans au moins
**un** distracteur. La garde livree exige en plus `SEUIL_QUESTIONS = 3`
questions. L'ecart n'est pas marginal :

| famille | exclusivite (`D >= 1`) | seuil de garde (`D >= 3`) |
|---|---|---|
| quantificateur | 21 corpus | 14 corpus |
| periodicite | 10 corpus | 1 corpus |

**Une famille peut donc etre significative et n'atteindre presque jamais le
seuil.** Ne pas lire un effectif d'exclusivite comme un nombre d'echecs CI
attendus.

Et la regle de classement `manuel => corriger / cron => consigner` est une
heuristique de lecture, pas un critere : **`script` la casse.** Classe comme une
technologie, il sort a p=0.002, parce qu'il s'ecrit ici « un script maison »,
« un script shell », « un script local partage ». Le classement porte sur le sens
au dictionnaire, la fuite porte sur l'usage — seule la mesure arbitre.

### Les deux sens, et leurs seuils inegaux

La garde d'origine ne mesurait que `bonne === 0 && distracteurs > 0`. La fuite
inverse existe : `par exemple` exclusif aux **bonnes reponses** sur quatre
corpus, ou une bonne reponse nomme une instance concrete d'une approche juste
tandis qu'un distracteur enonce platement une approche fausse. *« Prends
l'option qui donne un exemple »* s'execute aussi bien de tete.

Les deux sens n'ont pas le meme cout par occurrence :

    exclusif aux DISTRACTEURS   0.75^k < 0.05  ->  k >= 11
    exclusif a la BONNE REPONSE 0.25^k < 0.05  ->  k >= 3

**Une occurrence cote bonne reponse est environ quatre fois plus surprenante.**
Une garde unidirectionnelle est donc aveugle a la preuve la moins chere.

Le seuil retenu est neanmoins de **3 questions dans les deux sens**, et non 11
d'un cote : appliquer 11 rendrait la garde vide — exactement le defaut mesure
sur la garde d'origine. La significativite collective etant deja etablie, ce
seuil ne sert qu'a ecarter le cas non exploitable.

### Une region du depot que personne n'avait mesuree

L'enumeration a revele **146 questions Azure a plat** a la racine de
`content/public/questions/` (`ai900`, `ai901`, `az104`, `az900`, `dp900`,
`sc900`), en `schemaVersion` v2. Elles etaient hors de toute campagne et hors
des gardes de longueur, qui ne portent que sur v3. Un releve qui filtrait les
repertoires les avait ecartees **en silence** — un filtre de type rend un zero
indiscernable d'une absence.

La garde differentielle les couvre. **Leur contenu n'a pas ete touche** ; c'est
une dette consignee, non traitee.

**Limite connue :** la CLI historique `node tools/lex_leak.mjs <editeur> <cert>`
ne sait lire que la disposition imbriquee, et son temoin de bruit tire sans
graine — il n'est donc pas reproductible d'une execution a l'autre. La garde de
CI n'utilise ni l'un ni l'autre.

### Un instrument doit prouver qu'il peut varier

Trois releves de ce programme ont rendu un vert qui ne mesurait rien, et aucun
n'a ete arrete par la relecture :

- `releverRacine` retourne une **enveloppe** `{corpus, nbCorpus, nbQuestions}`.
  Une sonde qui la passe telle quelle au comparateur mesure trois cles au lieu
  de trente-trois corpus, et annonce zero regression.
- un motif derive a la main s'est retrouve **sur-echappe** (`\\d` pour `\d`) :
  il n'appariait rien et aurait rendu « aucune occurrence temporelle ».
- un filtre par type de fichier a masque 146 questions **sans le signaler**.

D'ou les trois exigences appliquees ici, toutes trois presentes dans
`tools/lex_baseline.mjs` et `test/lexical_leak.test.mjs` :

    plancher de lecture   refuser de conclure si le corpus lu est trop petit
    controle d identite   la reference comparee a son propre contenu rend 0/0/0
                          ET zero corpus inconnu
    autotest de motif     quelques chaines connues, avant la premiere execution

Le troisieme est le moins cher : les deux premiers rattrapent un resultat faux
**apres** l'avoir produit, l'autotest empeche qu'il existe.

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
