// Garde differentiel de fuite lexicale.
//
// L'AXE. Un marqueur present uniquement d'un cote — « manuel » jamais dans une
// bonne reponse, « par exemple » jamais dans un distracteur — donne une regle
// qu'un candidat execute de tete sans connaitre la matiere. C'est la meme
// famille de defaut que la position ou la longueur de la bonne reponse, sur un
// porteur lexical, et les deux sens sont exploitables.
//
// POURQUOI DIFFERENTIEL ET NON ABSOLU. Mesure du 2026-09-08 : un garde en
// niveau absolu rougirait des la fusion sur 17 des 33 corpus, dont ~11 portent
// un signal reel (permutation : 6.3 attendus, p=0.000). Onze campagnes de
// remediation avant que la CI reverdisse, et une garde rouge en permanence
// dresse a passer outre. Le differentiel est vert le jour un et attrape
// l'aggravation — le cas reel etant un corpus passe de 0 a 3 familles en fuite
// dans une PR fusionnee, parce que rien ne l'arretait.
//
// CE QUI EST GATE, ET CE QUI NE L'EST PAS. Voir FAMILLES_CLASSEES dans
// tools/lex_leak.mjs. En resume : les familles portant un JUGEMENT de valeur
// echouent, celles qui sont INHERENTES au domaine sont mesurees sans bloquer.
// « accorder a tous les utilisateurs » est l'erreur que la question TESTE, pas
// une maladresse de style : gater cette famille punirait une question neuve et
// correcte, ce qui est pire qu'aucun garde.
//
// PORTEE. Ce garde ne lit que `choices` et `correct`. Il ne suppose ni
// fournisseur, ni format de sourcage, ni effectif de corpus — contrairement a
// test/aws_professional_wave.test.mjs, dont la fixture `expectedDomains` est
// une liste ecrite a la main de cinq certifications AWS. Il couvre donc les 33
// corpus, y compris les six corpus Azure a plat que ce depot n'avait jamais
// mesures.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  FAMILLES_CLASSEES,
  SEUIL_QUESTIONS,
  ampleurFuite,
  chargerCorpus,
  comparer,
  enumererCorpus,
  mesurerFamilles,
  releverRacine,
} from "../tools/lex_leak.mjs";

const RACINE = ".";
const FIXTURE = path.join("test", "fixtures", "lexical");
const REFERENCE = path.join("config", "lexical-baseline.json");

// Plancher de lecture, aligne sur tools/lex_baseline.mjs. Il existe parce que
// ce depot a deja rendu un zero faux : un releve filtrant les repertoires avait
// masque 146 questions Azure a plat, en silence. Un garde qui accepte de
// mesurer moins que le depot ne rend pas un vert, il rend une absence.
const PLANCHER_CORPUS = 30;
const PLANCHER_QUESTIONS = 700;

test("le detecteur rougit dans LES DEUX SENS sur la fixture temoin", () => {
  const corpus = enumererCorpus(FIXTURE);
  assert.equal(corpus.length, 1, "la fixture doit exposer exactement un corpus");

  const paires = chargerCorpus(FIXTURE, corpus[0]);
  assert.equal(paires.length, 3, "la fixture doit exposer exactement trois questions");

  const compte = mesurerFamilles(paires);
  const famille = (nom) => FAMILLES_CLASSEES.find((f) => f.nom === nom);

  // Sens D : le marqueur n'existe que dans des distracteurs.
  assert.deepEqual(compte.manuel, { C: 0, D: 3 });
  assert.equal(ampleurFuite(compte.manuel, famille("manuel")), 3);

  // Sens C : le marqueur n'existe que dans des bonnes reponses. C'est le sens
  // que l'outil d'origine ne mesurait pas ; sans ce cas, l'ajout du sens C
  // serait du code jamais execute rouge.
  assert.deepEqual(compte.vague, { C: 3, D: 0 });
  assert.equal(ampleurFuite(compte.vague, famille("vague")), 3);

  // Temoin negatif : present des DEUX cotes, donc aucune fuite. Sans lui, les
  // deux assertions precedentes ne prouvent pas que l'outil mesure une
  // exclusivite plutot qu'une simple presence.
  assert.deepEqual(compte.uniquement, { C: 1, D: 1 });
  assert.equal(ampleurFuite(compte.uniquement, famille("uniquement")), 0);
});

