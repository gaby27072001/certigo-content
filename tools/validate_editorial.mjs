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

const LONG_DASH_RE = /[\u2013\u2014]/u;

function findLongDashPaths(value, currentPath = "") {
  if (typeof value === "string") {
    return LONG_DASH_RE.test(value) ? [currentPath || "/"] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, idx) => findLongDashPaths(item, `${currentPath}/${idx}`));
  }
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => findLongDashPaths(v, `${currentPath}/${k}`));
  }
  return [];
}

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
    if (!track.routeAliases.includes(track.routeCode)) {
      err(`routeAliases doit contenir routeCode "${track.routeCode}"`);
    }
    if (track.brandIdentity.logoSlug !== track.providerId) {
      err(`brandIdentity.logoSlug "${track.brandIdentity.logoSlug}" != providerId "${track.providerId}"`);
    }
    for (const examQId of track.mockExam.questionIds) {
      if (!questionById.has(examQId)) {
        err(`mockExam reference une question inconnue "${examQId}"`);
      }
    }
    for (const dashPath of findLongDashPaths(track)) {
      errors.push(`[editorial-track:long-dash] ${file}${dashPath}: long tiret interdit (U+2013/U+2014)`);
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
    for (const dashPath of findLongDashPaths(solutionsDoc)) {
      errors.push(`[editorial-track:long-dash] ${expectedSolutionFile}${dashPath}: long tiret interdit (U+2013/U+2014)`);
    }
  }

  const parityResult = validateMultilingualParity({ root });
  errors.push(...parityResult.errors);

  return {
    ok: errors.length === 0,
    trackFiles,
    solutionFiles,
    trackCount: trackFiles.length,
    moduleCount,
    lessonCount,
    questionCount,
    localeCount: parityResult.localeCount,
    errors,
  };
}

