#!/usr/bin/env node
// Deterministic content migrator for work-package p1-05.
//
// Reads the Certigo monorepo lesson corpus (content/<track>/lessons/*.lesson.yaml)
// and emits the certigo-content v2 question/answerKey pairs for every eligible
// MCQ `check` block:
//   - content/public/questions/<check.id>.json   (public payload, no answer)
//   - content/answerKey/solutions/<check.id>.json (answer material)
//
// Transformation rules (see wp-p1-05 DoD):
//   prompt   <- check.stem
//   choices  <- check.options[].label (labels only, order preserved)
//   correct  <- label of the option whose id is the single check.correct id
//   rationale<- check.explanation
//
// Judgment cases are NEVER invented: they are excluded and reported.
//   - check.type != mcq                    -> excluded (non-mcq)
//   - multi-answer (correct has >= 2 ids)  -> excluded (multi-answer, not
//     representable: solution.correct is a single string)
//   - < 2 options                          -> excluded (choices minItems:2)
//   - duplicate option labels              -> excluded (choices uniqueItems)
//   - correct id absent from options       -> excluded (unresolved correct id)
//   - empty stem / empty explanation       -> excluded (schema minLength:1)
//   - missing check.id                     -> excluded (no id)
//   - duplicate check.id across corpus     -> excluded (id collision)
//   - lesson YAML fails to parse           -> reported (parse error)
//
// The migrator is idempotent: it purges previously generated *.json (including
// the demo-0001 placeholder pair) from both output dirs before writing, so a
// re-run reproduces exactly the same tree.
//
// Usage:
//   node tools/migrate_p1_05.mjs --source "<abs path to Certigo/content>"
//   (or set SOURCE_CONTENT_DIR)
//
// Deps: npm install --no-save yaml glob

import { readFileSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { resolve, relative, basename } from "node:path";
import { cwd, argv, env, exit } from "node:process";
import { parse as parseYaml } from "yaml";
import { glob } from "glob";

const ROOT = cwd();
const PUBLIC_DIR = "content/public/questions";
const ANSWER_DIR = "content/answerKey/solutions";

function getSourceDir() {
  const idx = argv.indexOf("--source");
  if (idx !== -1 && argv[idx + 1]) return resolve(argv[idx + 1]);
  if (env.SOURCE_CONTENT_DIR) return resolve(env.SOURCE_CONTENT_DIR);
  console.error(
    "ERREUR: dossier source manquant. Passez --source <abs path Certigo/content> " +
      "ou definissez SOURCE_CONTENT_DIR."
  );
  exit(2);
}

const SOURCE = getSourceDir();

// --- helpers ---------------------------------------------------------------
const isNonEmptyString = (v) => typeof v === "string" && v.trim().length > 0;
const norm = (s) => String(s).replace(/\s+/g, " ").trim();

/** @type {{id?:string,lesson:string,reason:string}[]} */
const excluded = [];
/** @type {{lesson:string,reason:string}[]} */
const parseErrors = [];

let totalCheckBlocks = 0;
let eligible = 0;

/** id -> {lesson} of already-emitted question, to detect collisions */
const emitted = new Map();
/** files to write: [relPath, jsonString][] */
const toWrite = [];

// --- read lessons ----------------------------------------------------------
const lessonFiles = (
  await glob("*/lessons/*.lesson.yaml", { cwd: SOURCE, posix: true })
).sort();

if (lessonFiles.length === 0) {
  console.error(`ERREUR: aucune lecon trouvee sous ${SOURCE}`);
  exit(2);
}

for (const relFile of lessonFiles) {
  const abs = resolve(SOURCE, relFile);
  let doc;
  try {
    doc = parseYaml(readFileSync(abs, "utf8"));
  } catch (e) {
    parseErrors.push({ lesson: relFile, reason: `YAML illisible: ${e.message}` });
    continue;
  }
  const blocks = Array.isArray(doc?.blocks) ? doc.blocks : [];
  for (const block of blocks) {
    if (!block || block.type !== "check" || !block.check) continue;
    const check = block.check;
    totalCheckBlocks++;

    const id = check.id;
    if (!isNonEmptyString(id)) {
      excluded.push({ lesson: relFile, reason: "check sans id exploitable" });
      continue;
    }

    if (check.type !== "mcq") {
      excluded.push({ id, lesson: relFile, reason: `type non-mcq (${check.type ?? "absent"})` });
      continue;
    }

    const options = Array.isArray(check.options) ? check.options : [];
    const labels = options.map((o) => (o && o.label != null ? String(o.label).trim() : ""));
    if (options.length < 2 || labels.some((l) => l.length === 0)) {
      excluded.push({ id, lesson: relFile, reason: "moins de 2 options valides (choices minItems:2)" });
      continue;
    }
    if (new Set(labels).size !== labels.length) {
      excluded.push({ id, lesson: relFile, reason: "labels d'options dupliques (choices uniqueItems)" });
      continue;
    }

    const correct = Array.isArray(check.correct) ? check.correct : [];
    if (correct.length === 0) {
      excluded.push({ id, lesson: relFile, reason: "aucune reponse correcte declaree" });
      continue;
    }
    if (correct.length >= 2) {
      excluded.push({
        id,
        lesson: relFile,
        reason: `QCM multi-reponses (correct=${correct.length}) non representable en answerKey v2 (correct est une string unique)`,
      });
      continue;
    }

    const correctOpt = options.find((o) => o && String(o.id) === String(correct[0]));
    if (!correctOpt || !isNonEmptyString(correctOpt.label)) {
      excluded.push({ id, lesson: relFile, reason: `id correct "${correct[0]}" introuvable dans les options` });
      continue;
    }

    if (!isNonEmptyString(check.stem)) {
      excluded.push({ id, lesson: relFile, reason: "stem vide (prompt minLength:1)" });
      continue;
    }
    if (!isNonEmptyString(check.explanation)) {
      excluded.push({ id, lesson: relFile, reason: "explanation vide (rationale minLength:1)" });
      continue;
    }

    if (emitted.has(id)) {
      excluded.push({
        id,
        lesson: relFile,
        reason: `id "${id}" en collision avec ${emitted.get(id)}`,
      });
      continue;
    }
    emitted.set(id, relFile);

    const publicPayload = {
      id,
      schemaVersion: "v2",
      kind: "public",
      prompt: norm(check.stem),
      choices: labels,
    };
    const answerPayload = {
      id,
      schemaVersion: "v2",
      kind: "answerKey",
      correct: norm(correctOpt.label),
      rationale: norm(check.explanation),
    };

    toWrite.push([`${PUBLIC_DIR}/${id}.json`, JSON.stringify(publicPayload, null, 2) + "\n"]);
    toWrite.push([`${ANSWER_DIR}/${id}.json`, JSON.stringify(answerPayload, null, 2) + "\n"]);
    eligible++;
  }
}

// --- purge previous output (idempotence + demo removal) --------------------
mkdirSync(resolve(ROOT, PUBLIC_DIR), { recursive: true });
mkdirSync(resolve(ROOT, ANSWER_DIR), { recursive: true });
for (const dir of [PUBLIC_DIR, ANSWER_DIR]) {
  for (const f of await glob(`${dir}/*.json`, { cwd: ROOT, posix: true })) {
    rmSync(resolve(ROOT, f));
  }
}

// --- write -----------------------------------------------------------------
for (const [rel, content] of toWrite) {
  writeFileSync(resolve(ROOT, rel), content, "utf8");
}

// --- inventory report ------------------------------------------------------
const pairs = toWrite.length / 2;
console.log("=== Inventaire migration wp-p1-05 ===");
console.log(`Source                    : ${relative(ROOT, SOURCE) || SOURCE}`);
console.log(`Lecons analysees          : ${lessonFiles.length}`);
console.log(`Blocs check (total source): ${totalCheckBlocks}`);
console.log(`QCM eligibles migres      : ${eligible}`);
console.log(`Paires public/answerKey   : ${pairs}  (attendu == eligibles: ${pairs === eligible ? "OK" : "KO"})`);
console.log(`Items exclus/signales     : ${excluded.length}`);
console.log(`Lecons non parsees        : ${parseErrors.length}`);

if (excluded.length > 0) {
  console.log("\n--- Items exclus (non inventes, signales) ---");
  const byReason = new Map();
  for (const x of excluded) {
    const key = x.reason.replace(/"[^"]*"/g, '"…"').replace(/\(\d+\)/g, "(N)");
    byReason.set(key, (byReason.get(key) ?? 0) + 1);
  }
  for (const [reason, n] of [...byReason.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  [${n}] ${reason}`);
  }
  console.log("\n--- Detail des items exclus ---");
  for (const x of excluded) {
    console.log(`  - ${x.id ?? "(sans id)"} | ${basename(x.lesson)} | ${x.reason}`);
  }
}
if (parseErrors.length > 0) {
  console.log("\n--- Lecons non parsees ---");
  for (const p of parseErrors) console.log(`  - ${p.lesson} | ${p.reason}`);
}

const conserved = eligible === pairs && pairs * 2 === toWrite.length;
console.log(`\nBijection generee: ${pairs} paires (${toWrite.length} fichiers). Coherence: ${conserved ? "OK" : "KO"}`);