test("le seuil ecarte ce qui n'est pas exploitable, et seulement cela", () => {
  const famD = FAMILLES_CLASSEES.find((f) => f.nom === "manuel");
  const famC = FAMILLES_CLASSEES.find((f) => f.nom === "vague");

  assert.equal(SEUIL_QUESTIONS, 3);
  assert.equal(ampleurFuite({ C: 0, D: 2 }, famD), 0, "sous le seuil : pas une fuite");
  assert.equal(ampleurFuite({ C: 0, D: 3 }, famD), 3, "au seuil : fuite");
  assert.equal(ampleurFuite({ C: 1, D: 9 }, famD), 0, "presente des deux cotes : pas une fuite");
  assert.equal(ampleurFuite({ C: 3, D: 0 }, famC), 3, "sens C au seuil : fuite");
  assert.equal(ampleurFuite({ C: 0, D: 9 }, famC), 0, "sens C : le sens D ne la declenche pas");
});

test("le comparateur sait rendre ROUGE — controle d'isolation", () => {
  const ref = { "fx:t": { questions: 10, familles: { manuel: { C: 0, D: 3, ampleur: 3 } } } };

  const pire = comparer(ref, {
    "fx:t": { questions: 10, familles: { manuel: { C: 0, D: 5, ampleur: 5 } } },
  });
  assert.equal(pire.regressions.length, 1);
  assert.deepEqual(pire.regressions[0], {
    corpus: "fx:t",
    famille: "manuel",
    sens: "D",
    avant: 3,
    apres: 5,
  });

  const identique = comparer(ref, {
    "fx:t": { questions: 10, familles: { manuel: { C: 0, D: 3, ampleur: 3 } } },
  });
  assert.equal(identique.regressions.length, 0);
  assert.equal(identique.ameliorations.length, 0);

  const mieux = comparer(ref, {
    "fx:t": { questions: 10, familles: { manuel: { C: 1, D: 3, ampleur: 0 } } },
  });
  assert.equal(mieux.regressions.length, 0, "une amelioration ne doit jamais echouer");
  assert.equal(mieux.ameliorations.length, 1);

  // Le sens C doit rougir comme le sens D. Sans ce cas, le comparateur n'aurait
  // ete vu rouge que sur `manuel`, et rien ne prouverait qu'il traite la fuite
  // inverse — celle que l'outil d'origine ne savait pas voir.
  const inverse = comparer(
    { "fx:t": { questions: 10, familles: { vague: { C: 0, D: 2, ampleur: 0 } } } },
    { "fx:t": { questions: 10, familles: { vague: { C: 4, D: 0, ampleur: 4 } } } }
  );
  assert.equal(inverse.regressions.length, 1);
  assert.equal(inverse.regressions[0].sens, "C");
  assert.equal(inverse.regressions[0].famille, "vague");

  // Une famille RAPPORT qui empire ne doit PAS echouer : elle peut croitre
  // legitimement quand on ajoute une bonne question.
  const inherente = comparer(
    { "fx:t": { questions: 10, familles: { "tout-le-reste": { C: 0, D: 3, ampleur: 3 } } } },
    { "fx:t": { questions: 11, familles: { "tout-le-reste": { C: 0, D: 8, ampleur: 8 } } } }
  );
  assert.equal(inherente.regressions.length, 0);

  // Un corpus neuf sans reference est signale, pas ignore : sans cela il
  // entrerait dans le depot en echappant au garde.
  const neuf = comparer(ref, {
    "fx:t": { questions: 10, familles: { manuel: { C: 0, D: 3, ampleur: 3 } } },
    "fx:neuf": { questions: 4, familles: {} },
  });
  assert.deepEqual(neuf.corpusInconnus, ["fx:neuf"]);
});

