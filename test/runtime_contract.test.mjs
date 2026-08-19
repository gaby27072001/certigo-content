import assert from "node:assert/strict";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { afterEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { compileRuntime } from "../tools/compile_runtime.mjs";
import { buildManifest } from "../tools/gen_manifest.mjs";
import {
  inspectPublicArtifact,
  packageContent,
  verifyPackagedContent,
} from "../tools/package_content.mjs";
import {
  CONTENT_MODE,
  detectContentMode,
  expectedArtifactPath,
  resourceMetadata,
  resourceTypeFromArtifactPath,
  resourceTypeFromSourcePath,
  sourceGlobsForChannel,
} from "../tools/lib/resources.mjs";
import { validateContent } from "../tools/validate_content.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixtureRoot = resolve(repoRoot, "tools", "__fixtures__", "runtime-v3");
const temporaryRoots = [];

function createRoot() {
  const root = mkdtempSync(join(tmpdir(), "certigo-runtime-contract-"));
  temporaryRoots.push(root);
  cpSync(resolve(fixtureRoot, "content"), resolve(root, "content"), {
    recursive: true,
  });
  cpSync(resolve(repoRoot, "schemas"), resolve(root, "schemas"), {
    recursive: true,
  });
  return root;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function treeSnapshot(root) {
  const result = {};
  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else {
        result[relative(root, path).replaceAll("\\", "/")] =
          readFileSync(path).toString("base64");
      }
    }
  }
  walk(root);
  return result;
}

afterEach(() => {
  while (temporaryRoots.length > 0) {
    rmSync(temporaryRoots.pop(), { recursive: true, force: true });
  }
});

test("valide le contrat canonique pour quatre parcours Microsoft et une banque AWS", async () => {
  const root = createRoot();
  const result = await validateContent({ root });

  assert.deepEqual(result.errors, []);
  assert.equal(result.pairCount, 5);
  assert.equal(result.certificationCount, 5);
  assert.equal(result.coverageCount, 5);
  assert.equal(result.runtimeResourceCount, 23);
  assert.equal(detectContentMode(root), CONTENT_MODE.runtime);
});

test("genere un manifeste v3 ferme qui inventorie chaque resourceType runtime", async () => {
  const root = createRoot();
  const first = await buildManifest({ root });
  const second = await buildManifest({ root });

  assert.deepEqual(first, second);
  assert.equal(first.schema, "certigo.content.manifest/v3");
  assert.deepEqual(
    new Set(first.items.map((item) => item.resourceType)),
    new Set([
      "certificationCatalog",
      "concept",
      "coverageMatrix",
      "domain",
      "lesson",
      "question",
      "solution",
      "track",
      "unit",
    ])
  );
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const validate = ajv.compile(
    readJson(resolve(root, "schemas", "manifest.schema.json"))
  );
  assert.equal(validate(first), true, JSON.stringify(validate.errors));
  const contradictory = structuredClone(first);
  const track = contradictory.items.find(
    (item) => item.resourceType === "track"
  );
  track.resourceType = "question";
  assert.equal(validate(contradictory), false);
});

test("produit une release v3 deterministe avec identites golden sans cycle de hash", async () => {
  const root = createRoot();
  const first = await packageContent({ root, outDir: "dist-first" });
  const second = await packageContent({ root, outDir: "dist-second" });

  assert.deepEqual(
    treeSnapshot(resolve(root, "dist-first")),
    treeSnapshot(resolve(root, "dist-second"))
  );
  assert.equal(
    first.publicManifestId,
    "sha256:e5663734ac88ac916cff3b6e1206dc03bacf7f6d530e8b115e3f198a1e6304ee"
  );
  assert.equal(
    first.privateManifestId,
    "sha256:1e36233639e4cf7d6dead3fa3c70cb22faa7d02630bbb08333e9b8b5d6187e10"
  );
  assert.equal(
    first.releaseId,
    "sha256:6094410ae57637d55681fdeec3eae50fbfd69ba953741d069c95a478bee73f7f"
  );
  assert.deepEqual(first.release, second.release);
  assert.equal(
    readJson(resolve(root, "dist-first", "public", "manifest.json")).schema,
    "certigo.content.package-manifest/v3"
  );
  assert.equal(
    readJson(resolve(root, "dist-first", "private", "manifest.json")).schema,
    "certigo.content.package-manifest/v3"
  );
  assert.ok(readFileSync(resolve(root, "dist-first", "release.json")));
  assert.ok(!readdirSync(resolve(root, "dist-first", "public")).includes("release.json"));
  const verified = await verifyPackagedContent({ root, outDir: "dist-first" });
  assert.equal(verified.release.releaseId, first.releaseId);
});

