#!/usr/bin/env node
// Deterministic migrator: Microsoft legacy v2 questions -> v3.
//
// Six Microsoft corpora (ai-900, ai-901, az-104, az-900, dp-900, sc-900, 146
// pairs) lived flat in content/public/questions/ as schemaVersion v2. A v2
// payload carries NO metadata, so nothing in the file tied a question to a
// certification: the link lived in a hard-coded id prefix
// (tools/lib/schema_adapter.mjs classifyV2Question). This tool does not invent
// that link, it MOVES it from code into data — the certification it writes is
// the one classifyV2Question already derived.
//
// Consequence, and the reason this migration matters: the editorial guards in
// tools/validate_content.mjs only feed answerLengthsByCertification from the
// v3 branch. For a v2 corpus the list stayed empty, the control loop iterated
// zero times, and all six passed the length, rank and position guards without
// a byte being read. Migrating makes them visible.
//
// Transformation rules — FORMAT AND METADATA ONLY. No question is remediated,
// no prompt, choice, correct answer or rationale is edited:
//   id       <- <provider>.<slug>.<objective>.<conceptSlug>.001
//   metadata <- { provider, certification, blueprintVersion, objective }
//   path     <- content/{public/questions,answerKey/solutions}/microsoft/<slug>/<id>.json
//
// Nothing is invented:
//   - certification : classifyV2Question, the existing hard-coded prefix map
//   - objective     : every Microsoft blueprint has exactly ONE objective
//                     (section-1), so the assignment is determined, not judged
//   - conceptSlug   : the value conceptIdFromQuestionId ALREADY derives from
//                     the v2 id. Preserving it keeps every runtime concept id
//                     unchanged, so the 903 committed runtime resources stay
//                     byte-identical. The invariant is asserted per question
//                     rather than assumed.
//
// Side effects, both required for the migration to be coherent:
//   - the six Microsoft coverage matrices are rewritten onto the new ids
//   - config/legacy-coverage-inventory.json loses the migrated ids. Its own
//     note requires the list to only ever shrink, and shrink by migration.
//   - with --with-debt, config/editorial-debt.json records the pairs that
//     actually fail a per-question control. Only those: a clean pair stays
//     under an active guard.
//
// Safeguards applied to this tool itself, because an instrument that reports
// zero without having read anything is indistinguishable from a clean corpus:
//   - self-test on synthetic strings BEFORE any file is opened
//   - reading floor: fewer than 30 certifications or 700 questions THROWS
//   - positive control: canonicalize() must reproduce an existing coverage
//     file byte-for-byte before it is trusted to write one
//
// Usage: node tools/migrate_microsoft_v3.mjs [--root <dir>] [--with-debt]

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { argv, cwd } from "node:process";
import { pathToFileURL } from "node:url";

import {
  classifyV2Question,
  conceptIdFromQuestionId,
  slugify,
} from "./lib/schema_adapter.mjs";
import { compareOrdinal } from "./lib/deterministic.mjs";
import { answerLengthMetrics } from "./validate_content.mjs";

const EXPIRES_ON = "2026-11-30";

const V3_ID =
  /^(aws|gcp|microsoft)\.[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+(?:-[a-z0-9]+)*\.[0-9]{3}$/;

function canonicalize(value) {
  if (value === undefined) {
    throw new Error("valeur undefined interdite dans la canonicalisation JSON");
  }
  if (Array.isArray(value)) return "[" + value.map(canonicalize).join(",") + "]";
  if (value !== null && typeof value === "object") {
    const keys = Object.keys(value).sort(compareOrdinal);
    return (
      "{" +
      keys.map((k) => JSON.stringify(k) + ":" + canonicalize(value[k])).join(",") +
      "}"
    );
  }
  return JSON.stringify(value);
}

/** The concept slug conceptIdFromQuestionId already derives from a flat v2 id. */
export function conceptSlugForV2(questionId) {
  const match = questionId.match(/^[a-z0-9]+-l-(.+)-check-\d+$/);
  if (match) return match[1];
  return slugify(questionId);
}

function selfTest() {
  const failures = [];
  const eq = (label, actual, expected) => {
    if (actual !== expected) failures.push(`${label}: ${actual} != ${expected}`);
  };
  eq("slug.check", conceptSlugForV2("ai900-l-ai-workloads-check-1"), "ai-workloads");
  eq("slug.multi", conceptSlugForV2("az104-l-vm-availability-scale-check-1"), "vm-availability-scale");
  eq("slug.fallback", conceptSlugForV2("az104-scenario-2026-01"), "az104-scenario-2026-01");
  eq("canon.order", canonicalize({ b: 1, a: 2 }), '{"a":2,"b":1}');
  eq("canon.nested", canonicalize({ z: [1, { y: "x" }] }), '{"z":[1,{"y":"x"}]}');
  eq("id.accepts", V3_ID.test("microsoft.az-900.section-1.cloud-models.001"), true);
  eq("id.rejects", V3_ID.test("az900-l-cloud-models-check-1"), false);
  if (failures.length > 0) {
    throw new Error(`autotest echoue:\n  ${failures.join("\n  ")}`);
  }
  console.log("autotest : 7 assertions OK");
}

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function writeCanonical(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, canonicalize(value) + "\n", "utf8");
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    // Recursive on purpose: enumerating directories only is exactly what kept
    // the 146 flat Microsoft questions out of sight.
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else if (name.endsWith(".json")) out.push(path);
  }
  return out;
}

