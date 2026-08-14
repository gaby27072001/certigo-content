#!/usr/bin/env node
// Content pipeline validator for certigo-content (banque de questions v2).

import { lstatSync, readFileSync } from "node:fs";
import { resolve, relative } from "node:path";
import { argv, cwd } from "node:process";
import { pathToFileURL } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { glob } from "glob";
import { compareOrdinal } from "./lib/deterministic.mjs";

const QUESTION_SCHEMA = "schemas/question.schema.json";
const SOLUTION_SCHEMA = "schemas/solution.schema.json";
const QUESTION_GLOB = "content/public/questions/*.json";
const SOLUTION_GLOB = "content/answerKey/solutions/*.json";
const FORBIDDEN_PUBLIC_KEYS = ["correct", "rationale"];

function loadJson(absPath) {
  const raw = readFileSync(absPath, "utf8");
  const parseable = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  return { raw, data: JSON.parse(parseable) };
}

function describeUnsupportedType(stat) {
  if (stat.isSymbolicLink()) return "lien symbolique";
  if (stat.isDirectory()) return "repertoire";
  return "type special";
}

function loadRegularJson(root, file) {
  const absolutePath = resolve(root, file);
  const stat = lstatSync(absolutePath);
  if (!stat.isFile()) {
    throw new Error(`${describeUnsupportedType(stat)} interdit`);
  }
  return loadJson(absolutePath);
}

export function correctMatchesChoice(choices, correct) {
  return (
    Array.isArray(choices) &&
    typeof correct === "string" &&
    choices.some((choice) => typeof choice === "string" && choice === correct)
  );
}

/**
 * Validate a content tree without terminating the process.
 * @param {{root?: string}} [options]
 * @returns {Promise<{
 *   errors: string[],
 *   questionCount: number,
 *   solutionCount: number,
 *   pairCount: number
 * }>}
 */
export async function validateContent(options = {}) {
  const root = resolve(options.root ?? cwd());
  const errors = [];
  const err = (message) => errors.push(message);

  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const questionSchema = JSON.parse(readFileSync(resolve(root, QUESTION_SCHEMA), "utf8"));
  const solutionSchema = JSON.parse(readFileSync(resolve(root, SOLUTION_SCHEMA), "utf8"));
  const validateQuestion = ajv.compile(questionSchema);
  const validateSolution = ajv.compile(solutionSchema);

  const questionFiles = (await glob(QUESTION_GLOB, { cwd: root, posix: true })).sort(
    compareOrdinal
  );
  const solutionFiles = (await glob(SOLUTION_GLOB, { cwd: root, posix: true })).sort(
    compareOrdinal
  );
  const publicIds = new Map();
  const answerIds = new Map();

  for (const file of questionFiles) {
    let raw;
    let data;
    try {
      ({ raw, data } = loadRegularJson(root, file));
    } catch (error) {
      err(`[schema:question] ${file}: JSON invalide (${error.message})`);
      continue;
    }

    if (!validateQuestion(data)) {
      for (const error of validateQuestion.errors ?? []) {
        err(`[schema:question] ${file}: ${error.instancePath || "/"} ${error.message}`);
      }
    }

    for (const key of FORBIDDEN_PUBLIC_KEYS) {
      if (
        data !== null &&
        typeof data === "object" &&
        Object.prototype.hasOwnProperty.call(data, key)
      ) {
        err(`[anti-leak] ${file}: cle interdite "${key}" presente dans un payload public`);
      }
      if (new RegExp(`"${key}"\\s*:`).test(raw)) {
        err(`[anti-leak] ${file}: motif "${key}" detecte dans les octets bruts du fichier public`);
      }
    }

    if (typeof data?.id === "string") {
      if (publicIds.has(data.id)) {
        err(
          `[integrity] id public duplique "${data.id}" (${publicIds.get(data.id).file} & ${file})`
        );
      } else {
        publicIds.set(data.id, { file, data });
      }
    }
  }

  for (const file of solutionFiles) {
    let data;
    try {
      ({ data } = loadRegularJson(root, file));
    } catch (error) {
      err(`[schema:solution] ${file}: JSON invalide (${error.message})`);
      continue;
    }

    if (!validateSolution(data)) {
      for (const error of validateSolution.errors ?? []) {
        err(`[schema:solution] ${file}: ${error.instancePath || "/"} ${error.message}`);
      }
    }

    if (typeof data?.id === "string") {
      if (answerIds.has(data.id)) {
        err(
          `[integrity] id answerKey duplique "${data.id}" (${answerIds.get(data.id).file} & ${file})`
        );
      } else {
        answerIds.set(data.id, { file, data });
      }
    }
  }

  for (const [id, question] of publicIds) {
    if (!answerIds.has(id)) {
      err(`[integrity] question publique "${id}" (${question.file}) SANS solution answerKey`);
      continue;
    }
    const solution = answerIds.get(id);
    if (!correctMatchesChoice(question.data.choices, solution.data.correct)) {
      err(
        `[integrity:correct-choice] solution "${id}" (${solution.file}): correct doit correspondre exactement a une valeur de choices dans ${question.file} (egalite stricte, sans conversion de casse, trim ni normalisation Unicode)`
      );
    }
  }
  for (const [id, solution] of answerIds) {
    if (!publicIds.has(id)) {
      err(`[integrity] solution answerKey "${id}" (${solution.file}) SANS question publique`);
    }
  }

  return {
    errors,
    questionCount: questionFiles.length,
    solutionCount: solutionFiles.length,
    pairCount: [...publicIds.keys()].filter((id) => answerIds.has(id)).length,
  };
}

export function printValidationResult(result) {
  console.log("certigo-content validator");
  console.log(`  questions publiques : ${result.questionCount}`);
  console.log(`  solutions answerKey : ${result.solutionCount}`);

  if (result.errors.length > 0) {
    console.error(`\n${result.errors.length} violation(s) detectee(s) :`);
    for (const message of result.errors) console.error(`  - ${message}`);
    return false;
  }

  console.log("\nOK - 5/5 checks passes :");
  console.log("  [a] schema question publique");
  console.log("  [b] schema solution answerKey");
  console.log(`  [c] integrite referentielle (0 orphelin, ${result.pairCount} paires)`);
  console.log("  [d] coherence correct/choices par egalite stricte");
  console.log("  [e] anti-fuite (aucune cle correct/rationale cote public)");
  return true;
}

function parseArgs(cliArgs) {
  const options = {};
  for (let index = 0; index < cliArgs.length; index++) {
    const argument = cliArgs[index];
    if (argument === "--root") {
      const value = cliArgs[++index];
      if (value === undefined || value.startsWith("-")) {
        throw new Error("valeur manquante pour --root");
      }
      options.root = value;
    } else if (argument === "--help" || argument === "-h") {
      options.help = true;
    } else {
      throw new Error(`argument inconnu: ${argument}`);
    }
  }
  return options;
}

const isMain =
  argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(argv[1])).href;

if (isMain) {
  try {
    const options = parseArgs(argv.slice(2));
    if (options.help) {
      console.log("Usage: node tools/validate_content.mjs [--root DIR]");
    } else {
      const result = await validateContent(options);
      if (!printValidationResult(result)) process.exitCode = 1;
    }
  } catch (error) {
    console.error(`[validator] erreur fatale: ${error.message}`);
    process.exitCode = 1;
  }
}
