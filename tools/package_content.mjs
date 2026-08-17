#!/usr/bin/env node

import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { basename, dirname, relative, resolve } from "node:path";
import { argv, cwd } from "node:process";
import { pathToFileURL } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { glob } from "glob";
import { canonicalize, sha256Hex } from "./gen_manifest.mjs";
import { CATALOG_PATH, metadataFields } from "./lib/catalog.mjs";
import { compareOrdinal } from "./lib/deterministic.mjs";
import { validateContent } from "./validate_content.mjs";

export const PACKAGE_MANIFEST_SCHEMA_ID = "certigo.content.package-manifest/v1";
export const EXTENDED_PACKAGE_MANIFEST_SCHEMA_ID =
  "certigo.content.package-manifest/v2";
export const PACKAGE_SERIALIZATION = "json-sorted-keys-compact-utf8-lf";

const CHANNELS = {
  public: {
    name: "public",
    manifestChannel: "public",
    sourceRoot: "content/public",
    legacySourceGlob: "content/public/questions/*.json",
    extendedSourceGlobs: [
      "content/public/questions/**/*.json",
      "content/public/catalog/*.json",
      "content/public/coverage/**/*.json",
    ],
    payloadDirectory: "questions",
    payloadKind: "public",
  },
  private: {
    name: "private",
    manifestChannel: "answerKey",
    sourceRoot: "content/answerKey",
    legacySourceGlob: "content/answerKey/solutions/*.json",
    extendedSourceGlobs: ["content/answerKey/solutions/**/*.json"],
    payloadDirectory: "solutions",
    payloadKind: "answerKey",
  },
};

const FORBIDDEN_PUBLIC_KEYS = new Set(["correct", "rationale"]);

function toPosix(path) {
  return path.replaceAll("\\", "/");
}

function serializeJson(value) {
  return `${canonicalize(value)}\n`;
}

function serializePretty(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function hashBuffer(value) {
  return createHash("sha256").update(value).digest("hex");
}

function loadJson(path) {
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw);
}

function resolveChannels(channel) {
  if (channel === "all") return [CHANNELS.public, CHANNELS.private];
  if (CHANNELS[channel]) return [CHANNELS[channel]];
  throw new Error(`canal inconnu "${channel}" (attendu: all, public ou private)`);
}

function walkFiles(root) {
  const files = [];

  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) =>
      compareOrdinal(a.name, b.name)
    )) {
      const absolutePath = resolve(directory, entry.name);
      const relativePath = toPosix(relative(root, absolutePath));
      const stat = lstatSync(absolutePath);
      if (stat.isSymbolicLink()) {
        throw new Error(`[package-verify] lien symbolique interdit: ${relativePath}`);
      }
      if (stat.isDirectory()) walk(absolutePath);
      else if (stat.isFile()) files.push(relativePath);
      else throw new Error(`[package-verify] type de fichier interdit: ${relativePath}`);
    }
  }

  walk(root);
  return files.sort(compareOrdinal);
}

function buildManifest(config, files, extended) {
  const body = {
    schema: extended
      ? EXTENDED_PACKAGE_MANIFEST_SCHEMA_ID
      : PACKAGE_MANIFEST_SCHEMA_ID,
    channel: config.manifestChannel,
    artifact: config.name,
    algorithm: "sha256",
    serialization: PACKAGE_SERIALIZATION,
    fileCount: files.length,
    files,
  };
  const rootHash = sha256Hex(canonicalize(body));
  return {
    ...body,
    manifestId: `sha256:${rootHash}`,
    rootHash,
  };
}

function inferResourceType(path) {
  if (path.startsWith("questions/")) return "question";
  if (path.startsWith("solutions/")) return "solution";
  if (path === "catalog/certifications.json") return "certificationCatalog";
  if (path.startsWith("coverage/")) return "coverageMatrix";
  return null;
}

function resourceIdentity(resourceType, data) {
  if (resourceType === "certificationCatalog") return "certification-catalog";
  if (resourceType === "coverageMatrix") return data.certification;
  return data.id;
}

function resourceMetadata(resourceType, data) {
  if (resourceType === "coverageMatrix") {
    return {
      provider: data.provider,
      certification: data.certification,
      blueprintVersion: data.blueprintVersion,
    };
  }
  return metadataFields(data);
}

function expectedResourcePath(config, resourceType, data, extended) {
  if (resourceType === "certificationCatalog") return "catalog/certifications.json";
  if (resourceType === "coverageMatrix") {
    return `coverage/${data.provider}/${data.certification.split(":")[1]}.json`;
  }
  if (!extended || data.schemaVersion === "v2") {
    return `${config.payloadDirectory}/${data.id}.json`;
  }
  return `${config.payloadDirectory}/${data.metadata.provider}/${data.metadata.certification.split(":")[1]}/${data.id}.json`;
}

