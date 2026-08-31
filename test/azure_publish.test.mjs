import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workflowPath = resolve(repoRoot, ".github", "workflows", "publish-content-azure.yml");
const scriptPath = resolve(repoRoot, "tools", "publish_blob_artifact.sh");

function loadWorkflow() {
  return parse(readFileSync(workflowPath, "utf8"));
}

test("la publication est manuelle, main-only et fail-closed", () => {
  const workflow = loadWorkflow();
  assert.deepEqual(Object.keys(workflow.on), ["workflow_dispatch"]);
  assert.match(workflow.jobs.plan.if, /refs\/heads\/main/);
  assert.equal(workflow.concurrency["cancel-in-progress"], false);
  assert.deepEqual(workflow.permissions, {});
  const topology = workflow.jobs.plan.steps.find(
    (step) => step.name === "Validate publication feature and topology"
  );
  assert.match(topology.run, /CONTENT_PUBLISH_ENABLED.*=.*"true"/s);
  assert.match(topology.run, /RELEASE_STORAGE_TARGET.*PUBLIC_STORAGE_TARGET.*PRIVATE_STORAGE_TARGET/s);
  assert.match(topology.run, /RELEASE_CLIENT_ID.*PUBLIC_CLIENT_ID.*PRIVATE_CLIENT_ID/s);
  assert.match(topology.run, /sort -u \| wc -l/);
});

test("separe trois UAMI OIDC et publie le descripteur en dernier", () => {
  const workflow = loadWorkflow();
  const jobs = [
    workflow.jobs["publish-public"],
    workflow.jobs["publish-answer-key"],
    workflow.jobs["publish-release"],
  ];
  assert.deepEqual(jobs.map((job) => job.environment), [
    "azure-content-public",
    "azure-content-answer-key",
    "azure-content-release",
  ]);
  assert.deepEqual(workflow.jobs["publish-release"].needs, [
    "plan",
    "publish-public",
    "publish-answer-key",
  ]);
  for (const job of jobs) {
    assert.deepEqual(job.permissions, { contents: "read", "id-token": "write" });
    const login = job.steps.find((step) => step.uses?.startsWith("azure/login@"));
    const cli = job.steps.find((step) => step.uses?.startsWith("azure/cli@"));
    assert.match(login.uses, /^azure\/login@[0-9a-f]{40}$/);
    assert.equal(login.with.creds, undefined);
    assert.equal(login.with.audience, "api://AzureADTokenExchange");
    assert.match(cli.uses, /^azure\/cli@[0-9a-f]{40}$/);
    assert.equal(cli.with.azcliversion, "2.89.1");
  }
  const text = readFileSync(workflowPath, "utf8");
  assert.match(text, /manifests\/\$\{MANIFEST_ID\}/);
  assert.match(text, /releases\/\$\{RELEASE_ID\}/);
  assert.doesNotMatch(text, /upload-artifact/);
});

test("interdit les secrets statiques, alias mutables, delete et overwrite", () => {
  const contract = `${readFileSync(workflowPath, "utf8")}\n${readFileSync(scriptPath, "utf8")}`;
  assert.doesNotMatch(contract, /(?:account[-_ ]?key|connection[-_ ]?string)/i);
  assert.doesNotMatch(contract, /(?:^|\/)latest(?:\/|$)/im);
  assert.match(contract, /--auth-mode login/);
  assert.match(contract, /--overwrite false/);
  assert.match(contract, /sha256sum/);
  assert.match(contract, /versionId/);
  assert.match(contract, /immutabilityPolicy\.expiryTime/);
  assert.match(contract, /hasLegalHold/);
  assert.doesNotMatch(contract, /az storage blob delete/);
});

test("le script est valide et refuse les appels incomplets ou les anciens prefixes", () => {
  const syntax = spawnSync("bash", ["-n", scriptPath], { encoding: "utf8" });
  assert.equal(syntax.status, 0, syntax.stderr);
  const incomplete = spawnSync("bash", [scriptPath], { encoding: "utf8" });
  assert.equal(incomplete.status, 64);
  assert.match(incomplete.stderr, /Usage:/);
});

test("publie et verifie un manifeste versionne avec Azure CLI simule", (context) => {
  if (process.platform === "win32") {
    context.skip("test d'integration Bash execute sur les runners Linux");
    return;
  }

  const root = mkdtempSync(resolve(tmpdir(), "certigo-azure-publish-"));
  try {
    const source = resolve(root, "source");
    const state = resolve(root, "state");
    const bin = resolve(root, "bin");
    const hash = "a".repeat(64);
    const manifestId = `sha256:${hash}`;
    mkdirSync(resolve(source, "questions"), { recursive: true });
    mkdirSync(bin);
    writeFileSync(
      resolve(source, "manifest.json"),
      `${JSON.stringify({ manifestId, rootHash: hash }, null, 2)}\n`
    );
    writeFileSync(resolve(source, "questions", "sample.json"), '{"id":"sample"}\n');

    const fakeAz = resolve(bin, "az");
    writeFileSync(
      fakeAz,
      `#!/usr/bin/env bash
set -euo pipefail
command="$1 $2 $3"
shift 3
name=""
file=""
prefix=""
while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --name|--container-name) name="$2"; shift 2 ;;
    --file) file="$2"; shift 2 ;;
    --prefix) prefix="$2"; shift 2 ;;
    *) shift ;;
  esac
done
case "\${command}" in
  "storage container show") printf 'None\\n' ;;
  "storage container immutability-policy") printf 'Unlocked\\t30\\tfalse\\tfalse\\n' ;;
  "storage blob exists")
    [[ -f "\${MOCK_STATE}/\${name}" ]] && printf 'true\\n' || printf 'false\\n'
    ;;
  "storage blob upload")
    mkdir -p "\$(dirname "\${MOCK_STATE}/\${name}")"
    cp "\${file}" "\${MOCK_STATE}/\${name}"
    ;;
  "storage blob download")
    mkdir -p "\$(dirname "\${file}")"
    cp "\${MOCK_STATE}/\${name}" "\${file}"
    ;;
  "storage blob show") printf 'application/json\\t%s\\tversion-1\\t2099-01-01T00:00:00Z\\tfalse\\n' "\${MOCK_CACHE}" ;;
  "storage blob list")
    (cd "\${MOCK_STATE}" && find "\${prefix}" -type f -print | sort)
    ;;
  *) echo "commande inattendue: \${command}" >&2; exit 90 ;;
esac
`
    );
    chmodSync(fakeAz, 0o755);

    const result = spawnSync(
      "bash",
      [
        scriptPath,
        source,
        "rg-content",
        "storageaccount",
        "public-content",
        `manifests/${manifestId}`,
        "public,max-age=31536000,immutable",
        "manifestId",
      ],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${bin}:${process.env.PATH}`,
          MOCK_STATE: state,
          MOCK_CACHE: "public,max-age=31536000,immutable",
        },
      }
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /2 blob\(s\) verifies/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
