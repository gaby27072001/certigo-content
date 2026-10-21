#!/usr/bin/env node
// Content pipeline validator for certigo-content.

import { existsSync, lstatSync, readFileSync } from "node:fs";
import { basename, relative, resolve } from "node:path";
import { argv, cwd } from "node:process";
import { pathToFileURL } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { glob } from "glob";
import {
  CATALOG_PATH,
  CATALOG_SCHEMA_PATH,
  COVERAGE_SCHEMA_PATH,
  isCertificationActiveOn,
  isCertificationRecommendedOn,
} from "./lib/catalog.mjs";
import { compareOrdinal } from "./lib/deterministic.mjs";
import {
  isV5,
  v5PairViolations,
  v5QuestionViolations,
} from "./lib/exercise_v5.mjs";
import {
  CONTENT_MODE,
  detectContentMode,
  expectedSourcePath,
  resourceTypeFromSourcePath,
} from "./lib/resources.mjs";

const QUESTION_SCHEMA = "schemas/question.schema.json";
const SOLUTION_SCHEMA = "schemas/solution.schema.json";
const RUNTIME_SCHEMA = "schemas/runtime-resource.schema.json";
const QUESTION_GLOB = "content/public/questions/**/*.json";
const SOLUTION_GLOB = "content/answerKey/solutions/**/*.json";
const PUBLIC_JSON_GLOB = "content/public/**/*.json";
const COVERAGE_GLOB = "content/public/coverage/**/*.json";
const RUNTIME_GLOB = "content/public/runtime/**/*.json";
const FORBIDDEN_PUBLIC_KEYS = [
  "correct",
  "correctOptionIds",
  "explanation",
  "pairs",
  "rationale",
];
// Versions portant la metadata runtime (domainId, conceptId) et rattachees au graphe
// canonique. Les corriges de ces versions ne dupliquent pas la metadata.
const RUNTIME_ITEM_VERSIONS = ["v4", "v5"];

function isRuntimeItem(payload) {
  return RUNTIME_ITEM_VERSIONS.includes(payload?.schemaVersion);
}
const OFFICIAL_SOURCE_HOSTS = {
  aws: ["aws.amazon.com", "d1.awsstatic.com", "docs.aws.amazon.com"],
  gcp: ["cloud.google.com", "services.google.com", "support.google.com"],
  microsoft: ["learn.microsoft.com"],
};
export const EDITORIAL_DEBT_PATH = "config/editorial-debt.json";
export const LEGACY_COVERAGE_INVENTORY_PATH =
  "config/legacy-coverage-inventory.json";

// Un registre absent vaut "aucune dispense", jamais "tout est dispense" :
// supprimer le fichier doit durcir la validation, pas la neutraliser.
function loadLedger(root, path, collection, asOf) {
  const absolute = resolve(root, path);
  const byCertification = new Map();
  if (!existsSync(absolute)) return byCertification;
  const raw = readFileSync(absolute, "utf8");
  const document = JSON.parse(
    raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw
  );
  for (const entry of document[collection] ?? []) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.expiresOn ?? "")) {
      throw new Error(
        `[ledger] ${path}: ${entry.certification} porte une date expiresOn invalide (${entry.expiresOn})`
      );
    }
    // Une entree expiree cesse de dispenser : la dette redevient une erreur.
    if (asOf >= entry.expiresOn) continue;
    byCertification.set(
      entry.certification,
      new Set(entry.questionIds ?? [])
    );
  }
  return byCertification;
}

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

function compileSchema(root, path) {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  return ajv.compile(JSON.parse(readFileSync(resolve(root, path), "utf8")));
}

function formatSchemaErrors(prefix, file, validator, err) {
  for (const error of validator.errors ?? []) {
    err(`[schema:${prefix}] ${file}: ${error.instancePath || "/"} ${error.message}`);
  }
}

function toPosix(path) {
  return path.replaceAll("\\", "/");
}

function sameMetadata(left, right) {
  const common =
    left?.provider === right?.provider &&
    left?.certification === right?.certification &&
    left?.blueprintVersion === right?.blueprintVersion &&
    left?.objective === right?.objective;
  if (!common) return false;
  if (left?.domainId === undefined && right?.domainId === undefined) return true;
  return (
    left?.domainId === right?.domainId &&
    left?.conceptId === right?.conceptId
  );
}

function checkOfficialUrl(
  urlValue,
  provider,
  label,
  err,
  category = "[catalog:provenance]"
) {
  let host;
  try {
    host = new URL(urlValue).hostname.toLowerCase();
  } catch {
    err(`${category} ${label}: URL invalide "${urlValue}"`);
    return;
  }
  if (!provider.sourceHosts.includes(host)) {
    err(`${category} ${label}: hote non officiel "${host}"`);
  }
}

function validateSolutionProvenance({ data, file, catalogIndex, err }) {
  if (!Array.isArray(data?.provenance)) return;
  const provider = catalogIndex?.providers.get(data?.metadata?.provider);
  if (!provider) return;
  for (const url of data.provenance) {
    checkOfficialUrl(
      url,
      provider,
      file,
      err,
      "[solution:provenance]"
    );
  }
}

function validateTransitionDeclaration(certification, err) {
  const lifecycle = certification.lifecycle ?? {};
  const { transition, lastExamOn, successor } = lifecycle;
  if (transition === undefined) return;

  if (transition === "announced") {
    if (!lastExamOn) {
      err(
        `[catalog:transition] ${certification.id}: transition "announced" exige lastExamOn (date officielle de fin)`
      );
    }
    return;
  }

  // transition === "none-announced" : affirmation datee qu'aucune succession
  // n'est publiee. La fraicheur de cette affirmation est portee par
  // provenance.checkedOn et controlee par maxAgeDays.
  const declaredDates = ["lastExamOn", "recommendThrough"].filter((key) => lifecycle[key]);
  if (declaredDates.length > 0 || successor) {
    err(
      `[catalog:transition] ${certification.id}: transition "none-announced" est incompatible avec ${[
        ...declaredDates,
        ...(successor ? ["successor"] : []),
      ].join(", ")}; utiliser "announced"`
    );
  }
}

