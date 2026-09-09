// Significativite PAR MARQUEUR de la fuite lexicale, par permutation, dans les
// deux sens.
//
// CE QU'IL AJOUTE. tools/lex_leak.mjs sait dire QU'un marqueur est exclusif a
// un cote ; `bruitAttendu` sait dire combien de marqueurs exclusifs le hasard
// produit EN TOUT. Ni l'un ni l'autre ne rend un p par marqueur, et aucun n'est
// reproductible : `bruitAttendu` tire sur Math.random, donc deux executions du
// meme corpus rendent deux bruits differents.
//
// POURQUOI PAS DE FORMULE. La tentation est d'ecrire (1-p)^k avec p=1/4. Elle
// conclut a tort au bruit, parce qu'elle suppose que le marqueur a la meme
// chance d'etre dans chacune des quatre options. C'est faux : les distracteurs
// portent environ trois fois le texte des bonnes reponses, donc n'importe quel
// mot est « exclusif aux distracteurs » par pur volume. La longueur, la
// redondance entre options, la co-occurrence de deux marqueurs — rien de tout
// cela n'entre dans la formule.
//
// LE NUL CORRECT. On garde les quatre textes, leurs longueurs, chaque mot a sa
// place, et on permute UNIQUEMENT l'etiquette « celle-ci est la bonne ». La
// statistique est C = nombre de questions ou le marqueur figure dans la bonne
// reponse. Le nul est donc conditionnel au corpus reel : tout le desequilibre
// de volume est deja dedans, et ne peut plus etre pris pour un signal.
//
//   sens D (fuite vers les distracteurs) : p = P(C_permute <= C_observe)
//   sens C (fuite vers la bonne reponse) : p = P(C_permute >= C_observe)
//
// CONTROLE D'IDENTITE. La permutation nulle — celle qui rend a chaque question
// son index reel — doit redonner l'observe EXACTEMENT. Sans ce controle, une
// cle de comparaison detruite par la transformation mesuree rend un p qui a
// l'air d'un resultat. C'est arrive dans ce depot.
//
// TEMOIN POSITIF. Un marqueur synthetique, pose exclusivement d'un cote, doit
// sortir a p minimal. Un instrument qui n'a jamais montre qu'il sait rendre une
// presence n'informe pas quand il rend une absence.
//
// MULTIPLICITE. On balaie des milliers de marqueurs : a p<0.05 le hasard seul
// en designe des dizaines. Le tri final est un Benjamini-Hochberg, et le compte
// attendu sous le nul est imprime a cote du compte observe.
//
// Usage :
//   node tools/lex_perm.mjs --corpus azure:az900 [--tirages N] [--min K]
//   node tools/lex_perm.mjs --groupe azure            (met en commun les 6)
//   node tools/lex_perm.mjs --selftest

import { FAMILLES_CLASSEES, chargerCorpus, enumererCorpus } from "./lex_leak.mjs";

const RACINE = ".";

// Plancher de lecture. Un instrument qui n'a rien lu doit ECHOUER, pas rendre
// zero : sept fois dans ce depot un outil a rendu « 0 probleme » sans avoir lu
// une ligne.
const PLANCHER_QUESTIONS = 8;

// Generateur deterministe. Sans graine, deux executions rendent deux p
// differents et la mesure n'est pas reproductible.
function makeRandom(seed) {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 1e9) / 1e9;
  };
}

