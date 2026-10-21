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
import { dirname, relative, resolve } from "node:path";
import { argv, cwd } from "node:process";
import { pathToFileURL } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { glob } from "glob";
import {
  CANONICALIZATION,
  canonicalize,
  sha256Hex,
} from "./gen_manifest.mjs";
import { compareOrdinal } from "./lib/deterministic.mjs";
import { isCertificationRecommendedOn } from "./lib/catalog.mjs";
import {
  isV5,
  loadExerciseGuards,
  v5PairViolations,
  v5PublicationGuardViolations,
  v5QuestionViolations,
} from "./lib/exercise_v5.mjs";
import {
  CONTENT_MODE,
  detectContentMode,
  expectedArtifactPath,
  resourceIdentity,
  resourceMetadata,
  resourceTypeFromArtifactPath,
  sourceGlobsForChannel,
} from "./lib/resources.mjs";
import { validateContent } from "./validate_content.mjs";

export const PACKAGE_MANIFEST_SCHEMA_ID = "certigo.content.package-manifest/v1";
export const EXTENDED_PACKAGE_MANIFEST_SCHEMA_ID =
  "certigo.content.package-manifest/v2";
export const RUNTIME_PACKAGE_MANIFEST_SCHEMA_ID =
  "certigo.content.package-manifest/v3";
export const RELEASE_SCHEMA_ID = "certigo.content.release/v1";
export const PACKAGE_SERIALIZATION = "json-sorted-keys-compact-utf8-lf";

const CHANNELS = {
  public: {
    name: "public",
    manifestChannel: "public",
    sourceRoot: "content/public",
    payloadDirectory: "questions",
    payloadKind: "public",
  },
  private: {
    name: "private",
    manifestChannel: "answerKey",
    sourceRoot: "content/answerKey",
    payloadDirectory: "solutions",
    payloadKind: "answerKey",
  },
};

const FORBIDDEN_PUBLIC_KEYS = new Set([
  "correct",
  "correctoptionids",
  "explanation",
  "pairs",
  "rationale",
]);
const FORBIDDEN_PUBLIC_RAW_PATTERN =
  /"(?:correct|correctOptionIds|explanation|pairs|rationale)"\s*:/i;

const CATALOG_SOURCE_PATH = "content/public/catalog/certifications.json";

/**
 * Certification portee par une ressource, quel que soit son type. Renvoie null
 * quand la ressource n'appartient a aucune certification (le catalogue) ou
 * quand elle ne la declare pas (paires v2 heritees, sans bloc `metadata`) :
 * une ressource non identifiable n'est jamais exclue, pour que les corpus
 * historiques restent reconstructibles a l'identique (ADR-0002).
 *
 * Les corriges v4 et v5 ne portent pas de metadata, mais leur id est
 * namespace (`<provider>.<slug>.<objectif>.<concept>.<NNN>`), comme le chemin
 * que leur donne `expectedArtifactPath`. La certification s'en deduit : sans
 * cela, la porte exclurait la question et livrerait son corrige seul.
 */
function certificationOfResource(resourceType, data) {
  if (resourceType === "certificationCatalog") return null;
  if (resourceType === "coverageMatrix") return data.certification ?? null;
  if (resourceType === "question" || resourceType === "solution") {
    const metadata = data.metadata;
    if (metadata === null || Array.isArray(metadata) || typeof metadata !== "object") {
      if (
        resourceType === "solution" &&
        ["v4", "v5"].includes(data.schemaVersion) &&
        typeof data.id === "string"
      ) {
        const [provider, slug] = data.id.split(".");
        return provider && slug ? `${provider}:${slug}` : null;
      }
      return null;
    }
    return metadata.certification ?? null;
  }
  return data.certificationId ?? null;
}

