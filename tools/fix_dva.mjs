// Reecriture ciblee de aws:dva-c02 sur l'axe de similarite.
//
// PRINCIPE. La bonne reponse nommait la solution sans redire le probleme ; les
// trois distracteurs, eux, reformulaient l'enonce. La bonne reponse etait donc
// l'intrus, et « prends celle qui detonne » gagnait sans lecture. Chaque
// reecriture REINTRODUIT dans la bonne reponse le vocabulaire de l'enonce que
// les distracteurs portent deja.
//
// PAR SUBSTITUTION, PAS PAR AJOUT. Les rangs de longueur de ce corpus sont
// gardes a 5/5/5/5 et le ratio doit rester dans [0.85, 1.15] : allonger la
// bonne reponse la ferait monter en rang et casserait l'axe repare par #78. On
// echange donc des mots propres a la bonne reponse contre des mots partages, a
// longueur quasi constante. Un mot unique remplace par un mot partage fait
// -1 sur l'union et +1 sur l'intersection : c'est l'edition la plus efficace a
// longueur egale.
//
// Les distracteurs ne sont PAS touches : les toucher rouvrirait l'axe des rangs.
//
// LA CIBLE EST 0.250, PAS ZERO. Corriger les DOUZE questions concernees fait
// tomber le taux a 0.000 — mesure. Ce n'est pas une reussite : si la bonne
// reponse n'est JAMAIS l'intrus, la regle inverse « ecarte l'option qui detonne
// et choisis au hasard parmi les trois autres » rend 1/3 = 0.333, au-dessus du
// nul. On aurait remplace une fuite par sa symetrique, un peu plus faible.
//
// On n'en corrige donc que SEPT, en laissant les cinq dont la MARGE de
// similarite est la plus faible : a marge 0.014, l'ecart entre la bonne reponse
// et la suivante n'est pas une difference qu'un humain percoit — la question
// n'est pas exploitable, et la retoucher ne gagnerait rien tout en depeuplant
// la classe. Cinq sur vingt place les deux strategies, directe et inverse, a
// 0.250 exactement.
//
// Usage : node tools/fix_dva.mjs [--ecrire]

import fs from "node:fs";
import path from "node:path";

const PUB = path.join("content", "public", "questions", "aws", "dva-c02");
const KEY = path.join("content", "answerKey", "solutions", "aws", "dva-c02");

// Les cinq questions volontairement NON corrigees, avec leur marge d'origine.
// Elles restent « intrus » et maintiennent le taux au nul.
export const LAISSEES = {
  "ajustement-seuils-sans-redeploiement.016": 0.014,
  "application-creee-a-la-main-a-reproduire.013": 0.017,
  "exposition-progressive-nouvelle-version.014": 0.03,
  "journaux-contenant-donnees-clients.011": 0.034,
  "publication-metriques-ralentit-invocations.019": 0.035,
};

const REECRITURES = {
  "appels-perdus-lors-des-pics.001":
    "Configurer la stratégie de nouvelles tentatives du SDK (mode standard ou adaptatif) pour que le microservice écrit en Python réessaie l'exception de limitation de débit avec un retrait exponentiel et de la gigue, et rendre l'écriture idempotente afin que l'opération métier ne soit pas perdue.",

  "latence-percentile-eleve-api-interne.004":
    "Déplacer l'initialisation du client du SDK AWS et de la connexion à la base de données hors du gestionnaire, afin que l'environnement d'exécution les réutilise d'un appel à l'autre, puis augmenter la mémoire allouée à la fonction et mesurer le rapport coût/latence par paliers.",

  "authentification-utilisateurs-application-mobile.007":
    "Authentifier les utilisateurs de l'application mobile auprès d'un groupe d'utilisateurs Amazon Cognito, transmettre le jeton JWT à l'API REST Amazon API Gateway et le valider par un autorisateur Cognito, la fonction lisant les revendications afin de restreindre chaque utilisateur à ses propres données.",

  "cle-partenaire-lisible-par-operateur.009":
    "Placer la clé d'API du partenaire externe dans une variable d'environnement chiffrée par une clé KMS gérée par le client, la déchiffrer dans le code à l'initialisation, et n'accorder `kms:Decrypt` qu'au rôle d'exécution de la fonction Lambda, et non à l'opérateur.",

  "journaux-contenant-donnees-clients.011":
    "Appliquer dans le service de paiement une journalisation à liste d'autorisation de champs, afin que le numéro de carte et les coordonnées du client n'entrent jamais dans les journaux : seules des valeurs tronquées ou hachées y subsistent.",

  "ajustement-seuils-sans-redeploiement.016":
    "Externaliser les seuils métier et les indicateurs de fonctionnalité dans AWS AppConfig, avec un validateur assurant la validation préalable des valeurs, un déploiement progressif et une annulation automatique sur alarme CloudWatch, sans redéployer les fonctions de l'application à chaque changement.",

  "application-creee-a-la-main-a-reproduire.013":
    "Décrire dans un modèle AWS SAM versionné l'API Amazon API Gateway et les fonctions Lambda créées dans la console, puis déployer la même pile en développement, en recette et en production avec des valeurs propres à chacun (`sam deploy --config-env`) et un pipeline promouvant le même artefact.",

  "bibliotheque-commune-alourdit-huit-fonctions.012":
    "Extraire la bibliothèque volumineuse de traitement d'images dans une couche Lambda versionnée et partagée par les huit fonctions, afin que chaque archive .zip repasse sous la limite de taille décompressée, et publier dans Amazon ECR une image de conteneur pour la dépendance native à compiler.",

  "exposition-progressive-nouvelle-version.014":
    "Publier une nouvelle version de la fonction AWS Lambda de production et pondérer l'alias `prod` pour lui envoyer 10 % du trafic pendant dix minutes, puis la totalité, avec `AutoPublishAlias` et une préférence de déploiement Canary10Percent10Minutes dans AWS SAM.",

  "regression-detectee-le-lendemain.015":
    "Associer au groupe de déploiement CodeDeploy des alarmes CloudWatch sur le taux d'erreur et la latence de l'alias, et activer le retour arrière automatique dès la phase canari, en cas d'alarme ou d'échec d'un hook, afin que le trafic revienne sur la version précédente sans attendre l'équipe.",

  "publication-metriques-ralentit-invocations.019":
    "Émettre les six métriques métier au format de métriques intégré (EMF) dans les journaux de la fonction Lambda, une ligne structurée par invocation, supprimant les appels PutMetricData synchrones et réduisant la durée d'exécution et la facture de surveillance.",

  "recherche-erreurs-par-identifiant-correlation.018":
    "Exécuter pendant l'incident une requête CloudWatch Logs Insights sur le groupe de journaux, qui filtre l'identifiant de corrélation et regroupe les erreurs par code : `fields @timestamp | filter correlationId = '...' and level = 'ERROR' | stats count() by errorCode`.",
};