test("compile sans duplication les parcours guides et synthetise la pratique question-bank", async () => {
  const root = createRoot();
  const first = await compileRuntime({ root, outDir: "dist/runtime-first" });
  const second = await compileRuntime({ root, outDir: "dist/runtime-second" });

  assert.equal(first.publicDocumentCount, 10);
  assert.equal(first.privateDocumentCount, 5);
  assert.deepEqual(
    treeSnapshot(resolve(root, "dist", "runtime-first")),
    treeSnapshot(resolve(root, "dist", "runtime-second"))
  );
  const azLesson = readJson(
    resolve(root, "dist", "runtime-first", "public", "az900-l-cloud-models.json")
  );
  assert.equal(azLesson.trackId, "az-900");
  assert.equal(azLesson.blocks[1].check.id, "az900-l-cloud-models-check-1");
  assert.deepEqual(
    azLesson.blocks[1].check.options.map((option) => option.id),
    ["iaas", "paas", "saas", "on-premises"]
  );
  const azAnswer = readJson(
    resolve(
      root,
      "dist",
      "runtime-first",
      "private",
      "answerkey__az900-l-cloud-models.json"
    )
  );
  assert.deepEqual(azAnswer.items[0].correct, ["paas"]);
  assert.equal(azAnswer.items[0].difficulty, 2);

  const awsTrack = readJson(
    resolve(
      root,
      "dist",
      "runtime-first",
      "public",
      "aws.clf-c02.track.main.json"
    )
  );
  assert.equal(awsTrack.units[0].id, "aws.clf-c02.track.main.unit.domain-1");
  const awsLesson = readJson(
    resolve(
      root,
      "dist",
      "runtime-first",
      "public",
      "aws.clf-c02.track.main.lesson.domain-1.practice.json"
    )
  );
  assert.equal(awsLesson.blocks[0].check.id, "aws.clf-c02.domain-1.cloud-value.001");
  assert.deepEqual(
    inspectPublicArtifact(resolve(root, "dist", "runtime-first", "public")),
    first.antiLeakReport
  );
});

test("rejette references cassees, reponses inconnues, chemins et extensions publiques", async () => {
  const root = createRoot();
  const lessonPath = resolve(
    root,
    "content",
    "public",
    "runtime",
    "lessons",
    "microsoft",
    "az-900",
    "microsoft.az-900.lesson.cloud-models.json"
  );
  const lesson = readJson(lessonPath);
  lesson.blocks[1].questionId = "microsoft.az-900.section-1.missing.001";
  lesson.unexpected = true;
  writeJson(lessonPath, lesson);

  const solutionPath = resolve(
    root,
    "content",
    "answerKey",
    "solutions",
    "microsoft",
    "az-900",
    "microsoft.az-900.section-1.cloud-models.001.json"
  );
  const solution = readJson(solutionPath);
  solution.correctOptionIds = ["missing-option"];
  writeJson(solutionPath, solution);

  const result = await validateContent({ root });
  assert.ok(result.errors.some((error) => error.includes("[schema:runtime]")));
  assert.ok(result.errors.some((error) => error.includes("[runtime:reference]")));
  assert.ok(
    result.errors.some((error) => error.includes("[integrity:correct-choice]"))
  );
});