function normalise(mot) {
  return mot.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function tokens(texte) {
  return new Set((normalise(texte).match(/[a-z0-9]+/g) ?? []).filter((t) => t.length >= 5));
}

// Marqueurs portes par UNE option : les tokens longs, plus les familles
// nommees. Les familles sont des locutions, invisibles au balayage par token.
function marqueursDe(texte) {
  const s = tokens(texte);
  for (const f of FAMILLES_CLASSEES) if (f.motif.test(texte)) s.add(`@${f.nom}`);
  return s;
}

// Construit la table (question x option) -> ids de marqueurs, et l'index des
// marqueurs. Ne garde que les marqueurs presents dans au moins `min` questions
// (toutes options confondues) : sous ce seuil aucun test n'a de puissance, et
// les garder ne ferait que gonfler la correction de multiplicite.
function indexer(paires, min) {
  const presence = new Map();
  const brut = paires.map((p) =>
    p.choix.map((c) => marqueursDe(c))
  );
  for (const q of brut) {
    const vus = new Set();
    for (const opt of q) for (const m of opt) vus.add(m);
    for (const m of vus) presence.set(m, (presence.get(m) ?? 0) + 1);
  }
  const gardes = [...presence.entries()].filter(([, n]) => n >= min).map(([m]) => m).sort();
  const id = new Map(gardes.map((m, i) => [m, i]));
  const table = brut.map((q) =>
    q.map((opt) => Int32Array.from([...opt].map((m) => id.get(m)).filter((v) => v !== undefined)))
  );
  return { marqueurs: gardes, table, presence };
}

// C[m] = nombre de questions ou le marqueur m figure dans l'option designee.
// `choisir(k)` rend l'index de l'option designee pour la question k : l'index
// reel pour l'observe, un tirage uniforme pour une permutation.
function compterC(table, nbMarqueurs, choisir) {
  const c = new Int32Array(nbMarqueurs);
  for (let k = 0; k < table.length; k += 1) c_add(c, table[k][choisir(k)]);
  return c;
}

function c_add(c, ids) {
  for (let i = 0; i < ids.length; i += 1) c[ids[i]] += 1;
}

// D[m] = nombre de questions ou le marqueur figure dans AU MOINS UN distracteur.
function compterD(table, nbMarqueurs, choisir) {
  const d = new Int32Array(nbMarqueurs);
  for (let k = 0; k < table.length; k += 1) {
    const q = table[k];
    const bonne = choisir(k);
    const vus = new Set();
    for (let o = 0; o < q.length; o += 1) {
      if (o === bonne) continue;
      for (let i = 0; i < q[o].length; i += 1) vus.add(q[o][i]);
    }
    for (const m of vus) d[m] += 1;
  }
  return d;
}

export function analyser(paires, { tirages = 20000, min = 3, seed = 20260908 } = {}) {
  if (paires.length < PLANCHER_QUESTIONS) {
    throw new Error(
      `[lex_perm] ${paires.length} question(s) lue(s), sous le plancher ${PLANCHER_QUESTIONS} : ` +
        "refus de rendre une mesure qui n'aurait rien mesure."
    );
  }
  const { marqueurs, table } = indexer(paires, min);
  const M = marqueurs.length;
  if (M === 0) throw new Error("[lex_perm] aucun marqueur retenu : seuil trop haut ou corpus vide");

  const reel = (k) => paires[k].index;
  const cObs = compterC(table, M, reel);
  const dObs = compterD(table, M, reel);

  // --- Controle d'identite. La permutation nulle doit redonner l'observe.
  const cIdent = compterC(table, M, reel);
  for (let i = 0; i < M; i += 1) {
    if (cIdent[i] !== cObs[i]) {
      throw new Error("[lex_perm] la permutation nulle ne redonne pas l'observe : chaine cassee");
    }
  }

  const rnd = makeRandom(seed);
  const nbOpt = paires.map((p) => p.choix.length);
  const leC = new Int32Array(M); // # tirages ou C_perm <= C_obs
  const geC = new Int32Array(M); // # tirages ou C_perm >= C_obs
  let bouge = 0; // # tirages ou la permutation differe de l'observe

  for (let t = 0; t < tirages; t += 1) {
    const pick = new Int32Array(paires.length);
    let identique = true;
    for (let k = 0; k < paires.length; k += 1) {
      pick[k] = Math.floor(rnd() * nbOpt[k]);
      if (pick[k] !== paires[k].index) identique = false;
    }
    if (!identique) bouge += 1;
    const c = compterC(table, M, (k) => pick[k]);
    for (let i = 0; i < M; i += 1) {
      if (c[i] <= cObs[i]) leC[i] += 1;
      if (c[i] >= cObs[i]) geC[i] += 1;
    }
  }

  // Garde d'uniformite : si aucune permutation ne s'ecarte de l'observe, on
  // mesure le generateur, pas le corpus.
  if (bouge === 0) throw new Error("[lex_perm] aucune permutation n'a bouge : tirage inerte");

  const out = [];
  for (let i = 0; i < M; i += 1) {
    // +1 au numerateur et au denominateur : un p nul serait une certitude que
    // 20000 tirages ne peuvent pas etablir.
    const pD = (leC[i] + 1) / (tirages + 1);
    const pC = (geC[i] + 1) / (tirages + 1);
    out.push({
      marqueur: marqueurs[i],
      famille: marqueurs[i].startsWith("@"),
      C: cObs[i],
      D: dObs[i],
      sens: pD < pC ? "D" : "C",
      p: Math.min(pD, pC),
      pD,
      pC,
    });
  }
  out.sort((a, b) => a.p - b.p || b.D + b.C - (a.D + a.C));
  return { resultats: out, nbMarqueurs: M, nbQuestions: paires.length, tirages, bouge };
}

// Benjamini-Hochberg : rend le seuil de p sous lequel le taux de fausses
// decouvertes attendu reste sous q.
export function bh(resultats, q = 0.05) {
  const tries = [...resultats].sort((a, b) => a.p - b.p);
  const m = tries.length;
  let seuil = 0;
  for (let i = 0; i < m; i += 1) {
    if (tries[i].p <= ((i + 1) / m) * q) seuil = tries[i].p;
  }
  return seuil;
}

// --- Temoin positif -------------------------------------------------------
// On pose un marqueur inedit exclusivement d'un cote et on exige que
// l'instrument le designe. Puis on le pose des DEUX cotes et on exige qu'il ne
// le designe plus. Sans le second volet, l'outil pourrait signaler n'importe
// quel mot rare et passer quand meme le premier.
function selftest() {
  const base = [];
  for (let k = 0; k < 40; k += 1) {
    base.push({
      index: k % 4,
      choix: [0, 1, 2, 3].map((o) => `option ${o} question ${k} contenu neutre variable`),
    });
  }
  const temoin = "zzsentinellezz";

  const versD = base.map((p) => ({
    ...p,
    choix: p.choix.map((c, o) => (o === (p.index + 1) % 4 ? `${c} ${temoin}` : c)),
  }));
  const rD = analyser(versD, { tirages: 4000 }).resultats.find((r) => r.marqueur === temoin);
  if (!rD || rD.sens !== "D" || rD.p > 0.01) {
    console.error(`[selftest] ECHEC sens D : ${JSON.stringify(rD)}`);
    return false;
  }

  const versC = base.map((p) => ({
    ...p,
    choix: p.choix.map((c, o) => (o === p.index ? `${c} ${temoin}` : c)),
  }));
  const rC = analyser(versC, { tirages: 4000 }).resultats.find((r) => r.marqueur === temoin);
  if (!rC || rC.sens !== "C" || rC.p > 0.01) {
    console.error(`[selftest] ECHEC sens C : ${JSON.stringify(rC)}`);
    return false;
  }

  // Temoin negatif : partout, donc aucune information.
  const partout = base.map((p) => ({ ...p, choix: p.choix.map((c) => `${c} ${temoin}`) }));
  const rN = analyser(partout, { tirages: 4000 }).resultats.find((r) => r.marqueur === temoin);
  if (!rN || rN.p < 0.5) {
    console.error(`[selftest] ECHEC temoin negatif : ${JSON.stringify(rN)}`);
    return false;
  }

  console.log(
    `[selftest] ok — sens D p=${rD.p.toExponential(1)}, sens C p=${rC.p.toExponential(1)}, ` +
      `present partout p=${rN.p.toFixed(3)} (doit etre eleve).`
  );
  return true;
}

// --- CLI ------------------------------------------------------------------
const lanceDirectement = /lex_perm\.mjs$/.test(process.argv[1] ?? "");
if (lanceDirectement) {
  const argv = process.argv.slice(2);
  const val = (nom, def) => {
    const i = argv.indexOf(nom);
    return i > -1 ? argv[i + 1] : def;
  };

  if (argv.includes("--selftest")) process.exit(selftest() ? 0 : 1);
  if (!selftest()) {
    console.error("[lex_perm] refus de mesurer : l'instrument n'a pas prouve qu'il sait voir.");
    process.exit(1);
  }

  const tirages = Number(val("--tirages", 20000));
  const min = Number(val("--min", 3));
  const tous = enumererCorpus(RACINE);
  const idCorpus = val("--corpus", null);
  const groupe = val("--groupe", null);

  let paires;
  let titre;
  if (groupe) {
    const cibles = tous.filter((c) => c.id.startsWith(`${groupe}:`));
    if (cibles.length === 0) throw new Error(`[lex_perm] groupe vide : ${groupe}`);
    paires = cibles.flatMap((c) => chargerCorpus(RACINE, c));
    titre = `${groupe}:* (${cibles.length} corpus)`;
  } else if (idCorpus) {
    const c = tous.find((x) => x.id === idCorpus);
    if (!c) throw new Error(`[lex_perm] corpus inconnu : ${idCorpus}`);
    paires = chargerCorpus(RACINE, c);
    titre = idCorpus;
  } else {
    console.error("Usage: node tools/lex_perm.mjs --corpus <id> | --groupe <vendor> | --selftest");
    process.exit(2);
  }

  const { resultats, nbMarqueurs, nbQuestions, bouge } = analyser(paires, { tirages, min });
  const seuilBH = bh(resultats, 0.05);
  const retenus = resultats.filter((r) => r.p <= seuilBH && seuilBH > 0);
  const p05 = resultats.filter((r) => r.p < 0.05).length;

  console.log(`\n=== ${titre} — ${nbQuestions} questions, ${nbMarqueurs} marqueurs, ${tirages} tirages ===`);
  console.log(`permutations effectivement distinctes de l'observe : ${bouge}/${tirages}`);
  console.log(
    `marqueurs a p<0.05 : ${p05} observes contre ${(0.05 * nbMarqueurs).toFixed(1)} attendus sous le nul`
  );
  console.log(`seuil Benjamini-Hochberg (q=0.05) : ${seuilBH > 0 ? seuilBH.toExponential(2) : "aucun retenu"}`);
  console.log(`retenus apres controle de multiplicite : ${retenus.length}\n`);

  const ligne = (r) =>
    `  ${r.sens}  ${r.marqueur.padEnd(26)} C=${String(r.C).padStart(3)} D=${String(r.D).padStart(3)}  p=${r.p.toExponential(2)}`;
  for (const r of retenus) console.log(ligne(r));
  if (retenus.length === 0) {
    console.log("  aucun marqueur ne survit au controle de multiplicite. Dix meilleurs bruts :");
    for (const r of resultats.slice(0, 10)) console.log(ligne(r));
  }
}
