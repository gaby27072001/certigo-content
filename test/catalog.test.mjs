import assert from "node:assert/strict";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { afterEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { checkCatalogFreshness } from "../tools/check_catalog_freshness.mjs";
import { buildManifest, canonicalize } from "../tools/gen_manifest.mjs";
import {
  isCertificationActiveOn,
  metadataFields,
  parseDate,
} from "../tools/lib/catalog.mjs";
import {
  packageContent,
  verifyPackagedContent,
} from "../tools/package_content.mjs";
import { validateContent } from "../tools/validate_content.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const temporaryRoots = [];
const expectedAws = [
  "aws:aif-c01",
  "aws:aip-c01",
  "aws:ans-c01",
  "aws:clf-c02",
  "aws:dea-c01",
  "aws:dop-c02",
  "aws:dva-c02",
  "aws:mla-c01",
  "aws:saa-c03",
  "aws:sap-c02",
  "aws:scs-c03",
  "aws:soa-c03",
];
const expectedGcp = [
  "gcp:associate-google-workspace-administrator",
  "gcp:cloud-architect",
  "gcp:cloud-database-engineer",
  "gcp:cloud-developer",
  "gcp:cloud-devops-engineer",
  "gcp:cloud-digital-leader",
  "gcp:cloud-engineer",
  "gcp:cloud-network-engineer",
  "gcp:cloud-security-engineer",
  "gcp:data-engineer",
  "gcp:data-practitioner",
  "gcp:generative-ai-leader",
  "gcp:machine-learning-engineer",
  "gcp:security-operations-engineer",
];

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function treeSnapshot(root) {
  const snapshot = {};
  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else {
        snapshot[relative(root, path).replaceAll("\\", "/")] =
          readFileSync(path).toString("base64");
      }
    }
  }
  walk(root);
  return snapshot;
}

function catalogAt(root) {
  return resolve(root, "content", "public", "catalog", "certifications.json");
}

function createMetadataRoot() {
  const root = mkdtempSync(join(tmpdir(), "certigo-catalog-"));
  temporaryRoots.push(root);
  cpSync(resolve(repoRoot, "schemas"), resolve(root, "schemas"), { recursive: true });
  cpSync(
    resolve(repoRoot, "content", "public", "catalog"),
    resolve(root, "content", "public", "catalog"),
    { recursive: true }
  );
  cpSync(
    resolve(repoRoot, "content", "public", "coverage"),
    resolve(root, "content", "public", "coverage"),
    { recursive: true }
  );
  const coverageRoot = resolve(root, "content", "public", "coverage");
  for (const provider of readdirSync(coverageRoot, { withFileTypes: true })) {
    if (!provider.isDirectory()) continue;
    const providerRoot = resolve(coverageRoot, provider.name);
    for (const file of readdirSync(providerRoot)) {
      const matrixPath = resolve(providerRoot, file);
      const matrix = readJson(matrixPath);
      for (const objective of matrix.objectives) objective.questionIds = [];
      if (matrix.status === "complete" || matrix.status === "in-progress") {
        matrix.status = "planned";
      }
      writeJson(matrixPath, matrix);
    }
  }
  mkdirSync(resolve(root, "content", "public", "questions"), { recursive: true });
  mkdirSync(resolve(root, "content", "answerKey", "solutions"), { recursive: true });
  return root;
}