export function validateMultilingualParity(options = {}) {
  const root = resolve(options.root ?? ".");
  const localesConfigPath = resolve(root, "config/supported-locales.json");
  if (!existsSync(localesConfigPath)) {
    return { ok: true, localeCount: 0, locales: [], errors: [] };
  }

  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const validateLocales = ajv.compile(readJson(resolve(root, "editorial/schemas/supported-locales.schema.json")));
  const validateTrack = ajv.compile(readJson(resolve(root, "editorial/schemas/editorial-track.schema.json")));
  const validateTrackSolutions = ajv.compile(readJson(resolve(root, "editorial/schemas/editorial-track-solutions.schema.json")));
  const validatePilot = ajv.compile(readJson(resolve(root, "editorial/schemas/localized-editorial-pilot.schema.json")));
  const validateCatalogPublic = ajv.compile(readJson(resolve(root, "editorial/schemas/multilingual-catalog-public.schema.json")));
  const validateCatalogSolutions = ajv.compile(readJson(resolve(root, "editorial/schemas/multilingual-catalog-solutions.schema.json")));

  const errors = [];
  const localesDoc = readJson(localesConfigPath);
  if (!validateLocales(localesDoc)) {
    for (const error of validateLocales.errors ?? []) {
      errors.push(`[multilingual:schema] config/supported-locales.json${error.instancePath}: ${error.message}`);
    }
    return { ok: false, localeCount: 0, locales: [], errors };
  }

  const supportedLocales = localesDoc.locales.map((entry) => entry.locale);
  const canonicalTrackFiles = globSync("editorial/tracks/*.json", { cwd: root, posix: true }).sort(compareOrdinal);
  const canonicalPilotFiles = globSync("editorial/pilots/*.json", { cwd: root, posix: true }).sort(compareOrdinal);
  const catalogPath = resolve(root, "content/public/catalog/certifications.json");
  const radarTracksPath = resolve(root, "config/content-radar-tracks.json");
  const canonicalQuestions = globSync("content/public/questions/**/*.json", { cwd: root, posix: true })
    .sort(compareOrdinal)
    .map((file) => readJson(resolve(root, file)))
    .sort((a, b) => compareOrdinal(a.id, b.id));
  const canonicalSolutionsById = new Map(
    globSync("content/answerKey/solutions/**/*.json", { cwd: root, posix: true })
      .sort(compareOrdinal)
      .map((file) => readJson(resolve(root, file)))
      .map((s) => [s.id, s])
  );
  const canonicalConceptIds = globSync("content/public/runtime/concepts/**/*.json", { cwd: root, posix: true })
    .sort(compareOrdinal)
    .map((file) => readJson(resolve(root, file)).id)
    .sort(compareOrdinal);
  const canonicalCertIds = existsSync(catalogPath)
    ? readJson(catalogPath).certifications.map((c) => c.id)
    : [];
  const canonicalRadarIds = existsSync(radarTracksPath)
    ? readJson(radarTracksPath).tracks.map((t) => t.id)
    : [];

  for (const file of canonicalTrackFiles) {
    const canonicalTrack = readJson(resolve(root, file));
    const canonicalSol = readJson(resolve(root, `content/answerKey/editorial/tracks/${canonicalTrack.id}.solutions.json`));
    const canonicalQIds = canonicalTrack.modules.flatMap((m) => m.lessons.flatMap((l) => l.questions.map((q) => q.id)));
    const canonicalLessonIds = canonicalTrack.modules.flatMap((m) => m.lessons.map((l) => l.id));

    for (const locale of supportedLocales) {
      const locTrackRel = `editorial/i18n/tracks/${locale}/${canonicalTrack.id}.json`;
      const locSolRel = `content/answerKey/editorial/i18n/tracks/${locale}/${canonicalTrack.id}.solutions.json`;
      const locTrackAbs = resolve(root, locTrackRel);
      const locSolAbs = resolve(root, locSolRel);

      if (!existsSync(locTrackAbs)) {
        errors.push(`[multilingual:missing] ${locTrackRel} manquant pour locale ${locale}`);
        continue;
      }
      if (!existsSync(locSolAbs)) {
        errors.push(`[multilingual:missing] ${locSolRel} manquant pour locale ${locale}`);
        continue;
      }

      const rawTrack = readFileSync(locTrackAbs, "utf8");
      for (const key of FORBIDDEN_PUBLIC_KEYS) {
        if (new RegExp(`"${key}"\\s*:`, "i").test(rawTrack)) {
          errors.push(`[multilingual:anti-leak] ${locTrackRel}: cle interdite "${key}"`);
        }
      }

      const locTrack = JSON.parse(rawTrack);
      const locSol = readJson(locSolAbs);

      if (!validateTrack(locTrack)) {
        for (const error of validateTrack.errors ?? []) {
          errors.push(`[multilingual:schema] ${locTrackRel}${error.instancePath}: ${error.message}`);
        }
      }
      if (!validateTrackSolutions(locSol)) {
        for (const error of validateTrackSolutions.errors ?? []) {
          errors.push(`[multilingual:schema] ${locSolRel}${error.instancePath}: ${error.message}`);
        }
      }
      if (locTrack.locale !== locale || locSol.locale !== locale) {
        errors.push(`[multilingual:locale] ${locTrackRel}: locale attendue "${locale}"`);
      }

      const locLessonIds = locTrack.modules.flatMap((m) => m.lessons.map((l) => l.id));
      const locQIds = locTrack.modules.flatMap((m) => m.lessons.flatMap((l) => l.questions.map((q) => q.id)));
      if (locLessonIds.join(",") !== canonicalLessonIds.join(",") || locQIds.join(",") !== canonicalQIds.join(",")) {
        errors.push(`[multilingual:parity] ${locTrackRel}: divergence des lessons ou questions avec ${file}`);
      }
      if (locSol.solutions.map((s) => s.id).join(",") !== canonicalSol.solutions.map((s) => s.id).join(",")) {
        errors.push(`[multilingual:parity] ${locSolRel}: divergence des solutions avec ${canonicalTrack.id}`);
      }
      if (locale !== "fr-FR" && locTrack.title === canonicalTrack.title) {
        errors.push(`[multilingual:untranslated] ${locTrackRel}: titre non traduit pour ${locale}`);
      }
      for (const dashPath of findLongDashPaths(locTrack)) {
        errors.push(`[multilingual:long-dash] ${locTrackRel}${dashPath}: long tiret interdit`);
      }
      for (const dashPath of findLongDashPaths(locSol)) {
        errors.push(`[multilingual:long-dash] ${locSolRel}${dashPath}: long tiret interdit`);
      }
    }
  }

  for (const file of canonicalPilotFiles) {
    const canonicalPilot = readJson(resolve(root, file));
    for (const locale of supportedLocales) {
      const locPilotRel = `editorial/i18n/pilots/${locale}/${canonicalPilot.id}.json`;
      const locPilotAbs = resolve(root, locPilotRel);
      if (!existsSync(locPilotAbs)) {
        errors.push(`[multilingual:missing] ${locPilotRel} manquant pour locale ${locale}`);
        continue;
      }
      const locPilot = readJson(locPilotAbs);
      if (!validatePilot(locPilot)) {
        for (const error of validatePilot.errors ?? []) {
          errors.push(`[multilingual:schema] ${locPilotRel}${error.instancePath}: ${error.message}`);
        }
      }
      if (locPilot.locale !== locale) {
        errors.push(`[multilingual:locale] ${locPilotRel}: locale attendue "${locale}"`);
      }
      for (const dashPath of findLongDashPaths(locPilot)) {
        errors.push(`[multilingual:long-dash] ${locPilotRel}${dashPath}: long tiret interdit`);
      }
    }
  }

  if (canonicalCertIds.length > 0 && canonicalQuestions.length > 0) {
    for (const locale of supportedLocales) {
      const pubRel = `editorial/i18n/catalog/${locale}.public.json`;
      const solRel = `content/answerKey/editorial/i18n/catalog/${locale}.solutions.json`;
      const pubAbs = resolve(root, pubRel);
      const solAbs = resolve(root, solRel);

      if (!existsSync(pubAbs) || !existsSync(solAbs)) {
        errors.push(`[multilingual:missing] bundle catalogue manquant pour ${locale}`);
        continue;
      }

      const rawPub = readFileSync(pubAbs, "utf8");
      for (const key of FORBIDDEN_PUBLIC_KEYS) {
        if (new RegExp(`"${key}"\\s*:`, "i").test(rawPub)) {
          errors.push(`[multilingual:anti-leak] ${pubRel}: cle interdite "${key}"`);
        }
      }

      const pubDoc = JSON.parse(rawPub);
      const solDoc = readJson(solAbs);

      if (!validateCatalogPublic(pubDoc)) {
        for (const error of validateCatalogPublic.errors ?? []) {
          errors.push(`[multilingual:schema] ${pubRel}${error.instancePath}: ${error.message}`);
        }
      }
      if (!validateCatalogSolutions(solDoc)) {
        for (const error of validateCatalogSolutions.errors ?? []) {
          errors.push(`[multilingual:schema] ${solRel}${error.instancePath}: ${error.message}`);
        }
      }

      if (pubDoc.certifications.map((c) => c.id).join(",") !== canonicalCertIds.join(",")) {
        errors.push(`[multilingual:parity] ${pubRel}: certifications divergentes du catalogue`);
      }
      if (pubDoc.radarTracks.map((t) => t.id).join(",") !== canonicalRadarIds.join(",")) {
        errors.push(`[multilingual:parity] ${pubRel}: pistes Radar divergentes`);
      }
      if (pubDoc.concepts.map((c) => c.id).join(",") !== canonicalConceptIds.join(",")) {
        errors.push(`[multilingual:parity] ${pubRel}: concepts runtime divergents`);
      }
      if (pubDoc.questions.length !== canonicalQuestions.length || solDoc.solutions.length !== canonicalQuestions.length) {
        errors.push(`[multilingual:parity] ${pubRel}: nombre de questions/solutions divergent (${pubDoc.questions.length}/${solDoc.solutions.length} vs ${canonicalQuestions.length})`);
      } else {
        for (let idx = 0; idx < canonicalQuestions.length; idx++) {
          const canQ = canonicalQuestions[idx];
          const canS = canonicalSolutionsById.get(canQ.id);
          const locQ = pubDoc.questions[idx];
          const locS = solDoc.solutions[idx];
          const canChoices = canQ.choices ?? canQ.options?.map((o) => o.label) ?? [];
          const expectedIndex = canChoices.indexOf(canS.correct);
          if (locQ.id !== canQ.id || locS.id !== canQ.id) {
            errors.push(`[multilingual:parity] ${pubRel}: question/solution ${idx} hors ordre pour ${canQ.id}`);
            break;
          }
          if (locQ.choices.indexOf(locS.correct) !== expectedIndex) {
            errors.push(`[multilingual:answer-index] ${solRel}: index de bonne reponse divergent pour ${canQ.id}`);
            break;
          }
          if (locale !== "fr-FR" && locQ.prompt === canQ.prompt) {
            errors.push(`[multilingual:untranslated] ${pubRel}: question "${canQ.id}" non traduite pour ${locale}`);
            break;
          }
        }
      }
      for (const dashPath of findLongDashPaths(pubDoc)) {
        errors.push(`[multilingual:long-dash] ${pubRel}${dashPath}: long tiret interdit`);
      }
      for (const dashPath of findLongDashPaths(solDoc)) {
        errors.push(`[multilingual:long-dash] ${solRel}${dashPath}: long tiret interdit`);
      }
    }
  }

  return {
    ok: errors.length === 0,
    localeCount: supportedLocales.length,
    locales: supportedLocales,
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
    for (const dashPath of findLongDashPaths(pilot)) {
      errors.push(`[editorial:long-dash] ${file}${dashPath}: long tiret interdit (U+2013/U+2014)`);
    }
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