function validateCatalogSemantics(catalog, err) {
  const providerIds = new Set();
  const providers = new Map();
  const orderedProviderIds = catalog.providers.map((provider) => provider.id);
  if (
    orderedProviderIds.join("\n") !==
    [...orderedProviderIds].sort(compareOrdinal).join("\n")
  ) {
    err("[catalog:order] providers doit etre trie par id");
  }

  for (const provider of catalog.providers) {
    if (providerIds.has(provider.id)) {
      err(`[catalog:integrity] fournisseur duplique "${provider.id}"`);
    }
    providerIds.add(provider.id);
    providers.set(provider.id, provider);
    if (provider.namespace !== provider.id) {
      err(`[catalog:namespace] ${provider.id}: namespace doit etre identique a id`);
    }
    if (
      provider.sourceHosts.join("\n") !==
      OFFICIAL_SOURCE_HOSTS[provider.id].join("\n")
    ) {
      err(
        `[catalog:provenance] ${provider.id}: sourceHosts doit correspondre a l'allow-list officielle`
      );
    }
    if (provider.officialCatalogUrl !== null) {
      checkOfficialUrl(
        provider.officialCatalogUrl,
        provider,
        `${provider.id}.officialCatalogUrl`,
        err
      );
    }
  }

  const certificationIds = new Set();
  const slugs = new Set();
  const orderedCertificationIds = catalog.certifications.map(
    (certification) => certification.id
  );
  if (
    orderedCertificationIds.join("\n") !==
    [...orderedCertificationIds].sort(compareOrdinal).join("\n")
  ) {
    err("[catalog:order] certifications doit etre trie par id");
  }

  for (const certification of catalog.certifications) {
    const provider = providers.get(certification.provider);
    if (!provider) {
      err(
        `[catalog:integrity] ${certification.id}: fournisseur inconnu "${certification.provider}"`
      );
      continue;
    }
    if (certificationIds.has(certification.id)) {
      err(`[catalog:integrity] certification dupliquee "${certification.id}"`);
    }
    certificationIds.add(certification.id);
    const slugKey = `${certification.provider}:${certification.slug}`;
    if (slugs.has(slugKey)) {
      err(`[catalog:integrity] slug duplique "${slugKey}"`);
    }
    slugs.add(slugKey);
    if (certification.id !== slugKey) {
      err(
        `[catalog:namespace] ${certification.id}: attendu "${slugKey}" d'apres provider/slug`
      );
    }
    if (certification.provider === "aws" && certification.officialCode === null) {
      err(`[catalog:code] ${certification.id}: code AWS officiel requis`);
    }
    if (certification.provider === "gcp" && certification.officialCode !== null) {
      err(`[catalog:code] ${certification.id}: Google Cloud ne publie pas de code examen`);
    }
    if (
      ["active", "active-retiring"].includes(certification.status) &&
      !isCertificationActiveOn(certification, catalog.asOf)
    ) {
      err(
        `[catalog:lifecycle] ${certification.id}: statut ${certification.status} incompatible avec la date du snapshot ${catalog.asOf}`
      );
    }
    if (certification.status === "active-retiring") {
      const { lastExamOn, recommendThrough, reviewOn } = certification.lifecycle ?? {};
      if (!lastExamOn || !reviewOn) {
        err(
          `[catalog:lifecycle] ${certification.id}: lastExamOn et reviewOn sont requis pour active-retiring`
        );
      } else {
        if (recommendThrough && recommendThrough > lastExamOn) {
          err(
            `[catalog:lifecycle] ${certification.id}: recommendThrough ne peut pas depasser lastExamOn`
          );
        }
        if (reviewOn <= lastExamOn) {
          err(
            `[catalog:lifecycle] ${certification.id}: reviewOn doit etre posterieur a lastExamOn`
          );
        }
      }
    }

    validateTransitionDeclaration(certification, err);

    checkOfficialUrl(certification.officialUrl, provider, `${certification.id}.officialUrl`, err);
    checkOfficialUrl(certification.guide.url, provider, `${certification.id}.guide.url`, err);
    for (const source of certification.provenance.sources) {
      checkOfficialUrl(source.url, provider, `${certification.id}.provenance`, err);
    }

    const objectiveIds = new Set();
    let weightSum = 0;
    const expectedPrefix = certification.provider === "aws" ? "domain" : "section";
    certification.blueprint.objectives.forEach((objective, index) => {
      const expectedId = `${expectedPrefix}-${index + 1}`;
      if (objective.id !== expectedId) {
        err(
          `[catalog:objective] ${certification.id}: objectif ${objective.id}, attendu ${expectedId}`
        );
      }
      if (objectiveIds.has(objective.id)) {
        err(
          `[catalog:objective] ${certification.id}: objectif duplique "${objective.id}"`
        );
      }
      objectiveIds.add(objective.id);
      weightSum += objective.weightPercent;
      const expectedWeightType =
        certification.provider === "aws" ? "exact" : "approximate";
      if (objective.weightType !== expectedWeightType) {
        err(
          `[catalog:weight] ${certification.id}/${objective.id}: weightType attendu ${expectedWeightType}`
        );
      }
    });
    if (certification.provider === "aws" && weightSum !== 100) {
      err(`[catalog:weight] ${certification.id}: somme exacte ${weightSum}, attendu 100`);
    }
    if (
      certification.provider === "gcp" &&
      (weightSum < 99 || weightSum > 101)
    ) {
      err(
        `[catalog:weight] ${certification.id}: somme approximative ${weightSum}, attendu entre 99 et 101`
      );
    }
  }

  return { providers, certifications: new Map(catalog.certifications.map((item) => [item.id, item])) };
}

