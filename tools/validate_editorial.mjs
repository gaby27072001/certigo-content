#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { globSync } from "./lib/glob.mjs";
import { readJson } from "./lib/catalog.mjs";
import { compareOrdinal } from "./lib/deterministic.mjs";

const FORBIDDEN_PUBLIC_KEYS = [
  "correct",
  "correctOptionIds",
  "explanation",
  "pairs",
  "rationale",
];

export function validateEditorialTracks(options = {}) {
  const root = resolve(options.root ?? ".");
  const trackSchemaPath = resolve(root, "editorial/schemas/editorial-track.schema.json");
  const solutionSchemaPath = resolve(root, "editorial/schemas/editorial-track-solutions.schema.json");
  const trackFiles = globSync("editorial/tracks/**/*.json", { cwd: root, posix: true }).sort(compareOrdinal);
  const solutionFiles = globSync("content/answerKey/editorial/tracks/**/*.solutions.json", {
    cwd: root,
    posix: true,
  }).sort(compareOrdinal);

  if (trackFiles.length === 0 && solutionFiles.length === 0) {
    return {
      ok: true,
      trackFiles: [],
      solutionFiles: [],
      trackCount: 0,
      moduleCount: 0,
      lessonCount: 0,
      questionCount: 0,
      errors: [],
    };
  }

  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const validateTrack = ajv.compile(readJson(trackSchemaPath));
  const validateSolutions = ajv.compile(readJson(solutionSchemaPath));
  const errors = [];
  let moduleCount = 0;
  let lessonCount = 0;
  let questionCount = 0;

  for (const file of trackFiles) {
    const absPath = resolve(root, file);
    let raw;
    let track;
    try {
      raw = readFileSync(absPath, "utf8");
      track = JSON.parse(raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw);
    } catch (error) {
      errors.push(`[editorial-track:json] ${file}: ${error.message}`);
      continue;
    }

    for (const key of FORBIDDEN_PUBLIC_KEYS) {
      if (new RegExp(`"${key}"\\s*:`, "i").test(raw)) {
        errors.push(`[editorial-track:anti-leak] ${file}: cle interdite "${key}" dans le parcours public`);
      }
    }

    if (!validateTrack(track)) {
      for (const error of validateTrack.errors ?? []) {
        errors.push(`[editorial-track:schema] ${file}${error.instancePath}: ${error.message}`);
      }
      continue;
    }

    const err = (message) => errors.push(`[editorial-track:integrity] ${file}: ${message}`);
    if (file !== `editorial/tracks/${track.id}.json`) err("chemin divergent de id");
    if (track.brand !== "CertiGo") err(`orthographe de marque invalide "${track.brand}", attendu "CertiGo"`);

    const sourceIds = new Set();
    const urls = new Set();
    for (const source of track.sources) {
      if (sourceIds.has(source.id)) err(`source dupliquee "${source.id}"`);
      sourceIds.add(source.id);
      if (urls.has(source.url)) err(`URL dupliquee "${source.url}"`);
      urls.add(source.url);
      if (source.checkedOn !== track.asOf) err(`source "${source.id}" non revue a asOf`);
    }

    const moduleIds = new Set();
    const lessonIds = new Set();
    const questionById = new Map();
    const usedSources = new Set();
    let totalModuleMinutes = 0;

    track.modules.forEach((mod, modIndex) => {
      moduleCount++;
      if (mod.unitNumber !== modIndex + 1) {
        err(`module "${mod.id}": unitNumber=${mod.unitNumber}, attendu ${modIndex + 1}`);
      }
      if (moduleIds.has(mod.id)) err(`module duplique "${mod.id}"`);
      moduleIds.add(mod.id);
      totalModuleMinutes += mod.estimatedMinutes;

      let lessonMinutesSum = 0;
      for (const lesson of mod.lessons) {
        lessonCount++;
        if (lessonIds.has(lesson.id)) err(`lesson dupliquee "${lesson.id}"`);
        lessonIds.add(lesson.id);
        lessonMinutesSum += lesson.estimatedMinutes;

        for (const sourceId of lesson.sourceIds) {
          if (!sourceIds.has(sourceId)) err(`source inconnue "${sourceId}" dans lesson "${lesson.id}"`);
          usedSources.add(sourceId);
        }

        for (const question of lesson.questions) {
          questionCount++;
          const expectedPrefix = `${track.id}.${lesson.id}.`;
          if (!question.id.startsWith(expectedPrefix)) {
            err(`question "${question.id}" doit commencer par "${expectedPrefix}"`);
          }
          if (questionById.has(question.id)) {
            err(`question dupliquee "${question.id}"`);
          }
          const optionIds = question.options.map((opt) => opt.id);
          if (new Set(optionIds).size !== optionIds.length) {
            err(`question "${question.id}": option ids dupliques`);
          }
          questionById.set(question.id, { lessonId: lesson.id, question });
        }
      }

      if (lessonMinutesSum !== mod.estimatedMinutes) {
        err(`module "${mod.id}": duree (${mod.estimatedMinutes}) divergente de la somme des lessons (${lessonMinutesSum})`);
      }
    });

    if (totalModuleMinutes !== track.estimatedMinutes) {
      err(`duree totale (${track.estimatedMinutes}) divergente de la somme des modules (${totalModuleMinutes})`);
    }
    for (const sourceId of sourceIds) {
      if (!usedSources.has(sourceId)) err(`source non utilisee "${sourceId}"`);
    }

    const expectedSolutionFile = `content/answerKey/editorial/tracks/${track.id}.solutions.json`;
    const absSolutionPath = resolve(root, expectedSolutionFile);
    if (!existsSync(absSolutionPath)) {
      err(`fichier de solutions manquant: ${expectedSolutionFile}`);
      continue;
    }

    let solutionsDoc;
    try {
      solutionsDoc = readJson(absSolutionPath);
    } catch (error) {
      errors.push(`[editorial-track:json] ${expectedSolutionFile}: ${error.message}`);
      continue;
    }

    if (!validateSolutions(solutionsDoc)) {
      for (const error of validateSolutions.errors ?? []) {
        errors.push(`[editorial-track:schema] ${expectedSolutionFile}${error.instancePath}: ${error.message}`);
      }
      continue;
    }

    if (solutionsDoc.trackId !== track.id) {
      errors.push(`[editorial-track:integrity] ${expectedSolutionFile}: trackId "${solutionsDoc.trackId}" != "${track.id}"`);
    }

    const seenSolutions = new Set();
    for (const sol of solutionsDoc.solutions) {
      if (seenSolutions.has(sol.id)) {
        errors.push(`[editorial-track:integrity] ${expectedSolutionFile}: solution dupliquee "${sol.id}"`);
      }
      seenSolutions.add(sol.id);
      const entry = questionById.get(sol.id);
      if (!entry) {
        errors.push(`[editorial-track:integrity] ${expectedSolutionFile}: solution orpheline "${sol.id}"`);
        continue;
      }
      if (sol.lessonId !== entry.lessonId) {
        errors.push(`[editorial-track:integrity] ${expectedSolutionFile}: lessonId divergent pour "${sol.id}"`);
      }
      if (sol.itemType !== entry.question.itemType) {
        errors.push(`[editorial-track:integrity] ${expectedSolutionFile}: itemType divergent pour "${sol.id}"`);
      }
      const optionIdSet = new Set(entry.question.options.map((opt) => opt.id));
      for (const cid of sol.correctOptionIds) {
        if (!optionIdSet.has(cid)) {
          errors.push(`[editorial-track:integrity] ${expectedSolutionFile}: option correcte inconnue "${cid}" pour "${sol.id}"`);
        }
      }
      for (const sid of sol.sourceIds) {
        if (!sourceIds.has(sid)) {
          errors.push(`[editorial-track:integrity] ${expectedSolutionFile}: sourceId inconnu "${sid}" pour "${sol.id}"`);
        }
      }
    }

    for (const qId of questionById.keys()) {
      if (!seenSolutions.has(qId)) {
        errors.push(`[editorial-track:integrity] ${file}: question "${qId}" sans solution dans ${expectedSolutionFile}`);
      }
    }
  }

  return {
    ok: errors.length === 0,
    trackFiles,
    solutionFiles,
    trackCount: trackFiles.length,
    moduleCount,
    lessonCount,
    questionCount,
    errors,
  };
}

