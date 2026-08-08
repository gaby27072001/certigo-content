#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { argv, cwd } from "node:process";
import { pathToFileURL } from "node:url";
import { glob } from "glob";
import { parse } from "yaml";
import { compareOrdinal } from "./lib/deterministic.mjs";

const POLICY_SCHEMA = "certigo.artifact-access-policy/v1";
const DEFAULT_POLICY_PATH = ".github/artifact-access-policy.json";
const PRIVATE_ARTIFACT_PATTERNS = [
  /certigo-content-private/i,
  /private-sha256/i,
];

function isPrivateArtifactName(value) {
  return PRIVATE_ARTIFACT_PATTERNS.some((pattern) => pattern.test(value));
}

function loadPolicy(root, policyPath) {
  const path = resolve(root, policyPath);
  const policy = JSON.parse(readFileSync(path, "utf8"));
  const allowedKeys = new Set(["schema", "privateArtifactDownloads"]);
  const unknownKeys = Object.keys(policy).filter((key) => !allowedKeys.has(key));
  if (
    policy?.schema !== POLICY_SCHEMA ||
    !Array.isArray(policy?.privateArtifactDownloads) ||
    unknownKeys.length > 0
  ) {
    throw new Error(
      `politique invalide ${policyPath}: schema, privateArtifactDownloads ou cles inattendus`
    );
  }

  const entries = policy.privateArtifactDownloads.map((entry, index) => {
    const keys = Object.keys(entry ?? {});
    if (
      keys.length !== 3 ||
      !keys.every((key) => ["workflow", "job", "name"].includes(key)) ||
      !["workflow", "job", "name"].every(
        (key) => typeof entry?.[key] === "string" && entry[key].length > 0
      ) ||
      !isPrivateArtifactName(entry.name)
    ) {
      throw new Error(
        `politique invalide ${policyPath}: privateArtifactDownloads[${index}] doit contenir workflow/job/name prives exacts`
      );
    }
    return entry;
  });

  const identities = entries.map(
    (entry) => `${entry.workflow}\0${entry.job}\0${entry.name}`
  );
  if (new Set(identities).size !== identities.length) {
    throw new Error(`politique invalide ${policyPath}: allow-list dupliquee`);
  }
  return entries;
}

function isExplicitlyAllowed(entries, workflow, job, name) {
  return entries.some(
    (entry) =>
      entry.workflow === workflow && entry.job === job && entry.name === name
  );
}

export async function findArtifactAccessViolations(options = {}) {
  const root = resolve(options.root ?? cwd());
  const workflowRoot = resolve(root, options.workflowRoot ?? ".github/workflows");
  const actionRoot = resolve(root, options.actionRoot ?? ".github/actions");
  const policyPath = options.policyPath ?? DEFAULT_POLICY_PATH;
  const privateAllowList = loadPolicy(root, policyPath);
  const workflowFiles = await glob("*.{yml,yaml}", {
    cwd: workflowRoot,
    absolute: true,
  });
  const actionFiles = await glob("**/action.{yml,yaml}", {
    cwd: actionRoot,
    absolute: true,
  });
  const targets = [
    ...workflowFiles.map((path) => ({ path, kind: "workflow" })),
    ...actionFiles.map((path) => ({ path, kind: "action" })),
  ].sort((left, right) =>
    compareOrdinal(relative(root, left.path), relative(root, right.path))
  );
  const violations = [];

  for (const target of targets) {
    const policyIdentity = relative(root, target.path).replaceAll("\\", "/");
    const document = parse(readFileSync(target.path, "utf8"));
    const scopes =
      target.kind === "workflow"
        ? Object.entries(document?.jobs ?? {})
        : [["runs", { steps: document?.runs?.steps ?? [] }]];
    for (const [scopeId, scope] of scopes) {
      for (const step of scope?.steps ?? []) {
        if (!/^actions\/download-artifact@/i.test(step?.uses ?? "")) continue;

        const artifactName = step.with?.name;
        if (typeof artifactName !== "string" || artifactName.trim().length === 0) {
          violations.push(
            `${policyIdentity}:${scopeId}: download-artifact sans allow-list de nom`
          );
          continue;
        }
        if (
          isPrivateArtifactName(artifactName) &&
          !isExplicitlyAllowed(
            privateAllowList,
            policyIdentity,
            scopeId,
            artifactName
          )
        ) {
          violations.push(
            `${policyIdentity}:${scopeId}: telechargement prive hors allow-list explicite "${artifactName}"`
          );
        } else if (artifactName.includes("${{")) {
          violations.push(
            `${policyIdentity}:${scopeId}: nom d'artefact dynamique non verifiable "${artifactName}"`
          );
        }
      }
    }
  }
  return violations;
}

function parseArgs(cliArgs) {
  const options = {};
  for (let index = 0; index < cliArgs.length; index++) {
    const argument = cliArgs[index];
    if (argument === "--root" || argument === "--policy") {
      const value = cliArgs[++index];
      if (value === undefined || value.startsWith("-")) {
        throw new Error(`valeur manquante pour ${argument}`);
      }
      if (argument === "--root") options.root = value;
      else options.policyPath = value;
    } else if (argument === "--help" || argument === "-h") {
      options.help = true;
    } else {
      throw new Error(`argument inconnu: ${argument}`);
    }
  }
  return options;
}

const isMain =
  argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(argv[1])).href;

if (isMain) {
  try {
    const options = parseArgs(argv.slice(2));
    if (options.help) {
      console.log(
        "Usage: node tools/check_artifact_access.mjs [--root DIR] [--policy FILE]"
      );
    } else {
      const violations = await findArtifactAccessViolations(options);
      if (violations.length > 0) {
        console.error(
          `[artifact-access] ECHEC - ${violations.length} violation(s):\n` +
            violations.map((violation) => `  - ${violation}`).join("\n")
        );
        process.exitCode = 1;
      } else {
        console.log(
          "[artifact-access] OK - tous les telechargements nomment un artefact; le prive est limite a l'allow-list explicite."
        );
      }
    }
  } catch (error) {
    console.error(`[artifact-access] erreur fatale: ${error.message}`);
    process.exitCode = 1;
  }
}
