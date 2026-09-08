// Mesure DIFFERENTIELLE de la fuite lexicale : l'etat a une reference git
// contre l'etat du disque.
//
// La question a laquelle il repond, et qu'une mesure absolue ne peut pas poser :
// "ce defaut, est-ce moi qui l'ai introduit ?"
//
// Sans point de comparaison on s'attribue les defauts d'autrui ; en comparant a
// main courant on s'attribue les corrections d'autrui. Il faut comparer a
// l'etat d'AVANT sa propre branche.
//
// Usage : node lex_diff.mjs <vendor> <cert> <ref-git>

import { execFileSync } from "node:child_process";
import { mesurer } from "./lex_leak.mjs";

const [vendor, cert, ref] = process.argv.slice(2);

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

function chargerAuRef(reference) {
  const pubDir = `content/public/questions/${vendor}/${cert}`;
  const keyDir = `content/answerKey/solutions/${vendor}/${cert}`;
  let listing;
  try {
    listing = git(["ls-tree", "--name-only", `${reference}:${pubDir}`]);
  } catch {
    return null; // le repertoire n'existe pas a cette reference
  }
  const fichiers = listing.split("\n").filter((f) => f.endsWith(".json")).sort();
  const paires = [];
  for (const f of fichiers) {
    const q = JSON.parse(git(["show", `${reference}:${pubDir}/${f}`]));
    const s = JSON.parse(git(["show", `${reference}:${keyDir}/${f}`]));
    const choix = q.choices.map((c) => (typeof c === "string" ? c : c.text));
    const i = choix.indexOf(s.correct);
    if (i < 0) throw new Error(`${reference}:${f} — reponse correcte introuvable parmi les choix`);
    paires.push({ fichier: f, bonne: choix[i], distracteurs: choix.filter((_, j) => j !== i) });
  }
  return paires;
}

// Garde : refuser de rendre un zero qui viendrait d'un corpus vide. Un outil
// qui n'a rien lu et un corpus propre produisent le meme "0 famille".
function exiger(paires, quoi) {
  if (!paires || paires.length === 0) {
    console.error(`[garde] ${quoi} : 0 question lue — refus de conclure.`);
    process.exit(2);
  }
  return paires;
}

const MIN = 3;
const avant = exiger(chargerAuRef(ref), `reference ${ref}`);
const apres = exiger(chargerAuRef("HEAD"), "HEAD");
// Le disque peut porter des modifications non committees : c'est lui qui compte.
const { charger } = await import("./lex_leak.mjs");
const disque = exiger(charger(vendor, cert), "disque");

const fam = (ps) =>
  new Map(mesurer(ps, MIN).filter((e) => e.ou === "famille").map((e) => [e.marqueur, e.questions]));

const fAvant = fam(avant);
const fDisque = fam(disque);

console.log(`\n=== ${vendor}:${cert} — ${ref} (${avant.length} q) -> disque (${disque.length} q) ===`);
const toutes = new Set([...fAvant.keys(), ...fDisque.keys()]);
let introduites = 0;
if (toutes.size === 0) {
  console.log("aucune famille exclusive, ni avant ni apres.");
} else {
  for (const m of toutes) {
    const a = fAvant.get(m) ?? 0;
    const b = fDisque.get(m) ?? 0;
    if (a === 0 && b > 0) introduites += 1;
    const verdict =
      a === 0 && b > 0 ? "INTRODUITE PAR MOI" : b === 0 && a > 0 ? "corrigee" : a === b ? "preexistante, inchangee" : "preexistante, deplacee";
    console.log(`  ${m.padEnd(20)} avant ${a}  apres ${b}   -> ${verdict}`);
  }
}
// Seule une regression introduite fait rougir : une dette heritee n'est pas
// mon fait, et la confondre avec une regression rend l'outil inutilisable
// comme garde avant commit.
process.exit(introduites > 0 ? 1 : 0);
