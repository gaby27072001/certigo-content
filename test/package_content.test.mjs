import assert from "node:assert/strict";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { afterEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  inspectPublicArtifact,
  packageContent,
  verifyArtifact,
  verifyPackagedContent,
} from "../tools/package_content.mjs";
import { canonicalize, sha256Hex } from "../tools/gen_manifest.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const temporaryRoots = [];

function createRoot() {
  const root = mkdtempSync(join(tmpdir(), "certigo-package-"));
  temporaryRoots.push(root);
  cpSync(resolve(repoRoot, "schemas"), resolve(root, "schemas"), { recursive: true });
  mkdirSync(resolve(root, "content", "public", "questions"), { recursive: true });
  mkdirSync(resolve(root, "content", "answerKey", "solutions"), { recursive: true });
  writeFileSync(
    resolve(root, "content", "public", "questions", "sample.json"),
    JSON.stringify({
      choices: ["A", "B"],
      prompt: "Question",
      kind: "public",
      schemaVersion: "v2",
      id: "sample",
    })
  );
  writeFileSync(
    resolve(root, "content", "answerKey", "solutions", "sample.json"),
    JSON.stringify({
      rationale: "Because",
      correct: "A",
      kind: "answerKey",
      schemaVersion: "v2",
      id: "sample",
    })
  );
  return root;
}

function countJsonFiles(root) {
  let count = 0;
  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith(".json")) count++;
    }
  }
  walk(root);
  return count;
}

function createHistoricalV2Root() {
  const root = mkdtempSync(join(tmpdir(), "certigo-package-v2-historical-"));
  temporaryRoots.push(root);
  cpSync(resolve(repoRoot, "schemas"), resolve(root, "schemas"), { recursive: true });
  cpSync(resolve(repoRoot, "content"), resolve(root, "content"), { recursive: true });

  const wavesAfterRuntimeV2 = [
    {
      provider: "aws",
      certifications: ["aif-c01", "clf-c02"],
      pairCount: 42,
    },
    {
      provider: "gcp",
      certifications: ["cloud-digital-leader", "generative-ai-leader"],
      pairCount: 42,
    },
    {
      provider: "gcp",
      certifications: [
        "associate-google-workspace-administrator",
        "cloud-engineer",
        "data-practitioner",
      ],
      pairCount: 60,
    },
  ];
  for (const wave of wavesAfterRuntimeV2) {
    for (const channel of [
      ["public", "questions"],
      ["answerKey", "solutions"],
    ]) {
      const channelRoot = resolve(root, "content", channel[0], channel[1], wave.provider);
      const pairCount = wave.certifications.reduce(
        (total, certification) =>
          total + countJsonFiles(resolve(channelRoot, certification)),
        0
      );
      assert.equal(pairCount, wave.pairCount);
      for (const certification of wave.certifications) {
        rmSync(resolve(channelRoot, certification), { recursive: true });
      }
    }
  }

  const catalogPath = resolve(root, "content", "public", "catalog", "certifications.json");
  const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
  for (const certification of catalog.certifications) {
    if (
      ![
        "aws:aif-c01",
        "aws:clf-c02",
        "gcp:cloud-digital-leader",
        "gcp:generative-ai-leader",
      ].includes(certification.id)
    ) {
      continue;
    }
    certification.provenance.checkedOn = "2026-08-17";
    if (certification.provider === "aws") {
      certification.provenance.sources = certification.provenance.sources.filter(
        (source) => !source.url.endsWith("AWS-Certified-Cloud-Practitioner_Exam-Guide.pdf")
      );
    }
  }
  writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);

  for (const { provider, certifications } of wavesAfterRuntimeV2) {
    for (const certification of certifications) {
      const matrixPath = resolve(
        root,
        "content",
        "public",
        "coverage",
        provider,
        `${certification}.json`
      );
      const matrix = JSON.parse(readFileSync(matrixPath, "utf8"));
      matrix.status = "planned";
      for (const objective of matrix.objectives) objective.questionIds = [];
      writeFileSync(matrixPath, `${JSON.stringify(matrix, null, 2)}\n`);
    }
  }
  return root;
}

function treeSnapshot(root) {
  const snapshot = {};
  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else snapshot[relative(root, path).replaceAll("\\", "/")] = readFileSync(path).toString("base64");
    }

  }
  walk(root);
  return snapshot;
}

function rewriteManifest(artifactRoot, mutate) {
  const path = resolve(artifactRoot, "manifest.json");
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  mutate(manifest);
  const body = {
    schema: manifest.schema,
    channel: manifest.channel,
    artifact: manifest.artifact,
    algorithm: manifest.algorithm,
    serialization: manifest.serialization,
    fileCount: manifest.fileCount,
    files: manifest.files,
  };
  manifest.rootHash = sha256Hex(canonicalize(body));
  manifest.manifestId = `sha256:${manifest.rootHash}`;
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
}

