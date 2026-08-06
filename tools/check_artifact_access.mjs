#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { argv, cwd } from "node:process";
import { pathToFileURL } from "node:url";
import { glob } from "glob";
import { parse } from "yaml";

const PRIVATE_REFERENCES = [
  /answerkey/i,
  /dist[\\/]private/i,
  /certigo-content-private/i,
  /private-sha256/i,
];

function containsPrivateReference(value) {
  return PRIVATE_REFERENCES.some((pattern) => pattern.test(JSON.stringify(value)));
}

export async function findArtifactAccessViolations(options = {}) {
  const root = resolve(options.root ?? cwd());
  const workflowRoot = resolve(root, options.workflowRoot ?? ".github/workflows");
  const workflowFiles = (
    await glob("*.{yml,yaml}", { cwd: workflowRoot, posix: true })
  ).sort();
  const violations = [];

  for (const workflowFile of workflowFiles) {
    const workflow = parse(readFileSync(resolve(workflowRoot, workflowFile), "utf8"));
    for (const [jobId, job] of Object.entries(workflow?.jobs ?? {})) {
      const mobileJob = /mobile/i.test(`${jobId} ${job?.name ?? ""}`);
      if (!mobileJob) continue;

      if (containsPrivateReference(job)) {
        violations.push(`${workflowFile}:${jobId}: reference a un artefact prive`);
      }
      for (const step of job?.steps ?? []) {
        if (step?.uses?.startsWith("actions/download-artifact@")) {
          const artifactName = step.with?.name;
          if (!artifactName) {
            violations.push(
              `${workflowFile}:${jobId}: download-artifact sans allow-list de nom`
            );
          } else if (containsPrivateReference(artifactName)) {
            violations.push(
              `${workflowFile}:${jobId}: telechargement de l'artefact prive "${artifactName}"`
            );
          }
        }
      }
    }
  }
  return violations;
}

const isMain =
  argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(argv[1])).href;

if (isMain) {
  try {
    const violations = await findArtifactAccessViolations();
    if (violations.length > 0) {
      console.error(
        `[artifact-access] ECHEC - ${violations.length} violation(s):\n` +
          violations.map((violation) => `  - ${violation}`).join("\n")
      );
      process.exitCode = 1;
    } else {
      console.log(
        "[artifact-access] OK - aucun job mobile ne peut telecharger ou referencer l'artefact prive."
      );
    }
  } catch (error) {
    console.error(`[artifact-access] erreur fatale: ${error.message}`);
    process.exitCode = 1;
  }
}
