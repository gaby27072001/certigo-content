import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { globSync } from "glob";
import { CATALOG_PATH, metadataFields } from "./catalog.mjs";

export const CONTENT_MODE = Object.freeze({
  legacy: "legacy",
  extended: "extended",
  runtime: "runtime",
});

export const RUNTIME_ROOT = "content/public/runtime";

export const RUNTIME_RESOURCE_FOLDERS = Object.freeze({
  track: "tracks",
  domain: "domains",
  unit: "units",
  lesson: "lessons",
  concept: "concepts",
});

const BASE_RESOURCE_SPECS = Object.freeze([
  {
    channel: "public",
    sourceGlob: "content/public/questions/**/*.json",
    resourceType: "question",
  },
  {
    channel: "public",
    sourceGlob: "content/public/catalog/*.json",
    resourceType: "certificationCatalog",
  },
  {
    channel: "public",
    sourceGlob: "content/public/coverage/**/*.json",
    resourceType: "coverageMatrix",
  },
  {
    channel: "answerKey",
    sourceGlob: "content/answerKey/solutions/**/*.json",
    resourceType: "solution",
  },
]);

const RUNTIME_RESOURCE_SPECS = Object.freeze(
  Object.entries(RUNTIME_RESOURCE_FOLDERS).map(([resourceType, folder]) => ({
    channel: "public",
    sourceGlob: `${RUNTIME_ROOT}/${folder}/**/*.json`,
    resourceType,
  }))
);

const LEGACY_RESOURCE_SPECS = Object.freeze([
  {
    channel: "public",
    sourceGlob: "content/public/questions/*.json",
    resourceType: "question",
  },
  {
    channel: "answerKey",
    sourceGlob: "content/answerKey/solutions/*.json",
    resourceType: "solution",
  },
]);

export function detectContentMode(root) {
  const absoluteRoot = resolve(root);
  if (!existsSync(resolve(absoluteRoot, CATALOG_PATH))) {
    return CONTENT_MODE.legacy;
  }
  const runtimeFiles = globSync(`${RUNTIME_ROOT}/**/*.json`, {
    cwd: absoluteRoot,
    posix: true,
  });
  return runtimeFiles.length > 0 ? CONTENT_MODE.runtime : CONTENT_MODE.extended;
}

export function sourceSpecsForMode(mode) {
  if (mode === CONTENT_MODE.legacy) return LEGACY_RESOURCE_SPECS;
  if (mode === CONTENT_MODE.extended) return BASE_RESOURCE_SPECS;
  if (mode === CONTENT_MODE.runtime) {
    return [...BASE_RESOURCE_SPECS, ...RUNTIME_RESOURCE_SPECS];
  }
  throw new Error(`mode de contenu inconnu: ${mode}`);
}

export function sourceGlobsForChannel(mode, manifestChannel) {
  return sourceSpecsForMode(mode)
    .filter((spec) => spec.channel === manifestChannel)
    .map((spec) => spec.sourceGlob);
}

export function resourceTypeFromSourcePath(path) {
  if (path.startsWith("content/public/questions/")) return "question";
  if (path.startsWith("content/answerKey/solutions/")) return "solution";
  if (path === CATALOG_PATH) return "certificationCatalog";
  if (path.startsWith("content/public/coverage/")) return "coverageMatrix";
  for (const [resourceType, folder] of Object.entries(RUNTIME_RESOURCE_FOLDERS)) {
    if (path.startsWith(`${RUNTIME_ROOT}/${folder}/`)) return resourceType;
  }
  return null;
}

export function resourceTypeFromArtifactPath(path) {
  if (path.startsWith("questions/")) return "question";
  if (path.startsWith("solutions/")) return "solution";
  if (path === "catalog/certifications.json") return "certificationCatalog";
  if (path.startsWith("coverage/")) return "coverageMatrix";
  for (const [resourceType, folder] of Object.entries(RUNTIME_RESOURCE_FOLDERS)) {
    if (path.startsWith(`runtime/${folder}/`)) return resourceType;
  }
  return null;
}

export function resourceIdentity(resourceType, data) {
  if (resourceType === "certificationCatalog") return "certification-catalog";
  if (resourceType === "coverageMatrix") return data.certification;
  return data.id;
}

export function resourceMetadata(resourceType, data) {
  if (resourceType === "coverageMatrix") {
    return {
      provider: data.provider,
      certification: data.certification,
      blueprintVersion: data.blueprintVersion,
    };
  }
  if (Object.hasOwn(RUNTIME_RESOURCE_FOLDERS, resourceType)) {
    return {
      provider: providerFromCertification(data.certificationId),
      certification: data.certificationId,
      blueprintVersion: data.blueprintVersion,
      ...(resourceType === "domain" ? { objective: data.objectiveId } : {}),
    };
  }
  return metadataFields(data);
}

export function expectedArtifactPath({
  artifact,
  mode,
  resourceType,
  data,
}) {
  if (resourceType === "certificationCatalog") return "catalog/certifications.json";
  if (resourceType === "coverageMatrix") {
    return `coverage/${data.provider}/${certificationSlug(data.certification)}.json`;
  }
  if (Object.hasOwn(RUNTIME_RESOURCE_FOLDERS, resourceType)) {
    const provider = providerFromCertification(data.certificationId);
    const slug = certificationSlug(data.certificationId);
    return `runtime/${RUNTIME_RESOURCE_FOLDERS[resourceType]}/${provider}/${slug}/${data.id}.json`;
  }
  if (resourceType === "question" || resourceType === "solution") {
    const directory = resourceType === "question" ? "questions" : "solutions";
    if (mode === CONTENT_MODE.legacy || data.schemaVersion === "v2") {
      return `${directory}/${data.id}.json`;
    }
    const metadata = data.metadata;
    if (metadata?.provider && metadata?.certification) {
      return `${directory}/${metadata.provider}/${certificationSlug(metadata.certification)}/${data.id}.json`;
    }
    if (artifact === "private" && data.schemaVersion === "v4") {
      return `${directory}/${providerFromQuestionId(data.id)}/${certificationFromQuestionId(data.id)}/${data.id}.json`;
    }
  }
  return null;
}

export function expectedSourcePath(options) {
  const artifactPath = expectedArtifactPath(options);
  if (artifactPath === null) return null;
  const root =
    options.artifact === "private" ? "content/answerKey" : "content/public";
  return `${root}/${artifactPath}`;
}

export function certificationSlug(certificationId) {
  return certificationId.split(":")[1];
}

export function providerFromCertification(certificationId) {
  return certificationId.split(":")[0];
}

function providerFromQuestionId(questionId) {
  return questionId.split(".")[0];
}

function certificationFromQuestionId(questionId) {
  return questionId.split(".")[1];
}
