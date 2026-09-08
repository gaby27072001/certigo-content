// Mesure la fuite lexicale : un marqueur present UNIQUEMENT dans les distracteurs.
//
// Pourquoi c'est une fuite : si "manuel" n'apparait jamais dans une bonne
// reponse, alors "ecarte l'option qui dit manuel" est une regle qu'un candidat
// execute de tete, sans connaitre la matiere. C'est la meme famille que la
// position ou la longueur, sur un porteur lexical.
//
// Le garde du depot (test/aws_professional_wave.test.mjs:227) ne couvre qu'UN
// motif (manuel/manuelle/manuellement) sur CINQ certifications listees en dur.
// Cet outil mesure l'axe, pas le mot : il balaie tout le vocabulaire.
//
// Usage :
//   node lex_leak.mjs <vendor> <cert> [--min N] [--selftest]
//
// --selftest injecte un marqueur exclusif connu et refuse de servir si l'outil
// ne le voit pas. Un detecteur qui n'a pas montre qu'il sait pointer du rouge
// ne prouve rien quand il affiche du vert.

import fs from "node:fs";
import path from "node:path";

// Familles multi-mots nommees comme correlees a la faussete dans un corpus
// d'infrastructure. Le balayage generique ne les voit pas : ce sont des
// locutions, pas des tokens.
const FAMILLES = [
  ["manuel", /\bmanuel(?:le)?(?:ment)?\b/i],
  ["a la main", /\bà la main\b/i],
  ["ad hoc", /\bad hoc\b/i],
  ["ponctuellement", /\bponctuel(?:le)?(?:ment)?\b/i],
  ["par un ingenieur", /\bpar un (?:ingénieur|opérateur|administrateur)\b/i],
  ["tableur", /\btableur\b/i],
  ["ticket", /\bticket/i],
  ["un a un", /\b(?:une? à une?|un par un|compte par compte)\b/i],
  ["script maison", /\bscript maison\b/i],
];