function manifestBody(manifest) {
  return {
    schema: manifest.schema,
    channel: manifest.channel,
    artifact: manifest.artifact,
    algorithm: manifest.algorithm,
    serialization: manifest.serialization,
    fileCount: manifest.fileCount,
    files: manifest.files,
  };
}

function findForbiddenKeys(value, location = "$") {
  const findings = [];
  if (Array.isArray(value)) {
    value.forEach((entry, index) => findings.push(...findForbiddenKeys(entry, `${location}[${index}]`)));
  } else if (value !== null && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      const childLocation = `${location}.${key}`;
      if (FORBIDDEN_PUBLIC_KEYS.has(key.toLowerCase())) findings.push(childLocation);
      findings.push(...findForbiddenKeys(entry, childLocation));
    }
  }
  return findings;
}

export function inspectPublicArtifact(artifactRoot) {
  const root = resolve(artifactRoot);
  const files = walkFiles(root);
  const violations = [];

  for (const path of files) {
    if (path.toLowerCase().split("/").some((segment) => segment.includes("answerkey"))) {
      violations.push(`chemin answerKey interdit: ${path}`);
    }

    const absolutePath = resolve(root, path);
    const raw = readFileSync(absolutePath, "utf8");
    if (/"(?:correct|rationale)"\s*:/i.test(raw)) {
      violations.push(`motif de corrige interdit dans ${path}`);
    }

    if (path.toLowerCase().endsWith(".json")) {
      let parsed;
      try {
        parsed = JSON.parse(raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw);
      } catch (error) {
        violations.push(`JSON public invalide ${path}: ${error.message}`);
        continue;
      }
      for (const location of findForbiddenKeys(parsed)) {
        violations.push(`cle de corrige interdite dans ${path} a ${location}`);
      }
    }
  }

  if (violations.length > 0) {
    throw new Error(`[anti-leak] ${violations.join("; ")}`);
  }

  return {
    schema: "certigo.content.anti-leak-report/v1",
    artifact: "public",
    status: "passed",
    scannedFileCount: files.length,
    checks: ["recursive-paths", "raw-key-patterns", "recursive-json-keys"],
  };
}

function createManifestValidator(schemaPath) {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  return ajv.compile(loadJson(schemaPath));
}