test("le releve du depot couvre tous les corpus, sans filtre de type", () => {
  const { nbCorpus, nbQuestions } = releverRacine(RACINE);
  assert.ok(
    nbCorpus >= PLANCHER_CORPUS,
    `${nbCorpus} corpus lus, sous le plancher ${PLANCHER_CORPUS} : chemin de lecture casse`
  );
  assert.ok(
    nbQuestions >= PLANCHER_QUESTIONS,
    `${nbQuestions} questions lues, sous le plancher ${PLANCHER_QUESTIONS} : chemin de lecture casse`
  );
});

test("aucune fuite lexicale gatee n'empire par rapport a la reference figee", () => {
  assert.ok(
    fs.existsSync(REFERENCE),
    `${REFERENCE} absent : regenerer avec \`npm run lex:baseline\``
  );
  const reference = JSON.parse(fs.readFileSync(REFERENCE, "utf8"));
  assert.equal(
    reference.seuilQuestions,
    SEUIL_QUESTIONS,
    "la reference a ete figee avec un autre seuil : la comparaison serait fausse"
  );

  const { corpus } = releverRacine(RACINE);
  const { regressions, ameliorations, corpusInconnus } = comparer(reference.corpus, corpus);

  assert.deepEqual(
    corpusInconnus,
    [],
    `corpus absent(s) de la reference : ${corpusInconnus.join(", ")}. ` +
      "Un corpus neuf doit etre fige explicitement (`npm run lex:baseline`), " +
      "sinon il entre dans le depot sans etre garde."
  );

  if (ameliorations.length > 0) {
    // Non bloquant, par choix : voir l'entete de tools/lex_baseline.mjs.
    console.log(
      `\n[lex] ${ameliorations.length} amelioration(s) non encore figee(s) — ` +
        "resserrer la reference avec `npm run lex:baseline` :"
    );
    for (const a of ameliorations) {
      console.log(`  ${a.corpus} / ${a.famille} : ${a.avant} -> ${a.apres}`);
    }
  }

  assert.deepEqual(
    regressions.map((r) => `${r.corpus} / ${r.famille} (sens ${r.sens}) ${r.avant} -> ${r.apres}`),
    [],
    "aggravation d'une fuite lexicale gatee : allonger ou equilibrer, ne pas figer la regression"
  );
});

// Un motif ne renseigne que la ou sa sortie peut VARIER avec ce qu'elle mesure.
// Deux motifs de ce fichier ont vecu sans jamais matcher une seule fois —
// `/\bà la main\b/i` et l'alternative `la totalité` de `tout-le-reste` — parce
// qu'en JS `\b` est defini sur [A-Za-z0-9_] et qu'une lettre accentuee est un
// NON-mot : `\bà` et `é\b` ne peuvent pas former de frontiere en prose
// francaise. Ils n'echouaient pas et ne rendaient pas un zero suspect. Ils ne
// participaient jamais, et rien dans la sortie ne les distinguait d'une absence
// legitime — l'instrument vide le plus discret possible.
//
// D'ou ce tableau : CHAQUE famille declare un temoin PRESENT et un temoin
// ABSENT. Ajouter une famille sans temoins fait rougir ce test, ce qui est le
// seul moment ou le defaut est bon marche a corriger.
const TEMOINS = {
  manuel: ["reprendre manuellement chaque entree", "reprendre chaque entree"],
  script: ["un script de bascule planifie", "une bascule planifiee"],
  absolu: ["relancer systématiquement l'appel", "relancer l'appel une fois"],
  uniquement: ["servir uniquement le trafic interne", "servir le trafic interne"],
  vague: ["par exemple une file dediee", "une file dediee"],
  "tout-le-reste": ["accorder a tous les utilisateurs", "accorder a l'appelant"],
  cron: ["une tache cron horaire", "une tache horaire"],
  ticket: ["ouvrir un ticket de suivi", "ouvrir un suivi"],
  "a la main": ["reprendre à la main chaque entree", "reprendre chaque entree"],
  "ad hoc": ["une bascule ad hoc", "une bascule planifiee"],
  ponctuellement: ["verifier ponctuellement la file", "verifier la file"],
  "par un ingenieur": ["valide par un ingénieur de garde", "valide par le pipeline"],
  tableur: ["consigner dans un tableur partage", "consigner dans la table"],
  "sans verifier": ["appliquer sans vérifier la signature", "appliquer apres controle"],
  "un a un": ["migrer les tables une à une", "migrer les tables par lot"],
  "script maison": ["un script maison de bascule", "un service gere de bascule"],
};

