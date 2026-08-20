#!/usr/bin/env node

import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { argv, cwd } from "node:process";
import { pathToFileURL } from "node:url";
import { glob } from "glob";
import { canonicalize } from "./gen_manifest.mjs";
import { compareOrdinal } from "./lib/deterministic.mjs";
import { inspectPublicArtifact } from "./package_content.mjs";
import { validateContent } from "./validate_content.mjs";

function loadJson(path) {
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw);
}

async function loadById(root, pattern) {
  const entries = new Map();
  const files = (await glob(pattern, { cwd: root, posix: true })).sort(compareOrdinal);
  for (const file of files) {
    const data = loadJson(resolve(root, file));
    entries.set(data.id, data);
  }
  return entries;
}

function runtimeId(resource) {
  return resource.legacyId ?? resource.id;
}

function questionRuntimeId(question) {
  return question.legacyId ?? question.id;
}

function objectiveFor(catalog, domain) {
  return catalog.certifications
    .find((certification) => certification.id === domain.certificationId)
    ?.blueprint.objectives.find((objective) => objective.id === domain.objectiveId);
}

function compileQuestion(question, solution, concept) {
  if (question.schemaVersion !== "v4" || solution?.schemaVersion !== "v4") {
    throw new Error(
      `[runtime-compile] la projection canonique exige une paire v4: ${question.id}`
    );
  }
  return {
    publicCheck: {
      id: questionRuntimeId(question),
      conceptId: runtimeId(concept),
      type: question.itemType,
      stem: question.prompt,
      options: question.options,
    },
    answer: {
      itemId: questionRuntimeId(question),
      conceptId: runtimeId(concept),
      type: question.itemType,
      difficulty: question.difficulty,
      correct: solution.correctOptionIds,
      explanation: solution.rationale,
    },
  };
}

function compileBlock(block, questions, solutions, concepts) {
  const concept = concepts.get(block.conceptId);
  const output = {
    type: block.type,
    conceptId: runtimeId(concept),
  };
  for (const field of ["title", "body", "code", "language"]) {
    if (block[field] !== undefined) output[field] = block[field];
  }
  if (block.type !== "check") return { publicBlock: output, answer: null };
  const question = questions.get(block.questionId);
  const compiled = compileQuestion(question, solutions.get(question.id), concept);
  output.check = compiled.publicCheck;
  return { publicBlock: output, answer: compiled.answer };
}

function compileGuidedTrack({
  track,
  certification,
  catalog,
  domains,
  units,
  lessons,
  concepts,
  questions,
  solutions,
}) {
  const trackId = runtimeId(track);
  const publicDocuments = [];
  const privateDocuments = [];
  const trackUnits = [];
  const examDomains = track.domainIds.map((domainId) => {
    const domain = domains.get(domainId);
    const objective = objectiveFor(catalog, domain);
    return {
      id: runtimeId(domain),
      name: objective.title,
      weight: objective.weightPercent / 100,
    };
  });

  for (const unitId of track.unitIds) {
    const unit = units.get(unitId);
    const compiledLessonIds = [];
    for (const lessonId of unit.lessonIds) {
      const lesson = lessons.get(lessonId);
      const publicBlocks = [];
      const answers = [];
      for (const block of lesson.blocks) {
        const compiled = compileBlock(block, questions, solutions, concepts);
        publicBlocks.push(compiled.publicBlock);
        if (compiled.answer) answers.push(compiled.answer);
      }
      const compiledLessonId = runtimeId(lesson);
      compiledLessonIds.push(compiledLessonId);
      publicDocuments.push({
        id: compiledLessonId,
        type: "lesson",
        trackId,
        lessonId: compiledLessonId,
        unitId: runtimeId(unit),
        domainId: runtimeId(domains.get(unit.domainId)),
        title: lesson.title,
        estMinutes: lesson.estimatedMinutes,
        blocks: publicBlocks,
      });
      if (answers.length > 0) {
        privateDocuments.push({
          id: `answerkey::${compiledLessonId}`,
          type: "answerKey",
          trackId,
          lessonId: compiledLessonId,
          domainId: runtimeId(domains.get(unit.domainId)),
          items: answers,
        });
      }
    }
    trackUnits.push({
      id: runtimeId(unit),
      domainId: runtimeId(domains.get(unit.domainId)),
      title: unit.title,
      lessons: compiledLessonIds,
    });
  }

  publicDocuments.unshift({
    id: trackId,
    type: "track",
    trackId,
    code: certification.officialCode ?? certification.slug.toUpperCase(),
    title: certification.title,
    summary: track.summary,
    level: certification.level,
    domains: examDomains,
    units: trackUnits,
  });
  return { publicDocuments, privateDocuments };
}

