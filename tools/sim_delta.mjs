// Delta avant/apres remediation, sur l'axe de similarite, pour TOUS les corpus
// qui ont recu au moins un commit editorial.
//
// POURQUOI LE DELTA ET PAS LE NIVEAU. Un niveau eleve ne dit pas qui l'a mis
// la. Le depot porte des dettes anciennes que personne n'a mesurees, et
// desormais au moins une regression fabriquee par une campagne de correction.
// Les deux se ressemblent en niveau et se separent en delta :
//
//   delta eleve            -> la remediation l'a fabrique
//   delta ~0, niveau haut  -> dette ancienne, jamais mesuree
//   delta ~0, niveau ~0.25 -> sain
//
// L'ETAT DE REFERENCE est le parent de la PREMIERE MODIFICATION du corpus,
// c'est-a-dire du deuxieme commit le plus ancien qui touche ses fichiers. Le
// plus ancien est sa creation. Prendre la derniere modification mesurerait la
// derniere retouche et raterait la campagne ; prendre HEAD~1 melangerait les
// corpus.
//
// POURQUOI UN CRITERE STRUCTUREL ET NON UN MOTIF SUR LE SUJET DE COMMIT. La
// premiere version de cet outil reperait les remediations par un motif
// (/editorial|remedi|discernab|.../). Il a classe DEUX corpus « jamais
// remedie » a tort :
//
//   aws:scs-c03  « contenu: reecrit les 24 questions » -> « reecrit » n'est pas
//                « reecriture »
//   aws:soa-c03  « remédiation éditoriale des 20 questions » -> « remédi » avec
//                accent n'est pas « remedi »
//
// Un motif teste le FORMAT qu'on avait en tete en l'ecrivant, pas le fait ; et
// il rend un « jamais modifie » indiscernable d'un « jamais reconnu ». Le
// nombre de commits touchant les fichiers est un fait verifiable, insensible a
// la redaction du sujet et a l'orthographe.
//
// Usage : node tools/sim_delta.mjs [--tirages N]

import { execFileSync } from "node:child_process";
import { analyser, chargerAuRef, profil } from "./sim_leak.mjs";
import { enumererCorpus } from "./lex_leak.mjs";

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 128 * 1024 * 1024 });
}

// ATTRIBUTION PAR COMMIT. Un delta mesure contre « la premiere modification
// jamais faite » melange plusieurs campagnes : pour les corpus GCP, la premiere
// modification est un commit d'aout sans rapport avec la campagne du jour.
// L'attribution correcte mesure CHAQUE commit contre son propre parent, ce qui
// designe la PR responsable au lieu d'un cumul.
//
// Le taux observe est DETERMINISTE : il ne demande aucune permutation. Seule la
// significativite du niveau final en demande une. On peut donc balayer tout
// l'historique a cout negligeable, et ne payer les tirages que sur les etats
// finaux.
function historique(vendor, cert) {
  const lignes = git([
    "log",
    "--pretty=%H|%s",
    "--",
    `content/public/questions/${vendor}/${cert}`,
  ])
    .split("\n")
    .filter(Boolean);
  if (lignes.length === 0) {
    throw new Error(`[sim_delta] ${vendor}:${cert} : 0 commit — chemin de lecture casse`);
  }
  // git log rend du plus recent au plus ancien ; on remet en ordre historique.
  return lignes.reverse().map((l) => {
    const [sha, ...reste] = l.split("|");
    return { sha, sujet: reste.join("|") };
  });
}

// Taux observe seul, sans permutation. Sert au balayage de l'historique.
function tauxObserve(paires) {
  const profils = paires.map((p) => profil(p.choix));
  let ev = 0;
  for (let k = 0; k < profils.length; k += 1) {
    const g = profils[k].gagnants;
    ev += g.includes(paires[k].index) ? 1 / g.length : 0;
  }
  return ev / paires.length;
}

