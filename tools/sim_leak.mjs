// Fuite de forme par SIMILARITE : « choisis l'option qui ressemble le moins aux
// trois autres ».
//
// L'AXE, ET POURQUOI IL N'EST PAS COUVERT. La position, le rang de longueur et
// le ratio decrivent chacun UNE option isolement. Cet axe-ci decrit une option
// RELATIVEMENT aux trois autres : trois distracteurs qui reformulent l'enonce
// avec son propre vocabulaire deviennent semblables ENTRE EUX, et la bonne
// reponse — qui nomme un mecanisme different avec des mots neufs — devient
// l'intrus. La regle « prends celle qui detonne » s'execute alors sans lire
// l'enonce, et aucun controle numerique du depot ne la voit.
//
// RISQUE PROPRE A LA REMEDIATION. Allonger un distracteur en reprenant les mots
// de l'enonce est la methode qui rapproche les distracteurs les uns des autres.
// Une campagne qui equilibre les longueurs peut donc CREER cette fuite en
// corrigeant l'autre. C'est mesurable, et ca doit l'etre avant/apres.
//
// LE NUL EST EXACT, PAS APPROCHE. Le vecteur de similarite ne depend que des
// TEXTES : permuter l'etiquette « celle-ci est la bonne » ne le change pas. Pour
// une question dont l'argmin compte k ex aequo, la strategie repartit 1/k sur k
// options, donc P(succes) = k x (1/4) x (1/k) = 1/4 quel que soit k.
// L'esperance sous le nul vaut donc EXACTEMENT 0.25 pour tout corpus a quatre
// choix — et c'est ce qui rend un ecart interpretable immediatement. Seule la
// dispersion depend du corpus, d'ou la permutation pour le p.
//
// MARGE. Un ecart de similarite de 0.001 n'est pas une regle qu'un humain
// execute. La marge (2e plus petite similarite moins la plus petite) est donc
// rendue a cote du taux : un taux eleve a marge nulle mesure l'arrondi, pas une
// prise possible.
//
// Usage :
//   node tools/sim_leak.mjs --all
//   node tools/sim_leak.mjs --corpus aws:dva-c02
//   node tools/sim_leak.mjs --avant <ref-git> --corpus aws:dva-c02
//   node tools/sim_leak.mjs --selftest

import { execFileSync } from "node:child_process";
import { chargerCorpus, enumererCorpus } from "./lex_leak.mjs";

const RACINE = ".";
const PLANCHER_CORPUS = 30;
const PLANCHER_QUESTIONS = 700;

function makeRandom(seed) {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 1e9) / 1e9;
  };
}

function normaliser(texte) {
  return (
    texte
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .match(/[a-z0-9]+/g) ?? []
  );
}

function jaccard(a, b) {
  const A = new Set(a);
  const B = new Set(b);
  if (A.size === 0 && B.size === 0) return 1;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter += 1;
  return inter / (A.size + B.size - inter);
}

// Profil d'une question, calcule UNE FOIS : la similarite maximale de chaque
// option aux trois autres, l'ensemble des options d'argmin (les « intrus »), et
// la marge qui separe l'intrus du suivant.
export function profil(choix) {
  const jetons = choix.map(normaliser);
  const sim = choix.map((_, i) =>
    Math.max(...choix.map((__, j) => (j === i ? -1 : jaccard(jetons[i], jetons[j]))))
  );
  const min = Math.min(...sim);
  const gagnants = sim.map((v, i) => (v === min ? i : -1)).filter((i) => i >= 0);
  const suivants = sim.filter((v) => v > min);
  const marge = suivants.length ? Math.min(...suivants) - min : 0;
  return { sim, gagnants, marge, nbOptions: choix.length };
}

function taux(profils, choisir) {
  let ev = 0;
  for (let k = 0; k < profils.length; k += 1) {
    const p = profils[k];
    ev += p.gagnants.includes(choisir(k)) ? 1 / p.gagnants.length : 0;
  }
  return ev / profils.length;
}

