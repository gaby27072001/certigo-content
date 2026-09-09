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
//
// SENS. « D » = fuite si la famille n'apparait QUE dans des distracteurs
// (« ecarte l'option qui dit manuel »). « C » = fuite si elle n'apparait QUE
// dans des bonnes reponses (« prends l'option qui donne un exemple »). Les deux
// sont executables de tete ; l'outil d'origine ne mesurait que le premier.
//
// REGIME. Trois natures, etablies par permutation sur les 33 corpus du depot
// (3000 tirages, graine fixe — voir tools/lex_baseline.mjs) :
//
//   JUGEMENT  le mot est un marqueur de style corrle a la faussete.
//             -> GATE : une aggravation echoue.
//   INHERENT  le mot corrle a la faussete parce que le CONCEPT corrle a la
//             faussete. « accorder a tous les utilisateurs » n'est pas une
//             maladresse de style : c'est l'erreur que la question TESTE.
//             -> RAPPORT : une famille inherente peut legitimement croitre
//             quand on ajoute une bonne question. La gater punirait un corpus
//             qui s'ameliore.
//   TECHNO    le mot nomme une technologie, et sa correlation ne depasse pas
//             le bruit de frequence. -> RAPPORT.
//
// La regle « manuel => corriger / cron => consigner » est une heuristique de
// LECTURE, pas un critere : `script` est un nom de technologie employe comme
// jugement (« un script maison », « un script local partage »), et il sort a
// p=0.002. Le classement porte sur le sens au dictionnaire, la fuite porte sur
// l'usage — seule la mesure arbitre. D'ou ce champ, explicite et revisable.
// ATTENTION AUX FRONTIERES DE MOT ET AUX ACCENTS.
//
// En JS, `\b` est defini sur [A-Za-z0-9_]. Une lettre accentuee est donc un
// NON-mot, et deux non-mots cote a cote ne forment aucune frontiere :
//
//   /\bà la main\b/i   ne matche JAMAIS « reprendre à la main » — avant le `à`
//                      il y a un espace, non-mot lui aussi.
//   /…la totalité\b/i  ne matche JAMAIS « la totalité du trafic » — apres le
//                      `é` il y a un espace, non-mot lui aussi.
//
// Ces deux motifs ont vecu sans jamais matcher une seule fois. Ils n echouaient
// pas et ne rendaient pas un zero suspect : ils ne participaient jamais, et
// rien dans la sortie ne les distinguait d une absence legitime.
//
// D ou ces deux bornes, a utiliser DES QU une alternative commence ou finit par
// une lettre accentuee. `test/lexical_leak.test.mjs` impose a chaque famille un
// temoin present et un temoin absent : une alternative morte y rougit.
const AV = "(?<![0-9A-Za-zÀ-ÖØ-öø-ÿ_])"; // frontiere gauche, accents compris
const AP = "(?![0-9A-Za-zÀ-ÖØ-öø-ÿ_])"; // frontiere droite, accents compris

