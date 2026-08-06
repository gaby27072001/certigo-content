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
import {
  inspectPublicArtifact,
  packageContent,
  verifyArtifact,
} from "../tools/package_content.mjs";

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
