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
} from "./lib/catalog.mjs";
import { compareOrdinal } from "./lib/deterministic.mjs";

const QUESTION_SCHEMA = "schemas/question.schema.json";
const SOLUTION_SCHEMA = "schemas/solution.schema.json";
const QUESTION_GLOB = "content/public/questions/**/*.json";
const SOLUTION_GLOB = "content/answerKey/solutions/**/*.json";
const PUBLIC_JSON_GLOB = "content/public/**/*.json";
const COVERAGE_GLOB = "content/public/coverage/**/*.json";
const FORBIDDEN_PUBLIC_KEYS = ["correct", "rationale"];
const OFFICIAL_SOURCE_HOSTS = {
  aws: ["aws.amazon.com", "d1.awsstatic.com", "docs.aws.amazon.com"],
  gcp: ["cloud.google.com", "services.google.com", "support.google.com"],
  microsoft: ["learn.microsoft.com"],
};

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
  return (
    left?.provider === right?.provider &&
    left?.certification === right?.certification &&
    left?.blueprintVersion === right?.blueprintVersion &&
    left?.objective === right?.objective
  );
}

function checkOfficialUrl(urlValue, provider, label, err) {
  let host;
  try {
    host = new URL(urlValue).hostname.toLowerCase();
  } catch {
    return;
  }
  if (!provider.sourceHosts.includes(host)) {
    err(`[catalog:provenance] ${label}: hote non officiel "${host}"`);
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
  if (data?.schemaVersion !== "v3") {
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

export function correctMatchesChoice(choices, correct) {
  return (
    Array.isArray(choices) &&
    typeof correct === "string" &&
    choices.some((choice) => typeof choice === "string" && choice === correct)
  );
}

export async function validateContent(options = {}) {
  const root = resolve(options.root ?? cwd());
  const errors = [];
  const err = (message) => errors.push(message);

  const validateQuestion = compileSchema(root, QUESTION_SCHEMA);
  const validateSolution = compileSchema(root, SOLUTION_SCHEMA);
  const validateCatalog = compileSchema(root, CATALOG_SCHEMA_PATH);
  const validateCoverage = compileSchema(root, COVERAGE_SCHEMA_PATH);

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
      validateMetadata({ data, file, channel: "public", catalogIndex, err });
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
        if (
          question?.metadata?.certification !== certification.id ||
          question?.metadata?.objective !== objective.id
        ) {
          err(
            `[coverage:question] ${file}: "${questionId}" absent ou rattache au mauvais objectif`
          );
        }
      }
    });
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
      if (question.data.schemaVersion !== "v3") continue;
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
    questionCount: questionFiles.length,
    solutionCount: solutionFiles.length,
    pairCount: [...publicIds.keys()].filter((id) => answerIds.has(id)).length,
    certificationCount: catalog?.certifications?.length ?? 0,
    coverageCount: coverageFiles.length,
  };
}

export function printValidationResult(result) {
  console.log("certigo-content validator");
  console.log(`  questions publiques : ${result.questionCount}`);
  console.log(`  solutions answerKey : ${result.solutionCount}`);
  console.log(`  certifications      : ${result.certificationCount}`);
  console.log(`  matrices couverture : ${result.coverageCount}`);

  if (result.errors.length > 0) {
    console.error(`\n${result.errors.length} violation(s) detectee(s) :`);
    for (const message of result.errors) console.error(`  - ${message}`);
    return false;
  }

  console.log("\nOK - schemas, catalogue, couverture, integrite et anti-fuite valides.");
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