test("aucun motif n'est mort : chaque famille voit un cas PRESENT et un cas ABSENT", () => {
  // Exhaustivite : le tableau doit suivre FAMILLES_CLASSEES, sans quoi une
  // famille neuve echapperait au controle en silence.
  assert.deepEqual(
    FAMILLES_CLASSEES.map((f) => f.nom).filter((n) => !(n in TEMOINS)),
    [],
    "famille sans temoins declares — ajouter une entree dans TEMOINS"
  );

  const morts = [];
  const bavards = [];
  for (const f of FAMILLES_CLASSEES) {
    const [present, absent] = TEMOINS[f.nom];
    if (!f.motif.test(present)) morts.push(`${f.nom} : « ${present} » non reconnu`);
    if (f.motif.test(absent)) bavards.push(`${f.nom} : « ${absent} » reconnu a tort`);
  }

  assert.deepEqual(morts, [], "motif MORT : il ne peut plus rien mesurer (verifier les \\b autour des accents)");
  assert.deepEqual(bavards, [], "motif trop large : il matche un temoin qui ne porte pas la famille");
});

test("« la totalité » redevient mesurable, et le temporel reste compte", () => {
  const famille = FAMILLES_CLASSEES.find((f) => f.nom === "tout-le-reste");

  // L'alternative ressuscitee par la borne accent-compatible.
  assert.ok(famille.motif.test("basculer la totalité du trafic"), "« la totalité » doit redevenir mesurable");

  // Les autres alternatives, temoins que la borne n'a rien casse.
  for (const t of ["accorder a tous les utilisateurs", "present sur toutes les copies", "chiffrer l'ensemble des objets"]) {
    assert.ok(famille.motif.test(t), `quantificateur non reconnu : « ${t} »`);
  }

  // LE TEMPOREL EST COMPTE, ET C'EST VOULU. Permutation du 2026-09-08 :
  // tlr-temporel obs 10 / nul 6.2 / p = 0.005. Le sondage periodique est
  // lui-meme une mauvaise reponse classique face a l'evenementiel, donc le
  // vocabulaire temporel suit l'erreur qu'il decrit. Exclure ces tournures
  // retirerait un signal mesure : mesurer une COMPOSITION ne rend pas un
  // verdict de VALIDITE. Ce test existe pour qu'un futur « nettoyage » du
  // motif rougisse au lieu de passer.
  for (const t of ["relancer toutes les 50 millisecondes", "interroger la table toutes les 5 minutes"]) {
    assert.ok(famille.motif.test(t), `periodicite non comptee : « ${t} » — signal p=0.005, ne pas exclure`);
  }

  // Temoin ABSENT, sans quoi les assertions ci-dessus ne prouveraient que le
  // motif matche tout.
  assert.ok(!famille.motif.test("accorder ce droit a l'appelant"), "temoin absent reconnu a tort");
});