export function verifyArtifact({
  artifactRoot,
  expectedChannel,
  schemaPath,
  inspectPublic = expectedChannel === "public",
}) {
  const root = resolve(artifactRoot);
  const manifestPath = resolve(root, "manifest.json");
  const manifest = loadJson(manifestPath);
  const extended =
    manifest.schema === EXTENDED_PACKAGE_MANIFEST_SCHEMA_ID;
  const validateManifest = createManifestValidator(schemaPath);
  const errors = [];
  const manifestFiles = Array.isArray(manifest.files) ? manifest.files : [];
  const expectedConfig = CHANNELS[expectedChannel];
  if (!expectedConfig) {
    throw new Error(`[package-verify] canal attendu inconnu: ${expectedChannel}`);
  }

  if (!validateManifest(manifest)) {
    errors.push(
      ...(validateManifest.errors ?? []).map(
        (error) => `schema ${error.instancePath || "/"} ${error.message}`
      )
    );
  }
  if (manifest.artifact !== expectedChannel) {
    errors.push(`artefact attendu ${expectedChannel}, obtenu ${manifest.artifact}`);
  }
  if (manifest.channel !== expectedConfig.manifestChannel) {
    errors.push(
      `channel attendu ${expectedConfig.manifestChannel}, obtenu ${manifest.channel}`
    );
  }

  const expectedManifestId = `sha256:${sha256Hex(canonicalize(manifestBody(manifest)))}`;
  if (manifest.manifestId !== expectedManifestId || manifest.rootHash !== expectedManifestId.slice(7)) {
    errors.push("manifestId/rootHash ne correspondent pas au corps canonique du manifeste");
  }

  const actualFiles = walkFiles(root).filter((path) => path !== "manifest.json");
  const declaredFiles = manifestFiles
    .map((entry) => entry?.path)
    .filter((path) => typeof path === "string");
  if (new Set(declaredFiles).size !== declaredFiles.length) {
    errors.push("le manifeste contient des chemins dupliques");
  }
  for (const path of actualFiles) {
    if (!declaredFiles.includes(path)) errors.push(`fichier non declare: ${path}`);
  }
  for (const path of declaredFiles) {
    if (!actualFiles.includes(path)) errors.push(`fichier declare absent: ${path}`);
  }

  for (const entry of manifestFiles) {
    if (entry === null || typeof entry !== "object" || typeof entry.path !== "string") {
      continue;
    }
    if (!actualFiles.includes(entry.path)) continue;
    const bytes = readFileSync(resolve(root, entry.path));
    if (bytes.length !== entry.size) errors.push(`taille incorrecte: ${entry.path}`);
    if (hashBuffer(bytes) !== entry.hash) errors.push(`hash incorrect: ${entry.path}`);
    try {
      const payload = JSON.parse(
        bytes.toString("utf8").replace(/^\uFEFF/, "")
      );
      const resourceType = inferResourceType(entry.path);
      if (resourceType === null) {
        errors.push(`type de ressource inconnu: ${entry.path}`);
        continue;
      }
      if (extended && entry.resourceType !== resourceType) {
        errors.push(
          `resourceType incorrect: ${entry.path} attendu ${resourceType}, obtenu ${entry.resourceType}`
        );
      }
      if (!extended && !["question", "solution"].includes(resourceType)) {
        errors.push(`ressource ${resourceType} interdite dans un manifeste v1`);
      }
      const expectedId = resourceIdentity(resourceType, payload);
      if (expectedId !== entry.id) {
        errors.push(
          `couplage payload/id incorrect: ${entry.path} declare "${entry.id}", payload "${expectedId}"`
        );
      }
      const expectedPath = expectedResourcePath(
        expectedConfig,
        resourceType,
        payload,
        extended
      );
      if (entry.path !== expectedPath) {
        errors.push(
          `couplage path/id incorrect: ${entry.path} (attendu ${expectedPath})`
        );
      }
      if (
        ["question", "solution"].includes(resourceType) &&
        payload.kind !== expectedConfig.payloadKind
      ) {
        errors.push(
          `kind payload incorrect: ${entry.path} attendu ${expectedConfig.payloadKind}, obtenu ${payload.kind}`
        );
      }
      if (
        resourceType === "certificationCatalog" &&
        payload.schema !== "certigo.certification-catalog/v1"
      ) {
        errors.push(`schema catalogue incorrect: ${entry.path}`);
      }
      if (
        resourceType === "coverageMatrix" &&
        payload.schema !== "certigo.coverage-matrix/v1"
      ) {
        errors.push(`schema couverture incorrect: ${entry.path}`);
      }
      if (extended) {
        const expectedMetadata = resourceMetadata(resourceType, payload);
        for (const field of [
          "provider",
          "certification",
          "blueprintVersion",
          "objective",
        ]) {
          if (entry[field] !== expectedMetadata[field]) {
            errors.push(
              `metadata manifeste incorrecte: ${entry.path}.${field}`
            );
          }
        }
      }
    } catch (error) {
      errors.push(`JSON de payload invalide ${entry.path}: ${error.message}`);
    }
  }
  if (manifest.fileCount !== actualFiles.length) {
    errors.push(`fileCount=${manifest.fileCount}, fichiers reels=${actualFiles.length}`);
  }

  let antiLeakReport = null;
  if (inspectPublic) {
    try {
      antiLeakReport = inspectPublicArtifact(root);
    } catch (error) {
      errors.push(error.message);
    }
  }

  if (errors.length > 0) {
    throw new Error(`[package-verify] ${errors.join("; ")}`);
  }
  return { manifest, antiLeakReport };
}

async function writeArtifact(root, distRoot, config, extended) {
  const artifactRoot = resolve(distRoot, config.name);
  const sourceFiles = (
    await glob(
      extended ? config.extendedSourceGlobs : config.legacySourceGlob,
      { cwd: root, posix: true }
    )
  ).sort(compareOrdinal);
  const manifestFiles = [];

  for (const sourcePath of sourceFiles) {
    const data = loadJson(resolve(root, sourcePath));
    const outputPath = extended
      ? toPosix(relative(config.sourceRoot, sourcePath))
      : `${config.payloadDirectory}/${basename(sourcePath)}`;
    const resourceType = inferResourceType(outputPath);
    if (resourceType === null) {
      throw new Error(`[package] type de ressource inconnu: ${sourcePath}`);
    }
    const serialized = serializeJson(data);
    const outputAbsolutePath = resolve(artifactRoot, outputPath);
    mkdirSync(dirname(outputAbsolutePath), { recursive: true });
    writeFileSync(outputAbsolutePath, serialized, "utf8");
    const manifestEntry = {
      id: resourceIdentity(resourceType, data),
      path: outputPath,
      hash: sha256Hex(serialized),
      size: Buffer.byteLength(serialized, "utf8"),
    };
    if (extended) {
      manifestEntry.resourceType = resourceType;
      Object.assign(manifestEntry, resourceMetadata(resourceType, data));
    }
    manifestFiles.push(manifestEntry);
  }

  manifestFiles.sort((a, b) => compareOrdinal(a.path, b.path));
  const manifest = buildManifest(config, manifestFiles, extended);
  writeFileSync(resolve(artifactRoot, "manifest.json"), serializePretty(manifest), "utf8");
  return artifactRoot;
}