function normaliser(t) {
  return (
    t
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .match(/[a-z0-9]+/g) ?? []
  );
}

function jaccard(a, b) {
  const A = new Set(a);
  const B = new Set(b);
  if (!A.size && !B.size) return 1;
  let i = 0;
  for (const x of A) if (B.has(x)) i += 1;
  return i / (A.size + B.size - i);
}

function simDe(choix) {
  const j = choix.map(normaliser);
  return choix.map((_, i) =>
    Math.max(...choix.map((__, k) => (k === i ? -1 : jaccard(j[i], j[k]))))
  );
}

const ecrire = process.argv.includes("--ecrire");
const fichiers = fs.readdirSync(PUB).filter((f) => f.endsWith(".json")).sort();
if (fichiers.length !== 20) {
  throw new Error(`[fix_dva] ${fichiers.length} fichiers lus, 20 attendus`);
}

let touchees = 0;
let refus = 0;
for (const f of fichiers) {
  const cle = Object.keys(REECRITURES).find((k) => f.includes(k));
  if (!cle) continue;
  if (Object.keys(LAISSEES).some((k) => f.includes(k))) {
    console.log(`${cle.padEnd(50)} LAISSEE — marge ${LAISSEES[cle]} trop faible pour etre exploitable`);
    continue;
  }
  const pubPath = path.join(PUB, f);
  const keyPath = path.join(KEY, f);
  const q = JSON.parse(fs.readFileSync(pubPath, "utf8"));
  const s = JSON.parse(fs.readFileSync(keyPath, "utf8"));
  const i = q.choices.indexOf(s.correct);
  if (i < 0) throw new Error(`[fix_dva] ${f} : bonne reponse introuvable`);

  const avantChoix = q.choices.slice();
  const apresChoix = q.choices.slice();
  apresChoix[i] = REECRITURES[cle];

  const La = avantChoix.map((c) => c.length);
  const Lb = apresChoix.map((c) => c.length);
  const rangA = La.filter((v) => v < La[i]).length;
  const rangB = Lb.filter((v) => v < Lb[i]).length;
  const autresB = Lb.filter((_, k) => k !== i);
  const ratioB = Lb[i] / (autresB.reduce((a, b) => a + b, 0) / autresB.length);
  const distinctB = new Set(Lb).size === Lb.length;
  const sa = simDe(avantChoix);
  const sb = simDe(apresChoix);
  const intrusAvant = sa[i] === Math.min(...sa);
  const intrusApres = sb[i] === Math.min(...sb);

  const problemes = [];
  if (rangB !== rangA) problemes.push(`rang ${rangA} -> ${rangB}`);
  if (!distinctB) problemes.push("longueurs non distinctes");
  if (ratioB < 0.85 || ratioB > 1.15) problemes.push(`ratio ${ratioB.toFixed(3)}`);
  if (intrusApres) problemes.push("toujours l'intrus");

  const etat = problemes.length ? `REFUS: ${problemes.join(", ")}` : "ok";
  if (problemes.length) refus += 1;
  console.log(
    `${cle.padEnd(50)} len ${La[i]}->${Lb[i]}  rang ${rangA}->${rangB}  ` +
      `ratio ${ratioB.toFixed(3)}  sim ${sa[i].toFixed(3)}->${sb[i].toFixed(3)} ` +
      `(min autres ${Math.min(...sb.filter((_, k) => k !== i)).toFixed(3)})  ` +
      `intrus ${intrusAvant ? "oui" : "non"}->${intrusApres ? "OUI" : "non"}  ${etat}`
  );

  if (ecrire && problemes.length === 0) {
    q.choices = apresChoix;
    s.correct = apresChoix[i];
    fs.writeFileSync(pubPath, `${JSON.stringify(q, null, 2)}\n`, "utf8");
    fs.writeFileSync(keyPath, `${JSON.stringify(s, null, 2)}\n`, "utf8");
    touchees += 1;
  }
}

console.log(
  `\n${Object.keys(REECRITURES).length} reecriture(s) proposee(s), ${refus} refusee(s)` +
    (ecrire ? `, ${touchees} ecrite(s).` : " — essai a blanc, rien ecrit.")
);
if (refus > 0) process.exit(1);
