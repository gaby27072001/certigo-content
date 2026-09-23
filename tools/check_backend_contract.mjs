#!/usr/bin/env node

// Garde « expand avant usage » : le contenu ne doit utiliser que ce que le
// backend Certigo accepte deja a l'import.
//
// Le backend revalide chaque release contre SES copies embarquees des schemas
// (ContentContractVerifier + JsonSchemaContentContractValidator). Une forme que
// ce depot a ajoutee a ses propres schemas, et que le backend ignore encore, est
// donc refusee a l'import, apres une publication irreversible. Incident mesure le
// 2026-09-23 : `lifecycle.transition`, ajoute par la PR #84, faisait refuser
// tout le catalogue, alors que `validate` et les tests restaient verts ici.
//
// Les deux depots sont prives : la CI de ce depot ne peut pas lire Certigo. La
// garde s'appuie donc sur une copie des schemas du backend, figee a une revision
// Certigo nommee, et verifie deux choses :
//   1. la copie est integre : ses empreintes sont celles de SOURCE.json ;
//   2. tout ce que le paquet livre (descripteur, manifestes, charges utiles) est
//      accepte par cette copie.
// Un schema de ce depot en avance sur la copie n'est qu'une note : seul l'usage
// d'une forme refusee fait echouer.
// La copie ne se met a jour qu'avec --sync-from, depuis un checkout Certigo dont
// la revision est enregistree : c'est l'etape « expand » cote backend, faite
// avant l'usage cote contenu.

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { argv, cwd } from "node:process";
import { pathToFileURL } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { packageContent } from "./package_content.mjs";

export const BACKEND_SCHEMAS_DIRECTORY = "config/backend-accepted-schemas";
export const BACKEND_SOURCE_FILE = "SOURCE.json";
export const BACKEND_SOURCE_SCHEMA = "certigo.backend-accepted-schemas/v1";
export const BACKEND_REPOSITORY = "gchambaud_microsoft/Certigo";
export const BACKEND_SCHEMA_PATH =
  "backend/src/Certigo.Infrastructure/ContentContracts/Schemas";
const CONTENT_SCHEMAS_DIRECTORY = "schemas";

// Miroir de ContentContractVerifier.ValidatePayloadSchema cote Certigo.
const SCHEMA_BY_RESOURCE_TYPE = {
  certificationCatalog: "certification-catalog.schema.json",
  coverageMatrix: "coverage-matrix.schema.json",
  question: "question.schema.json",
  solution: "solution.schema.json",
  track: "runtime-resource.schema.json",
  domain: "runtime-resource.schema.json",
  unit: "runtime-resource.schema.json",
  lesson: "runtime-resource.schema.json",
  concept: "runtime-resource.schema.json",
};
const RELEASE_SCHEMA = "content-release.schema.json";
const PACKAGE_MANIFEST_SCHEMA = "package-manifest.schema.json";

const EXPAND_FIRST =
  "Regle « expand avant usage » : faire d'abord accepter cette forme par le backend " +
  "(PR Certigo sur " +
  BACKEND_SCHEMA_PATH +
  "), la fusionner, puis resynchroniser la copie avec " +
  "`npm run contract:backend -- --sync-from <checkout Certigo>` avant de l'utiliser ici.";

// Empreinte independante du poste : un checkout Windows en core.autocrlf=true
// voit des CRLF que l'objet git ne contient pas. On hache les octets en LF, ce
// qui rend la valeur verifiable par `git show <revision>:<chemin> | sha256sum`.
export function normalizedSha256(buffer) {
  const text = buffer.toString("utf8").replace(/\r\n/g, "\n");
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function readJson(path) {
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw);
}

function schemaFileNames(directory) {
  return readdirSync(directory)
    .filter((name) => name.endsWith(".schema.json"))
    .sort();
}

