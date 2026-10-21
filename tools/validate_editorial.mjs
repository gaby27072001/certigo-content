#!/usr/bin/env node

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { globSync } from "glob";
import { readJson } from "./lib/catalog.mjs";
import { compareOrdinal } from "./lib/deterministic.mjs";

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
