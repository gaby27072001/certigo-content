#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const args = ["--experimental-test-coverage", "--test"];
if (process.allowedNodeEnvironmentFlags.has("--test-coverage-lines")) {
  args.push(
    "--test-coverage-include=tools/**/*.mjs",
    "--test-coverage-exclude=tools/migrate_p1_05.mjs",
    "--test-coverage-exclude=tools/migrate_microsoft_v3.mjs",
    "--test-coverage-lines=80",
    "--test-coverage-functions=75",
    "--test-coverage-branches=70"
  );
}

const result = spawnSync(process.execPath, args, { stdio: "inherit" });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