export function loadBackendContract(options = {}) {
  const root = resolve(options.root ?? cwd());
  const directory = resolve(root, BACKEND_SCHEMAS_DIRECTORY);
  const sourcePath = resolve(directory, BACKEND_SOURCE_FILE);
  const errors = [];
  // Une copie absente vaut « rien n'est accepte », jamais « tout l'est » : la
  // garde doit durcir, pas se neutraliser.
  if (!existsSync(sourcePath)) {
    return {
      errors: [`${BACKEND_SCHEMAS_DIRECTORY}/${BACKEND_SOURCE_FILE} introuvable : garde inoperante`],
      source: null,
      schemas: new Map(),
    };
  }
  const source = readJson(sourcePath);
  if (source.schema !== BACKEND_SOURCE_SCHEMA) {
    errors.push(`${BACKEND_SOURCE_FILE}.schema: attendu ${BACKEND_SOURCE_SCHEMA}`);
  }
  if (source.repository !== BACKEND_REPOSITORY || source.path !== BACKEND_SCHEMA_PATH) {
    errors.push(
      `${BACKEND_SOURCE_FILE}: source attendue ${BACKEND_REPOSITORY}:${BACKEND_SCHEMA_PATH}`
    );
  }
  if (typeof source.revision !== "string" || !/^[0-9a-f]{40}$/.test(source.revision)) {
    errors.push(`${BACKEND_SOURCE_FILE}.revision: SHA git complet attendu`);
  }
  const listed = Object.keys(source.files ?? {}).sort();
  if (listed.length === 0) {
    errors.push(`${BACKEND_SOURCE_FILE}.files: aucun schema declare`);
  }
  const present = schemaFileNames(directory);
  for (const name of present) {
    if (!listed.includes(name)) {
      errors.push(`${BACKEND_SCHEMAS_DIRECTORY}/${name}: absent de ${BACKEND_SOURCE_FILE}`);
    }
  }
  const schemas = new Map();
  for (const name of listed) {
    const path = resolve(directory, name);
    if (!existsSync(path)) {
      errors.push(`${BACKEND_SCHEMAS_DIRECTORY}/${name}: declare mais absent`);
      continue;
    }
    const digest = normalizedSha256(readFileSync(path));
    if (digest !== source.files[name]) {
      errors.push(
        `${BACKEND_SCHEMAS_DIRECTORY}/${name}: copie modifiee hors synchronisation ` +
          `(sha256 ${digest}, ${BACKEND_SOURCE_FILE} declare ${source.files[name]}). ${EXPAND_FIRST}`
      );
      continue;
    }
    schemas.set(name, readJson(path));
  }
  return { errors, source, schemas };
}

function describeAjvErrors(validationErrors) {
  return validationErrors
    .slice(0, 3)
    .map((error) =>
      error.keyword === "additionalProperties"
        ? `${error.instancePath || "/"}: propriete inconnue du backend "${error.params.additionalProperty}"`
        : `${error.instancePath || "/"} ${error.message}`
    )
    .join(" | ");
}

function resourceTypeOf(file, channel) {
  if (typeof file.resourceType === "string" && file.resourceType.length > 0) {
    return file.resourceType;
  }
  if (channel === "private") return "solution";
  if (file.path?.startsWith("questions/")) return "question";
  if (file.path === "catalog/certifications.json") return "certificationCatalog";
  if (file.path?.startsWith("coverage/")) return "coverageMatrix";
  for (const type of ["track", "domain", "unit", "lesson", "concept"]) {
    if (file.path?.startsWith(`runtime/${type}s/`)) return type;
  }
  return null;
}

