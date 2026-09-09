// Audit de fuite de forme sur une cohorte de questions.
//
// Ce n'est PAS un gate : il ne bloque rien et la CI ne l'execute pas. Les deux
// axes exploitables sont deja controles par validate_content.mjs SUR LE V3
// SEULEMENT. Cet outil mesure ce qui reste APRES eux, pour que le residu soit
// constate plutot que redecouvert. Voir docs/editorial/README.md pour la regle
// qui dit lesquels de ces axes doivent etre corriges et lesquels ne doivent
// surtout pas l'etre.
//
// DISPOSITIONS. Le chargeur d'origine faisait `resolve(QUESTIONS, provider,
// slug)` : il supposait l'arborescence imbriquee et ne pouvait donc PAS lire
// les six corpus Azure a plat (146 questions v2). Un outil complet, branche sur
// rien. Il delegue desormais a `enumererCorpus` / `chargerCorpus`
// (tools/lex_leak.mjs), seul chargeur du depot qui connaisse les deux
// dispositions.
//
// Usage: node tools/audit_answer_leak.mjs <provider> <slug> [--seed N]
//        node tools/audit_answer_leak.mjs --corpus azure:az900
//        node tools/audit_answer_leak.mjs --all

import { chargerCorpus, enumererCorpus } from "./lex_leak.mjs";

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

// Resout un identifiant de corpus (`azure:az900`, `aws:saa-c03`) ou un couple
// <provider> <slug> vers la description rendue par `enumererCorpus`. Passer par
// l'enumerateur plutot que par un chemin construit a la main est ce qui rend
// les deux dispositions visibles : un chemin devine ne peut connaitre que la
// forme qu'on avait en tete en l'ecrivant.
function resoudre(racine, id) {
  const tous = enumererCorpus(racine);
  const trouve = tous.find((c) => c.id === id);
  if (!trouve) {
    throw new Error(
      `[audit] corpus inconnu: ${id}. Corpus lisibles: ${tous.map((c) => c.id).join(", ")}`
    );
  }
  return trouve;
}

