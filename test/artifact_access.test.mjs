import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, test } from "node:test";
import { findArtifactAccessViolations } from "../tools/check_artifact_access.mjs";

const temporaryRoots = [];

function createWorkflow(content) {
  const root = mkdtempSync(join(tmpdir(), "certigo-workflow-policy-"));
  temporaryRoots.push(root);
  mkdirSync(resolve(root, ".github", "workflows"), { recursive: true });
  writeFileSync(resolve(root, ".github", "workflows", "mobile.yml"), content);
  return root;
}

afterEach(() => {
  while (temporaryRoots.length > 0) {
    rmSync(temporaryRoots.pop(), { recursive: true, force: true });
  }
});

test("autorise un job mobile qui allow-list uniquement l'artefact public", async () => {
  const root = createWorkflow(`
jobs:
  mobile-build:
    name: Mobile build
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: certigo-content-public-sha256-abc
`);
  assert.deepEqual(await findArtifactAccessViolations({ root }), []);
});

test("rejette un job mobile sans allow-list ou referencant le prive", async () => {
  const root = createWorkflow(`
jobs:
  mobile:
    steps:
      - uses: actions/download-artifact@v4
      - run: cp dist/private/manifest.json app/
`);
  const violations = await findArtifactAccessViolations({ root });
  assert.ok(violations.some((violation) => violation.includes("artefact prive")));
  assert.ok(violations.some((violation) => violation.includes("sans allow-list")));
});