function validateMetadata({ data, file, channel, catalogIndex, err }) {
  if (!["v3", ...RUNTIME_ITEM_VERSIONS].includes(data?.schemaVersion)) {
    const legacyRoot =
      channel === "public"
        ? "content/public/questions/"
        : "content/answerKey/solutions/";
    const nested = toPosix(file).slice(legacyRoot.length).includes("/");
    if (nested) {
      err(`[namespace:path] ${file}: un payload v2 doit rester a plat`);
    }
    return;
  }

  if (isRuntimeItem(data) && channel === "answerKey") {
    const expectedPath = expectedSourcePath({
      artifact: "private",
      mode: CONTENT_MODE.runtime,
      resourceType: "solution",
      data,
    });
    if (toPosix(file) !== expectedPath) {
      err(`[namespace:path] ${file}: attendu ${expectedPath}`);
    }
    return;
  }

  const metadata = data.metadata;
  if (
    metadata === null ||
    Array.isArray(metadata) ||
    typeof metadata !== "object"
  ) {
    return;
  }
  const certification = catalogIndex?.certifications.get(metadata.certification);
  if (!certification) {
    err(
      `[metadata:certification] ${file}: certification inconnue "${metadata.certification}"`
    );
    return;
  }
  if (metadata.provider !== certification.provider) {
    err(
      `[metadata:provider] ${file}: provider ${metadata.provider}, attendu ${certification.provider}`
    );
  }
  if (metadata.blueprintVersion !== certification.blueprint.version) {
    err(
      `[metadata:blueprint] ${file}: version ${metadata.blueprintVersion}, attendu ${certification.blueprint.version}`
    );
  }
  if (
    !certification.blueprint.objectives.some(
      (objective) => objective.id === metadata.objective
    )
  ) {
    err(
      `[metadata:objective] ${file}: objectif inconnu "${metadata.objective}" pour ${certification.id}`
    );
  }

  const expectedIdPrefix = `${metadata.provider}.${certification.slug}.${metadata.objective}.`;
  if (!data.id.startsWith(expectedIdPrefix)) {
    err(
      `[namespace:id] ${file}: id doit commencer par "${expectedIdPrefix}"`
    );
  }
  const base =
    channel === "public"
      ? "content/public/questions"
      : "content/answerKey/solutions";
  const expectedPath = `${base}/${metadata.provider}/${certification.slug}/${data.id}.json`;
  if (toPosix(file) !== expectedPath) {
    err(`[namespace:path] ${file}: attendu ${expectedPath}`);
  }
}

export function correctMatchesChoice(question, solution) {
  if (isV5(question) || isV5(solution)) {
    return (
      isV5(question) &&
      isV5(solution) &&
      v5QuestionViolations(question).length === 0 &&
      v5PairViolations(question, solution).length === 0
    );
  }
  if (question?.schemaVersion === "v4") {
    const optionIds = new Set(
      Array.isArray(question.options)
        ? question.options
            .map((option) => option?.id)
            .filter((id) => typeof id === "string")
        : []
    );
    const correctIds = solution?.correctOptionIds;
    if (
      !Array.isArray(correctIds) ||
      correctIds.length === 0 ||
      !correctIds.every((id) => optionIds.has(id))
    ) {
      return false;
    }
    if (["mcq", "scenario", "spotTheIssue"].includes(question.itemType)) {
      return correctIds.length === 1;
    }
    return question.itemType === "multi";
  }
  return (
    Array.isArray(question?.choices) &&
    typeof solution?.correct === "string" &&
    question.choices.some(
      (choice) => typeof choice === "string" && choice === solution.correct
    )
  );
}

export function answerLengthMetrics(choices, correct) {
  if (
    !Array.isArray(choices) ||
    typeof correct !== "string" ||
    !choices.some((choice) => typeof choice === "string" && choice === correct)
  ) {
    return null;
  }
  const lengths = choices.map((choice) => choice.length);
  const correctLength = correct.length;
  const distractorLengths = choices
    .filter((choice) => choice !== correct)
    .map((choice) => choice.length);
  const meanDistractorLength =
    distractorLengths.reduce((total, length) => total + length, 0) /
    distractorLengths.length;
  return {
    choiceCount: choices.length,
    distinct: new Set(lengths).size === lengths.length,
    rank: [...lengths].sort((left, right) => left - right).indexOf(correctLength),
    ratio: correctLength / meanDistractorLength,
    position: choices.indexOf(correct),
  };
}