function normalise(mot) {
  return mot.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function tokens(texte) {
  return new Set(
    (normalise(texte).match(/[a-z0-9]+/g) ?? []).filter((t) => t.length >= 5)
  );
}

export function charger(vendor, cert) {
  const pub = path.join("content", "public", "questions", vendor, cert);
  const key = path.join("content", "answerKey", "solutions", vendor, cert);
  const fichiers = fs.readdirSync(pub).filter((f) => f.endsWith(".json")).sort();
  const out = [];
  for (const f of fichiers) {
    const q = JSON.parse(fs.readFileSync(path.join(pub, f), "utf8"));
    const s = JSON.parse(fs.readFileSync(path.join(key, f), "utf8"));
    const choix = q.choices.map((c) => (typeof c === "string" ? c : c.text));
    const i = choix.indexOf(s.correct);
    if (i < 0) throw new Error(`${f}: reponse correcte introuvable parmi les choix`);
    out.push({
      fichier: f,
      bonne: choix[i],
      distracteurs: choix.filter((_, j) => j !== i),
    });
  }
  return out;
}

export function mesurer(paires, min) {
  // Un marqueur compte par QUESTION, pas par occurrence : une locution repetee
  // trois fois dans un meme distracteur reste une seule question exploitable.
  const bonnes = new Map();
  const distr = new Map();
  const bump = (m, k) => m.set(k, (m.get(k) ?? 0) + 1);

  for (const p of paires) {
    for (const t of tokens(p.bonne)) bump(bonnes, t);
    const vus = new Set();
    for (const d of p.distracteurs) for (const t of tokens(d)) vus.add(t);
    for (const t of vus) bump(distr, t);
  }

  const exclusifs = [];
  for (const [t, n] of distr) {
    if ((bonnes.get(t) ?? 0) === 0 && n >= min) {
      exclusifs.push({ marqueur: t, questions: n, ou: "token" });
    }
  }

  for (const [nom, re] of FAMILLES) {
    let nb = 0;
    let nd = 0;
    for (const p of paires) {
      if (re.test(p.bonne)) nb += 1;
      if (p.distracteurs.some((d) => re.test(d))) nd += 1;
    }
    if (nb === 0 && nd >= min) {
      exclusifs.push({ marqueur: nom, questions: nd, ou: "famille" });
    }
  }

  exclusifs.sort((a, b) => b.questions - a.questions);
  return exclusifs;
}

// Temoin de bruit : on rebat au hasard QUELLE option est correcte, en gardant
// les textes intacts. Un marqueur reellement porteur d'information doit
// disparaitre sous ce rebattage ; ce qui survit est du bruit de frequence.
// Les distracteurs portent trois fois plus de texte que les bonnes reponses :
// n'importe quel mot est donc exclusif aux distracteurs par simple base rate.
export function bruitAttendu(paires, min, tirages = 200) {
  let total = 0;
  let familles = 0;
  for (let t = 0; t < tirages; t += 1) {
    const rebattu = paires.map((p) => {
      const toutes = [p.bonne, ...p.distracteurs];
      const i = Math.floor(Math.random() * toutes.length);
      return {
        ...p,
        bonne: toutes[i],
        distracteurs: toutes.filter((_, j) => j !== i),
      };
    });
    const e = mesurer(rebattu, min);
    total += e.length;
    familles += e.filter((x) => x.ou === "famille").length;
  }
  return { tokens: (total - familles) / tirages, familles: familles / tirages };
}

function selftest(paires, min) {
  // Temoin positif : on colle un marqueur inedit dans un distracteur de N
  // questions et on exige que l'outil le nomme. S'il ne le voit pas, il ne
  // sert a rien de lire son silence sur le corpus reel.
  const temoin = "zzsentinellezz";
  const truque = paires.map((p, k) => ({
    ...p,
    distracteurs:
      k < min
        ? [p.distracteurs[0] + " " + temoin, ...p.distracteurs.slice(1)]
        : p.distracteurs,
  }));
  const vu = mesurer(truque, min).some((e) => e.marqueur === temoin);
  if (!vu) {
    console.error(
      `[selftest] ECHEC : le marqueur temoin injecte dans ${min} question(s) n'a pas ete detecte.`
    );
    return false;
  }
  // Temoin negatif : le meme marqueur pose AUSSI dans une bonne reponse ne doit
  // plus etre exclusif. Sans ce second volet, l'outil pourrait signaler
  // n'importe quel mot rare et passer quand meme le premier volet.
  const equilibre = truque.map((p, k) => ({
    ...p,
    bonne: k === 0 ? p.bonne + " " + temoin : p.bonne,
  }));
  const encore = mesurer(equilibre, min).some((e) => e.marqueur === temoin);
  if (encore) {
    console.error(
      "[selftest] ECHEC : le marqueur reste signale alors qu'il figure aussi dans une bonne reponse."
    );
    return false;
  }
  console.log(
    `[selftest] ok : marqueur vu quand il est exclusif, ignore quand il ne l'est plus (seuil ${min}).`
  );
  return true;
}

const argv = process.argv.slice(2);
// Le bloc CLI ne doit s'executer que si CE fichier est le point d'entree.
// Sans ce garde, un simple `import { mesurer }` depuis un autre outil relance
// la CLI avec les arguments de l'appelant et sort par process.exit() : l'outil
// importateur ne s'execute jamais, et sa sortie ressemble a la sienne.
const lanceDirectement = /lex_leak\.mjs$/.test(process.argv[1] ?? "");

if (lanceDirectement && argv.length >= 2 && !argv[0].startsWith("--")) {
  const [vendor, cert] = argv;
  const iMin = argv.indexOf("--min");
  const min = iMin >= 0 ? Number(argv[iMin + 1]) : 3;
  const paires = charger(vendor, cert);

  if (!selftest(paires, min)) process.exit(1);

  const exclusifs = mesurer(paires, min);
  const bruit = bruitAttendu(paires, min);
  console.log(`\n=== ${vendor}:${cert} — ${paires.length} question(s), seuil ${min} ===`);
  const nbTok = exclusifs.filter((e) => e.ou === "token").length;
  const nbFam = exclusifs.filter((e) => e.ou === "famille").length;
  console.log(
    `bruit attendu sous rebattage : ${bruit.tokens.toFixed(1)} token(s), ${bruit.familles.toFixed(2)} famille(s)`
  );
  console.log(`observe                      : ${nbTok} token(s), ${nbFam} famille(s)\n`);
  for (const e of exclusifs.filter((x) => x.ou === "famille")) {
    console.log(
      `  [FAMILLE] ${e.marqueur.padEnd(24)} ${e.questions}/${paires.length} question(s), 0 en bonne reponse`
    );
  }
  if (nbFam === 0) console.log("  aucune famille lexicale exclusive aux distracteurs.");
  // Seules les familles font echouer : le balayage generique de tokens ne
  // depasse pas son bruit et ne designe donc rien d'exploitable.
  process.exit(nbFam === 0 ? 0 : 1);
}