// STRATEGIE INVERSE : « ecarte l'option qui detonne, choisis au hasard parmi les
// autres ». Elle existe des que la premiere echoue trop bien : si la bonne
// reponse n'est JAMAIS l'intrus, l'ecarter fait passer de 1/4 a 1/3.
//
// Sans cette seconde mesure, une remediation qui vise zero croit avoir referme
// la fuite alors qu'elle l'a retournee — c'est arrive sur ce corpus meme, mesure
// a 0.000 apres correction des douze questions concernees. Le nul est le meme
// 0.250 : ecarter k options d'un ensemble de 4 laisse 4-k candidats dont la
// bonne fait partie avec probabilite (4-k)/4, d'ou (4-k)/4 x 1/(4-k) = 1/4.
function tauxInverse(profils, choisir) {
  let ev = 0;
  for (let k = 0; k < profils.length; k += 1) {
    const p = profils[k];
    const restants = p.nbOptions - p.gagnants.length;
    if (restants === 0) {
      // Toutes les options sont ex aequo : rien a ecarter, on tire au hasard.
      ev += 1 / p.nbOptions;
      continue;
    }
    ev += p.gagnants.includes(choisir(k)) ? 0 : 1 / restants;
  }
  return ev / profils.length;
}

export function analyser(paires, { tirages = 50000, seed = 20260908 } = {}) {
  if (paires.length === 0) {
    throw new Error("[sim_leak] 0 question lue — refus de rendre une mesure vide.");
  }
  const profils = paires.map((p) => profil(p.choix));
  const observe = taux(profils, (k) => paires[k].index);
  const observeInv = tauxInverse(profils, (k) => paires[k].index);

  // Controle d'identite : rejouer l'observe par le meme chemin que la
  // permutation doit redonner la meme valeur, sinon la chaine est cassee.
  const identite = taux(profils, (k) => paires[k].index);
  if (Math.abs(identite - observe) > 1e-12) {
    throw new Error("[sim_leak] la permutation nulle ne redonne pas l'observe");
  }

  const rnd = makeRandom(seed);
  let ge = 0;
  let geInv = 0;
  let bouge = 0;
  let somme = 0;
  let sommeInv = 0;
  for (let t = 0; t < tirages; t += 1) {
    const pick = new Int32Array(paires.length);
    let identique = true;
    for (let k = 0; k < paires.length; k += 1) {
      pick[k] = Math.floor(rnd() * profils[k].nbOptions);
      if (pick[k] !== paires[k].index) identique = false;
    }
    if (!identique) bouge += 1;
    const v = taux(profils, (k) => pick[k]);
    const vi = tauxInverse(profils, (k) => pick[k]);
    somme += v;
    sommeInv += vi;
    if (v >= observe - 1e-12) ge += 1;
    if (vi >= observeInv - 1e-12) geInv += 1;
  }
  if (bouge === 0) throw new Error("[sim_leak] aucune permutation n'a bouge : tirage inerte");

  const margeMediane = [...profils.map((p) => p.marge)].sort((a, b) => a - b)[
    Math.floor(profils.length / 2)
  ];
  return {
    n: paires.length,
    observe,
    observeInv,
    moyenneNulle: somme / tirages,
    moyenneNulleInv: sommeInv / tirages,
    p: (ge + 1) / (tirages + 1),
    pInv: (geInv + 1) / (tirages + 1),
    margeMediane,
    margeNulle: profils.filter((p) => p.marge === 0).length,
  };
}

// --- Lecture a une reference git ------------------------------------------
// Sert a repondre a « ce defaut, est-ce la remediation qui l'a fabrique ? ».
// Sans point de comparaison la question n'est pas decidable.
function git(args) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 128 * 1024 * 1024 });
}

export function chargerAuRef(ref, vendor, cert) {
  const pub = `content/public/questions/${vendor}/${cert}`;
  const key = `content/answerKey/solutions/${vendor}/${cert}`;
  const fichiers = git(["ls-tree", "--name-only", `${ref}:${pub}`])
    .split("\n")
    .filter((f) => f.endsWith(".json"))
    .sort();
  if (fichiers.length === 0) throw new Error(`[sim_leak] 0 fichier a ${ref}:${pub}`);
  return fichiers.map((f) => {
    const q = JSON.parse(git(["show", `${ref}:${pub}/${f}`]));
    const s = JSON.parse(git(["show", `${ref}:${key}/${f}`]));
    const index = q.choices.indexOf(s.correct);
    if (index < 0) throw new Error(`[sim_leak] ${ref}:${f} — bonne reponse introuvable`);
    return { fichier: f, choix: q.choices, index };
  });
}

