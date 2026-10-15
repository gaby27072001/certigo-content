import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workflowRoot = resolve(repoRoot, ".github", "workflows");
const uploadCondition =
  "${{ github.event_name == 'workflow_dispatch' && inputs.upload_github_artifacts == true }}";

function loadWorkflow(name) {
  return parse(readFileSync(resolve(workflowRoot, name), "utf8"));
}

function findStep(workflow, jobName, stepName) {
  return workflow.jobs[jobName].steps.find((step) => step.name === stepName);
}

test("les gates CI couvrent chaque push main et pull request", () => {
  const content = loadWorkflow("ci-content-package.yml");
  const tooling = loadWorkflow("ci-tooling.yml");

  for (const workflow of [content, tooling]) {
    assert.deepEqual(
      Object.keys(workflow.on).sort(),
      ["pull_request", "push", "workflow_dispatch"]
    );
    assert.deepEqual(workflow.on.push, { branches: ["main"] });
    assert.deepEqual(workflow.on.pull_request, {});
  }

  assert.match(
    findStep(content, "package-public", "Build public artifact in a clean dist").run,
    /package:public/
  );
  assert.match(
    findStep(content, "package-public", "Verify final public artifact").run,
    /package:verify:public/
  );
  assert.match(
    findStep(content, "package-private", "Build private artifact in a clean dist").run,
    /package:private/
  );
  assert.match(
    findStep(content, "package-private", "Verify final private artifact").run,
    /package:verify:private/
  );
  // Garde « expand avant usage » : un paquet refuse par les schemas du backend
  // ne doit franchir ni une PR, ni un push main.
  assert.match(
    findStep(content, "package-gates", "Enforce backend content contract (expand before use)").run,
    /npm run contract:backend/
  );

  const toolingCommands = tooling.jobs["test-and-supply-chain"].steps
    .map((step) => step.run ?? "")
    .join("\n");
  for (const command of [
    "npm test",
    "npm run validate",
    "npm run manifest:check",
    "npm audit --audit-level=high",
    "osv-scanner_linux_amd64 --lockfile=package-lock.json",
    "npm sbom --sbom-format cyclonedx",
  ]) {
    assert.match(toolingCommands, new RegExp(command.replaceAll(".", "\\.")));
  }
});

test("le tooling utilise GitHub hosted sans elargir ses privileges", () => {
  const tooling = loadWorkflow("ci-tooling.yml");
  const job = tooling.jobs["test-and-supply-chain"];

  assert.equal(job["runs-on"], "ubuntu-24.04");
  assert.deepEqual(tooling.permissions, { contents: "read" });
  assert.equal(job.permissions, undefined);
  assert.equal(
    job.if,
    "${{ github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository }}"
  );
  assert.equal(
    job.environment,
    "${{ github.event_name == 'pull_request' && 'pr-ci' || '' }}"
  );
  const checkout = findStep(tooling, "test-and-supply-chain", "Checkout");
  assert.equal(checkout.with["persist-credentials"], false);
  assert.equal(checkout.with["fetch-depth"], 0);
  for (const step of job.steps) {
    if (step.uses !== undefined) {
      assert.match(step.uses, /@[0-9a-f]{40}$/);
    }
  }
});

test("les trois jobs package utilisent GitHub hosted sans elargir leurs privileges", () => {
  const content = loadWorkflow("ci-content-package.yml");

  assert.deepEqual(content.permissions, { contents: "read" });
  assert.deepEqual(Object.keys(content.jobs).sort(), [
    "package-gates",
    "package-private",
    "package-public",
  ]);
  for (const [name, job] of Object.entries(content.jobs)) {
    assert.equal(job["runs-on"], "ubuntu-24.04");
    assert.equal(job.permissions, undefined);
    assert.equal(
      job.if,
      "${{ github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository }}"
    );
    assert.equal(
      job.environment,
      "${{ github.event_name == 'pull_request' && 'pr-ci' || '' }}"
    );
    const checkout = findStep(content, name, "Checkout");
    assert.equal(checkout.with["persist-credentials"], false);
    if (name === "package-gates") {
      assert.equal(checkout.with["fetch-depth"], 0);
    } else {
      assert.equal(job.needs, "package-gates");
    }
    assert.equal(
      findStep(content, name, "Setup Node.js").with["node-version-file"],
      ".nvmrc"
    );
    assert.equal(findStep(content, name, "Install locked tooling").run, "npm ci");
    for (const step of job.steps) {
      if (step.uses !== undefined) {
        assert.match(step.uses, /@[0-9a-f]{40}$/);
      }
    }
  }
  for (const [step, command] of [
    ["Test packaging and leak gates", "npm test"],
    ["Enforce certification catalog freshness", "npm run catalog:freshness"],
    ["Enforce global artifact download policy", "npm run policy:artifact-access"],
  ]) {
    assert.equal(findStep(content, "package-gates", step).run, command);
  }
});

