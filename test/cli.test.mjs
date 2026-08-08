import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
    "check_artifact_access.mjs",
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
    ["check_artifact_access.mjs", ["--policy"]],
  ]) {
    const result = execute(tool, args);
    assert.equal(result.status, 1, `${tool}: ${result.stdout}`);
    assert.match(result.stderr, /argument inconnu|valeur manquante/);
  }
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
    })
  );

  const result = execute("check_artifact_access.mjs", ["--root", root]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /\[artifact-access\] ECHEC/);
});