export function validatePackagedPayloads({ distDir, schemas, resourceTypes = null }) {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  for (const [name, schema] of schemas) ajv.addSchema(schema, name);
  const compiled = new Map();
  const validatorFor = (name) => {
    if (!compiled.has(name)) compiled.set(name, schemas.has(name) ? ajv.getSchema(name) : null);
    return compiled.get(name);
  };
  const selected = (type) => resourceTypes === null || resourceTypes.includes(type);
  const errors = [];
  const counts = {};
  const check = (label, schemaName, value) => {
    const validate = validatorFor(schemaName);
    if (!validate) {
      errors.push(`${label}: schema backend ${schemaName} indisponible. ${EXPAND_FIRST}`);
      return;
    }
    if (!validate(value)) {
      errors.push(
        `${label}: refuse par le backend (${schemaName}) : ${describeAjvErrors(validate.errors)}`
      );
    }
  };

  const releasePath = resolve(distDir, "release.json");
  if (existsSync(releasePath) && selected("release")) {
    check("release.json", RELEASE_SCHEMA, readJson(releasePath));
    counts.release = 1;
  }
  for (const channel of ["public", "private"]) {
    const manifestPath = resolve(distDir, channel, "manifest.json");
    if (!existsSync(manifestPath)) {
      errors.push(`${channel}/manifest.json introuvable dans ${distDir}`);
      continue;
    }
    const manifest = readJson(manifestPath);
    if (selected("manifest")) check(`${channel}/manifest.json`, PACKAGE_MANIFEST_SCHEMA, manifest);
    for (const file of manifest.files ?? []) {
      const type = resourceTypeOf(file, channel);
      if (!selected(type)) continue;
      const schemaName = SCHEMA_BY_RESOURCE_TYPE[type];
      const label = `${channel}/${file.path}`;
      if (!schemaName) {
        errors.push(`${label}: type de ressource "${type}" inconnu du backend. ${EXPAND_FIRST}`);
        continue;
      }
      counts[`${channel}/${type}`] = (counts[`${channel}/${type}`] ?? 0) + 1;
      check(label, schemaName, readJson(resolve(distDir, channel, file.path)));
    }
  }
  return { errors, counts };
}

export async function checkBackendContract(options = {}) {
  const root = resolve(options.root ?? cwd());
  const contract = loadBackendContract({ root });
  if (contract.errors.length > 0) {
    return {
      errors: contract.errors,
      revision: contract.source?.revision ?? null,
      counts: {},
      schemaDrift: [],
    };
  }
  // Information, pas un echec : un schema de contrat peut prendre de l'avance
  // (champ optionnel ajoute, pas encore emis). Seul l'USAGE d'une forme que le
  // backend refuse fait echouer, via la validation du paquet ci-dessous.
  const contentDirectory = resolve(root, CONTENT_SCHEMAS_DIRECTORY);
  const schemaDrift = (existsSync(contentDirectory) ? schemaFileNames(contentDirectory) : []).filter(
    (name) =>
      contract.source.files[name] === undefined ||
      normalizedSha256(readFileSync(resolve(contentDirectory, name))) !== contract.source.files[name]
  );
  let distDir = options.distDir ? resolve(options.distDir) : null;
  let temporary = null;
  if (distDir === null) {
    temporary = mkdtempSync(join(tmpdir(), "certigo-backend-contract-"));
    distDir = temporary;
    await packageContent({ root, outDir: temporary });
  }
  try {
    const { errors, counts } = validatePackagedPayloads({ distDir, schemas: contract.schemas });
    return { errors, revision: contract.source.revision, counts, schemaDrift };
  } finally {
    if (temporary !== null) rmSync(temporary, { recursive: true, force: true });
  }
}

function git(repository, args, encoding = "utf8") {
  return execFileSync("git", ["-C", repository, ...args], {
    encoding,
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  });
}