function validateRuntimeGraph({
  runtimeByType,
  catalog,
  catalogIndex,
  publicIds,
  answerIds,
  err,
}) {
    const tracks = runtimeByType.get("track");
    const domains = runtimeByType.get("domain");
    const units = runtimeByType.get("unit");
    const lessons = runtimeByType.get("lesson");
    const concepts = runtimeByType.get("concept");
    const trackByCertification = new Map();
    const referencedDomains = new Set();
    const referencedUnits = new Set();
    const referencedLessons = new Set();
    const referencedConcepts = new Set();
    const referencedQuestions = new Set();
    const questionBankCertIds = new Set();

    for (const { data: track, file } of tracks.values()) {
      if (trackByCertification.has(track.certificationId)) {
        err(
          `[runtime:track] ${file}: plusieurs tracks pour ${track.certificationId}`
        );
      } else {
        trackByCertification.set(track.certificationId, track);
      }
      if (track.mode === "questionBank") {
        questionBankCertIds.add(track.certificationId);
      }
      const certification = catalogIndex?.certifications.get(track.certificationId);
      const isDistributable = certification
        ? isCertificationRecommendedOn(certification, catalog?.asOf)
        : ["active", "retiring"].includes(track.lifecycle?.status);
      const mappedObjectives = new Set();
      for (const domainId of track.domainIds ?? []) {
        const domain = domains.get(domainId)?.data;
        if (!domain) {
          err(`[runtime:reference] ${file}: domain absent "${domainId}"`);
          continue;
        }
        referencedDomains.add(domainId);
        if (
          domain.certificationId !== track.certificationId ||
          domain.blueprintVersion !== track.blueprintVersion
        ) {
          err(`[runtime:context] ${file}: domain hors contexte "${domainId}"`);
        }
        if (mappedObjectives.has(domain.objectiveId)) {
          err(
            `[runtime:domain] ${file}: objectif mappe plusieurs fois "${domain.objectiveId}"`
          );
        }
        mappedObjectives.add(domain.objectiveId);
        if (isDistributable && track.mode === "questionBank") {
          const hasPairForDomain = [...publicIds.entries()].some(
            ([questionId, { data: question }]) =>
              answerIds?.has(questionId) &&
              question?.metadata?.certification === track.certificationId &&
              (isRuntimeItem(question)
                ? question.metadata?.domainId === domain.id
                : question.metadata?.objective === domain.objectiveId)
          );
          if (!hasPairForDomain) {
            err(
              `[runtime:domain-coverage] ${file}: piste distribuable "${track.id}" sans question pour le domaine "${domainId}"`
            );
          }
        }
      }
      for (const unitId of track.unitIds ?? []) {
        const unit = units.get(unitId)?.data;
        if (!unit) {
          err(`[runtime:reference] ${file}: unit absente "${unitId}"`);
          continue;
        }
        referencedUnits.add(unitId);
        if (
          unit.certificationId !== track.certificationId ||
          unit.blueprintVersion !== track.blueprintVersion ||
          !track.domainIds.includes(unit.domainId)
        ) {
          err(`[runtime:context] ${file}: unit hors contexte "${unitId}"`);
        }
      }
    }

    for (const { data: domain, file } of domains.values()) {
      const certification = catalogIndex?.certifications.get(domain.certificationId);
      const objective = certification?.blueprint.objectives.find(
        (item) => item.id === domain.objectiveId
      );
      if (!objective) {
        err(
          `[runtime:objective] ${file}: objectif catalogue inconnu "${domain.objectiveId}"`
        );
      }
      if (!referencedDomains.has(domain.id)) {
        err(`[runtime:orphan] ${file}: domain non reference par un track`);
      }
    }

    for (const { data: unit, file } of units.values()) {
      if (!referencedUnits.has(unit.id)) {
        err(`[runtime:orphan] ${file}: unit non referencee par un track`);
      }
      const domain = domains.get(unit.domainId)?.data;
      if (!domain) {
        err(`[runtime:reference] ${file}: domain absent "${unit.domainId}"`);
      } else if (domain.certificationId !== unit.certificationId) {
        err(`[runtime:context] ${file}: domain hors certification`);
      }
      for (const lessonId of unit.lessonIds ?? []) {
        const lesson = lessons.get(lessonId)?.data;
        if (!lesson) {
          err(`[runtime:reference] ${file}: lesson absente "${lessonId}"`);
          continue;
        }
        referencedLessons.add(lessonId);
        if (
          lesson.unitId !== unit.id ||
          lesson.certificationId !== unit.certificationId ||
          lesson.blueprintVersion !== unit.blueprintVersion
        ) {
          err(`[runtime:context] ${file}: lesson hors contexte "${lessonId}"`);
        }
      }
    }

    for (const { data: lesson, file } of lessons.values()) {
      if (!referencedLessons.has(lesson.id)) {
        err(`[runtime:orphan] ${file}: lesson non referencee par une unit`);
      }
      const unit = units.get(lesson.unitId)?.data;
      const domain = unit ? domains.get(unit.domainId)?.data : null;
      (lesson.blocks ?? []).forEach((block, index) => {
        const expectedBlockId = `${lesson.id}.block.${String(index + 1).padStart(3, "0")}`;
        if (block.id !== expectedBlockId) {
          err(`[runtime:block-order] ${file}: attendu "${expectedBlockId}"`);
        }
        const concept = concepts.get(block.conceptId)?.data;
        if (!concept) {
          err(`[runtime:reference] ${file}: concept absent "${block.conceptId}"`);
        } else {
          referencedConcepts.add(block.conceptId);
          if (
            concept.certificationId !== lesson.certificationId ||
            (domain && concept.domainId !== domain.id)
          ) {
            err(`[runtime:context] ${file}: concept hors contexte "${block.conceptId}"`);
          }
        }
        if (block.type !== "check") return;
        const question = publicIds.get(block.questionId)?.data;
        if (!question) {
          err(`[runtime:reference] ${file}: question absente "${block.questionId}"`);
          return;
        }
        referencedQuestions.add(block.questionId);
        if (
          !isRuntimeItem(question) ||
          question.metadata?.certification !== lesson.certificationId ||
          question.metadata?.domainId !== domain?.id ||
          question.metadata?.conceptId !== block.conceptId
        ) {
          err(`[runtime:context] ${file}: question hors contexte "${block.questionId}"`);
        }
      });
    }

    for (const { data: concept, file } of concepts.values()) {
      const domain = domains.get(concept.domainId)?.data;
      if (!domain) {
        err(`[runtime:reference] ${file}: domain absent "${concept.domainId}"`);
      } else if (
        domain.certificationId !== concept.certificationId ||
        domain.blueprintVersion !== concept.blueprintVersion
      ) {
        err(`[runtime:context] ${file}: domain hors contexte`);
      }
      if (!referencedConcepts.has(concept.id)) {
        // In questionBank mode, concepts are resolved at compile time —
        // the compiler generates synthetic lessons that reference them.
        if (questionBankCertIds.has(concept.certificationId)) continue;
        const usedByQuestion = [...publicIds.values()].some(
          ({ data }) =>
            isRuntimeItem(data) && data.metadata?.conceptId === concept.id
        );
        if (!usedByQuestion) {
          err(`[runtime:orphan] ${file}: concept sans bloc ni question`);
        }
      }
    }

    for (const [questionId, { data: question, file }] of publicIds) {
      if (!isRuntimeItem(question)) continue;
      const domain = domains.get(question.metadata?.domainId)?.data;
      const concept = concepts.get(question.metadata?.conceptId)?.data;
      if (!domain || !concept) {
        err(`[runtime:reference] ${file}: domain ou concept runtime absent`);
        continue;
      }
      if (
        domain.certificationId !== question.metadata.certification ||
        domain.objectiveId !== question.metadata.objective ||
        concept.domainId !== domain.id
      ) {
        err(`[runtime:context] ${file}: liens domain/concept/objective divergents`);
      }
      const track = trackByCertification.get(question.metadata.certification);
      if (!track) {
        err(`[runtime:reference] ${file}: track absent`);
      } else if (track.mode === "guided" && !referencedQuestions.has(questionId)) {
        err(`[runtime:orphan] ${file}: question guidee absente des lessons`);
      }
    }
}

