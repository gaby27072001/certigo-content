#!/usr/bin/env node
// Deterministic runtime resource materializer.
// Reads catalog + coverage matrices and generates the runtime resource tree
// (tracks, domains, concepts) under content/public/runtime/.
// Supports --check mode for CI validation.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { argv, cwd } from "node:process";
import { pathToFileURL } from "node:url";
import { glob } from "glob";
import { canonicalize } from "./gen_manifest.mjs";
import { compareOrdinal } from "./lib/deterministic.mjs";
import {
  classifyV2Question,
  conceptIdFromQuestionId,
  domainIdFromObjective,
} from "./lib/schema_adapter.mjs";

function loadJson(path) {
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw);
}

function normalizeLineEndings(value) {
  return value.replace(/\r\n?/g, "\n");
}

function writeResource(path, data) {
  const serialized = `${canonicalize(data)}\n`;
  if (
    existsSync(path) &&
    normalizeLineEndings(readFileSync(path, "utf8")) === serialized
  ) {
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, serialized, "utf8");
}

function certSlug(certificationId) {
  return certificationId.split(":")[1];
}

function certProvider(certificationId) {
  return certificationId.split(":")[0];
}

function runtimeResourcePath(resource) {
  const provider = certProvider(resource.data.certificationId);
  const slug = certSlug(resource.data.certificationId);
  const folder = {
    track: "tracks",
    domain: "domains",
    concept: "concepts",
  }[resource.type];
  if (!folder) {
    throw new Error(`[runtime:ownership] type genere inconnu: ${resource.type}`);
  }
  return `content/public/runtime/${folder}/${provider}/${slug}/${resource.data.id}.json`;
}

function authoredGuidedTrackFiles(root) {
  const files = glob.sync("content/public/runtime/tracks/**/*.json", {
    cwd: root,
    posix: true,
  }).sort(compareOrdinal);
  const guidedFiles = new Set();

  for (const file of files) {
    const track = loadJson(resolve(root, file));
    if (track.mode === "guided") {
      if (
        typeof track.certificationId !== "string" ||
        typeof track.id !== "string"
      ) {
        throw new Error(
          `[runtime:ownership] piste guidee sans identite valide: ${file}`
        );
      }
      const expectedPath =
        `content/public/runtime/tracks/${certProvider(track.certificationId)}/` +
        `${certSlug(track.certificationId)}/${track.id}.json`;
      if (
        track.schema !== "certigo.runtime.track/v1" ||
        track.resourceType !== "track" ||
        file !== expectedPath
      ) {
        throw new Error(
          `[runtime:ownership] piste guidee invalide ou chemin divergent: ${file}`
        );
      }
      guidedFiles.add(file);
    } else if (track.mode !== "questionBank") {
      throw new Error(
        `[runtime:ownership] mode de piste non gere dans ${file}`
      );
    }
  }

  return guidedFiles;
}

function generatedResources(resources, guidedTrackFiles) {
  return resources.filter((resource) =>
    resource.type !== "track" ||
    !guidedTrackFiles.has(runtimeResourcePath(resource))
  );
}

function generatedRuntimeFiles(root) {
  return ["tracks", "domains", "concepts"].flatMap((folder) =>
    glob.sync(`content/public/runtime/${folder}/**/*.json`, {
      cwd: root,
      posix: true,
    })
  ).sort(compareOrdinal);
}

function removeStaleGeneratedResources(root, resources, guidedTrackFiles) {
  const expectedFiles = new Set(resources.map(runtimeResourcePath));
  for (const file of generatedRuntimeFiles(root)) {
    if (expectedFiles.has(file) || guidedTrackFiles.has(file)) continue;

    if (file.startsWith("content/public/runtime/tracks/")) {
      const track = loadJson(resolve(root, file));
      if (track.mode !== "questionBank") {
        throw new Error(
          `[runtime:ownership] refus de supprimer une piste non generee: ${file}`
        );
      }
    } else {
      const folder = file.split("/")[3];
      const resourceType = folder === "domains" ? "domain" : "concept";
      const resource = loadJson(resolve(root, file));
      if (
        resource.resourceType !== resourceType ||
        resource.schema !== `certigo.runtime.${resourceType}/v1`
      ) {
        throw new Error(
          `[runtime:ownership] refus de supprimer une ressource non generee: ${file}`
        );
      }
    }

    rmSync(resolve(root, file), { force: true });
  }
}

