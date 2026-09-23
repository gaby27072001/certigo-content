import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, test } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const temporaryRoots = [];

function execute(tool, args = [], cwd = repoRoot) {
  return spawnSync(process.execPath, [resolve(repoRoot, "tools", tool), ...args], {
    cwd,
    encoding: "utf8",
  });
}

afterEach(() => {
  while (temporaryRoots.length > 0) {
    rmSync(temporaryRoots.pop(), { recursive: true, force: true });
  }
});

test("les CLI documentent l'aide avec un code de succes", () => {
  for (const tool of [
    "gen_manifest.mjs",
    "validate_content.mjs",
    "package_content.mjs",
    "publish_release.mjs",
    "compile_runtime.mjs",
    "check_catalog_freshness.mjs",
    "check_artifact_access.mjs",
    "check_backend_contract.mjs",
  ]) {
    const result = execute(tool, ["--help"]);
    assert.equal(result.status, 0, `${tool}: ${result.stderr}`);
    assert.match(result.stdout, /Usage:/);
  }
});

test("les CLI refusent arguments inconnus et valeurs manquantes", () => {
  for (const [tool, args] of [
    ["gen_manifest.mjs", ["--unknown"]],
    ["validate_content.mjs", ["--root"]],
    ["package_content.mjs", ["--channel"]],
    ["publish_release.mjs", ["--destination"]],
    ["compile_runtime.mjs", ["--out"]],
    ["check_catalog_freshness.mjs", ["--as-of"]],
    ["check_artifact_access.mjs", ["--policy"]],
    ["check_backend_contract.mjs", ["--dist"]],
    ["check_backend_contract.mjs", ["--unknown"]],
  ]) {
    const result = execute(tool, args);
    assert.equal(result.status, 1, `${tool}: ${result.stdout}`);
    assert.match(result.stderr, /argument inconnu|valeur manquante/);
  }
});

test("la CLI de fraicheur expose les transitions sans acces reseau", () => {
  // Date derivee du snapshot du catalogue : une constante anterieure a
  // catalog.asOf declencherait "date de controle anterieure au snapshot" et
  // ferait echouer ce test a chaque avance de snapshot.
  const catalogAsOf = JSON.parse(
    readFileSync(
      resolve(repoRoot, "content", "public", "catalog", "certifications.json"),
      "utf8"
    )
  ).asOf;
  const current = execute("check_catalog_freshness.mjs", ["--as-of", catalogAsOf]);
  assert.equal(current.status, 0, current.stderr);
  assert.match(current.stdout, /actifs=31/);

  const transitioned = execute("check_catalog_freshness.mjs", [
    "--as-of",
    "2027-01-01",
  ]);
  assert.equal(transitioned.status, 1);
  assert.match(transitioned.stdout, /exclus automatiquement: aws:ans-c01/);
  assert.match(transitioned.stderr, /transition a reverifier/);
});

test("la CLI de policy retourne un echec exploitable en CI", () => {
  const root = mkdtempSync(join(tmpdir(), "certigo-cli-policy-"));
  temporaryRoots.push(root);
  mkdirSync(resolve(root, ".github", "workflows"), { recursive: true });
  writeFileSync(
    resolve(root, ".github", "workflows", "consumer.yml"),
    "jobs:\n  build:\n    steps:\n      - uses: actions/download-artifact@v4\n"
  );
  writeFileSync(
    resolve(root, ".github", "artifact-access-policy.json"),
    JSON.stringify({
      schema: "certigo.artifact-access-policy/v1",
      privateArtifactDownloads: [],
      privateReferenceScopes: [],
    })
  );

  const result = execute("check_artifact_access.mjs", ["--root", root]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /\[artifact-access\] ECHEC/);
});