afterEach(() => {
  while (temporaryRoots.length > 0) {
    rmSync(temporaryRoots.pop(), { recursive: true, force: true });
  }
});

test("produit deux artefacts byte-identical avec des manifestes distincts", async () => {
  const root = createRoot();
  await packageContent({ root, outDir: "dist-first" });
  await packageContent({ root, outDir: "dist-second" });

  assert.deepEqual(
    treeSnapshot(resolve(root, "dist-first")),
    treeSnapshot(resolve(root, "dist-second"))
  );

  const publicManifest = JSON.parse(
    readFileSync(resolve(root, "dist-first", "public", "manifest.json"), "utf8")
  );
  const privateManifest = JSON.parse(
    readFileSync(resolve(root, "dist-first", "private", "manifest.json"), "utf8")
  );
  assert.notEqual(publicManifest.manifestId, privateManifest.manifestId);
  assert.deepEqual(publicManifest.files.map((entry) => entry.path), ["questions/sample.json"]);
  assert.deepEqual(privateManifest.files.map((entry) => entry.path), ["solutions/sample.json"]);
});

test("conserve le package v2 courant byte-identical", async () => {
  const outDir = mkdtempSync(join(tmpdir(), "certigo-package-v2-golden-"));
  temporaryRoots.push(outDir);

  const result = await packageContent({ root: repoRoot, outDir });

  assert.equal(result.sourcePairCount, 232 + 42 + 42 + 60);
  assert.equal(result.release, null);
  assert.equal(existsSync(resolve(outDir, "release.json")), false);
  assert.deepEqual(
    result.packages.map(({ artifact, manifestId }) => ({ artifact, manifestId })),
    [
      {
        artifact: "public",
        manifestId:
          "sha256:561856321bcee074d2c40f2cb970e6780f5a49de98e6e892f56b20635b7cdd84",
      },
      {
        artifact: "private",
        manifestId:
          "sha256:093dce8a62420661f3eeb0efff46327e533b483dfc01217c6abe096a86263d6b",
      },
    ]
  );
  assert.equal(
    sha256Hex(canonicalize(treeSnapshot(outDir))),
    "1f917094a696e6831da117a74840abfce8b99e624b41838d1a3e7bb037dd81af"
  );
});

test("conserve le package v2 historique de #25 byte-identical", async () => {
  const root = createHistoricalV2Root();
  const outDir = resolve(root, "dist-golden");
  const result = await packageContent({ root, outDir });

  assert.equal(result.sourcePairCount, 232);
  assert.equal(result.release, null);
  assert.equal(existsSync(resolve(outDir, "release.json")), false);
  assert.deepEqual(
    result.packages.map(({ artifact, manifestId }) => ({ artifact, manifestId })),
    [
      {
        artifact: "public",
        manifestId:
          "sha256:a3ab2254673515990410268a93f95afd5605f19e29637373d7b20d412fa08869",
      },
      {
        artifact: "private",
        manifestId:
          "sha256:e3bfa7c20c03503384a68d8e261bcbb88f749292a273744a5ba4a309fc48c901",
      },
    ]
  );
  assert.equal(
    sha256Hex(canonicalize(treeSnapshot(outDir))),
    "c8720f3665593a2da00540f43cbde5436fd826293dfe950d5af221d47ab50eac"
  );
});

test("revalide un package historique v1 sans release descriptor", async () => {
  const root = createRoot();
  await packageContent({ root });

  const verified = await verifyPackagedContent({ root });
  assert.equal(verified.release, null);
  assert.equal(verified.packages.length, 2);
});

test("la gate finale rejette une fuite injectee recursivement dans dist/public", async () => {
  const root = createRoot();
  await packageContent({ root });
  const leakPath = resolve(root, "dist", "public", "nested", "answerKey", "leak.json");
  mkdirSync(dirname(leakPath), { recursive: true });
  writeFileSync(leakPath, JSON.stringify({ nested: { rationale: "secret" } }));

  assert.throws(
    () => inspectPublicArtifact(resolve(root, "dist", "public")),
    /\[anti-leak\].*(answerKey|rationale|corrige)/i
  );
});

test("la verification rejette un fichier non declare et un hash altere", async () => {
  const root = createRoot();
  await packageContent({ root });
  const artifactRoot = resolve(root, "dist", "public");
  const schemaPath = resolve(root, "schemas", "package-manifest.schema.json");
  writeFileSync(resolve(artifactRoot, "questions", "sample.json"), "{}\n");
  writeFileSync(resolve(artifactRoot, "undeclared.json"), "{}\n");

  assert.throws(
    () => verifyArtifact({ artifactRoot, expectedChannel: "public", schemaPath }),
    /fichier non declare.*hash incorrect/
  );
});