function load(racine, corpus) {
  // chargerCorpus refuse deja de rendre un corpus vide ; il porte le plancher
  // de lecture unitaire. Ici on ne fait que reprojeter dans la forme attendue
  // par les mesures de position et de rang.
  return chargerCorpus(racine, corpus).map((p) => ({
    id: p.id,
    choices: p.choix,
    index: p.index,
  }));
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

// Forme d'une cohorte : position de la bonne reponse, rang de sa longueur,
// ratio longueur(correcte)/moyenne(distracteurs), longueurs non distinctes.
//
// Le rang de longueur compte les options STRICTEMENT plus courtes. Une egalite
// de longueur ecrase donc deux options sur le meme rang : c'est pourquoi le
// nombre de questions a longueurs non distinctes est rendu a cote, faute de
// quoi un `0/0/0/20` et un `0/0/0/20` a longueurs egales se liraient pareil.
const RATIO_BAS = 0.85;
const RATIO_HAUT = 1.15;

function forme(items) {
  const positions = [0, 0, 0, 0];
  const ranks = [0, 0, 0, 0];
  let horsBande = 0;
  let nonDistinctes = 0;
  let sommeRatio = 0;
  for (const item of items) {
    const lengths = item.choices.map((c) => c.length);
    positions[item.index]++;
    ranks[lengths.filter((l) => l < lengths[item.index]).length]++;
    const autres = lengths.filter((_, i) => i !== item.index);
    const moyenne = autres.reduce((a, b) => a + b, 0) / autres.length;
    const ratio = moyenne === 0 ? 1 : lengths[item.index] / moyenne;
    sommeRatio += ratio;
    if (ratio < RATIO_BAS || ratio > RATIO_HAUT) horsBande++;
    if (new Set(lengths).size !== lengths.length) nonDistinctes++;
  }
  return { positions, ranks, horsBande, nonDistinctes, ratioMoyen: sommeRatio / items.length };
}

function auditer(racine, corpus, seed) {
  const items = load(racine, corpus);
  const n = items.length;
  const f = forme(items);

  console.log(`=== ${corpus.id} — n=${n} — disposition ${corpus.disposition} — graine ${seed} ===`);
  // La porte des deux controles de cohorte est `exemptCount === 0` : tant que la
  // certification porte des dispenses, NI la position NI le rang ne sont mesures.
  // Le libelle doit donc nommer cette condition, sinon il annonce une protection
  // que la cohorte en dette n'a pas. Sur le v2 la porte ne s'ouvre jamais : les
  // deux controles sont ecrits pour le v3 seulement.
  console.log(`axes controles par la CI, une fois la dette de la cohorte soldee :`);
  console.log(`  positions          ${f.positions.join("/")}`);
  console.log(`  rangs longueur     ${f.ranks.join("/")}`);
  console.log(
    `  ratio hors bande   ${f.horsBande}/${n} (bande ${RATIO_BAS}-${RATIO_HAUT}, moyen ${f.ratioMoyen.toFixed(3)})`
  );
  console.log(`  longueurs egales   ${f.nonDistinctes}/${n} question(s)`);
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
  console.log("");
  return { id: corpus.id, n, ...f };
}

// Plancher de lecture du mode --all. Aligne sur tools/lex_baseline.mjs : un
// releve qui rend moins que le depot n'est pas un vert, c'est un chemin casse.
const PLANCHER_CORPUS = 30;
const PLANCHER_QUESTIONS = 700;

function main() {
  const argv = process.argv.slice(2);
  const seedArg = argv.indexOf("--seed");
  const seed = seedArg > -1 ? Number(argv[seedArg + 1]) : 20260907;
  const iRacine = argv.indexOf("--racine");
  // `--racine` existe pour pouvoir MONTRER que le plancher de lecture echoue :
  // pointe sur une fixture a un corpus et le mode --all doit sortir en erreur.
  // Un plancher qu'on n'a jamais vu rougir ne protege de rien.
  const racine = iRacine > -1 ? argv[iRacine + 1] : ".";

  const iCorpus = argv.indexOf("--corpus");
  const positionnels = argv.filter((a, i) => {
    if (a.startsWith("--")) return false;
    if (seedArg > -1 && i === seedArg + 1) return false;
    if (iCorpus > -1 && i === iCorpus + 1) return false;
    if (iRacine > -1 && i === iRacine + 1) return false;
    return true;
  });

  if (argv.includes("--all")) {
    const tous = enumererCorpus(racine);
    const releves = tous.map((c) => auditer(racine, c, seed));
    const nbQuestions = releves.reduce((a, r) => a + r.n, 0);
    if (tous.length < PLANCHER_CORPUS || nbQuestions < PLANCHER_QUESTIONS) {
      console.error(
        `ECHEC : ${tous.length} corpus / ${nbQuestions} questions lus, sous le plancher ` +
          `(${PLANCHER_CORPUS}/${PLANCHER_QUESTIONS}). Un releve partiel n'est pas une mesure.`
      );
      process.exit(1);
    }
    console.log(`--- ${tous.length} corpus, ${nbQuestions} questions lues ---`);
    return;
  }

  let id;
  if (iCorpus > -1) id = argv[iCorpus + 1];
  else if (positionnels.length >= 2) id = `${positionnels[0]}:${positionnels[1]}`;
  else {
    console.error(
      "Usage: node tools/audit_answer_leak.mjs <provider> <slug> [--seed N]\n" +
        "       node tools/audit_answer_leak.mjs --corpus azure:az900\n" +
        "       node tools/audit_answer_leak.mjs --all"
    );
    process.exit(2);
  }
  auditer(racine, resoudre(racine, id), seed);
}

main();
