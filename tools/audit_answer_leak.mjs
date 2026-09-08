// Audit de fuite de forme sur une cohorte de questions v3.
//
// Ce n'est PAS un gate : il ne bloque rien et la CI ne l'execute pas. Les deux
// axes exploitables sont deja controles par validate_content.mjs. Cet outil
// mesure ce qui reste APRES eux, pour que le residu soit constate plutot que
// redecouvert. Voir docs/editorial/README.md pour la regle qui dit lesquels de
// ces axes doivent etre corriges et lesquels ne doivent surtout pas l'etre.
//
// Usage: node tools/audit_answer_leak.mjs <provider> <slug> [--seed N]
//        node tools/audit_answer_leak.mjs aws saa-c03

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const QUESTIONS = "content/public/questions";
const SOLUTIONS = "content/answerKey/solutions";

// Generateur deterministe : sans graine fixe, deux executions du meme corpus
// rendraient deux controles negatifs differents et la mesure ne serait pas
// reproductible.
function makeRandom(seed) {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 1e9) / 1e9;
  };
}

// Fisher-Yates. Un comparateur aleatoire passe a sort() ne rend PAS une
// permutation uniforme : l'algorithme suppose un ordre coherent, et un
// comparateur qui ment donne un biais dependant de l'implementation.
function shuffle(list, rnd) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Le controle negatif doit DETRUIRE le signal, pas en preserver une tranche.
// Une permutation deseequilibree laisse un index sur-represente ; les options
// de cet index portent alors le profil de traits d'une bonne reponse et le
// plancher du controle remonte. Le defaut est anti-correle a ce qu'on cherche :
// il gonfle le plancher exactement sur les corpus les plus fuyants. D'ou cette
// garde, qui refuse une permutation non equilibree au lieu de s'y fier.
function balancedIndices(n, rnd) {
  const pool = [];
  for (let i = 0; i < n; i++) pool.push(i % 4);
  const permuted = shuffle(pool, rnd);
  const counts = [0, 0, 0, 0];
  for (const index of permuted) counts[index]++;
  const low = Math.floor(n / 4);
  const high = Math.ceil(n / 4);
  if (counts.some((c) => c < low || c > high)) {
    throw new Error(
      `[audit] permutation deseequilibree (${counts.join("/")}), controle negatif inutilisable`
    );
  }
  return permuted;
}

const CONJONCTIONS = /\b(et|ou|puis|ainsi que|afin de|afin que|pour que|tout en|alors que|tandis que)\b/gi;

function traits(text) {
  return {
    conjonctions: (text.match(CONJONCTIONS) ?? []).length,
    acronymes: (text.match(/\b[A-Z]{2,}\b/g) ?? []).length,
    motLePlusLong: Math.max(0, ...text.split(/\s+/).map((w) => w.length)),
  };
}

// Loi binomiale exacte, unilaterale : P(X >= k | n, 1/2). Le corpus est trop
// petit pour une approximation normale.
function binomialTail(k, n) {
  let total = 0;
  for (let i = k; i <= n; i++) {
    let c = 1;
    for (let j = 0; j < i; j++) c = (c * (n - j)) / (j + 1);
    total += c;
  }
  return total / 2 ** n;
}

function load(provider, slug) {
  const qDir = resolve(QUESTIONS, provider, slug);
  const sDir = resolve(SOLUTIONS, provider, slug);
  if (!existsSync(qDir)) throw new Error(`[audit] repertoire absent: ${qDir}`);
  if (!existsSync(sDir)) throw new Error(`[audit] repertoire absent: ${sDir}`);
  const items = [];
  for (const file of readdirSync(qDir).sort()) {
    if (!file.endsWith(".json")) continue;
    const question = JSON.parse(readFileSync(resolve(qDir, file), "utf8"));
    const solutionPath = resolve(sDir, file);
    if (!existsSync(solutionPath)) {
      throw new Error(`[audit] solution absente pour ${file}`);
    }
    const solution = JSON.parse(readFileSync(solutionPath, "utf8"));
    // solution.correct porte le TEXTE de la bonne reponse, pas son index.
    const index = question.choices.indexOf(solution.correct);
    if (index < 0) {
      throw new Error(`[audit] ${file}: reponse correcte introuvable parmi les choix`);
    }
    items.push({ id: question.id ?? file, choices: question.choices, index });
  }
  if (!items.length) throw new Error(`[audit] aucune paire lue dans ${qDir}`);
  return items;
}

// Compte, sur chaque question, si l'option designee porte le trait plus que la
// moyenne des trois autres. Sous l'hypothese nulle la proportion vaut 1/2.
function scoreTrait(items, pick, name) {
  let hits = 0;
  let trials = 0;
  for (const item of items) {
    const designated = pick(item);
    const values = item.choices.map((c) => traits(c)[name]);
    const others = values.filter((_, i) => i !== designated);
    const mean = others.reduce((a, b) => a + b, 0) / others.length;
    if (values[designated] === mean) continue;
    trials++;
    if (values[designated] > mean) hits++;
  }
  return { hits, trials, p: trials ? binomialTail(hits, trials) : null };
}

function main() {
  const [provider, slug] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  if (!provider || !slug) {
    console.error("Usage: node tools/audit_answer_leak.mjs <provider> <slug> [--seed N]");
    process.exit(2);
  }
  const seedArg = process.argv.indexOf("--seed");
  const seed = seedArg > -1 ? Number(process.argv[seedArg + 1]) : 20260907;

  const items = load(provider, slug);
  const n = items.length;

  const positions = [0, 0, 0, 0];
  const ranks = [0, 0, 0, 0];
  for (const item of items) {
    const lengths = item.choices.map((c) => c.length);
    positions[item.index]++;
    ranks[lengths.filter((l) => l < lengths[item.index]).length]++;
  }

  console.log(`=== ${provider}:${slug} — n=${n} — graine ${seed} ===`);
  // La porte des deux controles de cohorte est `exemptCount === 0` : tant que la
  // certification porte des dispenses, NI la position NI le rang ne sont mesures.
  // Le libelle doit donc nommer cette condition, sinon il annonce une protection
  // que la cohorte en dette n'a pas.
  console.log(`axes controles par la CI, une fois la dette de la cohorte soldee :`);
  console.log(`  positions      ${positions.join("/")}`);
  console.log(`  rangs longueur ${ranks.join("/")}`);
  console.log(`axes hors controle, mesures et NON corriges (voir docs/editorial/README.md) :`);

  const rnd = makeRandom(seed);
  const decoys = balancedIndices(n, rnd);
  for (const name of ["conjonctions", "acronymes", "motLePlusLong"]) {
    const reel = scoreTrait(items, (i) => i.index, name);
    const controle = scoreTrait(
      items.map((item, k) => ({ ...item, decoy: decoys[k] })),
      (i) => i.decoy,
      name
    );
    const fmt = (r) =>
      r.trials
        ? `${r.hits}/${r.trials}  p=${r.p < 1e-4 ? r.p.toExponential(1) : r.p.toFixed(4)}`
        : "aucun essai";
    console.log(`  ${name.padEnd(14)} reel ${fmt(reel).padEnd(24)} controle ${fmt(controle)}`);
  }
  console.log(
    `\nLe controle negatif rejoue les memes traits sur une option tiree selon une`
  );
  console.log(
    `permutation equilibree. Un ecart reel/controle est un residu constate, pas`
  );
  console.log(`une consigne de correction : la regle d'arret est dans la doc.`);
}

main();