export async function validateContent(options = {}) {
  const root = resolve(options.root ?? cwd());
  const errors = [];
  const err = (message) => errors.push(message);

  const validateQuestion = compileSchema(root, QUESTION_SCHEMA);
  const validateSolution = compileSchema(root, SOLUTION_SCHEMA);
  const validateCatalog = compileSchema(root, CATALOG_SCHEMA_PATH);
  const validateCoverage = compileSchema(root, COVERAGE_SCHEMA_PATH);
  const validateRuntime = compileSchema(root, RUNTIME_SCHEMA);
  const contentMode = detectContentMode(root);
  const asOf = options.asOf ?? new Date().toISOString().slice(0, 10);
  const editorialDebt = loadLedger(root, EDITORIAL_DEBT_PATH, "debts", asOf);
  const legacyCoverage = loadLedger(
    root,
    LEGACY_COVERAGE_INVENTORY_PATH,
    "inventories",
    asOf
  );

  const questionFiles = (await glob(QUESTION_GLOB, { cwd: root, posix: true })).sort(
    compareOrdinal
  );
  const solutionFiles = (await glob(SOLUTION_GLOB, { cwd: root, posix: true })).sort(
    compareOrdinal
  );
  const publicJsonFiles = (await glob(PUBLIC_JSON_GLOB, {
    cwd: root,
    posix: true,
  })).sort(compareOrdinal);
  const coverageFiles = (await glob(COVERAGE_GLOB, { cwd: root, posix: true })).sort(
    compareOrdinal
  );
  const runtimeFiles = (await glob(RUNTIME_GLOB, { cwd: root, posix: true })).sort(
    compareOrdinal
  );

  for (const file of publicJsonFiles) {
    try {
      const { raw } = loadRegularJson(root, file);
      for (const key of FORBIDDEN_PUBLIC_KEYS) {
        if (new RegExp(`"${key}"\\s*:`, "i").test(raw)) {
          err(
            `[anti-leak] ${file}: motif "${key}" detecte dans les octets bruts du fichier public`
          );
        }
      }
    } catch (error) {
      err(`[anti-leak] ${file}: lecture impossible (${error.message})`);
    }
  }

  let catalog = null;
  let catalogIndex = null;
  const catalogFile = CATALOG_PATH;
  if (existsSync(resolve(root, catalogFile))) {
    try {
      ({ data: catalog } = loadRegularJson(root, catalogFile));
      if (!validateCatalog(catalog)) {
        formatSchemaErrors("catalog", catalogFile, validateCatalog, err);
      } else {
        catalogIndex = validateCatalogSemantics(catalog, err);
      }
    } catch (error) {
      err(`[schema:catalog] ${catalogFile}: JSON invalide (${error.message})`);
    }
  } else if (coverageFiles.length > 0) {
    err(`[catalog:integrity] matrices presentes sans ${catalogFile}`);
  }

  const publicIds = new Map();
  const answerIds = new Map();
  const answerLengthsByCertification = new Map();
  const publicLegacyIds = new Map();

  for (const file of questionFiles) {
    let data;
    try {
      ({ data } = loadRegularJson(root, file));
    } catch (error) {
      err(`[schema:question] ${file}: JSON invalide (${error.message})`);
      continue;
    }
    if (!validateQuestion(data)) {
      formatSchemaErrors("question", file, validateQuestion, err);
    }
    if (data?.schemaVersion === "v4" && Array.isArray(data.options)) {
      const optionIds = data.options
        .map((option) => option?.id)
        .filter((id) => typeof id === "string");
      if (new Set(optionIds).size !== optionIds.length) {
        err(`[integrity:option-id] ${file}: ids d'option dupliques`);
      }
    }
    if (isV5(data)) {
      for (const { rule, message } of v5QuestionViolations(data)) {
        err(`[v5:${rule}] ${file}: ${message}`);
      }
    }
    if (typeof data?.id === "string") {
      if (basename(file, ".json") !== data.id) {
        err(`[integrity:path-id] ${file}: nom de fichier different de id "${data.id}"`);
      }
      if (publicIds.has(data.id)) {
        err(
          `[integrity] id public duplique "${data.id}" (${publicIds.get(data.id).file} & ${file})`
        );
      } else {
        publicIds.set(data.id, { file, data });
      }
      if (isRuntimeItem(data) && typeof data.legacyId === "string") {
        if (publicLegacyIds.has(data.legacyId)) {
          err(
            `[integrity:legacy-id] ${file}: alias question duplique "${data.legacyId}"`
          );
        } else {
          publicLegacyIds.set(data.legacyId, file);
        }
      }
      validateMetadata({ data, file, channel: "public", catalogIndex, err });
    }
  }
  for (const [legacyId, file] of publicLegacyIds) {
    if (publicIds.has(legacyId)) {
      err(
        `[integrity:legacy-id] ${file}: alias "${legacyId}" collisionne avec un id canonique`
      );
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
      formatSchemaErrors("solution", file, validateSolution, err);
    }
    if (typeof data?.id === "string") {
      if (basename(file, ".json") !== data.id) {
        err(`[integrity:path-id] ${file}: nom de fichier different de id "${data.id}"`);
      }
      if (answerIds.has(data.id)) {
        err(
          `[integrity] id answerKey duplique "${data.id}" (${answerIds.get(data.id).file} & ${file})`
        );
      } else {
        answerIds.set(data.id, { file, data });
      }
      validateMetadata({ data, file, channel: "answerKey", catalogIndex, err });
      validateSolutionProvenance({ data, file, catalogIndex, err });
    }
  }

  const runtimeByType = new Map(
    ["track", "domain", "unit", "lesson", "concept"].map((type) => [
      type,
      new Map(),
    ])
  );
  const runtimeLegacyIds = new Map();
  for (const file of runtimeFiles) {
    let data;
    try {
      ({ data } = loadRegularJson(root, file));
    } catch (error) {
      err(`[schema:runtime] ${file}: JSON invalide (${error.message})`);
      continue;
    }
    if (!validateRuntime(data)) {
      formatSchemaErrors("runtime", file, validateRuntime, err);
    }
    const pathResourceType = resourceTypeFromSourcePath(file);
    const resourceType = data?.resourceType;
    if (
      typeof resourceType !== "string" ||
      !runtimeByType.has(resourceType)
    ) {
      err(`[runtime:type] ${file}: resourceType runtime inconnu`);
      continue;
    }
    if (pathResourceType !== resourceType) {
      err(
        `[runtime:type] ${file}: dossier ${pathResourceType ?? "inconnu"} divergent de ${resourceType}`
      );
    }
    if (typeof data.id !== "string") continue;
    if (basename(file, ".json") !== data.id) {
      err(`[integrity:path-id] ${file}: nom de fichier different de id "${data.id}"`);
    }
    const expectedPath = expectedSourcePath({
      artifact: "public",
      mode: CONTENT_MODE.runtime,
      resourceType,
      data,
    });
    if (toPosix(file) !== expectedPath) {
      err(`[runtime:path] ${file}: attendu ${expectedPath}`);
    }
    const resources = runtimeByType.get(resourceType);
    if (resources.has(data.id)) {
      err(`[runtime:integrity] id ${resourceType} duplique "${data.id}"`);
    } else {
      resources.set(data.id, { file, data });
    }
    if (typeof data.legacyId === "string") {
      if (runtimeLegacyIds.has(data.legacyId)) {
        err(
          `[runtime:legacy-id] ${file}: alias duplique "${data.legacyId}" avec ${runtimeLegacyIds.get(data.legacyId)}`
        );
      } else {
        runtimeLegacyIds.set(data.legacyId, file);
      }
    }
    const certification = catalogIndex?.certifications.get(data.certificationId);
    if (!certification) {
      err(
        `[runtime:certification] ${file}: certification inconnue "${data.certificationId}"`
      );
      continue;
    }
    if (data.blueprintVersion !== certification.blueprint.version) {
      err(
        `[runtime:blueprint] ${file}: version ${data.blueprintVersion}, attendu ${certification.blueprint.version}`
      );
    }
    const expectedIdPrefix = `${certification.provider}.${certification.slug}.${resourceType}.`;
    if (!data.id.startsWith(expectedIdPrefix)) {
      err(`[runtime:id] ${file}: id doit commencer par "${expectedIdPrefix}"`);
    }
    if (
      ["retired", "replaced"].includes(certification.status) &&
      !["retired", "replaced"].includes(data.lifecycle?.status)
    ) {
      err(`[runtime:lifecycle] ${file}: ressource active sous certification retiree`);
    }
  }

  if (
    contentMode !== CONTENT_MODE.runtime &&
    [...publicIds.values()].some(({ data }) => isRuntimeItem(data))
  ) {
    err("[runtime:missing] une question v4 ou v5 exige un graphe runtime canonique");
  }

  for (const [id, question] of publicIds) {
    if (!answerIds.has(id)) {
      err(`[integrity] question publique "${id}" (${question.file}) SANS solution answerKey`);
      continue;
    }
    const solution = answerIds.get(id);
    if (isV5(question.data) || isV5(solution.data)) {
      // Une paire v5 se juge sur les regles croisees X1 a X9, chacune nommee. Les regles
      // qui ne dependent que de la question (X2 et une partie de X6/X7) ont deja ete
      // signalees fichier par fichier. Une paire dont un seul fichier est en v5 est
      // signalee par [integrity:schema-version] ci-dessous.
      if (isV5(question.data) && isV5(solution.data)) {
        for (const { rule, message } of v5PairViolations(question.data, solution.data)) {
          err(`[v5:${rule}] paire "${id}" (${solution.file}): ${message}`);
        }
      }
    } else if (!correctMatchesChoice(question.data, solution.data)) {
      err(
        `[integrity:correct-choice] solution "${id}" (${solution.file}): la reponse doit correspondre exactement aux options publiques dans ${question.file} (egalite stricte, sans conversion de casse, trim ni normalisation Unicode)`
      );
    } else if (question.data.schemaVersion === "v3") {
      const certification = question.data.metadata?.certification;
      const metrics = answerLengthMetrics(
        question.data.choices,
        solution.data.correct
      );
      if (typeof certification === "string" && metrics !== null) {
        const entries = answerLengthsByCertification.get(certification) ?? [];
        entries.push({
          id,
          ...metrics,
          exempt: editorialDebt.get(certification)?.has(id) === true,
        });
        answerLengthsByCertification.set(certification, entries);
      }
    }
    if (question.data.schemaVersion !== solution.data.schemaVersion) {
      err(
        `[integrity:schema-version] paire "${id}": ${question.data.schemaVersion} != ${solution.data.schemaVersion}`
      );
    }
    if (
      question.data.schemaVersion === "v3" &&
      !sameMetadata(question.data.metadata, solution.data.metadata)
    ) {
      err(`[integrity:metadata] paire "${id}": metadata public/answerKey divergentes`);
    }
    const publicRelative = toPosix(
      relative(resolve(root, "content/public/questions"), resolve(root, question.file))
    );
    const privateRelative = toPosix(
      relative(resolve(root, "content/answerKey/solutions"), resolve(root, solution.file))
    );
    if (publicRelative !== privateRelative) {
      err(
        `[integrity:path-pair] paire "${id}": chemins relatifs public/answerKey divergents`
      );
    }
  }
  for (const [id, solution] of answerIds) {
    if (!publicIds.has(id)) {
      err(`[integrity] solution answerKey "${id}" (${solution.file}) SANS question publique`);
    }
  }

  if (runtimeFiles.length > 0) {
    validateRuntimeGraph({
      runtimeByType,
      catalog,
      catalogIndex,
      publicIds,
      answerIds,
      err,
    });
  }

  const coverageByCertification = new Map();
  for (const file of coverageFiles) {
    let matrix;
    try {
      ({ data: matrix } = loadRegularJson(root, file));
    } catch (error) {
      err(`[schema:coverage] ${file}: JSON invalide (${error.message})`);
      continue;
    }
    if (!validateCoverage(matrix)) {
      formatSchemaErrors("coverage", file, validateCoverage, err);
      continue;
    }
    if (coverageByCertification.has(matrix.certification)) {
      err(`[coverage:integrity] matrice dupliquee "${matrix.certification}"`);
      continue;
    }
    coverageByCertification.set(matrix.certification, { file, matrix });
    const certification = catalogIndex?.certifications.get(matrix.certification);
    if (!certification) {
      err(`[coverage:integrity] ${file}: certification inconnue "${matrix.certification}"`);
      continue;
    }
    const expectedPath = `content/public/coverage/${certification.provider}/${certification.slug}.json`;
    if (toPosix(file) !== expectedPath) {
      err(`[coverage:path] ${file}: attendu ${expectedPath}`);
    }
    if (
      matrix.provider !== certification.provider ||
      matrix.blueprintVersion !== certification.blueprint.version
    ) {
      err(`[coverage:metadata] ${file}: provider ou blueprintVersion divergent du catalogue`);
    }
    if (
      certification.status === "active-retiring" &&
      matrix.status !== "retiring"
    ) {
      err(`[coverage:lifecycle] ${file}: statut retiring requis`);
    }
    if (
      certification.status === "active" &&
      ["retiring", "retired"].includes(matrix.status)
    ) {
      err(`[coverage:lifecycle] ${file}: statut ${matrix.status} incompatible avec active`);
    }
    if (
      ["retired", "replaced"].includes(certification.status) &&
      matrix.status !== "retired"
    ) {
      err(`[coverage:lifecycle] ${file}: statut retired requis`);
    }
    if (matrix.objectives.length !== certification.blueprint.objectives.length) {
      err(`[coverage:objectives] ${file}: nombre d'objectifs divergent du catalogue`);
    }
    certification.blueprint.objectives.forEach((objective, index) => {
      const covered = matrix.objectives[index];
      if (
        covered === undefined ||
        covered.objective !== objective.id ||
        covered.title !== objective.title ||
        covered.weightPercent !== objective.weightPercent ||
        covered.weightType !== objective.weightType
      ) {
        err(
          `[coverage:objectives] ${file}: objectif ${objective.id} divergent du catalogue`
        );
        return;
      }
      for (const questionId of covered.questionIds) {
        const question = publicIds.get(questionId)?.data;
        if (!question) {
          err(
            `[coverage:question] ${file}: "${questionId}" absent ou rattache au mauvais objectif`
          );
        } else if (question.metadata) {
          // v3/v4/v5 questions carry metadata — verify certification+objective match
          if (
            question.metadata.certification !== certification.id ||
            question.metadata.objective !== objective.id
          ) {
            err(
              `[coverage:question] ${file}: "${questionId}" absent ou rattache au mauvais objectif`
            );
          }
        } else if (
          legacyCoverage.get(certification.id)?.has(questionId) !== true
        ) {
          // Une question v2 ne porte aucune metadonnee : rien dans le fichier ne
          // la rattache a une certification. L'inventaire est donc le seul
          // rattachement verifiable, et son absence doit echouer — sinon
          // n'importe quelle question peut etre reliee a n'importe quel examen.
          err(
            `[coverage:question] ${file}: "${questionId}" est une question heritee (v2) absente de ${LEGACY_COVERAGE_INVENTORY_PATH} pour ${certification.id}`
          );
        }
      }
    });
  }

  for (const [certification, coverage] of coverageByCertification) {
    const referencedQuestionCount = coverage.matrix.objectives.reduce(
      (total, objective) => total + objective.questionIds.length,
      0
    );
    if (referencedQuestionCount === 0) continue;
    const entries = answerLengthsByCertification.get(certification) ?? [];
    for (const entry of entries) {
      if (entry.exempt) continue;
      if (entry.choiceCount !== 4) {
        err(
          `[editorial:answer-length] paire "${entry.id}": exactement quatre choix sont requis`
        );
        continue;
      }
      if (!entry.distinct) {
        err(
          `[editorial:answer-length] paire "${entry.id}": les quatre choix doivent avoir des longueurs distinctes`
        );
      }
      if (entry.ratio < 0.85 || entry.ratio > 1.15) {
        err(
          `[editorial:answer-length] paire "${entry.id}": ratio de longueur ${entry.ratio.toFixed(3)}, attendu entre 0.85 et 1.15`
        );
      }
    }
    // L'equilibre des rangs est un invariant de cohorte : il n'a de sens qu'une
    // fois la dette de la certification soldee. Tant qu'il reste des questions
    // dispensees, la cohorte est incomplete et le mesurer punirait la
    // correction progressive au lieu de la recompenser.
    //
    // ANGLE MORT ASSUME, ET MESURE. Les deux controles de cohorte ci-dessous
    // (rangs ET positions) sont MUETS tant qu'une seule question de la
    // certification figure au registre de dette : un identifiant residuel
    // suffit a les eteindre entierement, et `validate` rend alors VERT sur un
    // corpus desequilibre. Ils protegent les cohortes ENTIEREMENT remediees
    // contre une regression future, pas les cohortes en cours de traitement.
    // Sequence obligatoire pour une remediation : vider le registre PUIS
    // valider. Un vert obtenu avant le retrait ne dit rien de ces deux axes.
    const exemptCount = entries.filter((entry) => entry.exempt).length;
    if (
      exemptCount === 0 &&
      entries.every((entry) => entry.choiceCount === 4) &&
      entries.length >= 4
    ) {
      const minimumPerRank = Math.floor(entries.length / 4);
      const maximumPerRank = Math.ceil(entries.length / 4);
      const ranks = [0, 0, 0, 0];
      for (const entry of entries) ranks[entry.rank]++;
      if (
        ranks.some(
          (count) => count < minimumPerRank || count > maximumPerRank
        )
      ) {
        const expected =
          minimumPerRank === maximumPerRank
            ? `${minimumPerRank}/${minimumPerRank}/${minimumPerRank}/${minimumPerRank}`
            : `chaque rang entre ${minimumPerRank} et ${maximumPerRank}`;
        err(
          `[editorial:answer-length] ${certification}: rangs de longueur ${ranks.join("/")}, attendu ${expected}`
        );
      }
      // Meme invariant de cohorte, meme porte et memes bornes, applique a la
      // POSITION de la bonne reponse. Le rang mesure si elle se repere a sa
      // longueur ; la position mesure si elle se repere a son index. Les deux
      // sont exploitables sans lire l'enonce, et un corpus peut etre equilibre
      // sur l'un tout en etant degenere sur l'autre : les bornes sont donc
      // partagees, mais les deux distributions sont comptees separement.
      const positions = [0, 0, 0, 0];
      for (const entry of entries) positions[entry.position]++;
      if (
        positions.some(
          (count) => count < minimumPerRank || count > maximumPerRank
        )
      ) {
        const expectedPositions =
          minimumPerRank === maximumPerRank
            ? `${minimumPerRank}/${minimumPerRank}/${minimumPerRank}/${minimumPerRank}`
            : `chaque position entre ${minimumPerRank} et ${maximumPerRank}`;
        err(
          `[editorial:answer-position] ${certification}: positions de la bonne reponse ${positions.join("/")}, attendu ${expectedPositions}`
        );
      }
    }
  }

  if (catalogIndex) {
    for (const certification of catalog.certifications.filter((item) =>
      isCertificationActiveOn(item, catalog.asOf)
    )) {
      if (!coverageByCertification.has(certification.id)) {
        err(`[coverage:missing] matrice absente pour "${certification.id}"`);
      }
    }
    for (const [id, question] of publicIds) {
      if (!["v3", ...RUNTIME_ITEM_VERSIONS].includes(question.data.schemaVersion)) continue;
      if (
        question.data.metadata === null ||
        Array.isArray(question.data.metadata) ||
        typeof question.data.metadata !== "object"
      ) {
        continue;
      }
      const matrix = coverageByCertification.get(
        question.data.metadata.certification
      )?.matrix;
      const objective = matrix?.objectives.find(
        (item) => item.objective === question.data.metadata.objective
      );
      if (!objective?.questionIds.includes(id)) {
        err(`[coverage:missing-question] "${id}" absent de sa matrice de couverture`);
      }
    }
  }

  return {
    errors,
    ledger: {
      asOf,
      editorialDebtCount: [...editorialDebt.values()].reduce(
        (total, ids) => total + ids.size,
        0
      ),
      legacyCoverageCount: [...legacyCoverage.values()].reduce(
        (total, ids) => total + ids.size,
        0
      ),
    },
    questionCount: questionFiles.length,
    solutionCount: solutionFiles.length,
    pairCount: [...publicIds.keys()].filter((id) => answerIds.has(id)).length,
    certificationCount: catalog?.certifications?.length ?? 0,
    coverageCount: coverageFiles.length,
    runtimeResourceCount: runtimeFiles.length,
  };
}