function runtimeLifecycle(certification) {
  if (certification.status === "retired") {
    // Un examen retire doit pouvoir nommer son successeur : sans `replacedBy`,
    // la ressource dit au candidat que l'examen est mort sans lui donner d'ou
    // aller. Le catalogue connait le successeur ; on le propage.
    return {
      status: "retired",
      retiredOn: certification.lifecycle.lastExamOn,
      ...(certification.lifecycle.successor
        ? { replacedBy: certification.lifecycle.successor }
        : {}),
    };
  }
  if (certification.status === "replaced") {
    return {
      status: "replaced",
      replacedBy: certification.lifecycle.successor,
    };
  }
  if (certification.status === "active-retiring") return { status: "retiring" };
  if (certification.status === "announced") return { status: "planned" };
  return { status: "active" };
}

/**
 * Build the full set of runtime resources for one certification.
 */
function buildCertificationResources(certification, coverage) {
  const provider = certProvider(certification.id);
  const slug = certSlug(certification.id);
  const bpVersion = certification.blueprint.version;
  const lifecycle = runtimeLifecycle(certification);
  const resources = [];

  // Domains — one per blueprint objective
  const domainIds = [];
  for (const objective of certification.blueprint.objectives) {
    const domainId = domainIdFromObjective(certification.id, objective.id);
    domainIds.push(domainId);
    resources.push({
      type: "domain",
      data: {
        schema: "certigo.runtime.domain/v1",
        resourceType: "domain",
        id: domainId,
        certificationId: certification.id,
        blueprintVersion: bpVersion,
        objectiveId: objective.id,
        lifecycle,
      },
    });
  }

  // Concepts — one per question in coverage
  const conceptIds = new Set();
  if (coverage) {
    for (const objective of coverage.objectives) {
      for (const questionId of objective.questionIds ?? []) {
        const conceptId = conceptIdFromQuestionId(questionId, certification.id);
        if (!conceptIds.has(conceptId)) {
          conceptIds.add(conceptId);
          const domainId = domainIdFromObjective(certification.id, objective.objective);
          // Derive a human-readable title from the concept slug
          const conceptSlug = conceptId.split(".concept.")[1] || conceptId;
          const title = conceptSlug
            .replace(/-/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase());
          resources.push({
            type: "concept",
            data: {
              schema: "certigo.runtime.concept/v1",
              resourceType: "concept",
              id: conceptId,
              certificationId: certification.id,
              blueprintVersion: bpVersion,
              domainId,
              title,
              lifecycle,
            },
          });
        }
      }
    }
  }

  // Track — questionBank mode for all materialized certs
  const trackId = `${provider}.${slug}.track.main`;
  resources.push({
    type: "track",
    data: {
      schema: "certigo.runtime.track/v1",
      resourceType: "track",
      id: trackId,
      certificationId: certification.id,
      blueprintVersion: bpVersion,
      mode: "questionBank",
      summary: `${certification.title} question bank.`,
      domainIds,
      unitIds: [],
      lifecycle,
    },
  });

  return resources;
}

/**
 * Build coverage matrices for Microsoft v2 certs that lack them.
 * Groups v2 questions by certification (from ID prefix) into single-section coverage.
 */
function buildV2CoverageMatrices(root, catalog) {
  const v2Questions = glob.sync("content/public/questions/*.json", {
    cwd: root,
    posix: true,
  });

  // Group by certification
  const groups = new Map();
  for (const file of v2Questions.sort(compareOrdinal)) {
    const data = loadJson(resolve(root, file));
    if (data.schemaVersion !== "v2") continue;
    const certId = classifyV2Question(data.id);
    if (!certId) continue;
    if (!groups.has(certId)) groups.set(certId, []);
    groups.get(certId).push(data.id);
  }

  const matrices = [];
  for (const [certId, questionIds] of [...groups.entries()].sort((a, b) =>
    compareOrdinal(a[0], b[0])
  )) {
    const cert = catalog.certifications.find((c) => c.id === certId);
    if (!cert) continue;

    // Assign all questions to section-1 (the single section)
    const objective = cert.blueprint.objectives[0];
    if (!objective) continue;

    matrices.push({
      schema: "certigo.coverage-matrix/v1",
      provider: certProvider(certId),
      certification: certId,
      blueprintVersion: cert.blueprint.version,
      status:
        cert.status === "retired"
          ? "retired"
          : cert.status === "active-retiring"
            ? "retiring"
            : "complete",
      objectives: [
        {
          objective: objective.id,
          title: objective.title,
          weightPercent: objective.weightPercent,
          weightType: objective.weightType,
          questionIds: questionIds.sort(compareOrdinal),
        },
      ],
    });
  }
  return matrices;
}