// LE VOCABULAIRE TEMPOREL DE `tout-le-reste` EST UN SIGNAL, PAS DU BRUIT.
// Ce motif appareille deux usages grammaticalement distincts :
//
//   quantificateur  « accorder a tous les utilisateurs »
//   periodicite     « interroger toutes les 5 minutes »
//
// Il est tentant d exclure le second comme un faux positif. Permutation du
// 2026-09-08, 3000 tirages, controle d identite OK, famille scindee :
//
//   tout-le-reste  obs 21  nul 7.1  p = 0.000
//   tlr-quantif    obs 21  nul 7.5  p = 0.000
//   tlr-temporel   obs 10  nul 6.2  p = 0.005   <- significatif
//
// Le sondage periodique est LUI-MEME une mauvaise reponse classique face a
// l evenementiel : le vocabulaire temporel suit l erreur qu il decrit. Exclure
// « toutes les <nombre|unite> » retirerait un signal mesure. Mesurer une
// COMPOSITION ne rend pas un verdict de VALIDITE — ne pas separer ces deux
// usages sans repermuter.
export const FAMILLES_CLASSEES = [
  // --- GATE : jugement de valeur, correlation etablie au-dela du bruit
  { nom: "manuel", sens: "D", regime: "JUGEMENT", gate: true, motif: /\bmanuel(?:le(?:s|ment)?|s)?\b/i },
  { nom: "script", sens: "D", regime: "JUGEMENT", gate: true, motif: /\bscripts?\b/i },
  { nom: "absolu", sens: "D", regime: "JUGEMENT", gate: true, motif: /\b(?:toujours|jamais|aucune?|systématiquement|exclusivement|impossible)\b/i },
  { nom: "uniquement", sens: "D", regime: "JUGEMENT", gate: true, motif: /\b(?:uniquement|seulement)\b/i },
  { nom: "vague", sens: "C", regime: "JUGEMENT", gate: true, motif: /\b(?:par exemple|notamment)\b|\betc\./i },

  // --- RAPPORT : inherent au domaine, mesure mais jamais bloquant
  { nom: "tout-le-reste", sens: "D", regime: "INHERENT", gate: false, motif: new RegExp(`${AV}(?:l'ensemble des|la totalité|tous les|toutes les)${AP}`, "i") },


  // --- RAPPORT : technologie, correlation dans le bruit
  { nom: "cron", sens: "D", regime: "TECHNO", gate: false, motif: /\bcron\b/i },
  { nom: "ticket", sens: "D", regime: "TECHNO", gate: false, motif: /\bticket/i },

  // --- RAPPORT : jugement, mais correlation marginale (p entre 0.03 et 0.07)
  { nom: "a la main", sens: "D", regime: "JUGEMENT", gate: false, motif: new RegExp(`${AV}à la main${AP}`, "i") },
  { nom: "ad hoc", sens: "D", regime: "JUGEMENT", gate: false, motif: /\bad hoc\b/i },
  { nom: "ponctuellement", sens: "D", regime: "JUGEMENT", gate: false, motif: /\bponctuel(?:le)?(?:ment)?\b/i },
  { nom: "par un ingenieur", sens: "D", regime: "JUGEMENT", gate: false, motif: /\bpar un (?:ingénieur|opérateur|administrateur)\b/i },
  { nom: "tableur", sens: "D", regime: "JUGEMENT", gate: false, motif: /\b(?:tableur|feuille de calcul)\b/i },
  { nom: "sans verifier", sens: "D", regime: "JUGEMENT", gate: false, motif: /\bsans vérifier\b/i },
  { nom: "un a un", sens: "D", regime: "JUGEMENT", gate: false, motif: /\b(?:une? à une?|un par un|compte par compte)\b/i },
  { nom: "script maison", sens: "D", regime: "JUGEMENT", gate: false, motif: /\bscript maison\b/i },
];

// Vue historique, conservee pour la CLI `node lex_leak.mjs <vendor> <cert>`
// documentee dans docs/editorial/README.md. Elle ne connait pas le sens : elle
// ne mesure que « exclusif aux distracteurs », comme a l'origine.
const FAMILLES = FAMILLES_CLASSEES.map((f) => [f.nom, f.motif]);

// Seuil de declenchement, en NOMBRE DE QUESTIONS, pour qu'une exclusivite
// compte comme une fuite.
//
// Pourquoi 3 dans les deux sens, alors que la significativite par corpus est
// asymetrique : une occurrence isolee a 3 chances sur 4 de tomber dans un
// distracteur, donc il faut k>=11 pour que « exclusif aux distracteurs »
// surprenne a lui seul (0.75^11 = 0.042), contre k>=3 dans l'autre sens
// (0.25^3 = 0.016). Appliquer k>=11 ici rendrait le gate VIDE — exactement le
// defaut mesure sur le garde d'origine, vert parce que le mot avait disparu et
// non parce qu'il etait reparti. La significativite collective est deja etablie
// (17 corpus rouges contre 6.3 attendus, p=0.000) ; ce seuil-ci ne sert donc
// qu'a ecarter le cas non exploitable : sous 3 questions, « ecarte l'option qui
// dit manuel » ne se joue pas de tete.
export const SEUIL_QUESTIONS = 3;