export function validateEditorial(options = {}) {
  const root = resolve(options.root ?? ".");
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const validate = ajv.compile(readJson(resolve(root, "editorial/schemas/editorial-pilot.schema.json")));
  const files = globSync("editorial/pilots/**/*.json", { cwd: root, posix: true })
    .sort(compareOrdinal);
  const errors = [];
  if (files.length === 0) errors.push("[editorial:missing] aucun pilote");

  for (const file of files) {
    let pilot;
    try {
      pilot = readJson(resolve(root, file));
    } catch (error) {
      errors.push(`[editorial:json] ${file}: ${error.message}`);
      continue;
    }
    if (!validate(pilot)) {
      for (const error of validate.errors) {
        errors.push(`[editorial:schema] ${file}${error.instancePath}: ${error.message}`);
      }
      continue;
    }
    const err = (message) => errors.push(`[editorial:integrity] ${file}: ${message}`);
    if (file !== `editorial/pilots/${pilot.id}.json`) err("chemin divergent de id");
    const sourceIds = new Set();
    const urls = new Set();
    for (const source of pilot.sources) {
      if (sourceIds.has(source.id)) err(`source dupliquee "${source.id}"`);
      sourceIds.add(source.id);
      if (urls.has(source.url)) err(`URL dupliquee "${source.url}"`);
      urls.add(source.url);
      if (source.checkedOn !== pilot.asOf) err(`source "${source.id}" non revue a asOf`);
    }
    const lessonIds = new Set();
    const usedSources = new Set();
    for (const lesson of pilot.lessons) {
      if (lessonIds.has(lesson.id)) err(`lesson dupliquee "${lesson.id}"`);
      lessonIds.add(lesson.id);
      for (const sourceId of lesson.sourceIds) {
        if (!sourceIds.has(sourceId)) err(`source inconnue "${sourceId}"`);
        usedSources.add(sourceId);
      }
    }
    for (const sourceId of sourceIds) {
      if (!usedSources.has(sourceId)) err(`source non utilisee "${sourceId}"`);
    }
    const minutes = pilot.lessons.reduce((sum, lesson) => sum + lesson.estimatedMinutes, 0);
    if (minutes !== pilot.estimatedMinutes) err("duree totale divergente des lessons");
  }
  const tracksResult = validateEditorialTracks({ root });
  errors.push(...tracksResult.errors);
  return { ok: errors.length === 0, files, errors };
}

function parseArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index++) {
    if (args[index] === "--root") {
      const root = args[++index];
      if (!root || root.startsWith("--")) throw new Error("--root exige un repertoire");
      options.root = root;
    } else if (args[index] === "--help" || args[index] === "-h") {
      options.help = true;
    } else {
      throw new Error(`argument inconnu: ${args[index]}`);
    }
  }
  return options;
}

const isMain = process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      console.log("Usage: node tools/validate_editorial.mjs [--root DIR]");
    } else {
      const result = validateEditorial(options);
      console.log(JSON.stringify(result, null, 2));
      if (!result.ok) process.exitCode = 1;
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