export async function materializeRuntime(options = {}) {
  const root = resolve(options.root ?? cwd());
  const checkMode = !!options.check;
  const catalog = loadJson(resolve(root, "content/public/catalog/certifications.json"));

  // Load existing coverage matrices
  const coverageFiles = glob.sync("content/public/coverage/**/*.json", {
    cwd: root,
    posix: true,
  });
  const coverageMap = new Map();
  for (const file of coverageFiles.sort(compareOrdinal)) {
    const data = loadJson(resolve(root, file));
    if (data.schema === "certigo.coverage-matrix/v1") {
      coverageMap.set(data.certification, data);
    }
  }

  // Build v2 coverage matrices for Microsoft certs that need them
  const v2Matrices = buildV2CoverageMatrices(root, catalog);
  const expectedCoverageFiles = [];
  for (const matrix of v2Matrices) {
    coverageMap.set(matrix.certification, matrix);
    const provider = certProvider(matrix.certification);
    const slug = certSlug(matrix.certification);
    const path = `content/public/coverage/${provider}/${slug}.json`;
    expectedCoverageFiles.push({ path, data: matrix });
  }

  // Generate runtime resources for each certification with coverage
  const allResources = [];
  const certStats = [];
  for (const cert of catalog.certifications) {
    const coverage = coverageMap.get(cert.id);
    if (!coverage) continue;
    const resources = buildCertificationResources(cert, coverage);
    allResources.push(...resources);
    const questionCount = coverage.objectives.reduce(
      (sum, obj) => sum + (obj.questionIds?.length ?? 0),
      0
    );
    certStats.push({
      id: cert.id,
      resourceCount: resources.length,
      questionCount,
    });
  }

  const guidedTrackFiles = authoredGuidedTrackFiles(root);
  const resourcesToMaterialize = generatedResources(allResources, guidedTrackFiles);

  if (checkMode) {
    // Generated resources are exact; authored units, lessons and guided tracks
    // are validated by validate_content.mjs and are never regenerated here.
    let mismatches = 0;
    for (const { path, data } of expectedCoverageFiles) {
      const expected = `${canonicalize(data)}\n`;
      if (
        !existsSync(resolve(root, path)) ||
        normalizeLineEndings(readFileSync(resolve(root, path), "utf8")) !== expected
      ) {
        mismatches++;
      }
    }
    const expectedRuntimeFiles = new Set(
      resourcesToMaterialize.map(runtimeResourcePath)
    );
    for (const file of guidedTrackFiles) expectedRuntimeFiles.add(file);
    for (const resource of resourcesToMaterialize) {
      const path = runtimeResourcePath(resource);
      const filePath = resolve(root, path);
      const expected = `${canonicalize(resource.data)}\n`;
      if (!existsSync(filePath)) {
        mismatches++;
      } else {
        const actual = normalizeLineEndings(readFileSync(filePath, "utf8"));
        if (actual !== expected) mismatches++;
      }
    }
    const actualRuntimeFiles = new Set(generatedRuntimeFiles(root));
    for (const path of actualRuntimeFiles) {
      if (!expectedRuntimeFiles.has(path)) mismatches++;
    }
    return {
      mode: "check",
      certificationCount: certStats.length,
      resourceCount: allResources.length,
      mismatches,
      ok: mismatches === 0,
    };
  }

  // Write coverage matrices and replace the generated runtime tree atomically enough
  // for a local build. Only generated resource types are reconciled; authored
  // guided tracks, units and lessons are outside the generator's ownership.
  for (const { path, data } of expectedCoverageFiles) {
    writeResource(resolve(root, path), data);
  }
  removeStaleGeneratedResources(root, resourcesToMaterialize, guidedTrackFiles);

  // Write runtime resources
  let written = 0;
  for (const resource of resourcesToMaterialize) {
    const filePath = resolve(root, runtimeResourcePath(resource));
    writeResource(filePath, resource.data);
    written++;
  }

  return {
    mode: "write",
    certificationCount: certStats.length,
    resourceCount: written,
    microsoftCoverageMatrices: expectedCoverageFiles.length,
    certStats,
  };
}

function parseArgs(cliArgs) {
  const options = {};
  for (let index = 0; index < cliArgs.length; index++) {
    const arg = cliArgs[index];
    if (arg === "--root") {
      options.root = cliArgs[++index];
    } else if (arg === "--check") {
      options.check = true;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else {
      throw new Error(`argument inconnu: ${arg}`);
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
        "Usage: node tools/materialize_runtime.mjs [--root DIR] [--check]"
      );
    } else {
      const result = await materializeRuntime(options);
      console.log(JSON.stringify(result, null, 2));
      if (options.check && !result.ok) process.exitCode = 1;
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