function addV3Pair(root, overrides = {}) {
  const id = overrides.id ?? "aws.aif-c01.domain-1.ai-basics.001";
  const publicMetadata = {
    provider: "aws",
    certification: "aws:aif-c01",
    blueprintVersion: "2026-08-17",
    objective: "domain-1",
    ...overrides.publicMetadata,
  };
  const privateMetadata = {
    ...publicMetadata,
    ...overrides.privateMetadata,
  };
  const publicPath =
    overrides.publicPath ??
    resolve(
      root,
      "content",
      "public",
      "questions",
      "aws",
      "aif-c01",
      `${id}.json`
    );
  const privatePath =
    overrides.privatePath ??
    resolve(
      root,
      "content",
      "answerKey",
      "solutions",
      "aws",
      "aif-c01",
      `${id}.json`
    );
  writeJson(publicPath, {
    id,
    schemaVersion: "v3",
    kind: "public",
    metadata: publicMetadata,
    prompt: "What is AI?",
    choices: ["A", "B"],
  });
  writeJson(privatePath, {
    id,
    schemaVersion: "v3",
    kind: "answerKey",
    metadata: privateMetadata,
    correct: "A",
    rationale: "Because.",
  });
  const matrixPath = resolve(
    root,
    "content",
    "public",
    "coverage",
    "aws",
    "aif-c01.json"
  );
  const matrix = readJson(matrixPath);
  matrix.status = "in-progress";
  matrix.objectives[0].questionIds = [id];
  writeJson(matrixPath, matrix);
  return id;
}

afterEach(() => {
  while (temporaryRoots.length > 0) {
    rmSync(temporaryRoots.pop(), { recursive: true, force: true });
  }
});

test("inventorie exactement les certifications AWS et Google Cloud actives", async () => {
  const catalog = readJson(catalogAt(repoRoot));
  const aws = catalog.certifications
    .filter((certification) => certification.provider === "aws")
    .map((certification) => certification.id);
  const gcp = catalog.certifications
    .filter((certification) => certification.provider === "gcp")
    .map((certification) => certification.id);

  assert.deepEqual(aws, expectedAws);
  assert.deepEqual(gcp, expectedGcp);
  assert.equal(catalog.asOf, "2026-08-17");
  assert.ok(aws.includes("aws:aip-c01"));
  assert.ok(!aws.includes("aws:mls-c01"));

  const ans = catalog.certifications.find(
    (certification) => certification.id === "aws:ans-c01"
  );
  assert.equal(ans.status, "active-retiring");
  assert.equal(ans.lifecycle.lastExamOn, "2026-08-25");
  assert.equal(ans.lifecycle.reviewOn, "2026-08-26");
  assert.equal(
    readJson(resolve(repoRoot, "content", "public", "coverage", "aws", "ans-c01.json"))
      .status,
    "retiring"
  );
});

test("valide exhaustivement le catalogue reel et ses 26 matrices", async () => {
  const result = await validateContent({ root: repoRoot });
  assert.deepEqual(result.errors, []);
  assert.equal(result.certificationCount, 26);
  assert.equal(result.coverageCount, 26);

  const catalog = readJson(catalogAt(repoRoot));
  const questionIds = [];
  for (const certification of catalog.certifications) {
    const matrix = readJson(
      resolve(
        repoRoot,
        "content",
        "public",
        "coverage",
        certification.provider,
        `${certification.slug}.json`
      )
    );
    assert.equal(matrix.certification, certification.id);
    assert.ok(matrix.objectives.every((objective) => Array.isArray(objective.questionIds)));
    questionIds.push(...matrix.objectives.flatMap((objective) => objective.questionIds));
    if (matrix.status === "planned") {
      assert.ok(matrix.objectives.every((objective) => objective.questionIds.length === 0));
    }
    if (matrix.status === "complete") {
      assert.ok(matrix.objectives.every((objective) => objective.questionIds.length > 0));
    }
    const sum = certification.blueprint.objectives.reduce(
      (total, objective) => total + objective.weightPercent,
      0
    );
    if (certification.provider === "aws") assert.equal(sum, 100);
    else assert.ok(sum >= 99 && sum <= 101);
  }
  assert.equal(questionIds.length, new Set(questionIds).size);
});

