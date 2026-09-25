// Regles croisees question <-> corrige des exercices v5 (X1 a X9).
//
// Source : contrat v5 de Certigo, docs/contracts/exercise-items/v5/README.md, section 5,
// a la revision 6562c293852592f727d7b61e2d792070752a67cf. Le schema ne voit qu'un fichier a
// la fois ; ces regles lient la question publique et son corrige. Elles s'appliquent ici
// dans le validateur (sources) et dans le packager (artefacts construits), puis une seconde
// fois a l'import par le ContentContractVerifier du backend.
//
// X8 et X9 remplacent la publication « triee par id » de la premiere version d'ADR-022 :
// rien ne reordonne les options a la publication, et c'est a l'auteur de publier un ordre
// qui ne donne pas la reponse.

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export const V5 = "v5";

export const V5_ITEM_TYPES = Object.freeze([
  "mcq",
  "multi",
  "scenario",
  "spotTheIssue",
  "ordering",
  "applied",
  "cloze",
  "matchPairs",
]);

// Meme marqueur que le client (answer_grading.dart) : un trou est une suite d'au moins
// quatre soulignes, et chaque suite maximale compte pour un seul trou.
export const CLOZE_BLANK_PATTERN = /_{4,}/g;
export const CLOZE_MAX_BLANKS = 6;

export function isV5(payload) {
  return payload?.schemaVersion === V5;
}

export function clozeBlankCount(prompt) {
  return typeof prompt === "string" ? (prompt.match(CLOZE_BLANK_PATTERN) ?? []).length : 0;
}

function idsOf(list) {
  return Array.isArray(list)
    ? list.map((entry) => (entry !== null && typeof entry === "object" ? entry.id : undefined))
    : [];
}

function duplicates(values) {
  const seen = new Set();
  const repeated = new Set();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated];
}