/**
 * Porte de livraison. Une certification qui n'est plus recommandee a la date
 * d'evaluation du catalogue ne part plus dans les artefacts : servir un corpus
 * au-dela de son `recommendThrough`, c'est faire preparer un examen qu'on
 * deconseille de passer. La regle est datee et pilotee par le catalogue, donc
 * reversible en changeant une date, et elle s'applique aux DEUX canaux pour que
 * la correspondance un-a-un entre questions publiques et corriges soit
 * preservee dans les artefacts.
 */
function buildDeliveryGate(root) {
  const catalogPath = resolve(root, CATALOG_SOURCE_PATH);
  if (!existsSync(catalogPath)) return { asOf: null, excluded: new Map() };
  const catalog = loadJson(catalogPath);
  const excluded = new Map();
  for (const certification of catalog.certifications ?? []) {
    if (isCertificationRecommendedOn(certification, catalog.asOf)) continue;
    excluded.set(certification.id, {
      certification: certification.id,
      status: certification.status ?? null,
      recommendThrough: certification.lifecycle?.recommendThrough ?? null,
      successor: certification.lifecycle?.successor ?? null,
    });
  }
  return { asOf: catalog.asOf, excluded };
}

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

function packageSchemaForMode(mode) {
  if (mode === CONTENT_MODE.legacy) return PACKAGE_MANIFEST_SCHEMA_ID;
  if (mode === CONTENT_MODE.extended) return EXTENDED_PACKAGE_MANIFEST_SCHEMA_ID;
  return RUNTIME_PACKAGE_MANIFEST_SCHEMA_ID;
}

function modeFromPackageSchema(schema) {
  if (schema === PACKAGE_MANIFEST_SCHEMA_ID) return CONTENT_MODE.legacy;
  if (schema === EXTENDED_PACKAGE_MANIFEST_SCHEMA_ID) return CONTENT_MODE.extended;
  if (schema === RUNTIME_PACKAGE_MANIFEST_SCHEMA_ID) return CONTENT_MODE.runtime;
  return null;
}

