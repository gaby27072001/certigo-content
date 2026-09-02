import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workflowRoot = resolve(repoRoot, ".github", "workflows");
const prRunner = ["self-hosted", "Linux", "X64", "certigo-pr-ci"];
const publisherRunner = ["self-hosted", "Linux", "X64", "certigo-publisher"];
const prGuard =
  "${{ github.event_name != 'pull_request_target' || github.event.pull_request.head.repo.full_name == github.repository }}";
const prCheckoutRef =
  "${{ github.event_name == 'pull_request_target' && github.event.pull_request.head.sha || github.sha }}";
const publishGuard =
  "${{ github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && vars.CONTENT_PUBLISH_ENABLED == 'true' && vars.CONTENT_PUBLISHER_ATTESTED == 'true' }}";

const contracts = {
  "ci-content-package.yml": {
    trust: "pr",
    jobs: {
      "package-gates": [],
      "package-public": ["package-gates"],
      "package-private": ["package-gates"],
    },
  },
  "ci-tooling.yml": {
    trust: "pr",
    jobs: {
      "test-and-supply-chain": [],
    },
  },
  "publish-content-azure.yml": {
    trust: "publisher",
    jobs: {
      plan: [],
      "publish-public": ["plan"],
      "publish-answer-key": ["plan"],
      "publish-release": ["plan", "publish-public", "publish-answer-key"],
    },
  },
};

const publisherEnvironments = {
  plan: "content-publish-plan",
  "publish-public": "azure-content-public",
  "publish-answer-key": "azure-content-answer-key",
  "publish-release": "azure-content-release",
};