export function printValidationResult(result) {
  console.log("certigo-content validator");
  console.log(`  questions publiques : ${result.questionCount}`);
  console.log(`  solutions answerKey : ${result.solutionCount}`);
  console.log(`  certifications      : ${result.certificationCount}`);
  console.log(`  matrices couverture : ${result.coverageCount}`);
  console.log(`  ressources runtime  : ${result.runtimeResourceCount}`);
  if (result.ledger) {
    console.log(
      `  dette dispensee     : ${result.ledger.editorialDebtCount} paire(s) editoriale(s), ${result.ledger.legacyCoverageCount} question(s) v2 heritee(s) (au ${result.ledger.asOf})`
    );
  }

  if (result.errors.length > 0) {
    console.error(`\n${result.errors.length} violation(s) detectee(s) :`);
    for (const message of result.errors) console.error(`  - ${message}`);
    return false;
  }

  console.log(
    "\nOK - schemas, catalogue, couverture, provenance, integrite, equilibre editorial et anti-fuite valides."
  );
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
    } else if (argument === "--as-of") {
      const value = cliArgs[++index];
      if (value === undefined || value.startsWith("-")) {
        throw new Error("valeur manquante pour --as-of");
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new Error(`--as-of attend une date AAAA-MM-JJ, recu: ${value}`);
      }
      options.asOf = value;
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
        "Usage: node tools/validate_content.mjs [--root DIR] [--as-of AAAA-MM-JJ]"
      );
      console.log(
        "  --as-of  evalue les registres a une date donnee. Les dispenses de"
      );
      console.log(
        "           config/editorial-debt.json expirent, et plusieurs controles"
      );
      console.log(
        "           restent eteints tant qu'une dispense subsiste : dater la"
      );
      console.log(
        "           validation apres l'expiration montre ce qu'ils diront alors."
      );
    } else {
      const result = await validateContent(options);
      if (!printValidationResult(result)) process.exitCode = 1;
    }
  } catch (error) {
    console.error(`[validator] erreur fatale: ${error.message}`);
    process.exitCode = 1;
  }
}