test("les uploads GitHub sont manuels, explicites et stricts", () => {
  const content = loadWorkflow("ci-content-package.yml");
  const tooling = loadWorkflow("ci-tooling.yml");

  for (const workflow of [content, tooling]) {
    assert.deepEqual(
      workflow.on.workflow_dispatch.inputs.upload_github_artifacts,
      {
        description: "Upload temporary GitHub artifacts (requires available quota)",
        required: false,
        type: "boolean",
        default: false,
      }
    );
  }

  const uploads = [
    findStep(content, "package-public", "Publish public artifact"),
    findStep(content, "package-private", "Publish private artifact"),
    findStep(tooling, "test-and-supply-chain", "Publish tooling SBOM"),
  ];
  assert.equal(uploads.length, 3);
  for (const step of uploads) {
    assert.match(step.uses, /^actions\/upload-artifact@[0-9a-f]{40}$/);
    assert.equal(step.if, uploadCondition);
    assert.equal(step["continue-on-error"], undefined);
    assert.equal(step.with["if-no-files-found"], "error");
  }

  assert.equal(uploads[0].with["retention-days"], 90);
  assert.equal(uploads[1].with["retention-days"], 30);
  assert.equal(uploads[2].with["retention-days"], 30);
});

test("l'analyse CodeQL reste bornee a son perimetre mesure", () => {
  const codeql = loadWorkflow("codeql.yml");

  // Aucun `schedule` : pas d'analyse periodique sans changement de code.
  assert.deepEqual(Object.keys(codeql.on).sort(), ["pull_request", "push"]);
  assert.deepEqual(codeql.on.push, { branches: ["main"] });
  assert.deepEqual(codeql.on.pull_request, {});

  // `pull_request_target` executerait le code d'une PR avec un jeton
  // privilegie. Ce workflow s'en passe, ce qui rend inutile toute isolation
  // source/controle.
  assert.equal(codeql.on.pull_request_target, undefined);

  const analyze = codeql.jobs.analyze;

  // Perimetre de langages : mesure du 2026-09-09, 0 fichier `.py` dans le
  // depot. Ajouter `python` reintroduirait un job vide.
  assert.deepEqual(
    analyze.strategy.matrix.include.map((entry) => entry.language).sort(),
    ["actions", "javascript-typescript"]
  );
  for (const entry of analyze.strategy.matrix.include) {
    assert.equal(entry["build-mode"], "none");
  }

  const init = analyze.steps.find((step) =>
    step.uses?.startsWith("github/codeql-action/init@")
  );
  // `queries` absent => suite `default`. `security-and-quality` rend surtout
  // des `note` de style, et une regle qui rougit sur tout dresse a passer outre.
  assert.equal(init.with.queries, undefined);

  assert.equal(analyze["runs-on"], "ubuntu-24.04");
  assert.equal(analyze.strategy["fail-fast"], false);
  assert.equal(
    analyze.if,
    "${{ github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository }}"
  );

  // Moindre privilege : rien au niveau du workflow, et le strict necessaire
  // au niveau du job. `actions: read` est requis par le mode overlay de
  // CodeQL sur les pull requests ; son absence a fait echouer les deux
  // langages sur « Resource not accessible by integration ».
  assert.deepEqual(codeql.permissions, {});
  assert.deepEqual(analyze.permissions, {
    actions: "read",
    contents: "read",
    "security-events": "write",
  });

  // Toute action tierce reste epinglee par SHA complet.
  for (const step of analyze.steps) {
    if (step.uses !== undefined) {
      assert.match(step.uses, /@[0-9a-f]{40}$/);
    }
  }
});

test("la publication Azure reste separee et exclusivement manuelle", () => {
  const azure = loadWorkflow("publish-content-azure.yml");
  assert.deepEqual(Object.keys(azure.on), ["workflow_dispatch"]);
  assert.equal(
    azure.on.workflow_dispatch.inputs.upload_github_artifacts,
    undefined
  );
  assert.equal(azure.concurrency["cancel-in-progress"], false);
  // Une publication est irreversible : le plan refuse une release que l'import
  // backend rejetterait, et le controle porte sur le dist qui sera publie.
  const gates = findStep(azure, "plan", "Run publication gates").run;
  assert.match(gates, /npm run contract:backend -- --dist dist/);
  assert.ok(
    gates.indexOf("npm run package\n") < gates.indexOf("npm run contract:backend"),
    "la garde backend doit porter sur le paquet construit"
  );
});