// Delta attribue a chaque commet de modification, du plus ancien au plus recent.
function parCommit(vendor, cert) {
  const commits = historique(vendor, cert);
  const out = [];
  for (let i = 1; i < commits.length; i += 1) {
    const avant = tauxObserve(chargerAuRef(`${commits[i].sha}~1`, vendor, cert));
    const apres = tauxObserve(chargerAuRef(commits[i].sha, vendor, cert));
    out.push({ ...commits[i], avant, apres, delta: apres - avant });
  }
  return out;
}

const argv = process.argv.slice(2);
const iT = argv.indexOf("--tirages");
const tirages = iT > -1 ? Number(argv[iT + 1]) : 20000;

const corpus = enumererCorpus(".").filter((c) => c.disposition === "imbrique");
if (corpus.length < 25) {
  throw new Error(`[sim_delta] ${corpus.length} corpus imbriques lus : chemin de lecture casse`);
}

// SEUILS. Un delta seul ne suffit pas a declarer une regression : un corpus qui
// passe de 0.025 a 0.225 a bouge de +0.200 mais ATTERRIT SOUS LE NUL (0.250) —
// il est revenu a la normale, il n'offre aucune prise. La regression exige donc
// les deux : un mouvement franc ET un niveau d'arrivee exploitable.
const DELTA_REGRESSION = 0.15;
const NIVEAU_EXPLOITABLE = 0.35;
const NUL = 0.25;

const lignes = [];
for (const c of corpus) {
  const commits = parCommit(c.vendor, c.cert);
  const apres = analyser(chargerAuRef("HEAD", c.vendor, c.cert), { tirages });
  // Commit le plus aggravant : c'est lui qui designe la PR responsable.
  const pire = commits.length
    ? commits.reduce((a, b) => (b.delta > a.delta ? b : a))
    : null;
  lignes.push({ id: c.id, n: apres.n, apres, commits, pire });
}

const classe = (l) => {
  if (!l.pire) return "jamais-modifie";
  if (l.pire.delta >= DELTA_REGRESSION && l.apres.observe > NUL) return "REGRESSION";
  if (l.apres.observe >= NIVEAU_EXPLOITABLE) return "dette-ancienne";
  return "sain";
};

console.log(`\n${"corpus".padEnd(46)}  n  apres  p_apres   pire delta  classement`);
const ordre = { REGRESSION: 0, "dette-ancienne": 1, "jamais-modifie": 2, sain: 3 };
for (const l of lignes.sort(
  (a, b) => ordre[classe(a)] - ordre[classe(b)] || b.apres.observe - a.apres.observe
)) {
  const p = l.apres.p < 1e-4 ? l.apres.p.toExponential(1) : l.apres.p.toFixed(4);
  const d = l.pire ? `${l.pire.delta >= 0 ? "+" : ""}${l.pire.delta.toFixed(3)}` : "   -  ";
  console.log(
    `${l.id.padEnd(46)}${String(l.n).padStart(3)}  ${l.apres.observe.toFixed(3)}  ${p.padEnd(9)} ${d.padEnd(11)} ${classe(l)}`
  );
}

const nbMod = lignes.filter((l) => l.pire).length;
const nbReg = lignes.filter((l) => classe(l) === "REGRESSION").length;
console.log(
  `\n${corpus.length} corpus imbriques — ${nbMod} modifie(s) apres creation, ${nbReg} regression(s).`
);
console.log(
  `nul EXACT = ${NUL.toFixed(3)} ; regression = delta >= ${DELTA_REGRESSION} ET niveau > nul ; ` +
    `dette = niveau >= ${NIVEAU_EXPLOITABLE}.`
);

console.log(`\n--- attribution par commit (tout mouvement >= 0.05 en valeur absolue) ---`);
for (const l of lignes.filter((x) => x.commits.length).sort((a, b) => a.id.localeCompare(b.id))) {
  const notables = l.commits.filter((c) => Math.abs(c.delta) >= 0.05);
  if (notables.length === 0) continue;
  console.log(`\n${l.id}`);
  for (const c of notables) {
    console.log(
      `  ${c.avant.toFixed(3)} -> ${c.apres.toFixed(3)}  ${(c.delta >= 0 ? "+" : "") + c.delta.toFixed(3)}  ${c.sha.slice(0, 7)}  ${c.sujet.slice(0, 66)}`
    );
  }
}