function normalise(mot) {
  return mot.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function tokens(texte) {
  return new Set(
    (normalise(texte).match(/[a-z0-9]+/g) ?? []).filter((t) => t.length >= 5)
  );
}

export function charger(vendor, cert) {
  return chargerCorpus(".", { id: `${vendor}:${cert}`, disposition: "imbrique", vendor, cert });
}

// --- Enumeration et lecture generiques ------------------------------------
//
// Le depot porte DEUX dispositions, et la seconde a ete invisible longtemps :
//
//   imbrique   content/public/questions/<vendor>/<cert>/*.json
//   a plat     content/public/questions/<prefixe>-*.json      (146 questions
//              Azure, schemaVersion v2, jamais touchees par une campagne)
//
// Elles avaient ete manquees parce qu'un releve filtrait les repertoires : un
// filtre de TYPE ecarte en silence ce qui n'a pas la forme attendue, et rend un
// zero indiscernable d'une absence. On enumere donc les entrees sans filtre de
// type et on branche sur ce qu'on trouve.
function estRepertoire(p) {
  return fs.statSync(p).isDirectory();
}

export function enumererCorpus(racine) {
  const base = path.join(racine, "content", "public", "questions");
  const corpus = [];
  const platParPrefixe = new Map();

  for (const entree of fs.readdirSync(base).sort()) {
    const complet = path.join(base, entree);
    if (estRepertoire(complet)) {
      for (const cert of fs.readdirSync(complet).sort()) {
        if (!estRepertoire(path.join(complet, cert))) continue;
        corpus.push({
          id: `${entree}:${cert}`,
          disposition: "imbrique",
          vendor: entree,
          cert,
        });
      }
      continue;
    }
    if (!entree.endsWith(".json")) continue;
    const prefixe = entree.split("-")[0];
    if (!platParPrefixe.has(prefixe)) platParPrefixe.set(prefixe, []);
    platParPrefixe.get(prefixe).push(entree);
  }

  for (const [prefixe, fichiers] of [...platParPrefixe].sort()) {
    corpus.push({
      id: `azure:${prefixe}`,
      disposition: "plat",
      prefixe,
      fichiers: fichiers.sort(),
    });
  }
  return corpus.sort((a, b) => a.id.localeCompare(b.id));
}

export function chargerCorpus(racine, corpus) {
  const racinePub = path.join(racine, "content", "public", "questions");
  const racineKey = path.join(racine, "content", "answerKey", "solutions");
  let entrees;
  if (corpus.disposition === "imbrique") {
    const dir = path.join(racinePub, corpus.vendor, corpus.cert);
    entrees = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .sort()
      .map((f) => ({
        nom: f,
        pub: path.join(dir, f),
        key: path.join(racineKey, corpus.vendor, corpus.cert, f),
      }));
  } else {
    entrees = corpus.fichiers.map((f) => ({
      nom: f,
      pub: path.join(racinePub, f),
      key: path.join(racineKey, f),
    }));
  }

  const out = [];
  for (const e of entrees) {
    const q = JSON.parse(fs.readFileSync(e.pub, "utf8"));
    if (!Array.isArray(q.choices)) continue;
    const s = JSON.parse(fs.readFileSync(e.key, "utf8"));
    const choix = q.choices.map((c) => (typeof c === "string" ? c : c.text));
    const i = choix.indexOf(s.correct);
    if (i < 0) throw new Error(`${e.nom}: reponse correcte introuvable parmi les choix`);
    out.push({
      fichier: e.nom,
      id: q.id ?? e.nom,
      // `choix` et `index` conservent la FORME de la question (ordre des
      // options, position de la bonne reponse). La fuite lexicale ne s'en sert
      // pas, mais les axes position / rang de longueur ne peuvent pas etre
      // mesures sans eux — et tools/audit_answer_leak.mjs portait son propre
      // chargeur, cable sur la seule disposition imbriquee, donc aveugle aux
      // 146 questions Azure a plat. Un seul chargeur, deux dispositions.
      choix,
      index: i,
      bonne: choix[i],
      distracteurs: choix.filter((_, j) => j !== i),
    });
  }
  if (out.length === 0) {
    // Un zero de lecture doit crier. Sans ce refus, un chemin faux rend
    // « aucune fuite » et le garde devient un vert qui ne mesure rien.
    throw new Error(`${corpus.id}: 0 question lue — refus de rendre une mesure vide`);
  }
  return out;
}

// Compte, PAR QUESTION et dans les deux sens, les familles classees.
// Une locution repetee trois fois dans un meme distracteur reste une seule
// question exploitable : on compte donc la question, pas l'occurrence.
export function mesurerFamilles(paires) {
  const compte = {};
  for (const f of FAMILLES_CLASSEES) compte[f.nom] = { C: 0, D: 0 };
  for (const p of paires) {
    for (const f of FAMILLES_CLASSEES) {
      if (f.motif.test(p.bonne)) compte[f.nom].C += 1;
      if (p.distracteurs.some((d) => f.motif.test(d))) compte[f.nom].D += 1;
    }
  }
  return compte;
}

// Ampleur de la fuite pour une famille, dans SON sens. Zero = pas de fuite.
// Le sens compte : une famille presente des deux cotes ne fuit dans aucun,
// meme si elle est desequilibree — c'est le desequilibre TOTAL qui fournit une
// regle executable sans lire la question.
export function ampleurFuite(compte, famille, seuil = SEUIL_QUESTIONS) {
  const { C, D } = compte;
  if (famille.sens === "D") {
    return C === 0 && D >= seuil ? D : 0;
  }
  return D === 0 && C >= seuil ? C : 0;
}

// Releve complet d'une racine de contenu : toutes dispositions, tous corpus.
// Rend `{ corpus, nbCorpus, nbQuestions }` — la meme structure que la reference
// figee, pour que le releve du jour et la reference soient comparables sans
// conversion intermediaire.
export function releverRacine(racine) {
  const liste = enumererCorpus(racine);
  const corpus = {};
  let nbQuestions = 0;
  for (const c of liste) {
    const paires = chargerCorpus(racine, c);
    nbQuestions += paires.length;
    const compte = mesurerFamilles(paires);
    const familles = {};
    for (const f of FAMILLES_CLASSEES) {
      const { C, D } = compte[f.nom];
      // Une famille absente des deux cotes n'a rien a figer, et l'omettre garde
      // la reference lisible a la revue.
      if (C === 0 && D === 0) continue;
      familles[f.nom] = { C, D, ampleur: ampleurFuite({ C, D }, f) };
    }
    corpus[c.id] = { questions: paires.length, familles };
  }
  return { corpus, nbCorpus: liste.length, nbQuestions };
}

// Compare un releve a la reference figee et rend une STRUCTURE, pas un verdict.
// La decision d'echouer appartient au test ; cette fonction se contente de
// classer, ce qui la rend testable dans les deux sens avec des entrees
// synthetiques — un comparateur qu'on n'a vu que rendre « rien a signaler » ne
// prouve rien quand il rend « rien a signaler » sur le depot.
export function comparer(reference, releve) {
  const regressions = [];
  const ameliorations = [];
  const corpusInconnus = [];
  const gatees = new Map(FAMILLES_CLASSEES.filter((f) => f.gate).map((f) => [f.nom, f]));

  for (const [idCorpus, actuel] of Object.entries(releve)) {
    const ref = reference[idCorpus];
    if (!ref) {
      // Un corpus neuf n'a pas de reference : on ne peut pas dire s'il empire.
      // Il doit etre fige explicitement, sinon il entrerait dans le depot en
      // echappant au garde — la faille meme qu'on repare ici.
      corpusInconnus.push(idCorpus);
      continue;
    }
    for (const [nom, famille] of gatees) {
      const av = ref.familles?.[nom]?.ampleur ?? 0;
      const ap = actuel.familles?.[nom]?.ampleur ?? 0;
      if (ap > av) regressions.push({ corpus: idCorpus, famille: nom, sens: famille.sens, avant: av, apres: ap });
      else if (ap < av) ameliorations.push({ corpus: idCorpus, famille: nom, avant: av, apres: ap });
    }
  }
  return { regressions, ameliorations, corpusInconnus };
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