function buildManifest(config, files, mode) {
  const body = {
    schema: packageSchemaForMode(mode),
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

function releaseBody(release) {
  return {
    schema: release.schema,
    algorithm: release.algorithm,
    canonicalization: release.canonicalization,
    publicManifestId: release.publicManifestId,
    privateManifestId: release.privateManifestId,
  };
}

export function buildReleaseDescriptor(publicManifest, privateManifest) {
  const body = {
    schema: RELEASE_SCHEMA_ID,
    algorithm: "sha256",
    canonicalization: CANONICALIZATION,
    publicManifestId: publicManifest.manifestId,
    privateManifestId: privateManifest.manifestId,
  };
  return {
    ...body,
    releaseId: `sha256:${sha256Hex(canonicalize(body))}`,
  };
}

function verifyReleaseDescriptor({ distRoot, schemaPath, manifests }) {
  const releasePath = resolve(distRoot, "release.json");
  const release = loadJson(releasePath);
  const validateRelease = createManifestValidator(schemaPath);
  const errors = [];
  if (!validateRelease(release)) {
    errors.push(
      ...(validateRelease.errors ?? []).map(
        (error) => `schema ${error.instancePath || "/"} ${error.message}`
      )
    );
  }
  const expectedReleaseId = `sha256:${sha256Hex(canonicalize(releaseBody(release)))}`;
  if (release.releaseId !== expectedReleaseId) {
    errors.push("releaseId ne correspond pas au corps canonique de la release");
  }
  if (release.publicManifestId !== manifests.public.manifestId) {
    errors.push("publicManifestId ne correspond pas au manifeste public");
  }
  if (release.privateManifestId !== manifests.private.manifestId) {
    errors.push("privateManifestId ne correspond pas au manifeste prive");
  }
  if (errors.length > 0) {
    throw new Error(`[release-verify] ${errors.join("; ")}`);
  }
  return release;
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
    if (FORBIDDEN_PUBLIC_RAW_PATTERN.test(raw)) {
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

function createPayloadValidators(schemaDirectory) {
  const paths = {
    certificationCatalog: "certification-catalog.schema.json",
    concept: "runtime-resource.schema.json",
    coverageMatrix: "coverage-matrix.schema.json",
    domain: "runtime-resource.schema.json",
    lesson: "runtime-resource.schema.json",
    question: "question.schema.json",
    solution: "solution.schema.json",
    track: "runtime-resource.schema.json",
    unit: "runtime-resource.schema.json",
  };
  return new Map(
    Object.entries(paths).map(([resourceType, file]) => [
      resourceType,
      createManifestValidator(resolve(schemaDirectory, file)),
    ])
  );
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
  const mode = modeFromPackageSchema(manifest.schema);
  const extended = mode !== CONTENT_MODE.legacy;
  const validateManifest = createManifestValidator(schemaPath);
  const payloadValidators = createPayloadValidators(dirname(schemaPath));
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
  if (mode === null) {
    errors.push(`schema de manifeste inconnu: ${manifest.schema}`);
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
      const resourceType = resourceTypeFromArtifactPath(entry.path);
      if (resourceType === null) {
        errors.push(`type de ressource inconnu: ${entry.path}`);
        continue;
      }
      const validatePayload = payloadValidators.get(resourceType);
      if (!validatePayload(payload)) {
        errors.push(
          ...(validatePayload.errors ?? []).map(
            (error) =>
              `payload ${entry.path}${error.instancePath || "/"} ${error.message}`
          )
        );
      }
      if (resourceType === "question" && payload.schemaVersion === "v4") {
        const optionIds = Array.isArray(payload.options)
          ? payload.options.map((option) => option?.id)
          : [];
        if (
          optionIds.some((id) => typeof id !== "string") ||
          new Set(optionIds).size !== optionIds.length
        ) {
          errors.push(`ids d'option dupliques ou invalides: ${entry.path}`);
        }
      }
      if (resourceType === "question" && isV5(payload)) {
        for (const { rule, message } of v5QuestionViolations(payload)) {
          errors.push(`[v5:${rule}] ${entry.path}: ${message}`);
        }
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
      const expectedPath = expectedArtifactPath(
        {
          artifact: expectedConfig.name,
          mode,
          resourceType,
          data: payload,
        }
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
      if (
        ["track", "domain", "unit", "lesson", "concept"].includes(resourceType) &&
        (
          payload.resourceType !== resourceType ||
          payload.schema !== `certigo.runtime.${resourceType}/v1`
        )
      ) {
        errors.push(`schema runtime incorrect: ${entry.path}`);
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

function loadArtifactPayloads(artifactRoot, resourceType) {
  const manifest = loadJson(resolve(artifactRoot, "manifest.json"));
  const payloads = new Map();
  for (const entry of Array.isArray(manifest.files) ? manifest.files : []) {
    if (typeof entry?.path !== "string") continue;
    if (resourceTypeFromArtifactPath(entry.path) !== resourceType) continue;
    payloads.set(entry.id, {
      path: entry.path,
      payload: loadJson(resolve(artifactRoot, entry.path)),
    });
  }
  return payloads;
}

/**
 * Regles croisees v5 sur ce qui est reellement livre : chaque question v5 du
 * canal public a son corrige v5 dans le canal prive, et la paire respecte X1 a
 * X9 (les regles propres a la question sont verifiees artefact par artefact).
 * Le validateur les applique deja aux sources ; les rejouer ici couvre la porte
 * de livraison et toute modification des artefacts apres construction.
 *
 * Les gardes provisoires de publication (`guards`, lues dans
 * config/exercise-publication-guards.json par les appelants) ne s'appliquent
 * qu'ici : elles refusent la PUBLICATION d'items conformes au contrat que l'app
 * ne sait pas encore faire reussir. Sans reglage, elles sont actives.
 */
export function verifyDistributableDomainCoverage(distRoot, { requirePrivate = true } = {}) {
  const root = resolve(distRoot);
  const publicRoot = resolve(root, "public");
  const catalogPath = resolve(publicRoot, "catalog", "certifications.json");
  const catalog = existsSync(catalogPath) ? loadJson(catalogPath) : null;
  const certifications = new Map(
    (catalog?.certifications ?? []).map((item) => [item.id, item])
  );
  const tracks = loadArtifactPayloads(publicRoot, "track");
  const domains = loadArtifactPayloads(publicRoot, "domain");
  const questions = loadArtifactPayloads(publicRoot, "question");
  const privateManifestPath = resolve(root, "private", "manifest.json");
  const solutions =
    requirePrivate && existsSync(privateManifestPath)
      ? loadArtifactPayloads(resolve(root, "private"), "solution")
      : null;
  const errors = [];

  for (const { payload: track } of tracks.values()) {
    if (track?.mode !== "questionBank") continue;
    const certification = certifications.get(track.certificationId);
    const isDistributable = certification
      ? isCertificationRecommendedOn(certification, catalog?.asOf)
      : ["active", "retiring"].includes(track.lifecycle?.status);
    if (!isDistributable) continue;
    for (const domainId of track.domainIds ?? []) {
      const domain = domains.get(domainId)?.payload;
      if (!domain) {
        errors.push(
          `[runtime:domain-coverage] piste distribuable "${track.id}" reference un domaine absent "${domainId}"`
        );
        continue;
      }
      const matchingQuestionIds = [...questions.entries()]
        .filter(([, { payload: question }]) =>
          question?.metadata?.certification === track.certificationId &&
          (["v4", "v5"].includes(question?.schemaVersion)
            ? question.metadata?.domainId === domain.id
            : question.metadata?.objective === domain.objectiveId)
        )
        .map(([id]) => id);
      if (matchingQuestionIds.length === 0) {
        errors.push(
          `[runtime:domain-coverage] piste distribuable "${track.id}" sans question pour le domaine "${domainId}"`
        );
      } else if (solutions && !matchingQuestionIds.some((id) => solutions.has(id))) {
        errors.push(
          `[runtime:domain-coverage] piste distribuable "${track.id}" sans corrige prive pour le domaine "${domainId}"`
        );
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`[package-verify] ${errors.join("; ")}`);
  }
}

export function verifyExercisePairs(distRoot, guards) {
  const root = resolve(distRoot);
  const questions = loadArtifactPayloads(resolve(root, "public"), "question");
  const solutions = loadArtifactPayloads(resolve(root, "private"), "solution");
  const errors = [];
  for (const [id, { path, payload }] of questions) {
    if (!isV5(payload)) continue;
    const solution = solutions.get(id);
    if (!solution) {
      errors.push(`question v5 "${id}" (${path}) livree sans son corrige`);
      continue;
    }
    if (!isV5(solution.payload)) {
      errors.push(
        `paire "${id}": question v5, corrige ${solution.payload?.schemaVersion ?? "inconnu"}`
      );
      continue;
    }
    for (const { rule, message } of [
      ...v5PairViolations(payload, solution.payload),
      ...v5PublicationGuardViolations(payload, solution.payload, guards),
    ]) {
      errors.push(`[v5:${rule}] paire "${id}": ${message}`);
    }
  }
  for (const [id, { path, payload }] of solutions) {
    if (!isV5(payload)) continue;
    if (!isV5(questions.get(id)?.payload)) {
      errors.push(`corrige v5 "${id}" (${path}) livre sans sa question v5`);
    }
  }
  if (errors.length > 0) {
    throw new Error(`[package-verify] ${errors.join("; ")}`);
  }
}

async function writeArtifact(root, distRoot, config, mode) {
  const artifactRoot = resolve(distRoot, config.name);
  const gate = buildDeliveryGate(root);
  const excludedByCertification = new Map();
  const sourceFiles = [];
  for (const pattern of sourceGlobsForChannel(mode, config.manifestChannel)) {
    sourceFiles.push(...await glob(pattern, { cwd: root, posix: true }));
  }
  sourceFiles.sort(compareOrdinal);
  const manifestFiles = [];

  for (const sourcePath of sourceFiles) {
    const data = loadJson(resolve(root, sourcePath));
    const relativeSourcePath = toPosix(relative(config.sourceRoot, sourcePath));
    const resourceType = resourceTypeFromArtifactPath(relativeSourcePath);
    if (resourceType === null) {
      throw new Error(`[package] type de ressource inconnu: ${sourcePath}`);
    }
    const certification = certificationOfResource(resourceType, data);
    if (certification !== null && gate.excluded.has(certification)) {
      const tally = excludedByCertification.get(certification) ?? {
        ...gate.excluded.get(certification),
        fileCount: 0,
      };
      tally.fileCount++;
      excludedByCertification.set(certification, tally);
      continue;
    }
    const outputPath = expectedArtifactPath({
      artifact: config.name,
      mode,
      resourceType,
      data,
    });
    if (outputPath === null || outputPath !== relativeSourcePath) {
      throw new Error(
        `[package] chemin source non canonique: ${sourcePath} (attendu ${outputPath ?? "inconnu"})`
      );
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
    if (mode !== CONTENT_MODE.legacy) {
      manifestEntry.resourceType = resourceType;
      Object.assign(manifestEntry, resourceMetadata(resourceType, data));
    }
    manifestFiles.push(manifestEntry);
  }

  manifestFiles.sort((a, b) => compareOrdinal(a.path, b.path));
  const manifest = buildManifest(config, manifestFiles, mode);
  writeFileSync(resolve(artifactRoot, "manifest.json"), serializePretty(manifest), "utf8");

  // La porte doit rester BRUYANTE. Une exclusion silencieuse ferait fondre des
  // dizaines de fichiers sans trace, et le mode d'echec dangereux de ce depot
  // est precisement celui qui ne dit rien.
  const exclusions = [...excludedByCertification.values()].sort((left, right) =>
    compareOrdinal(left.certification, right.certification)
  );
  const excludedFileCount = exclusions.reduce(
    (total, entry) => total + entry.fileCount,
    0
  );
  if (exclusions.length > 0) {
    console.warn(
      `[package] ${config.name}: ${excludedFileCount} fichier(s) EXCLU(S) de la livraison — ` +
        `${exclusions.length} certification(s) non recommandee(s) au ${gate.asOf}`
    );
    for (const entry of exclusions) {
      console.warn(
        `[package]   - ${entry.certification}: ${entry.fileCount} fichier(s)` +
          ` [statut ${entry.status ?? "inconnu"}` +
          `, recommendThrough ${entry.recommendThrough ?? "aucun"}` +
          `, successeur ${entry.successor ?? "aucun"}]`
      );
    }
  }

  return { artifactRoot, deliveryGate: { asOf: gate.asOf, excludedFileCount, exclusions } };
}

export async function verifyPackagedContent(options = {}) {
  const root = resolve(options.root ?? cwd());
  const distRoot = resolve(root, options.outDir ?? "dist");
  const schemaPath = resolve(root, "schemas", "package-manifest.schema.json");
  const releaseSchemaPath = resolve(root, "schemas", "content-release.schema.json");
  const packages = [];
  const manifests = {};

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
    manifests[config.name] = result.manifest;
  }
  const allChannels = options.channel === undefined || options.channel === "all";
  if (allChannels) verifyExercisePairs(distRoot, loadExerciseGuards(root));
  const releasePath = resolve(distRoot, "release.json");
  const releaseRequired = Object.values(manifests).some(
    (manifest) => manifest.schema === RUNTIME_PACKAGE_MANIFEST_SCHEMA_ID
  );
  if (releaseRequired && manifests.public) {
    verifyDistributableDomainCoverage(distRoot, { requirePrivate: allChannels });
  }
  const release =
    allChannels && (releaseRequired || existsSync(releasePath))
      ? verifyReleaseDescriptor({
          distRoot,
          schemaPath: releaseSchemaPath,
          manifests,
        })
      : null;
  return { packages, release };
}

export async function packageContent(options = {}) {
  const root = resolve(options.root ?? cwd());
  const distRoot = resolve(root, options.outDir ?? "dist");
  const configs = resolveChannels(options.channel ?? "all");
  const mode = detectContentMode(root);
  const schemaPath = resolve(root, "schemas", "package-manifest.schema.json");
  const releaseSchemaPath = resolve(root, "schemas", "content-release.schema.json");
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
    rmSync(resolve(distRoot, "release.json"), { force: true });
  }
  mkdirSync(resolve(distRoot, "reports"), { recursive: true });

  const packages = [];
  const manifests = {};
  const deliveryGates = {};
  for (const config of configs) {
    const { artifactRoot, deliveryGate } = await writeArtifact(root, distRoot, config, mode);
    deliveryGates[config.name] = deliveryGate;
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
    manifests[config.name] = verified.manifest;
  }

  if (configs.length === Object.keys(CHANNELS).length) {
    verifyExercisePairs(distRoot, loadExerciseGuards(root));
  }
  if (mode === CONTENT_MODE.runtime && manifests.public) {
    verifyDistributableDomainCoverage(distRoot, {
      requirePrivate: configs.length === Object.keys(CHANNELS).length,
    });
  }

  let release = null;
  if (
    mode === CONTENT_MODE.runtime &&
    configs.length === Object.keys(CHANNELS).length
  ) {
    release = buildReleaseDescriptor(manifests.public, manifests.private);
    writeFileSync(
      resolve(distRoot, "release.json"),
      serializePretty(release),
      "utf8"
    );
    verifyReleaseDescriptor({
      distRoot,
      schemaPath: releaseSchemaPath,
      manifests,
    });
  }

  const deliveryGateExclusions = [
    ...new Set(
      Object.values(deliveryGates).flatMap((gate) =>
        gate.exclusions.map((entry) => entry.certification)
      )
    ),
  ].sort(compareOrdinal);

  const summary = {
    schema: "certigo.content.package-report/v1",
    sourcePairCount: validation.pairCount,
    certificationCount: validation.certificationCount,
    coverageMatrixCount: validation.coverageCount,
    ...(mode === CONTENT_MODE.runtime
      ? { runtimeResourceCount: validation.runtimeResourceCount }
      : {}),
    // Emis UNIQUEMENT quand la porte exclut quelque chose. Un corpus sans
    // exclusion produit donc le meme rapport qu'avant l'existence de la porte,
    // ce qui preserve la reconstruction byte-identical des artefacts
    // historiques exigee par l'ADR-0002.
    ...(deliveryGateExclusions.length === 0
      ? {}
      : {
          deliveryGate: {
            asOf: deliveryGates[configs[0].name].asOf,
            excludedCertifications: deliveryGateExclusions,
            excludedFileCount: Object.values(deliveryGates).reduce(
              (total, gate) => total + gate.excludedFileCount,
              0
            ),
            byArtifact: configs.map((config) => ({
              artifact: config.name,
              excludedFileCount: deliveryGates[config.name].excludedFileCount,
            })),
          },
        }),
    packages,
    ...(release === null
      ? {}
      : {
          releaseId: release.releaseId,
          publicManifestId: release.publicManifestId,
          privateManifestId: release.privateManifestId,
        }),
  };
  writeFileSync(
    resolve(distRoot, "reports", "package-summary.json"),
    serializePretty(summary),
    "utf8"
  );
  return { ...summary, release };
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
      if (result.release) {
        console.log(
          `[package] release: ${result.release.releaseId}, public=${result.release.publicManifestId}`
        );
      }
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
