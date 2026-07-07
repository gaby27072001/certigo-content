#!/usr/bin/env node
// Content pipeline validator for certigo-content (banque de questions v2).
//
// Runs four checks and exits non-zero on the first corpus that fails any of
// them, printing actionable file-level messages:
//   (a) every public question validates against schemas/question.schema.json
//   (b) every answerKey solution validates against schemas/solution.schema.json
//   (c) referential integrity: public ids and answerKey ids form a bijection
//       (no orphan on either side)
//   (d) anti-leak (defense-in-depth): no public file carries the answer-bearing
//       keys "correct" or "rationale" (the public schema already forbids them
//       structurally via additionalProperties:false; this re-checks the raw
//       bytes + parsed keys so a schema regression cannot silently leak answers)
//
// Deps (installed by CI via `npm install --no-save ajv ajv-formats glob`):
//   ajv (draft 2020-12 build), ajv-formats, glob. ESM native (.mjs).

import { readFileSync } from "node:fs";
import { resolve, relative } from "node:path";
import { cwd } from "node:process";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { glob } from "glob";

const ROOT = cwd();
const QUESTION_SCHEMA = "schemas/question.schema.json";
const SOLUTION_SCHEMA = "schemas/solution.schema.json";
const QUESTION_GLOB = "content/public/questions/*.json";
const SOLUTION_GLOB = "content/answerKey/solutions/*.json";
const FORBIDDEN_PUBLIC_KEYS = ["correct", "rationale"];

/** @type {string[]} */
const errors = [];
const err = (msg) => errors.push(msg);
const rel = (abs) => relative(ROOT, abs).split("\\").join("/");

function loadJson(absPath) {
  const raw = readFileSync(absPath, "utf8");
  // Tolerate a leading UTF-8 BOM (present in the real corpus) before parsing;
  // keep `raw` untouched for the anti-leak byte scan.
  const parseable = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  return { raw, data: JSON.parse(parseable) };
}

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);

const questionSchema = JSON.parse(readFileSync(resolve(ROOT, QUESTION_SCHEMA), "utf8"));
const solutionSchema = JSON.parse(readFileSync(resolve(ROOT, SOLUTION_SCHEMA), "utf8"));
const validateQuestion = ajv.compile(questionSchema);
const validateSolution = ajv.compile(solutionSchema);

const questionFiles = (await glob(QUESTION_GLOB, { cwd: ROOT, posix: true })).sort();
const solutionFiles = (await glob(SOLUTION_GLOB, { cwd: ROOT, posix: true })).sort();

const publicIds = new Map(); // id -> file
const answerIds = new Map(); // id -> file

// ---- Check (a): public questions vs question.schema -----------------------
// ---- Check (d): anti-leak defense-in-depth on public files ----------------
for (const file of questionFiles) {
  const abs = resolve(ROOT, file);
  let raw, data;
  try {
    ({ raw, data } = loadJson(abs));
  } catch (e) {
    err(`[schema:question] ${file}: JSON invalide (${e.message})`);
    continue;
  }

  if (!validateQuestion(data)) {
    for (const e of validateQuestion.errors ?? []) {
      err(`[schema:question] ${file}: ${e.instancePath || "/"} ${e.message}`);
    }
  }

  // (d) anti-leak: parsed top-level keys + raw byte scan (catches nesting too).
  for (const key of FORBIDDEN_PUBLIC_KEYS) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      err(`[anti-leak] ${file}: cle interdite "${key}" presente dans un payload public`);
    }
    const rawKeyRe = new RegExp(`"${key}"\\s*:`);
    if (rawKeyRe.test(raw)) {
      err(`[anti-leak] ${file}: motif "${key}" detecte dans les octets bruts du fichier public`);
    }
  }

  if (typeof data?.id === "string") {
    if (publicIds.has(data.id)) {
      err(`[integrity] id public duplique "${data.id}" (${publicIds.get(data.id)} & ${file})`);
    } else {
      publicIds.set(data.id, file);
    }
  }
}

// ---- Check (b): answerKey solutions vs solution.schema --------------------
for (const file of solutionFiles) {
  const abs = resolve(ROOT, file);
  let data;
  try {
    ({ data } = loadJson(abs));
  } catch (e) {
    err(`[schema:solution] ${file}: JSON invalide (${e.message})`);
    continue;
  }

  if (!validateSolution(data)) {
    for (const e of validateSolution.errors ?? []) {
      err(`[schema:solution] ${file}: ${e.instancePath || "/"} ${e.message}`);
    }
  }

  if (typeof data?.id === "string") {
    if (answerIds.has(data.id)) {
      err(`[integrity] id answerKey duplique "${data.id}" (${answerIds.get(data.id)} & ${file})`);
    } else {
      answerIds.set(data.id, file);
    }
  }
}

// ---- Check (c): referential integrity (bijection public <-> answerKey) ----
for (const [id, file] of publicIds) {
  if (!answerIds.has(id)) {
    err(`[integrity] question publique "${id}" (${file}) SANS solution answerKey`);
  }
}
for (const [id, file] of answerIds) {
  if (!publicIds.has(id)) {
    err(`[integrity] solution answerKey "${id}" (${file}) SANS question publique`);
  }
}

// ---- Report ---------------------------------------------------------------
console.log(`certigo-content validator`);
console.log(`  questions publiques : ${questionFiles.length}`);
console.log(`  solutions answerKey : ${solutionFiles.length}`);

if (errors.length > 0) {
  console.error(`\n${errors.length} violation(s) detectee(s) :`);
  for (const m of errors) console.error(`  - ${m}`);
  process.exit(1);
}

console.log(`\nOK - 4/4 checks passes :`);
console.log(`  [a] schema question publique`);
console.log(`  [b] schema solution answerKey`);
console.log(`  [c] integrite referentielle (0 orphelin, ${publicIds.size} paires)`);
console.log(`  [d] anti-fuite (aucune cle correct/rationale cote public)`);
process.exit(0);