function compileQuestionBankTrack({
  track,
  certification,
  catalog,
  domains,
  concepts,
  questions,
  solutions,
}) {
  const trackId = runtimeId(track);
  const publicDocuments = [];
  const privateDocuments = [];
  const trackUnits = [];
  const examDomains = [];

  for (const domainId of track.domainIds) {
    const domain = domains.get(domainId);
    const objective = objectiveFor(catalog, domain);
    const domainRuntimeId = runtimeId(domain);
    const unitId = `${trackId}.unit.${domain.objectiveId}`;
    const lessonId = `${trackId}.lesson.${domain.objectiveId}.practice`;
    const domainQuestions = [...questions.values()]
      .filter(
        (question) =>
          question.schemaVersion === "v4" &&
          question.metadata.certification === track.certificationId &&
          question.metadata.domainId === domain.id
      )
      .sort((left, right) => compareOrdinal(left.id, right.id));
    const blocks = [];
    const answers = [];
    for (const question of domainQuestions) {
      const concept = concepts.get(question.metadata.conceptId);
      const compiled = compileQuestion(question, solutions.get(question.id), concept);
      blocks.push({
        type: "check",
        conceptId: runtimeId(concept),
        check: compiled.publicCheck,
      });
      answers.push(compiled.answer);
    }
    publicDocuments.push({
      id: lessonId,
      type: "lesson",
      trackId,
      lessonId,
      unitId,
      domainId: domainRuntimeId,
      title: `${objective.title} practice`,
      estMinutes: Math.max(1, Math.min(20, domainQuestions.length * 2)),
      blocks,
    });
    if (answers.length > 0) {
      privateDocuments.push({
        id: `answerkey::${lessonId}`,
        type: "answerKey",
        trackId,
        lessonId,
        domainId: domainRuntimeId,
        items: answers,
      });
    }
    examDomains.push({
      id: domainRuntimeId,
      name: objective.title,
      weight: objective.weightPercent / 100,
    });
    trackUnits.push({
      id: unitId,
      domainId: domainRuntimeId,
      title: objective.title,
      lessons: [lessonId],
    });
  }

  publicDocuments.unshift({
    id: trackId,
    type: "track",
    trackId,
    code: certification.officialCode ?? certification.slug.toUpperCase(),
    title: certification.title,
    summary: track.summary,
    level: certification.level,
    domains: examDomains,
    units: trackUnits,
  });
  return { publicDocuments, privateDocuments };
}

function writeDocuments(root, channel, documents) {
  const channelRoot = resolve(root, channel);
  mkdirSync(channelRoot, { recursive: true });
  for (const document of documents.sort((left, right) =>
    compareOrdinal(left.id, right.id)
  )) {
    const fileName = `${document.id.replaceAll("::", "__")}.json`;
    writeFileSync(
      resolve(channelRoot, fileName),
      `${canonicalize(document)}\n`,
      "utf8"
    );
  }
}

