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
const workflowPath = resolve(
  repoRoot,
  ".github",
  "workflows",
  "publish-content-azure.yml"
);
const scriptPath = resolve(repoRoot, "tools", "publish_blob_artifact.sh");

function loadWorkflow() {
  return parse(readFileSync(workflowPath, "utf8"));
}

test("la promotion Azure est exclusivement manuelle depuis main", () => {
  const workflow = loadWorkflow();
  assert.deepEqual(Object.keys(workflow.on), ["workflow_dispatch"]);
  assert.match(workflow.jobs.plan.if, /refs\/heads\/main/);
  assert.equal(workflow.concurrency["cancel-in-progress"], false);
  assert.deepEqual(workflow.permissions, {});
  const topology = workflow.jobs.plan.steps.find(
    (step) => step.name === "Validate promotion topology"
  );
  assert.match(topology.run, /PUBLIC_STORAGE_TARGET.*ANSWER_KEY_STORAGE_TARGET/s);
  assert.match(topology.run, /PUBLIC_CLIENT_ID.*ANSWER_KEY_CLIENT_ID/s);
  assert.match(topology.run, /PUBLIC_CLIENT_ID=",?\$\{PUBLIC_CLIENT_ID,,\}"/);
  assert.match(
    workflow.jobs["publish-public"].steps.find(
      (step) => step.name === "Validate public environment variables"
    ).env.EXPECTED_STORAGE_TARGET,
    /needs\.plan\.outputs\.public_storage_target/
  );
  assert.match(
    workflow.jobs["publish-answer-key"].steps.find(
      (step) => step.name === "Validate answer key environment variables"
    ).env.EXPECTED_STORAGE_TARGET,
    /needs\.plan\.outputs\.answer_key_storage_target/
  );
});

test("separe les canaux dans deux environnements OIDC proteges", () => {
  const workflow = loadWorkflow();
  const publicJob = workflow.jobs["publish-public"];
  const answerKeyJob = workflow.jobs["publish-answer-key"];

  assert.equal(publicJob.environment, "azure-content-public");
  assert.equal(answerKeyJob.environment, "azure-content-answer-key");
  for (const job of [publicJob, answerKeyJob]) {
    assert.deepEqual(job.permissions, { contents: "read", "id-token": "write" });
    const login = job.steps.find((step) => step.uses?.startsWith("azure/login@"));
    const cli = job.steps.find((step) => step.uses?.startsWith("azure/cli@"));
    assert.match(login.uses, /^azure\/login@[0-9a-f]{40}$/);
    assert.match(cli.uses, /^azure\/cli@[0-9a-f]{40}$/);
    assert.equal(login.with.creds, undefined);
    assert.equal(login.with.audience, "api://AzureADTokenExchange");
    assert.equal(cli.with.azcliversion, "2.89.1");
  }
});

test("interdit les cles, les alias mutables et les ecrasements", () => {
  const workflowText = readFileSync(workflowPath, "utf8");
  const scriptText = readFileSync(scriptPath, "utf8");
  const publicationContract = `${workflowText}\n${scriptText}`;

  assert.doesNotMatch(publicationContract, /(?:account[-_ ]?key|connection[-_ ]?string)/i);
  assert.doesNotMatch(publicationContract, /(?:^|\/)latest(?:\/|$)/im);
  assert.match(scriptText, /--auth-mode login/);
  assert.match(scriptText, /--overwrite false/);
  assert.match(scriptText, /sha256sum/);
  assert.match(scriptText, /remote_prefix.*manifest_root_hash/s);
  assert.match(scriptText, /az storage blob download/);
  assert.match(scriptText, /az storage blob list/);
  assert.match(scriptText, /immutability-policy show/);
  assert.match(scriptText, /policy_state.*Locked/s);
  assert.doesNotMatch(scriptText, /az storage blob delete/);
});

test("le script de publication est syntaxiquement valide et refuse un appel incomplet", () => {
  const syntax = spawnSync("bash", ["-n", scriptPath], { encoding: "utf8" });
  assert.equal(syntax.status, 0, syntax.stderr);

  const incomplete = spawnSync("bash", [scriptPath], { encoding: "utf8" });
  assert.equal(incomplete.status, 64);
  assert.match(incomplete.stderr, /Usage:/);
});

test("publie et verifie un prefixe WORM avec Azure CLI simule", (context) => {
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
    mkdirSync(resolve(source, "questions"), { recursive: true });
    mkdirSync(bin);
    writeFileSync(
      resolve(source, "manifest.json"),
      `${JSON.stringify({ manifestId: `sha256:${hash}`, rootHash: hash }, null, 2)}\n`
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
while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --name|--container-name) name="$2"; shift 2 ;;
    --file) file="$2"; shift 2 ;;
    *) shift ;;
  esac
done
case "\${command}" in
  "storage container show") printf 'None\\n' ;;
  "storage container immutability-policy") printf 'Locked\\t30\\tfalse\\tfalse\\n' ;;
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
  "storage blob show") printf 'application/json\\t%s\\n' "\${MOCK_CACHE}" ;;
  "storage blob list")
    (cd "\${MOCK_STATE}" && find releases -type f -print | sort)
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
        `releases/sha256/${hash}`,
        "public,max-age=31536000,immutable",
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