test("un build mono-canal preserve l'autre artefact existant", async () => {
  const root = createRoot();
  await packageContent({ root });
  const publicBefore = treeSnapshot(resolve(root, "dist", "public"));

  await packageContent({ root, channel: "private" });

  assert.deepEqual(treeSnapshot(resolve(root, "dist", "public")), publicBefore);
  assert.ok(readFileSync(resolve(root, "dist", "reports", "public-anti-leak.json")));
});

test("couple strictement artifact, channel, path, id et payload", async () => {
  const channelRoot = createRoot();
  await packageContent({ root: channelRoot });
  const publicRoot = resolve(channelRoot, "dist", "public");
  rewriteManifest(publicRoot, (manifest) => {
    manifest.channel = "answerKey";
  });
  assert.throws(
    () =>
      verifyArtifact({
        artifactRoot: publicRoot,
        expectedChannel: "public",
        schemaPath: resolve(channelRoot, "schemas", "package-manifest.schema.json"),
      }),
    /channel attendu public|schema.*const/
  );

  const pathRoot = createRoot();
  await packageContent({ root: pathRoot });
  const privateRoot = resolve(pathRoot, "dist", "private");
  renameSync(
    resolve(privateRoot, "solutions", "sample.json"),
    resolve(privateRoot, "solutions", "renamed.json")
  );
  rewriteManifest(privateRoot, (manifest) => {
    manifest.files[0].path = "solutions/renamed.json";
  });
  assert.throws(
    () =>
      verifyArtifact({
        artifactRoot: privateRoot,
        expectedChannel: "private",
        schemaPath: resolve(pathRoot, "schemas", "package-manifest.schema.json"),
      }),
    /couplage path\/id incorrect/
  );

  const payloadRoot = createRoot();
  await packageContent({ root: payloadRoot });
  const payloadArtifactRoot = resolve(payloadRoot, "dist", "private");
  const payloadPath = resolve(payloadArtifactRoot, "solutions", "sample.json");
  const payload = JSON.parse(readFileSync(payloadPath, "utf8"));
  payload.id = "other";
  const serialized = `${canonicalize(payload)}\n`;
  writeFileSync(payloadPath, serialized);
  rewriteManifest(payloadArtifactRoot, (manifest) => {
    manifest.files[0].hash = sha256Hex(serialized);
    manifest.files[0].size = Buffer.byteLength(serialized);
  });
  assert.throws(
    () =>
      verifyArtifact({
        artifactRoot: payloadArtifactRoot,
        expectedChannel: "private",
        schemaPath: resolve(payloadRoot, "schemas", "package-manifest.schema.json"),
      }),
    /couplage payload\/id incorrect/
  );
});

test("utilise un tri ordinal stable, independant de la locale", async () => {
  const root = createRoot();
  for (const id of ["Zeta", "alpha"]) {
    writeFileSync(
      resolve(root, "content", "public", "questions", `${id}.json`),
      JSON.stringify({
        id,
        schemaVersion: "v2",
        kind: "public",
        prompt: id,
        choices: ["A", "B"],
      })
    );
    writeFileSync(
      resolve(root, "content", "answerKey", "solutions", `${id}.json`),
      JSON.stringify({
        id,
        schemaVersion: "v2",
        kind: "answerKey",
        correct: "A",
        rationale: id,
      })
    );
  }
  await packageContent({ root });
  const manifest = JSON.parse(
    readFileSync(resolve(root, "dist", "public", "manifest.json"), "utf8")
  );
  assert.deepEqual(
    manifest.files.map((entry) => entry.path),
    ["questions/Zeta.json", "questions/alpha.json", "questions/sample.json"]
  );
});

test("refuse les liens symboliques et types speciaux dans un artefact", async (context) => {
  const root = createRoot();
  await packageContent({ root });
  const publicRoot = resolve(root, "dist", "public");
  const target = resolve(publicRoot, "questions", "sample.json");
  const link = resolve(publicRoot, "linked.json");
  try {
    symlinkSync(target, link, "file");
  } catch (error) {
    if (error.code === "EPERM" || error.code === "EACCES") {
      context.skip(`liens symboliques indisponibles: ${error.code}`);
      return;
    }
    throw error;
  }
  assert.throws(() => inspectPublicArtifact(publicRoot), /lien symbolique interdit/);

  if (process.platform !== "win32") {
    rmSync(link);
    const fifo = resolve(publicRoot, "special");
    const result = spawnSync("mkfifo", [fifo], { encoding: "utf8" });
    if (result.status === 0) {
      assert.throws(() => inspectPublicArtifact(publicRoot), /type de fichier interdit/);
    }
  }
});