function sameArray(left, right) {
  return (
    Array.isArray(left) &&
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function sameObject(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function normalizeNeeds(value) {
  if (value === undefined) return [];
  if (typeof value === "string") return [value];
  return Array.isArray(value) ? value : null;
}

function workflowFiles() {
  return readdirSync(workflowRoot)
    .filter((name) => /\.ya?ml$/i.test(name))
    .sort();
}

function loadWorkflows() {
  return Object.fromEntries(
    workflowFiles().map((name) => [
      name,
      parse(readFileSync(resolve(workflowRoot, name), "utf8")),
    ])
  );
}

function cloneWithMutation(workflows, workflowName, mutate) {
  const clone = structuredClone(workflows);
  mutate(clone[workflowName]);
  return clone;
}

function checkoutSteps(job) {
  return (job.steps ?? []).filter((step) =>
    /^actions\/checkout@/i.test(step.uses ?? "")
  );
}

function validateCheckout(job, expectedRef, location, violations) {
  const checkouts = checkoutSteps(job);
  if (checkouts.length !== 1) {
    violations.push(`${location}: checkout unique requis`);
    return;
  }
  const checkout = checkouts[0];
  if (checkout.with?.["persist-credentials"] !== false) {
    violations.push(`${location}: persist-credentials doit valoir false`);
  }
  if (expectedRef !== undefined) {
    if (checkout.with?.ref !== expectedRef) {
      violations.push(`${location}: ref checkout non scellee`);
    }
    if (checkout.with?.["fetch-depth"] !== 1) {
      violations.push(`${location}: fetch-depth doit valoir 1`);
    }
  }
}

function validateCiWorkflow(name, workflow, contract, violations) {
  const location = `.github/workflows/${name}`;
  if (
    !sameArray(Object.keys(workflow.on ?? {}).sort(), [
      "pull_request_target",
      "push",
      "workflow_dispatch",
    ])
  ) {
    violations.push(`${location}: triggers CI inattendus`);
  }
  if (
    !sameObject(workflow.on?.push, { branches: ["main"] }) ||
    !sameObject(workflow.on?.pull_request_target, {})
  ) {
    violations.push(`${location}: couverture push main/pull_request_target invalide`);
  }
  if (!sameObject(workflow.permissions, { contents: "read" })) {
    violations.push(`${location}: permissions CI non minimales`);
  }
  if (workflow.env !== undefined) {
    violations.push(`${location}: env racine interdit en CI PR`);
  }

  for (const [jobName, expectedNeeds] of Object.entries(contract.jobs)) {
    const job = workflow.jobs?.[jobName];
    const jobLocation = `${location}:${jobName}`;
    if (job === undefined) continue;
    if (!sameArray(job["runs-on"], prRunner)) {
      violations.push(`${jobLocation}: runs-on PR statique requis`);
    }
    if (job.if !== prGuard) {
      violations.push(`${jobLocation}: garde fork same-repository requise`);
    }
    if (!sameArray(normalizeNeeds(job.needs), expectedNeeds)) {
      violations.push(`${jobLocation}: graphe needs CI invalide`);
    }
    if (job.environment !== undefined) {
      violations.push(`${jobLocation}: environment interdit en CI PR`);
    }
    if (job.permissions !== undefined) {
      violations.push(`${jobLocation}: permissions job interdites en CI PR`);
    }
    const jobText = JSON.stringify(job);
    for (const [pattern, message] of [
      [/\bid-token\b/i, "id-token interdit en CI PR"],
      [/\$\{\{\s*secrets(?:\.|\[)/i, "secret interdit en CI PR"],
      [/azure\/(?:login|cli)@/i, "action Azure interdite en CI PR"],
      [
        /\b(?:AZURE_[A-Z0-9_]+|CONTENT_PUBLISH[A-Z0-9_]*)\b/,
        "variable publisher interdite en CI PR",
      ],
      [
        /content-publish-plan|azure-content-(?:public|answer-key|release)/i,
        "environment publisher interdit en CI PR",
      ],
      [/\bcertigo-publisher\b/i, "label publisher interdit en CI PR"],
    ]) {
      if (pattern.test(jobText)) {
        violations.push(`${jobLocation}: ${message}`);
      }
    }
    validateCheckout(job, prCheckoutRef, jobLocation, violations);
  }
}

function validatePublisherWorkflow(name, workflow, contract, violations) {
  const location = `.github/workflows/${name}`;
  if (
    !sameArray(Object.keys(workflow.on ?? {}), ["workflow_dispatch"]) ||
    !sameObject(workflow.on?.workflow_dispatch?.inputs, {})
  ) {
    violations.push(`${location}: trigger workflow_dispatch exclusif requis`);
  }
  if (!sameObject(workflow.permissions, {})) {
    violations.push(`${location}: permissions racine publisher doivent etre vides`);
  }
  if (workflow.env !== undefined) {
    violations.push(`${location}: env racine publisher interdit`);
  }
  if (workflow.concurrency?.["cancel-in-progress"] !== false) {
    violations.push(`${location}: annulation publisher interdite`);
  }

  for (const [jobName, expectedNeeds] of Object.entries(contract.jobs)) {
    const job = workflow.jobs?.[jobName];
    const jobLocation = `${location}:${jobName}`;
    if (job === undefined) continue;
    if (!sameArray(job["runs-on"], publisherRunner)) {
      violations.push(`${jobLocation}: runs-on publisher statique requis`);
    }
    if (job.if !== publishGuard || /\balways\s*\(/i.test(job.if)) {
      violations.push(`${jobLocation}: garde main/activation/attestation requise`);
    }
    if (!sameArray(normalizeNeeds(job.needs), expectedNeeds)) {
      violations.push(`${jobLocation}: graphe needs publisher invalide`);
    }
    if (job.environment !== publisherEnvironments[jobName]) {
      violations.push(`${jobLocation}: environment publisher exact requis`);
    }
    const expectedPermissions =
      jobName === "plan"
        ? { contents: "read" }
        : { contents: "read", "id-token": "write" };
    if (!sameObject(job.permissions, expectedPermissions)) {
      violations.push(`${jobLocation}: permissions publisher invalides`);
    }
    const expectedRef =
      jobName === "plan"
        ? "${{ github.sha }}"
        : "${{ needs.plan.outputs.approved_sha }}";
    validateCheckout(job, expectedRef, jobLocation, violations);

    const jobText = JSON.stringify(job);
    if (/actions\/download-artifact@/i.test(jobText)) {
      violations.push(`${jobLocation}: download-artifact interdit au publisher`);
    }
    if (/\$\{\{\s*secrets(?:\.|\[)/i.test(jobText)) {
      violations.push(`${jobLocation}: secret statique interdit au publisher`);
    }
    if (jobName === "plan" && /\bid-token\b|azure\/(?:login|cli)@/i.test(jobText)) {
      violations.push(`${jobLocation}: identite Azure interdite au plan`);
    }
  }

  if (
    workflow.jobs?.plan?.outputs?.approved_sha !==
    "${{ steps.source.outputs.approved_sha }}"
  ) {
    violations.push(`${location}: output approved_sha scelle requis`);
  }
  const sourceSeal = workflow.jobs?.plan?.steps?.find(
    (step) => step.id === "source"
  );
  if (
    sourceSeal?.env?.EXPECTED_SHA !== "${{ github.sha }}" ||
    !/git rev-parse HEAD/.test(sourceSeal?.run ?? "") ||
    !/approved_sha=/.test(sourceSeal?.run ?? "")
  ) {
    violations.push(`${location}: scellement du SHA source invalide`);
  }
  for (const jobName of [
    "publish-public",
    "publish-answer-key",
    "publish-release",
  ]) {
    const job = workflow.jobs?.[jobName];
    const verification = job?.steps?.find(
      (step) => step.name === "Verify sealed source commit"
    );
    if (
      verification?.env?.EXPECTED_SHA !==
        "${{ needs.plan.outputs.approved_sha }}" ||
      !/git rev-parse HEAD/.test(verification?.run ?? "")
    ) {
      violations.push(
        `${location}:${jobName}: verification du SHA scelle requise`
      );
    }
    const rebuild = job?.steps?.find(
      (step) =>
        step.name === "Rebuild and verify release" ||
        step.name === "Rebuild and verify complete release"
    );
    const rebuildText = JSON.stringify(rebuild ?? {});
    const requiredByJob = {
      "publish-public": [
        "${{ needs.plan.outputs.public_manifest_id }}",
        "dist/public/manifest.json",
      ],
      "publish-answer-key": [
        "${{ needs.plan.outputs.private_manifest_id }}",
        "dist/private/manifest.json",
      ],
      "publish-release": [
        "${{ needs.plan.outputs.release_id }}",
        "${{ needs.plan.outputs.public_manifest_id }}",
        "${{ needs.plan.outputs.private_manifest_id }}",
        "dist/release.json",
      ],
    };
    for (const required of requiredByJob[jobName]) {
      if (!rebuildText.includes(required)) {
        violations.push(
          `${location}:${jobName}: identite de contenu non scellee (${required})`
        );
      }
    }
  }

  const topology = workflow.jobs?.plan?.steps?.find(
    (step) => step.name === "Validate publication feature and topology"
  );
  if (
    topology?.env?.CONTENT_PUBLISH_ENABLED !==
      "${{ vars.CONTENT_PUBLISH_ENABLED }}" ||
    topology?.env?.CONTENT_PUBLISHER_ATTESTED !==
      "${{ vars.CONTENT_PUBLISHER_ATTESTED }}" ||
    !/CONTENT_PUBLISH_ENABLED.*true/s.test(topology?.run ?? "") ||
    !/CONTENT_PUBLISHER_ATTESTED.*true/s.test(topology?.run ?? "")
  ) {
    violations.push(`${location}: double gate fail-closed manquante`);
  }
}

function findTrustViolations(workflows) {
  const violations = [];
  const expectedNames = Object.keys(contracts).sort();
  const actualNames = Object.keys(workflows).sort();
  if (!sameArray(actualNames, expectedNames)) {
    violations.push(
      `.github/workflows: workflows non classes (${actualNames.join(", ")})`
    );
  }

  for (const [name, contract] of Object.entries(contracts)) {
    const workflow = workflows[name];
    if (workflow === undefined) {
      violations.push(`.github/workflows/${name}: workflow requis absent`);
      continue;
    }
    const expectedJobs = Object.keys(contract.jobs).sort();
    const actualJobs = Object.keys(workflow.jobs ?? {}).sort();
    if (!sameArray(actualJobs, expectedJobs)) {
      violations.push(
        `.github/workflows/${name}: jobs non classes (${actualJobs.join(", ")})`
      );
    }
    for (const [jobName, job] of Object.entries(workflow.jobs ?? {})) {
      if (job?.uses !== undefined) {
        violations.push(
          `.github/workflows/${name}:${jobName}: reusable workflow interdit`
        );
      }
    }
    if (contract.trust === "pr") {
      validateCiWorkflow(name, workflow, contract, violations);
    } else {
      validatePublisherWorkflow(name, workflow, contract, violations);
    }
  }
  return violations;
}

function assertRejected(workflows, expected, label = "fixture") {
  const violations = findTrustViolations(workflows);
  assert.ok(
    violations.some((violation) => violation.includes(expected)),
    `${label}: violation attendue "${expected}", obtenu:\n${violations.join("\n")}`
  );
}

test("tous les workflows respectent les deux pools statiques exclusifs", () => {
  const workflows = loadWorkflows();
  assert.notEqual(prRunner.at(-1), publisherRunner.at(-1));
  assert.deepEqual(findTrustViolations(workflows), []);

  for (const name of workflowFiles()) {
    const source = readFileSync(resolve(workflowRoot, name), "utf8");
    assert.doesNotMatch(source, /PR_RUNNER_LABELS|fromJSON\s*\(|\bcertigo-ci\b/);
  }
});

test("rejette les selecteurs dynamiques, croises et les reusable workflows", () => {
  const workflows = loadWorkflows();
  const cases = [
    {
      name: "fallback dynamique",
      workflow: "ci-tooling.yml",
      mutate(document) {
        document.jobs["test-and-supply-chain"]["runs-on"] =
          "${{ vars.PR_RUNNER_LABELS && fromJSON(vars.PR_RUNNER_LABELS) || fromJSON('[\"self-hosted\",\"certigo-ci\"]') }}";
      },
      expected: "runs-on PR statique requis",
    },
    {
      name: "CI sur publisher",
      workflow: "ci-content-package.yml",
      mutate(document) {
        document.jobs["package-gates"]["runs-on"] = publisherRunner;
      },
      expected: "runs-on PR statique requis",
    },
    {
      name: "publisher sur CI PR",
      workflow: "publish-content-azure.yml",
      mutate(document) {
        document.jobs.plan["runs-on"] = prRunner;
      },
      expected: "runs-on publisher statique requis",
    },
    {
      name: "reusable sans pool classe",
      workflow: "ci-tooling.yml",
      mutate(document) {
        document.jobs.bypass = {
          uses: "attacker/example/.github/workflows/ci.yml@main",
        };
      },
      expected: "reusable workflow interdit",
    },
  ];

  for (const fixture of cases) {
    assertRejected(
      cloneWithMutation(
        workflows,
        fixture.workflow,
        fixture.mutate
      ),
      fixture.expected,
      fixture.name
    );
  }
});

test("rejette tout privilege publisher dans la CI de pull request", () => {
  const workflows = loadWorkflows();
  const cases = [
    {
      mutate(document) {
        document.jobs["package-gates"].permissions = {
          contents: "read",
          "id-token": "write",
        };
      },
      expected: "permissions job interdites en CI PR",
    },
    {
      mutate(document) {
        document.jobs["package-gates"].environment = "azure-content-public";
      },
      expected: "environment interdit en CI PR",
    },
    {
      mutate(document) {
        document.jobs["package-gates"].steps.push({
          run: "echo '${{ secrets.AZURE_CLIENT_SECRET }}'",
        });
      },
      expected: "secret interdit en CI PR",
    },
    {
      mutate(document) {
        document.jobs["package-gates"].steps.push({
          uses: "azure/login@7184910d9eb2b1c5e48f7073824a90609bb9b6d6",
        });
      },
      expected: "action Azure interdite en CI PR",
    },
    {
      mutate(document) {
        document.jobs["package-gates"].steps.push({
          env: {
            AZURE_CLIENT_ID: "${{ vars.AZURE_CLIENT_ID }}",
          },
          run: "test -n \"${AZURE_CLIENT_ID}\"",
        });
      },
      expected: "variable publisher interdite en CI PR",
    },
  ];

  for (const fixture of cases) {
    assertRejected(
      cloneWithMutation(
        workflows,
        "ci-content-package.yml",
        fixture.mutate
      ),
      fixture.expected
    );
  }
});

test("rejette les triggers non approuves et la suppression du garde fork", () => {
  const workflows = loadWorkflows();
  assertRejected(
    cloneWithMutation(workflows, "ci-tooling.yml", (document) => {
      document.jobs["test-and-supply-chain"].if = "${{ true }}";
    }),
    "garde fork same-repository requise"
  );
  assertRejected(
    cloneWithMutation(workflows, "ci-tooling.yml", (document) => {
      document.on.pull_request = {};
      delete document.on.pull_request_target;
    }),
    "triggers CI inattendus"
  );
  assertRejected(
    cloneWithMutation(workflows, "publish-content-azure.yml", (document) => {
      document.on.pull_request_target = {};
    }),
    "trigger workflow_dispatch exclusif requis"
  );
  assertRejected(
    cloneWithMutation(workflows, "publish-content-azure.yml", (document) => {
      document.jobs["publish-public"].if =
        "${{ always() && github.ref == 'refs/heads/main' }}";
    }),
    "garde main/activation/attestation requise"
  );
});

test("rejette les environments ou le graphe needs affaiblis", () => {
  const workflows = loadWorkflows();
  assertRejected(
    cloneWithMutation(workflows, "publish-content-azure.yml", (document) => {
      delete document.jobs.plan.environment;
    }),
    "environment publisher exact requis"
  );
  assertRejected(
    cloneWithMutation(workflows, "publish-content-azure.yml", (document) => {
      document.jobs["publish-release"].needs = ["plan", "publish-public"];
    }),
    "graphe needs publisher invalide"
  );
  assertRejected(
    cloneWithMutation(workflows, "publish-content-azure.yml", (document) => {
      document.jobs["publish-public"].permissions = { contents: "read" };
    }),
    "permissions publisher invalides"
  );
  assertRejected(
    cloneWithMutation(workflows, "publish-content-azure.yml", (document) => {
      document.env = {
        AZURE_CLIENT_SECRET: "${{ secrets.AZURE_CLIENT_SECRET }}",
      };
    }),
    "env racine publisher interdit"
  );
});

test("rejette un checkout PR ou un contenu non scelle dans le publisher", () => {
  const workflows = loadWorkflows();
  assertRejected(
    cloneWithMutation(workflows, "publish-content-azure.yml", (document) => {
      checkoutSteps(document.jobs.plan)[0].with.ref =
        "${{ github.event.pull_request.head.sha }}";
    }),
    "ref checkout non scellee"
  );
  assertRejected(
    cloneWithMutation(workflows, "publish-content-azure.yml", (document) => {
      checkoutSteps(document.jobs["publish-answer-key"])[0].with.ref =
        "${{ github.sha }}";
    }),
    "ref checkout non scellee"
  );
  assertRejected(
    cloneWithMutation(workflows, "publish-content-azure.yml", (document) => {
      delete document.jobs.plan.outputs.approved_sha;
    }),
    "output approved_sha scelle requis"
  );
  assertRejected(
    cloneWithMutation(workflows, "publish-content-azure.yml", (document) => {
      document.jobs["publish-public"].steps = document.jobs[
        "publish-public"
      ].steps.filter((step) => step.name !== "Verify sealed source commit");
    }),
    "verification du SHA scelle requise"
  );
  assertRejected(
    cloneWithMutation(workflows, "publish-content-azure.yml", (document) => {
      const rebuild = document.jobs["publish-release"].steps.find(
        (step) => step.name === "Rebuild and verify complete release"
      );
      delete rebuild.env.EXPECTED_PRIVATE_MANIFEST_ID;
    }),
    "identite de contenu non scellee"
  );
});