test("applique automatiquement la date de retrait ANS-C01 a l'inventaire actif", () => {
  const catalog = readJson(catalogAt(repoRoot));
  const ans = catalog.certifications.find(
    (certification) => certification.id === "aws:ans-c01"
  );

  assert.equal(isCertificationActiveOn(ans, "2026-08-25"), true);
  assert.equal(isCertificationActiveOn(ans, "2026-08-26"), false);
  assert.equal(
    isCertificationActiveOn({ ...ans, status: "retired" }, "2026-08-17"),
    false
  );

  const current = checkCatalogFreshness({ root: repoRoot, asOf: "2026-08-17" });
  assert.deepEqual(current.errors, []);
  assert.ok(current.activeCertificationIds.includes("aws:ans-c01"));

  const transition = checkCatalogFreshness({
    root: repoRoot,
    asOf: "2026-08-26",
  });
  assert.ok(!transition.activeCertificationIds.includes("aws:ans-c01"));
  assert.ok(transition.excludedCertificationIds.includes("aws:ans-c01"));
  assert.ok(
    transition.errors.some((error) => error.includes("transition a reverifier"))
  );
});

test("detecte catalogue stale, date invalide et catalogue absent", () => {
  const stale = checkCatalogFreshness({ root: repoRoot, asOf: "2026-09-17" });
  assert.ok(stale.errors.some((error) => error.includes("snapshot age")));
  const before = checkCatalogFreshness({ root: repoRoot, asOf: "2026-08-16" });
  assert.ok(before.errors.some((error) => error.includes("anterieure")));
  assert.throws(() => parseDate("2026-02-30", "test"), /date invalide/);
  assert.throws(() => parseDate("17-08-2026", "test"), /YYYY-MM-DD/);

  const root = mkdtempSync(join(tmpdir(), "certigo-no-catalog-"));
  temporaryRoots.push(root);
  assert.throws(() => checkCatalogFreshness({ root }), /catalogue introuvable/);
});

test("refuse undefined en canonicalisation et ignore metadata v3 non objet", () => {
  assert.throws(() => canonicalize({ value: undefined }), /undefined interdite/);
  assert.deepEqual(metadataFields({ schemaVersion: "v3", metadata: null }), {});
  assert.deepEqual(metadataFields({ schemaVersion: "v3", metadata: [] }), {});
  assert.deepEqual(metadataFields({ schemaVersion: "v3", metadata: "invalid" }), {});
});

test("accepte une paire v3 namespacee et la rattache a sa matrice", async () => {
  const root = createMetadataRoot();
  const id = addV3Pair(root);
  const result = await validateContent({ root });
  assert.deepEqual(result.errors, []);
  assert.equal(result.pairCount, 1);

  const summary = await packageContent({ root, outDir: "dist-first" });
  await packageContent({ root, outDir: "dist-second" });
  assert.deepEqual(
    treeSnapshot(resolve(root, "dist-first")),
    treeSnapshot(resolve(root, "dist-second"))
  );
  assert.equal(summary.certificationCount, 26);
  const publicManifest = readJson(
    resolve(root, "dist-first", "public", "manifest.json")
  );
  const question = publicManifest.files.find((entry) => entry.id === id);
  assert.equal(publicManifest.schema, "certigo.content.package-manifest/v2");
  assert.deepEqual(
    {
      resourceType: question.resourceType,
      provider: question.provider,
      certification: question.certification,
      blueprintVersion: question.blueprintVersion,
      objective: question.objective,
    },
    {
      resourceType: "question",
      provider: "aws",
      certification: "aws:aif-c01",
      blueprintVersion: "2026-08-17",
      objective: "domain-1",
    }
  );
  assert.equal(
    question.path,
    `questions/aws/aif-c01/${id}.json`
  );
  assert.ok(
    !publicManifest.files.some((entry) => entry.resourceType === "solution")
  );
  await verifyPackagedContent({ root, outDir: "dist-first" });
});