function sameSequence(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function violation(rule, message) {
  return { rule, message };
}

// Regles qui ne dependent que de la question publique : X2, et les moities de X6 et X7
// qui portent sur la question seule (nombre de trous, cardinal des deux colonnes).
export function v5QuestionViolations(question) {
  const found = [];
  const optionIds = idsOf(question?.options);
  const matchIds = idsOf(question?.matches);

  const repeatedOptions = duplicates(optionIds);
  if (repeatedOptions.length > 0) {
    found.push(violation("X2", `ids d'options dupliques: ${repeatedOptions.join(", ")}`));
  }
  const repeatedMatches = duplicates(matchIds);
  if (repeatedMatches.length > 0) {
    found.push(violation("X2", `ids de matches dupliques: ${repeatedMatches.join(", ")}`));
  }
  const shared = [...new Set(optionIds)].filter((id) => matchIds.includes(id));
  if (shared.length > 0) {
    found.push(violation("X2", `ids communs a options et matches: ${shared.join(", ")}`));
  }

  if (question?.itemType === "cloze") {
    const blanks = clozeBlankCount(question.prompt);
    if (blanks < 1 || blanks > CLOZE_MAX_BLANKS) {
      found.push(
        violation("X6", `${blanks} trou(s) dans le prompt, attendu entre 1 et ${CLOZE_MAX_BLANKS}`)
      );
    }
    if (optionIds.length < blanks) {
      found.push(
        violation("X6", `banque de ${optionIds.length} mot(s) pour ${blanks} trou(s)`)
      );
    }
  }

  if (question?.itemType === "matchPairs" && optionIds.length !== matchIds.length) {
    found.push(
      violation(
        "X7",
        `options (${optionIds.length}) et matches (${matchIds.length}) n'ont pas le meme cardinal`
      )
    );
  }
  return found;
}

// Regles qui lient la question et son corrige : X1, X3 a X9. Les regles dependent du
// type ; si les deux fichiers ne s'accordent pas sur le type (X1), les autres ne sont pas
// evaluees, parce que la semantique de correctOptionIds n'est alors pas definie.
export function v5PairViolations(question, solution) {
  const itemType = question?.itemType;
  if (solution?.itemType !== itemType) {
    return [
      violation(
        "X1",
        `itemType du corrige "${solution?.itemType}" different de celui de la question "${itemType}"`
      ),
    ];
  }

  const found = [];
  const optionIds = idsOf(question?.options);
  const matchIds = idsOf(question?.matches);
  const optionSet = new Set(optionIds);
  const correct = Array.isArray(solution?.correctOptionIds) ? solution.correctOptionIds : [];

  if (itemType !== "matchPairs") {
    const unknown = correct.filter((id) => !optionSet.has(id));
    if (unknown.length > 0) {
      found.push(violation("X3", `ids absents des options: ${unknown.join(", ")}`));
    }
  }

  if (itemType === "ordering") {
    const isPermutation =
      correct.length === optionIds.length &&
      new Set(correct).size === correct.length &&
      optionIds.every((id) => correct.includes(id));
    if (!isPermutation) {
      found.push(
        violation("X4", "correctOptionIds doit etre une permutation de toutes les options")
      );
    }
  }

  if (itemType === "applied" && (correct.length < 2 || correct.length > optionIds.length)) {
    found.push(
      violation(
        "X5",
        `${correct.length} etape(s) attendue(s), il en faut entre 2 et ${optionIds.length}`
      )
    );
  }

  if (itemType === "cloze") {
    const blanks = clozeBlankCount(question?.prompt);
    if (correct.length !== blanks) {
      found.push(violation("X6", `${correct.length} reponse(s) pour ${blanks} trou(s)`));
    }
  }

  if (itemType === "matchPairs") {
    const matchSet = new Set(matchIds);
    const lefts = [];
    const rights = [];
    for (const token of correct) {
      const separator = typeof token === "string" ? token.indexOf(":") : -1;
      if (separator <= 0 || separator === token.length - 1) {
        found.push(violation("X7", `jeton "${token}" hors format "gauche:droite"`));
        continue;
      }
      const left = token.slice(0, separator);
      const right = token.slice(separator + 1);
      if (!optionSet.has(left)) found.push(violation("X7", `jeton "${token}": "${left}" absent des options`));
      if (!matchSet.has(right)) found.push(violation("X7", `jeton "${token}": "${right}" absent des matches`));
      lefts.push(left);
      rights.push(right);
    }
    const repeatedLefts = duplicates(lefts);
    const repeatedRights = duplicates(rights);
    if (repeatedLefts.length > 0 || repeatedRights.length > 0) {
      found.push(
        violation(
          "X7",
          `association non bijective: ${[...repeatedLefts, ...repeatedRights].join(", ")} apparait plusieurs fois`
        )
      );
    }
    if (correct.length !== optionIds.length) {
      found.push(
        violation("X7", `${correct.length} jeton(s) pour ${optionIds.length} option(s) de gauche`)
      );
    }
    const aligned =
      optionIds.length > 0 &&
      optionIds.every((left, index) => correct.includes(`${left}:${matchIds[index]}`));
    if (aligned) {
      found.push(
        violation("X9", "l'ordre publie donne les paires : chaque option est face a son match")
      );
    }
  }

  if (itemType === "ordering" || itemType === "applied") {
    // Une suite d'un seul element n'a pas d'ordre a trahir ; ce cas est deja refuse
    // par le schema et par X4 ou X5.
    const cited = new Set(correct);
    const publishedOrder = optionIds.filter((id) => cited.has(id));
    if (correct.length >= 2 && sameSequence(publishedOrder, correct)) {
      found.push(
        violation("X8", "l'ordre publie des options donne la reponse attendue")
      );
    }
  }
  return found;
}

export function v5Violations(question, solution) {
  return [...v5QuestionViolations(question), ...v5PairViolations(question, solution)];
}

// ---------------------------------------------------------------------------------------
// Gardes provisoires de publication. Elles ne font pas partie du contrat v5 : elles
// refusent a la publication des items conformes au contrat que l'app ne sait pas encore
// faire reussir. Chacune se leve par un reglage de EXERCISE_GUARDS_PATH, documente dans le
// fichier lui-meme, et un fichier ou un reglage absent laisse la garde ACTIVE.
// ---------------------------------------------------------------------------------------

export const EXERCISE_GUARDS_PATH = "config/exercise-publication-guards.json";
export const EXERCISE_GUARDS_SCHEMA = "certigo.exercise-publication-guards/v1";
export const APPLIED_DISTRACTOR_GUARD = "garde-applied";

export const DEFAULT_EXERCISE_GUARDS = Object.freeze({ allowAppliedDistractors: false });

export function loadExerciseGuards(root) {
  const path = resolve(root, EXERCISE_GUARDS_PATH);
  if (!existsSync(path)) return DEFAULT_EXERCISE_GUARDS;
  const raw = readFileSync(path, "utf8");
  const document = JSON.parse(raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw);
  if (document?.schema !== EXERCISE_GUARDS_SCHEMA) {
    throw new Error(`${EXERCISE_GUARDS_PATH}: schema attendu ${EXERCISE_GUARDS_SCHEMA}`);
  }
  const allow = document.allowAppliedDistractors;
  if (allow !== undefined && typeof allow !== "boolean") {
    throw new Error(`${EXERCISE_GUARDS_PATH}: allowAppliedDistractors doit etre un booleen`);
  }
  return Object.freeze({ allowAppliedDistractors: allow === true });
}

// Les options d'un applied absentes du corrige sont ses distracteurs (X5 les permet).
export function appliedDistractorIds(question, solution) {
  if (question?.itemType !== "applied") return [];
  const cited = new Set(Array.isArray(solution?.correctOptionIds) ? solution.correctOptionIds : []);
  return idsOf(question.options).filter((id) => !cited.has(id));
}

// Tant que allowAppliedDistractors vaut false, un applied avec distracteurs est refuse :
// l'app ne permet de valider qu'une fois toutes les options placees, l'item serait
// impossible a reussir. Meme regle que APPLIED_DISTRACTORS_NOT_YET_SUPPORTED cote Certigo ;
// ses trois conditions de levee sont recopiees dans EXERCISE_GUARDS_PATH.
export function v5PublicationGuardViolations(question, solution, guards = DEFAULT_EXERCISE_GUARDS) {
  if (guards.allowAppliedDistractors === true) return [];
  const distractors = appliedDistractorIds(question, solution);
  if (distractors.length === 0) return [];
  return [
    violation(
      APPLIED_DISTRACTOR_GUARD,
      `item applied avec distracteur(s) ${distractors.join(", ")} refuse a la publication : ` +
        "l'app ne permet de valider qu'une fois toutes les options placees (meme garde que " +
        "APPLIED_DISTRACTORS_NOT_YET_SUPPORTED cote Certigo). Garde levee par " +
        `allowAppliedDistractors dans ${EXERCISE_GUARDS_PATH}, aux conditions qu'il documente`
    ),
  ];
}
