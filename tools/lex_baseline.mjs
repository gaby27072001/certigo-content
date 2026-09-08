// Regenere la reference lexicale figee : config/lexical-baseline.json
//
// POURQUOI UNE REFERENCE, ET PAS UN SEUIL ABSOLU
//
// Mesure du 2026-09-08 sur les 33 corpus du depot : un garde en niveau absolu
// sur la seule famille `manuel` rougirait sur 17 corpus, dont environ 11
// portent un signal reel (nul par permutation : 6.3 attendus, p=0.000). Le
// fusionner exigerait onze campagnes de remediation avant que la CI reverdisse
// — et une garde rouge en permanence dresse a passer outre, donc ne protege
// rien.
//
// Le differentiel n'a pas ce defaut : il est vert le jour un par construction,
// et il attrape exactement ce que le niveau absolu ne voit pas — l'aggravation.
// Cas reel qui motive ce choix : un corpus est passe de 0 a 3 familles en fuite
// dans une PR fusionnee, sans mauvaise foi, parce que rien ne l'arretait.
//
// SENS DE MISE A JOUR
//
// La reference se met a jour a la BAISSE. Le test n'echoue que sur une
// aggravation ; une amelioration passe et s'affiche avec la commande a lancer.
// C'est delibere : faire echouer une amelioration rendrait la CI rouge chez
// toute session dont la branche est plus ancienne qu'une correction fusionnee
// ailleurs — plusieurs sessions travaillent en parallele sur ce depot. Le prix
// de ce choix est que la reference ne se resserre pas toute seule ; c'est
// pourquoi la commande a lancer est imprimee a chaque amelioration constatee.
//
// Usage : npm run lex:baseline

import fs from "node:fs";
import path from "node:path";
import { FAMILLES_CLASSEES, SEUIL_QUESTIONS, releverRacine } from "./lex_leak.mjs";

const RACINE = process.argv[2] ?? ".";
const SORTIE = path.join(RACINE, "config", "lexical-baseline.json");

// Plancher de lecture. Un releve qui rend moins que cela n'est pas une mesure,
// c'est un chemin casse : le depot portait deja 146 questions invisibles a un
// releve qui filtrait les repertoires, et ce zero-la passait pour une absence.
const PLANCHER_CORPUS = 30;
const PLANCHER_QUESTIONS = 700;

function trier(valeur) {
  if (Array.isArray(valeur)) return valeur.map(trier);
  if (valeur && typeof valeur === "object") {
    const out = {};
    for (const k of Object.keys(valeur).sort()) out[k] = trier(valeur[k]);
    return out;
  }
  return valeur;
}

const { corpus, nbCorpus, nbQuestions } = releverRacine(RACINE);

if (nbCorpus < PLANCHER_CORPUS || nbQuestions < PLANCHER_QUESTIONS) {
  console.error(
    `ECHEC : ${nbCorpus} corpus / ${nbQuestions} questions lus, sous le plancher ` +
      `(${PLANCHER_CORPUS}/${PLANCHER_QUESTIONS}). Refus d'ecrire une reference ` +
      `qui figerait une lecture partielle comme etat de reference.`
  );
  process.exit(1);
}

const doc = {
  note:
    "Reference figee des fuites lexicales. Ne se met a jour qu'a la baisse. " +
    "Regenerer avec `npm run lex:baseline`, jamais a la main.",
  seuilQuestions: SEUIL_QUESTIONS,
  famillesGatees: FAMILLES_CLASSEES.filter((f) => f.gate).map((f) => `${f.nom} (${f.sens})`),
  corpus: trier(corpus),
};

fs.writeFileSync(SORTIE, `${JSON.stringify(doc, null, 2)}\n`, "utf8");

const gatees = new Set(FAMILLES_CLASSEES.filter((f) => f.gate).map((f) => f.nom));
let fuitesGatees = 0;
let fuitesRapportees = 0;
for (const c of Object.values(corpus)) {
  for (const [nom, v] of Object.entries(c.familles)) {
    if (v.ampleur === 0) continue;
    if (gatees.has(nom)) fuitesGatees += 1;
    else fuitesRapportees += 1;
  }
}

console.log(`${SORTIE} ecrit : ${nbCorpus} corpus, ${nbQuestions} questions.`);
console.log(`  fuites figees sur familles GATEES   : ${fuitesGatees}`);
console.log(`  fuites figees sur familles RAPPORT  : ${fuitesRapportees}`);