function assertSafeOutputPath(root, outDir) {
  const allowedRoot = resolve(root, "dist");
  const relativeOutput = relative(allowedRoot, outDir);
  if (
    relativeOutput.length === 0 ||
    relativeOutput.startsWith("..") ||
    isAbsolute(relativeOutput)
  ) {
    throw new Error(
      "[runtime-compile] --out doit cibler un sous-repertoire dedie de dist/"
    );
  }

  mkdirSync(allowedRoot, { recursive: true });
  const allowedStat = lstatSync(allowedRoot);
  if (!allowedStat.isDirectory() || allowedStat.isSymbolicLink()) {
    throw new Error("[runtime-compile] dist/ doit etre un repertoire reel");
  }
  const realAllowedRoot = realpathSync(allowedRoot);
  let current = allowedRoot;
  for (const segment of relativeOutput.split(/[\\/]+/)) {
    current = resolve(current, segment);
    if (!existsSync(current)) continue;
    const stat = lstatSync(current);
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new Error(
        `[runtime-compile] chemin de sortie non sur: ${relative(root, current)}`
      );
    }
    const realCurrent = realpathSync(current);
    const realRelative = relative(realAllowedRoot, realCurrent);
    if (realRelative.startsWith("..") || isAbsolute(realRelative)) {
      throw new Error("[runtime-compile] chemin de sortie hors de dist/");
    }
  }
}

export async function compileRuntime(options = {}) {
  const root = resolve(options.root ?? cwd());
  const outDir = resolve(root, options.outDir ?? "dist/runtime-adapter");
  assertSafeOutputPath(root, outDir);
  const validation = await validateContent({ root });
  if (validation.errors.length > 0) {
    throw new Error(
      `[runtime-compile] corpus invalide: ${validation.errors.join("; ")}`
    );
  }
  if (validation.runtimeResourceCount === 0) {
    throw new Error("[runtime-compile] aucune ressource runtime canonique");
  }

  const catalog = loadJson(resolve(root, "content/public/catalog/certifications.json"));
  const tracks = await loadById(root, "content/public/runtime/tracks/**/*.json");
  const domains = await loadById(root, "content/public/runtime/domains/**/*.json");
  const units = await loadById(root, "content/public/runtime/units/**/*.json");
  const lessons = await loadById(root, "content/public/runtime/lessons/**/*.json");
  const concepts = await loadById(root, "content/public/runtime/concepts/**/*.json");
  const questions = await loadById(root, "content/public/questions/**/*.json");
  const solutions = await loadById(root, "content/answerKey/solutions/**/*.json");
  const publicDocuments = [];
  const privateDocuments = [];

  for (const track of [...tracks.values()].sort((left, right) =>
    compareOrdinal(left.id, right.id)
  )) {
    const certification = catalog.certifications.find(
      (entry) => entry.id === track.certificationId
    );
    const compiled =
      track.mode === "guided"
        ? compileGuidedTrack({
            track,
            certification,
            catalog,
            domains,
            units,
            lessons,
            concepts,
            questions,
            solutions,
          })
        : compileQuestionBankTrack({
            track,
            certification,
            catalog,
            domains,
            concepts,
            questions,
            solutions,
          });
    publicDocuments.push(...compiled.publicDocuments);
    privateDocuments.push(...compiled.privateDocuments);
  }

  rmSync(outDir, { recursive: true, force: true });
  writeDocuments(outDir, "public", publicDocuments);
  writeDocuments(outDir, "private", privateDocuments);
  const antiLeakReport = inspectPublicArtifact(resolve(outDir, "public"));
  return {
    output: relative(root, outDir).replaceAll("\\", "/"),
    publicDocumentCount: publicDocuments.length,
    privateDocumentCount: privateDocuments.length,
    antiLeakReport,
  };
}

function parseArgs(cliArgs) {
  const options = {};
  for (let index = 0; index < cliArgs.length; index++) {
    const argument = cliArgs[index];
    if (argument === "--root" || argument === "--out") {
      const value = cliArgs[++index];
      if (value === undefined || value.startsWith("-")) {
        throw new Error(`valeur manquante pour ${argument}`);
      }
      if (argument === "--root") options.root = value;
      else options.outDir = value;
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
      console.log(
        "Usage: node tools/compile_runtime.mjs [--root DIR] [--out DIR]"
      );
    } else {
      const result = await compileRuntime(options);
      console.log(
        `[runtime-compile] public=${result.publicDocumentCount}, private=${result.privateDocumentCount}, output=${result.output}`
      );
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