export async function verifyPackagedContent(options = {}) {
  const root = resolve(options.root ?? cwd());
  const distRoot = resolve(root, options.outDir ?? "dist");
  const schemaPath = resolve(root, "schemas", "package-manifest.schema.json");
  const packages = [];

  for (const config of resolveChannels(options.channel ?? "all")) {
    const result = verifyArtifact({
      artifactRoot: resolve(distRoot, config.name),
      expectedChannel: config.name,
      schemaPath,
    });
    packages.push({
      artifact: config.name,
      artifactName: `certigo-content-${config.name}-sha256-${result.manifest.rootHash}`,
      manifestId: result.manifest.manifestId,
      rootHash: result.manifest.rootHash,
      fileCount: result.manifest.fileCount,
    });
  }
  return { packages };
}

export async function packageContent(options = {}) {
  const root = resolve(options.root ?? cwd());
  const distRoot = resolve(root, options.outDir ?? "dist");
  const configs = resolveChannels(options.channel ?? "all");
  const extended = existsSync(resolve(root, CATALOG_PATH));
  const schemaPath = resolve(root, "schemas", "package-manifest.schema.json");
  const validation = await validateContent({ root });
  if (validation.errors.length > 0) {
    throw new Error(`[package] corpus invalide: ${validation.errors.join("; ")}`);
  }

  if (configs.length === Object.keys(CHANNELS).length) {
    rmSync(distRoot, { recursive: true, force: true });
  } else {
    for (const config of configs) {
      rmSync(resolve(distRoot, config.name), { recursive: true, force: true });
    }
    rmSync(resolve(distRoot, "reports", "package-summary.json"), { force: true });
    if (configs.some((config) => config.name === "public")) {
      rmSync(resolve(distRoot, "reports", "public-anti-leak.json"), { force: true });
    }
  }
  mkdirSync(resolve(distRoot, "reports"), { recursive: true });

  const packages = [];
  for (const config of configs) {
    const artifactRoot = await writeArtifact(root, distRoot, config, extended);
    const verified = verifyArtifact({
      artifactRoot,
      expectedChannel: config.name,
      schemaPath,
    });
    if (verified.antiLeakReport) {
      writeFileSync(
        resolve(distRoot, "reports", "public-anti-leak.json"),
        serializePretty(verified.antiLeakReport),
        "utf8"
      );
    }
    packages.push({
      artifact: config.name,
      artifactName: `certigo-content-${config.name}-sha256-${verified.manifest.rootHash}`,
      manifestId: verified.manifest.manifestId,
      rootHash: verified.manifest.rootHash,
      fileCount: verified.manifest.fileCount,
    });
  }

  const summary = {
    schema: "certigo.content.package-report/v1",
    sourcePairCount: validation.pairCount,
    certificationCount: validation.certificationCount,
    coverageMatrixCount: validation.coverageCount,
    packages,
  };
  writeFileSync(
    resolve(distRoot, "reports", "package-summary.json"),
    serializePretty(summary),
    "utf8"
  );
  return summary;
}

function parseArgs(cliArgs) {
  const options = { channel: "all", verify: false };
  for (let index = 0; index < cliArgs.length; index++) {
    const argument = cliArgs[index];
    if (argument === "--channel" || argument === "--root" || argument === "--out") {
      const value = cliArgs[++index];
      if (value === undefined || value.startsWith("-")) {
        throw new Error(`valeur manquante pour ${argument}`);
      }
      if (argument === "--channel") options.channel = value;
      else if (argument === "--root") options.root = value;
      else options.outDir = value;
    }
    else if (argument === "--verify") options.verify = true;
    else if (argument === "--help" || argument === "-h") options.help = true;
    else throw new Error(`argument inconnu: ${argument}`);
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
        "Usage: node tools/package_content.mjs [--channel all|public|private] [--root DIR] [--out DIR] [--verify]"
      );
    } else {
      const result = options.verify
        ? await verifyPackagedContent(options)
        : await packageContent(options);
      for (const entry of result.packages) {
        console.log(
          `[package] ${entry.artifact}: ${entry.fileCount} fichier(s), ${entry.manifestId}, artifact=${entry.artifactName}`
        );
      }
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