test("refuse les reponses v4 incompatibles avec le type et les sorties hors dist", async () => {
  const root = createRoot();
  const solutionPath = resolve(
    root,
    "content",
    "answerKey",
    "solutions",
    "microsoft",
    "az-900",
    "microsoft.az-900.section-1.cloud-models.001.json"
  );
  const solution = readJson(solutionPath);
  solution.correctOptionIds = ["paas", "saas"];
  writeJson(solutionPath, solution);
  const result = await validateContent({ root });
  assert.ok(
    result.errors.some((error) => error.includes("[integrity:correct-choice]"))
  );
  await assert.rejects(
    () => compileRuntime({ root, outDir: "content" }),
    /sous-repertoire dedie de dist/
  );
});

test("la gate finale detecte aussi les champs de solution v4", async () => {
  const root = createRoot();
  await packageContent({ root });
  const leakPath = resolve(root, "dist", "public", "runtime-answer-leak.json");
  writeJson(leakPath, { nested: { correctOptionIds: ["secret"] } });
  assert.throws(
    () => inspectPublicArtifact(resolve(root, "dist", "public")),
    /\[anti-leak\].*correctOptionIds/i
  );
});

test("la verification standalone refuse les option IDs dupliques", async () => {
  const root = createRoot();
  await packageContent({ root });
  const questionPath = resolve(
    root,
    "dist",
    "public",
    "questions",
    "microsoft",
    "az-900",
    "microsoft.az-900.section-1.cloud-models.001.json"
  );
  const question = readJson(questionPath);
  question.options[1].id = question.options[0].id;
  writeJson(questionPath, question);
  await assert.rejects(
    () => verifyPackagedContent({ root }),
    /ids d'option dupliques ou invalides/
  );
});

test("refuse une sortie runtime traversant une junction", async (context) => {
  const root = createRoot();
  const outside = mkdtempSync(join(tmpdir(), "certigo-runtime-outside-"));
  temporaryRoots.push(outside);
  mkdirSync(resolve(root, "dist"), { recursive: true });
  const link = resolve(root, "dist", "link");
  try {
    symlinkSync(outside, link, "junction");
  } catch (error) {
    if (error.code === "EPERM" || error.code === "EACCES") {
      context.skip(`junction indisponible: ${error.code}`);
      return;
    }
    throw error;
  }
  await assert.rejects(
    () => compileRuntime({ root, outDir: "dist/link/victim" }),
    /chemin de sortie non sur/
  );
  assert.equal(existsSync(outside), true);
});

test("centralise les chemins, types et metadata de package runtime", () => {
  const question = readJson(
    resolve(
      fixtureRoot,
      "content",
      "public",
      "questions",
      "microsoft",
      "az-900",
      "microsoft.az-900.section-1.cloud-models.001.json"
    )
  );
  const domain = readJson(
    resolve(
      fixtureRoot,
      "content",
      "public",
      "runtime",
      "domains",
      "microsoft",
      "az-900",
      "microsoft.az-900.domain.cloud-concepts.json"
    )
  );
  assert.equal(
    resourceTypeFromSourcePath(
      "content/public/runtime/domains/microsoft/az-900/microsoft.az-900.domain.cloud-concepts.json"
    ),
    "domain"
  );
  assert.equal(
    resourceTypeFromArtifactPath(
      "runtime/domains/microsoft/az-900/microsoft.az-900.domain.cloud-concepts.json"
    ),
    "domain"
  );
  assert.equal(resourceTypeFromArtifactPath("unknown/file.json"), null);
  assert.deepEqual(resourceMetadata("domain", domain), {
    provider: "microsoft",
    certification: "microsoft:az-900",
    blueprintVersion: "2026-08-17",
    objective: "section-1",
  });
  assert.equal(
    expectedArtifactPath({
      artifact: "public",
      mode: CONTENT_MODE.runtime,
      resourceType: "question",
      data: question,
    }),
    "questions/microsoft/az-900/microsoft.az-900.section-1.cloud-models.001.json"
  );
  assert.ok(
    sourceGlobsForChannel(CONTENT_MODE.runtime, "public").includes(
      "content/public/runtime/tracks/**/*.json"
    )
  );
  assert.throws(
    () => sourceGlobsForChannel("unknown", "public"),
    /mode de contenu inconnu/
  );
});
