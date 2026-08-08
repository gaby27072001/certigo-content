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
  writeFileSync(resolve(root, ".github", "workflows", "consumer.yml"), content);
  writeFileSync(
    resolve(root, ".github", "artifact-access-policy.json"),
    `${JSON.stringify({
      schema: "certigo.artifact-access-policy/v1",
      privateArtifactDownloads: [],
      privateReferenceScopes: [],
    }, null, 2)}\n`
  );
  return root;
}

function allowPrivate(root, entries) {
  writeFileSync(
    resolve(root, ".github", "artifact-access-policy.json"),
    `${JSON.stringify({
      schema: "certigo.artifact-access-policy/v1",
      privateArtifactDownloads: entries,
      privateReferenceScopes: [],
    }, null, 2)}\n`
  );
}

afterEach(() => {
  while (temporaryRoots.length > 0) {
    rmSync(temporaryRoots.pop(), { recursive: true, force: true });
  }
});

test("autorise un telechargement public nomme dans tout job", async () => {
  const root = createWorkflow(`
jobs:
  desktop-build:
    name: Desktop build
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: certigo-content-public-sha256-abc
`);
  assert.deepEqual(await findArtifactAccessViolations({ root }), []);
});

test("rejette globalement un telechargement sans nom", async () => {
  const root = createWorkflow(`
jobs:
  release:
    steps:
      - uses: actions/download-artifact@v4
`);
  const violations = await findArtifactAccessViolations({ root });
  assert.ok(violations.some((violation) => violation.includes("sans allow-list")));
});

test("rejette un nom dynamique qui pourrait resoudre vers le prive", async () => {
  const root = createWorkflow(`
jobs:
  release:
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: \${{ inputs.artifact-name }}
`);
  const violations = await findArtifactAccessViolations({ root });
  assert.ok(
    violations.some((violation) => violation.includes("dynamique non verifiable"))
  );
});

test("rejette le prive hors allow-list et exige une correspondance exacte", async () => {
  const artifactName = "certigo-content-private-sha256-abc";
  const root = createWorkflow(`
jobs:
  release:
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: ${artifactName}
`);

  let violations = await findArtifactAccessViolations({ root });
  assert.ok(violations.some((violation) => violation.includes("hors allow-list")));

  allowPrivate(root, [
    {
      workflow: ".github/workflows/consumer.yml",
      job: "other-job",
      name: artifactName,
    },
  ]);
  violations = await findArtifactAccessViolations({ root });
  assert.ok(violations.some((violation) => violation.includes("hors allow-list")));

  allowPrivate(root, [
    {
      workflow: ".github/workflows/consumer.yml",
      job: "release",
      name: artifactName,
    },
  ]);
  assert.deepEqual(await findArtifactAccessViolations({ root }), []);
});

test("rejette une politique privee non explicite ou mal formee", async () => {
  const root = createWorkflow("jobs: {}\n");
  allowPrivate(root, [
    {
      workflow: ".github/workflows/consumer.yml",
      job: "release",
      name: "certigo-content-public-sha256-abc",
    },
  ]);

  await assert.rejects(
    () => findArtifactAccessViolations({ root }),
    /politique invalide/
  );
});

test("inspecte aussi les actions composites locales", async () => {
  const root = createWorkflow("jobs: {}\n");
  const actionRoot = resolve(root, ".github", "actions", "download");
  mkdirSync(actionRoot, { recursive: true });
  writeFileSync(
    resolve(actionRoot, "action.yml"),
    `
name: Download
runs:
  using: composite
  steps:
    - uses: actions/download-artifact@v4
`
  );

  const violations = await findArtifactAccessViolations({ root });
  assert.ok(
    violations.some(
      (violation) =>
        violation.includes(".github/actions/download/action.yml:runs") &&
        violation.includes("sans allow-list")
    )
  );
});

test("rejette les bypass prives via gh, curl et action tierce", async () => {
  const bypasses = [
    {
      name: "gh",
      step: "      - run: gh run download -n certigo-content-private-sha256-abc",
    },
    {
      name: "curl",
      step:
        "      - run: curl https://api.github.test/repos/o/r/actions/artifacts/certigo-content-private-sha256-abc",
    },
    {
      name: "action-tierce",
      step: `      - uses: vendor/download-release@0123456789012345678901234567890123456789
        with:
          artifact: certigo-content-private-sha256-abc`,
    },
  ];

  for (const bypass of bypasses) {
    const root = createWorkflow(`
jobs:
  release:
    steps:
${bypass.step}
`);
    const violations = await findArtifactAccessViolations({ root });
    assert.ok(
      violations.some(
        (violation) =>
          violation.includes("reference privee hors mecanisme autorise") &&
          violation.includes("$.steps[0]")
      ),
      `${bypass.name} doit etre refuse`
    );
  }
});