// Copie depuis un checkout Certigo : les octets viennent de l'objet git de HEAD,
// pas de l'arbre de travail, pour qu'une fin de ligne locale ou une modification
// non commitee ne puissent pas entrer dans la copie.
export function syncBackendSchemas({ root, from }) {
  const repository = resolve(from);
  const revision = git(repository, ["rev-parse", "HEAD"]).trim();
  if (!/^[0-9a-f]{40}$/.test(revision)) {
    throw new Error(`revision Certigo illisible: ${revision}`);
  }
  const committedAt = new Date(git(repository, ["show", "-s", "--format=%cI", "HEAD"]).trim())
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z");
  const names = git(repository, ["ls-tree", "--name-only", "HEAD", `${BACKEND_SCHEMA_PATH}/`])
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.endsWith(".schema.json"))
    .map((line) => line.slice(BACKEND_SCHEMA_PATH.length + 1))
    .sort();
  if (names.length === 0) {
    throw new Error(`aucun schema sous ${BACKEND_SCHEMA_PATH} a la revision ${revision}`);
  }
  const directory = resolve(root, BACKEND_SCHEMAS_DIRECTORY);
  mkdirSync(directory, { recursive: true });
  for (const name of schemaFileNames(directory)) {
    if (!names.includes(name)) rmSync(resolve(directory, name));
  }
  const files = {};
  for (const name of names) {
    const bytes = git(repository, ["show", `HEAD:${BACKEND_SCHEMA_PATH}/${name}`], "buffer");
    const text = bytes.toString("utf8").replace(/\r\n/g, "\n");
    writeFileSync(resolve(directory, name), text, "utf8");
    files[name] = normalizedSha256(Buffer.from(text, "utf8"));
  }
  const source = {
    schema: BACKEND_SOURCE_SCHEMA,
    note:
      "Copie des schemas embarques par le backend Certigo, qui revalide chaque release a l'import. " +
      "Ne pas editer a la main : regenerer avec `npm run contract:backend -- --sync-from <checkout Certigo>` " +
      "une fois la PR expand fusionnee cote Certigo.",
    repository: BACKEND_REPOSITORY,
    path: BACKEND_SCHEMA_PATH,
    revision,
    committedAt,
    files,
  };
  writeFileSync(
    resolve(directory, BACKEND_SOURCE_FILE),
    JSON.stringify(source, null, 2) + "\n",
    "utf8"
  );
  return source;
}

function parseArgs(cliArgs) {
  const options = {};
  for (let index = 0; index < cliArgs.length; index++) {
    const argument = cliArgs[index];
    if (argument === "--root" || argument === "--dist" || argument === "--sync-from") {
      const value = cliArgs[++index];
      if (value === undefined || value.startsWith("-")) {
        throw new Error(`valeur manquante pour ${argument}`);
      }
      if (argument === "--root") options.root = value;
      else if (argument === "--dist") options.distDir = value;
      else options.syncFrom = value;
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
        "Usage: node tools/check_backend_contract.mjs [--root DIR] [--dist DIR] [--sync-from CERTIGO_CHECKOUT]"
      );
    } else if (options.syncFrom) {
      const source = syncBackendSchemas({ root: resolve(options.root ?? cwd()), from: options.syncFrom });
      console.log(
        `[contract:backend] copie synchronisee depuis ${source.repository}@${source.revision} (${Object.keys(source.files).length} schemas)`
      );
    } else {
      const result = await checkBackendContract(options);
      const total = Object.values(result.counts).reduce((sum, count) => sum + count, 0);
      console.log(
        `[contract:backend] revision Certigo ${result.revision ?? "inconnue"}, ${total} document(s) controle(s)`
      );
      if (result.schemaDrift.length > 0) {
        console.log(
          `[contract:backend] note: schema(s) de contrat en avance sur la copie backend (sans echec tant qu'aucun contenu livre ne s'en sert): ${result.schemaDrift.join(", ")}`
        );
      }
      if (result.errors.length > 0) {
        for (const error of result.errors.slice(0, 50)) console.error(`  - ${error}`);
        if (result.errors.length > 50) {
          console.error(`  ... ${result.errors.length - 50} erreur(s) de plus`);
        }
        console.error(`[contract:backend] ECHEC - ${EXPAND_FIRST}`);
        process.exitCode = 1;
      } else {
        console.log("[contract:backend] OK - tout le paquet est accepte par les schemas du backend.");
      }
    }
  } catch (error) {
    console.error(`[contract:backend] erreur fatale: ${error.message}`);
    process.exitCode = 1;
  }
}