export function migrateMicrosoftV3(options = {}) {
  const root = resolve(options.root ?? cwd());
  const withDebt = options.withDebt === true;

  selfTest();

  // Positive control: a serializer that has never matched anything is a guess.
  const probe = join(root, "content/public/coverage/microsoft/az-900.json");
  const onDisk = readFileSync(probe, "utf8").replace(/\r\n/g, "\n");
  if (canonicalize(readJson(probe)) + "\n" !== onDisk) {
    throw new Error(
      "controle positif echoue : canonicalize() ne reproduit pas content/public/coverage/microsoft/az-900.json a l'octet pres"
    );
  }
  console.log("controle positif : canonicalize() reproduit un fichier existant a l'octet pres");

  const catalog = readJson(join(root, "content/public/catalog/certifications.json"));
  const certById = new Map(catalog.certifications.map((item) => [item.id, item]));

  const questionsDir = join(root, "content/public/questions");
  const solutionsDir = join(root, "content/answerKey/solutions");
  const questionFiles = walk(questionsDir);

  if (catalog.certifications.length < 30 || questionFiles.length < 700) {
    throw new Error(
      `plancher de lecture franchi : ${catalog.certifications.length} certifications, ` +
        `${questionFiles.length} questions (attendu >= 30 et >= 700). L'outil n'a pas lu le corpus.`
    );
  }

  const renames = new Map();
  const idsByCertification = new Map();
  const debtByCertification = new Map();

  for (const questionFile of questionFiles.sort(compareOrdinal)) {
    const question = readJson(questionFile);
    if (question.schemaVersion !== "v2") continue;

    const certificationId = classifyV2Question(question.id);
    if (!certificationId) {
      throw new Error(`question v2 non classifiable : ${question.id}`);
    }
    const certification = certById.get(certificationId);
    if (!certification) {
      throw new Error(`certification absente du catalogue : ${certificationId}`);
    }
    const objectives = certification.blueprint.objectives;
    if (objectives.length !== 1) {
      throw new Error(
        `${certificationId}: ${objectives.length} objectifs. L'attribution n'est plus determinee et ne doit pas etre devinee.`
      );
    }
    const objective = objectives[0].id;

    const conceptSlug = conceptSlugForV2(question.id);
    const newId = `${certification.provider}.${certification.slug}.${objective}.${conceptSlug}.001`;
    if (!V3_ID.test(newId)) {
      throw new Error(`${question.id} -> ${newId}: identifiant v3 invalide`);
    }
    if (renames.has(question.id)) {
      throw new Error(`identifiant source duplique : ${question.id}`);
    }
    // Invariant runtime : le concept sur lequel le graphe est indexe ne bouge pas.
    const conceptBefore = conceptIdFromQuestionId(question.id, certificationId);
    const conceptAfter = conceptIdFromQuestionId(newId, certificationId);
    if (conceptBefore !== conceptAfter) {
      throw new Error(
        `${question.id}: derive de conceptId ${conceptBefore} -> ${conceptAfter}`
      );
    }
    renames.set(question.id, newId);

    const solutionFile = join(solutionsDir, `${question.id}.json`);
    if (!existsSync(solutionFile)) {
      throw new Error(`solution answerKey absente pour ${question.id}`);
    }
    const solution = readJson(solutionFile);

    const metadata = {
      provider: certification.provider,
      certification: certificationId,
      blueprintVersion: certification.blueprint.version,
      objective,
    };

    const migratedQuestion = {
      id: newId,
      schemaVersion: "v3",
      kind: "public",
      metadata,
      prompt: question.prompt,
      choices: question.choices,
    };
    const migratedSolution = {
      id: newId,
      schemaVersion: "v3",
      kind: "answerKey",
      metadata,
      correct: solution.correct,
      rationale: solution.rationale,
    };
    // La frontiere de confiance ne depend pas d'une relecture : elle est verifiee.
    for (const forbidden of ["correct", "rationale"]) {
      if (forbidden in migratedQuestion) {
        throw new Error(`${newId}: cle de reponse "${forbidden}" dans le payload public`);
      }
    }

    const relative = `microsoft/${certification.slug}/${newId}.json`;
    writeJson(join(questionsDir, relative), migratedQuestion);
    writeJson(join(solutionsDir, relative), migratedSolution);
    rmSync(questionFile);
    rmSync(solutionFile);

    if (!idsByCertification.has(certificationId)) {
      idsByCertification.set(certificationId, []);
    }
    idsByCertification.get(certificationId).push(newId);

    const metrics = answerLengthMetrics(question.choices, solution.correct);
    if (metrics === null) {
      throw new Error(`${question.id}: la reponse correcte est absente des choix`);
    }
    if (
      metrics.choiceCount !== 4 ||
      !metrics.distinct ||
      metrics.ratio < 0.85 ||
      metrics.ratio > 1.15
    ) {
      if (!debtByCertification.has(certificationId)) {
        debtByCertification.set(certificationId, []);
      }
      debtByCertification.get(certificationId).push(newId);
    }
  }

  console.log(`migration : ${renames.size} paires v2 -> v3`);

  for (const [certificationId, ids] of idsByCertification) {
    const certification = certById.get(certificationId);
    const path = join(
      root,
      `content/public/coverage/microsoft/${certification.slug}.json`
    );
    const matrix = readJson(path);
    let replaced = 0;
    for (const objective of matrix.objectives) {
      objective.questionIds = objective.questionIds
        .map((oldId) => {
          const newId = renames.get(oldId);
          if (!newId) {
            throw new Error(
              `${certificationId}: la matrice reference un identifiant non migre ${oldId}`
            );
          }
          replaced++;
          return newId;
        })
        .sort(compareOrdinal);
    }
    if (replaced !== ids.length) {
      throw new Error(
        `${certificationId}: ${replaced} identifiants remplaces pour ${ids.length} migres`
      );
    }
    writeCanonical(path, matrix);
  }
  console.log(`couverture : ${idsByCertification.size} matrices Microsoft reecrites`);

  const inventoryPath = join(root, "config/legacy-coverage-inventory.json");
  const inventory = readJson(inventoryPath);
  const countIds = (entries) =>
    entries.reduce((total, entry) => total + entry.questionIds.length, 0);
  const before = countIds(inventory.inventories);
  inventory.inventories = inventory.inventories
    .map((entry) => ({
      ...entry,
      questionIds: entry.questionIds.filter((id) => !renames.has(id)),
    }))
    .filter((entry) => entry.questionIds.length > 0);
  const after = countIds(inventory.inventories);
  if (after >= before) {
    throw new Error(`inventaire herite non retreci : ${before} -> ${after}`);
  }
  writeJson(inventoryPath, inventory);
  console.log(`inventaire herite : ${before} -> ${after} identifiants`);

  const debtTotal = [...debtByCertification.values()].reduce(
    (total, ids) => total + ids.length,
    0
  );
  if (withDebt) {
    const debtPath = join(root, "config/editorial-debt.json");
    const ledger = readJson(debtPath);
    const known = new Set(ledger.debts.map((entry) => entry.certification));
    for (const [certificationId, ids] of [...debtByCertification].sort((left, right) =>
      compareOrdinal(left[0], right[0])
    )) {
      if (known.has(certificationId)) {
        throw new Error(`${certificationId} figure deja au registre de dette`);
      }
      ledger.debts.push({
        certification: certificationId,
        expiresOn: EXPIRES_ON,
        questionIds: [...ids].sort(compareOrdinal),
        note:
          "Corpus Microsoft migre de v2 vers v3. La migration rend ces paires " +
          "visibles aux controles editoriaux, qui ne les avaient jamais lues : " +
          "le v2 n'alimentait aucun releve de longueur. Aucune question n'a ete " +
          "modifiee par la migration. Seules les paires qui echouent reellement " +
          "un controle par question sont inscrites ; les paires conformes du meme " +
          "corpus restent sous controle actif. Un identifiant sort d'ici en " +
          "corrigeant la question, pas en repoussant la date.",
      });
    }
    ledger.debts.sort((left, right) =>
      compareOrdinal(left.certification, right.certification)
    );
    writeJson(debtPath, ledger);
    console.log(
      `dette editoriale : ${debtTotal} paires inscrites sur ${debtByCertification.size} certifications (expiresOn ${EXPIRES_ON})`
    );
  } else {
    console.log(`dette editoriale : non ecrite (--with-debt absent), ${debtTotal} paires concernees`);
  }

  return {
    migrated: renames.size,
    certifications: idsByCertification.size,
    debtPairs: debtTotal,
    legacyInventoryBefore: before,
    legacyInventoryAfter: after,
  };
}

function parseArgs(args) {
  const options = { withDebt: false };
  for (let index = 0; index < args.length; index++) {
    if (args[index] === "--with-debt") options.withDebt = true;
    else if (args[index] === "--root") options.root = args[++index];
  }
  return options;
}

const isMain =
  argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(argv[1])).href;

if (isMain) {
  migrateMicrosoftV3(parseArgs(argv.slice(2)));
}