// --- Temoin positif -------------------------------------------------------
function selftest() {
  const base = [];
  for (let k = 0; k < 24; k += 1) {
    // Trois distracteurs batis sur le MEME gabarit, une bonne reponse a
    // vocabulaire disjoint : l'intrus est la bonne reponse, par construction.
    base.push({
      index: k % 4,
      choix: [0, 1, 2, 3].map((o) =>
        o === k % 4
          ? `zeta omicron kappa lambda ${k}`
          : `gabarit commun partage recurrent variante ${o} ${k}`
      ),
    });
  }
  const fuit = analyser(base, { tirages: 5000 });
  if (fuit.observe < 0.99 || fuit.p > 0.01) {
    console.error(`[selftest] ECHEC presence : ${JSON.stringify(fuit)}`);
    return false;
  }

  // Temoin negatif : quatre options interchangeables, aucun intrus stable.
  const neutre = [];
  for (let k = 0; k < 24; k += 1) {
    neutre.push({
      index: k % 4,
      choix: [0, 1, 2, 3].map((o) => `alpha beta gamma delta option ${o} question ${k}`),
    });
  }
  const rien = analyser(neutre, { tirages: 5000 });
  if (Math.abs(rien.observe - 0.25) > 1e-9) {
    console.error(`[selftest] ECHEC absence : observe ${rien.observe}, attendu 0.25`);
    return false;
  }
  console.log(
    `[selftest] ok — gabarit partage : ${fuit.observe.toFixed(3)} (p=${fuit.p.toExponential(1)}) ; ` +
      `options interchangeables : ${rien.observe.toFixed(3)} (nul exact).`
  );
  return true;
}

// --- CLI ------------------------------------------------------------------
const lanceDirectement = /sim_leak\.mjs$/.test(process.argv[1] ?? "");
if (lanceDirectement) {
  const argv = process.argv.slice(2);
  const val = (nom) => {
    const i = argv.indexOf(nom);
    return i > -1 ? argv[i + 1] : null;
  };
  if (argv.includes("--selftest")) process.exit(selftest() ? 0 : 1);
  if (!selftest()) {
    console.error("[sim_leak] refus de mesurer : l'instrument n'a pas prouve qu'il sait voir.");
    process.exit(1);
  }

  const tirages = Number(val("--tirages") ?? 50000);
  const avant = val("--avant");
  const idCorpus = val("--corpus");
  const tous = enumererCorpus(RACINE);

  const fmt = (id, r, suffixe = "") =>
    `${id.padEnd(46)}n=${String(r.n).padStart(3)}  intrus=${r.observe.toFixed(3)} (p=${r.p < 1e-4 ? r.p.toExponential(1) : r.p.toFixed(4)})  ` +
    `inverse=${r.observeInv.toFixed(3)} (p=${r.pInv < 1e-4 ? r.pInv.toExponential(1) : r.pInv.toFixed(4)})  ` +
    `nul=${r.moyenneNulle.toFixed(3)}/${r.moyenneNulleInv.toFixed(3)}  ` +
    `marge_med=${r.margeMediane.toFixed(3)}${suffixe}`;

  if (avant) {
    if (!idCorpus) throw new Error("[sim_leak] --avant exige --corpus <vendor>:<cert>");
    const [vendor, cert] = idCorpus.split(":");
    const A = analyser(chargerAuRef(avant, vendor, cert), { tirages });
    const B = analyser(chargerAuRef("HEAD", vendor, cert), { tirages });
    console.log(`\n${fmt(`${idCorpus} @ ${avant}`, A)}`);
    console.log(fmt(`${idCorpus} @ HEAD`, B));
    console.log(
      `\nDELTA observe = ${(B.observe - A.observe >= 0 ? "+" : "") + (B.observe - A.observe).toFixed(3)}`
    );
    process.exit(0);
  }

  const cibles = idCorpus ? tous.filter((c) => c.id === idCorpus) : tous;
  if (cibles.length === 0) throw new Error(`[sim_leak] corpus inconnu : ${idCorpus}`);
  const lignes = [];
  let nbQuestions = 0;
  for (const c of cibles) {
    const paires = chargerCorpus(RACINE, c);
    nbQuestions += paires.length;
    lignes.push({ id: c.id, r: analyser(paires, { tirages }) });
  }
  if (!idCorpus && (cibles.length < PLANCHER_CORPUS || nbQuestions < PLANCHER_QUESTIONS)) {
    console.error(
      `ECHEC : ${cibles.length} corpus / ${nbQuestions} questions lus, sous le plancher ` +
        `(${PLANCHER_CORPUS}/${PLANCHER_QUESTIONS}).`
    );
    process.exit(1);
  }
  console.log(`\nesperance sous le nul = 0.250 EXACTEMENT (voir l'entete)\n`);
  for (const l of lignes.sort((a, b) => b.r.observe - a.r.observe)) console.log(fmt(l.id, l.r));
  console.log(`\n--- ${cibles.length} corpus, ${nbQuestions} questions lues ---`);
}