test("rejette les divergences de namespace, metadata et couverture v3", async () => {
  const root = createMetadataRoot();
  const id = addV3Pair(root, {
    publicPath: resolve(
      root,
      "content",
      "public",
      "questions",
      "gcp",
      "wrong",
      "aws.aif-c01.domain-1.ai-basics.001.json"
    ),
    privateMetadata: { objective: "domain-2" },
  });

  const matrixPath = resolve(
    root,
    "content",
    "public",
    "coverage",
    "aws",
    "aif-c01.json"
  );
  const matrix = readJson(matrixPath);
  matrix.objectives[0].questionIds = [];
  matrix.objectives[1].questionIds = [id];
  writeJson(matrixPath, matrix);

  const result = await validateContent({ root });
  assert.ok(result.errors.some((error) => error.includes("[namespace:path]")));
  assert.ok(result.errors.some((error) => error.includes("[integrity:metadata]")));
  assert.ok(
    result.errors.some(
      (error) =>
        error.includes("[coverage:question]") ||
        error.includes("[coverage:missing-question]")
    )
  );
});

test("retourne des erreurs structurees si metadata v3 manque", async () => {
  const root = createMetadataRoot();
  const id = addV3Pair(root);
  const questionPath = resolve(
    root,
    "content",
    "public",
    "questions",
    "aws",
    "aif-c01",
    `${id}.json`
  );
  const question = readJson(questionPath);
  delete question.metadata;
  writeJson(questionPath, question);

  const result = await validateContent({ root });
  assert.ok(result.errors.some((error) => error.includes("[schema:question]")));
});

test("conserve un enregistrement retire tout en l'excluant des actifs", async () => {
  const root = createMetadataRoot();
  const catalog = readJson(catalogAt(root));
  catalog.asOf = "2026-08-26";
  const ans = catalog.certifications.find(
    (certification) => certification.id === "aws:ans-c01"
  );
  ans.status = "retired";
  delete ans.lifecycle.reviewOn;
  writeJson(catalogAt(root), catalog);

  const matrixPath = resolve(
    root,
    "content",
    "public",
    "coverage",
    "aws",
    "ans-c01.json"
  );
  const matrix = readJson(matrixPath);
  matrix.status = "retired";
  writeJson(matrixPath, matrix);

  const result = await validateContent({ root });
  assert.deepEqual(result.errors, []);
  assert.equal(isCertificationActiveOn(ans, catalog.asOf), false);
});

test("rejette les ecarts semantiques du catalogue et les sources non officielles", async () => {
  const root = createMetadataRoot();
  const catalog = readJson(catalogAt(root));
  catalog.certifications[0].officialUrl = "https://example.com/fake";
  catalog.providers[0].sourceHosts.push("example.com");
  catalog.certifications.find(
    (certification) => certification.provider === "gcp"
  ).officialUrl = "https://example.com/fake-gcp";
  catalog.certifications[0].blueprint.objectives[0].weightPercent = 19;
  catalog.certifications.reverse();
  writeJson(catalogAt(root), catalog);
  rmSync(resolve(root, "content", "public", "coverage", "aws", "aif-c01.json"));

  const result = await validateContent({ root });
  assert.ok(result.errors.some((error) => error.includes("[catalog:order]")));
  assert.ok(result.errors.some((error) => error.includes("sourceHosts")));
  assert.ok(result.errors.some((error) => error.includes("hote non officiel")));
  assert.ok(result.errors.some((error) => error.includes("[catalog:weight]")));
  assert.ok(result.errors.some((error) => error.includes("[coverage:missing]")));
});

test("genere un manifeste v2 deterministe incluant catalogue et couverture", async () => {
  const first = await buildManifest({ root: repoRoot });
  const second = await buildManifest({ root: repoRoot });
  assert.deepEqual(first, second);
  assert.equal(first.schema, "certigo.content.manifest/v2");
  assert.ok(
    first.items.some(
      (item) =>
        item.resourceType === "certificationCatalog" &&
        item.path === "content/public/catalog/certifications.json"
    )
  );
  assert.ok(
    first.items.some(
      (item) =>
        item.resourceType === "coverageMatrix" &&
        item.certification === "gcp:cloud-architect"
    )
  );
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const validate = ajv.compile(
    readJson(resolve(repoRoot, "schemas", "manifest.schema.json"))
  );
  assert.equal(validate(first), true, JSON.stringify(validate.errors));
});
