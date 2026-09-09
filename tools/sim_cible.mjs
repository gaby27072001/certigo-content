// Aide a la reecriture ciblee : pour chaque question ou la bonne reponse est
// l'INTRUS (similarite minimale stricte aux trois autres), montre le budget de
// longueur disponible et le vocabulaire que les distracteurs partagent sans
// elle.
//
// POURQUOI UN BUDGET, ET PAS UNE SIMPLE ADDITION. Les rangs de longueur de ce
// corpus sont gardes a 5/5/5/5 par validate_content.mjs, et le ratio
// longueur(correcte)/moyenne(distracteurs) doit rester dans 0.85-1.15. Ajouter
// des mots a la bonne reponse la ferait monter en rang et casserait le garde
// qu'une campagne precedente a mis six PR a satisfaire. La reecriture doit donc
// SUBSTITUER a longueur quasi constante, pas ajouter.
//
// Le budget affiche est l'intervalle de longueurs qui laisse la bonne reponse
// dans son rang actuel et le ratio dans la bande. En sortir casse un autre axe.
//
// Usage : node tools/sim_cible.mjs <vendor> <cert>

import { chargerCorpus, enumererCorpus } from "./lex_leak.mjs";
import { profil } from "./sim_leak.mjs";

const [vendor, cert] = process.argv.slice(2);
if (!vendor || !cert) {
  console.error("Usage: node tools/sim_cible.mjs <vendor> <cert>");
  process.exit(2);
}

const corpus = enumererCorpus(".").find((c) => c.id === `${vendor}:${cert}`);
if (!corpus) throw new Error(`[sim_cible] corpus inconnu : ${vendor}:${cert}`);
const paires = chargerCorpus(".", corpus);
if (paires.length === 0) throw new Error("[sim_cible] 0 question lue");

const RATIO_BAS = 0.85;
const RATIO_HAUT = 1.15;

function jetons(texte) {
  return new Set(
    (texte
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .match(/[a-z0-9]+/g) ?? []
    ).filter((t) => t.length >= 4)
  );
}

let cibles = 0;
for (const p of paires) {
  const pr = profil(p.choix);
  const estIntrus = pr.gagnants.length === 1 && pr.gagnants[0] === p.index;
  if (!estIntrus) continue;
  cibles += 1;

  const L = p.choix.map((c) => c.length);
  const correcte = L[p.index];
  const autres = L.filter((_, i) => i !== p.index);
  const rang = L.filter((v) => v < correcte).length;

  // Bornes de longueur qui preservent le rang : strictement au-dessus de la
  // plus grande longueur inferieure, strictement en dessous de la plus petite
  // superieure.
  const inf = autres.filter((v) => v < correcte);
  const sup = autres.filter((v) => v > correcte);
  const bMin = inf.length ? Math.max(...inf) + 1 : 1;
  const bMax = sup.length ? Math.min(...sup) - 1 : Infinity;

  const moy = autres.reduce((a, b) => a + b, 0) / autres.length;
  const rMin = Math.ceil(RATIO_BAS * moy);
  const rMax = Math.floor(RATIO_HAUT * moy);

  const bas = Math.max(bMin, rMin);
  const haut = Math.min(bMax, rMax);

  // Vocabulaire porte par au moins DEUX distracteurs et absent de la bonne
  // reponse : c'est lui qui isole la bonne reponse.
  const jCorrecte = jetons(p.choix[p.index]);
  const compte = new Map();
  p.choix.forEach((c, i) => {
    if (i === p.index) return;
    for (const t of jetons(c)) compte.set(t, (compte.get(t) ?? 0) + 1);
  });
  const partages = [...compte.entries()]
    .filter(([t, n]) => n >= 2 && !jCorrecte.has(t))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([t, n]) => `${t}(${n})`);

  console.log(`\n=== ${p.fichier}`);
  console.log(
    `    sim bonne=${pr.sim[p.index].toFixed(3)}  autres=${pr.sim
      .filter((_, i) => i !== p.index)
      .map((v) => v.toFixed(3))
      .join("/")}  marge=${pr.marge.toFixed(3)}`
  );
  console.log(
    `    longueur=${correcte}  rang=${rang}  BUDGET=[${bas}..${haut === Infinity ? "inf" : haut}]  ` +
      `(rang impose [${bMin}..${bMax === Infinity ? "inf" : bMax}], ratio impose [${rMin}..${rMax}])`
  );
  console.log(`    BONNE : ${p.choix[p.index]}`);
  console.log(`    mots partages par >=2 distracteurs et absents : ${partages.slice(0, 14).join(" ")}`);
}

console.log(
  `\n${cibles}/${paires.length} question(s) ou la bonne reponse est l'intrus strict.`
);
