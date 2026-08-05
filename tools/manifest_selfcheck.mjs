#!/usr/bin/env node
// Content-independent checks for the deterministic manifest generator.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { argv } from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { buildManifest, serializeManifest } from "./gen_manifest.mjs";

const toolDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(toolDir, "..");

export const EXPECTED_ROOT_HASH =
  "fb3c178e096a36aab496037b954e57dcb394aac38b1777e8e783583ce9c5038e";

/**
 * Run the manifest invariants and return the number of failures.
 * @param {{fixtureRoot?: string, schemaPath?: string}} [options]
 */
export async function runManifestSelfcheck(options = {}) {
  const fixtureRoot = resolve(
    options.fixtureRoot ?? resolve(toolDir, "__fixtures__", "manifest")
  );
  const schemaPath = resolve(
    options.schemaPath ?? resolve(repoRoot, "schemas", "manifest.schema.json")
  );
  let failures = 0;
  const ok = (message) => console.log(`  \u2713 ${message}`);
  const ko = (message) => {
    console.error(`  \u2717 ${message}`);
    failures++;
  };

  console.log("[selfcheck] Verification du generateur de manifeste de contenu");

  const first = await buildManifest({ root: fixtureRoot });
  const second = await buildManifest({ root: fixtureRoot });
  if (
    serializeManifest(first) === serializeManifest(second) &&
    first.rootHash === second.rootHash
  ) {
    ok(`Determinisme: deux generations identiques (rootHash=${first.rootHash})`);
  } else {
    ko("Determinisme: deux generations divergent");
  }

  if (first.rootHash === EXPECTED_ROOT_HASH) {
    ok(`Golden vector: rootHash attendu confirme (${first.rootHash})`);
  } else {
    ko(
      `Golden vector: rootHash inattendu.\n` +
        `      attendu : ${EXPECTED_ROOT_HASH}\n` +
        `      obtenu  : ${first.rootHash}`
    );
  }

  if (first.manifestId === `sha256:${first.rootHash}`) {
    ok("Adressage par hash: manifestId derive du rootHash");
  } else {
    ko(`Adressage par hash: manifestId (${first.manifestId}) incoherent avec rootHash`);
  }

  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(JSON.parse(readFileSync(schemaPath, "utf8")));
  if (validate(first)) {
    ok("Schema: le manifeste emis valide manifest.schema.json");
  } else {
    ko(
      "Schema: le manifeste emis ne valide pas manifest.schema.json:\n" +
        (validate.errors ?? [])
          .map((error) => `      - ${error.instancePath || "/"} ${error.message}`)
          .join("\n")
    );
  }

  if (failures === 0) {
    console.log("[selfcheck] OK - toutes les verifications passent.");
  } else {
    console.error(`[selfcheck] ECHEC - ${failures} verification(s) en erreur.`);
  }
  return failures;
}

const isMain =
  argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(argv[1])).href;

if (isMain) {
  try {
    process.exitCode = (await runManifestSelfcheck()) === 0 ? 0 : 1;
  } catch (error) {
    console.error(`[selfcheck] erreur fatale: ${error.message}`);
    process.exitCode = 1;
  }
}
