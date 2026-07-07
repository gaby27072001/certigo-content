#!/usr/bin/env node
// Self-check for the content manifest generator (wp-p1-07).
//
// This gate is CONTENT-INDEPENDENT on purpose: it validates the *algorithm*,
// not the live corpus. That way the concurrent real-content migration
// (wp-p1-05) can add/replace content/** freely without ever breaking this
// check. The live manifest is (re)generated separately in CI and published as
// an artifact.
//
// Three assertions:
//   1. Determinism      - generating the fixture corpus twice yields byte-identical output.
//   2. Golden vector    - the fixture corpus reproduces a hard-coded expected rootHash
//                         (guards against silent, unintended algorithm changes).
//   3. Schema           - the emitted manifest validates against schemas/manifest.schema.json.
//
// Exit 0 on success, 1 on any failure. Messages in French.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { buildManifest, serializeManifest } from "./gen_manifest.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const fixtureRoot = resolve(__dirname, "__fixtures__", "manifest");
const schemaPath = resolve(repoRoot, "schemas", "manifest.schema.json");

// Golden vector: expected rootHash of the frozen fixture corpus under
// tools/__fixtures__/manifest/content/**. Baked from the deterministic
// algorithm; if you INTENTIONALLY change the algorithm or the fixtures, update
// this constant in the same commit.
const EXPECTED_ROOT_HASH =
  "__GOLDEN_ROOT_HASH__";

let failures = 0;
function ok(msg) {
  console.log(`  \u2713 ${msg}`);
}
function ko(msg) {
  console.error(`  \u2717 ${msg}`);
  failures++;
}

console.log("[selfcheck] Verification du generateur de manifeste de contenu");

// 1. Determinism.
const m1 = await buildManifest({ root: fixtureRoot });
const m2 = await buildManifest({ root: fixtureRoot });
const s1 = serializeManifest(m1);
const s2 = serializeManifest(m2);
if (s1 === s2 && m1.rootHash === m2.rootHash) {
  ok(`Determinisme: deux generations identiques (rootHash=${m1.rootHash})`);
} else {
  ko("Determinisme: deux generations divergent (le generateur n'est pas deterministe)");
}

// 2. Golden vector.
if (m1.rootHash === EXPECTED_ROOT_HASH) {
  ok(`Golden vector: rootHash attendu confirme (${m1.rootHash})`);
} else {
  ko(
    `Golden vector: rootHash inattendu.\n` +
      `      attendu : ${EXPECTED_ROOT_HASH}\n` +
      `      obtenu  : ${m1.rootHash}\n` +
      `      -> si le changement d'algorithme/fixtures est VOULU, mets a jour EXPECTED_ROOT_HASH.`
  );
}

// 2b. manifestId must be derived from rootHash (hash-addressable invariant).
if (m1.manifestId === `sha256:${m1.rootHash}`) {
  ok("Adressage par hash: manifestId derive du rootHash");
} else {
  ko(`Adressage par hash: manifestId (${m1.manifestId}) incoherent avec rootHash`);
}

// 3. Schema validation.
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
const validate = ajv.compile(schema);
if (validate(m1)) {
  ok("Schema: le manifeste emis valide manifest.schema.json");
} else {
  ko(
    "Schema: le manifeste emis ne valide pas manifest.schema.json:\n" +
      (validate.errors || [])
        .map((e) => `      - ${e.instancePath || "/"} ${e.message}`)
        .join("\n")
  );
}

if (failures === 0) {
  console.log("[selfcheck] OK - toutes les verifications passent.");
  process.exit(0);
} else {
  console.error(`[selfcheck] ECHEC - ${failures} verification(s) en erreur.`);
  process.exit(1);
}
