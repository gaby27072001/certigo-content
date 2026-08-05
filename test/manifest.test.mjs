import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { buildManifest, serializeManifest } from "../tools/gen_manifest.mjs";
import { EXPECTED_ROOT_HASH } from "../tools/manifest_selfcheck.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixtureRoot = resolve(repoRoot, "tools", "__fixtures__", "manifest");

test("genere un manifeste byte-identical pour le meme corpus", async () => {
  const first = await buildManifest({ root: fixtureRoot });
  const second = await buildManifest({ root: fixtureRoot });

  assert.equal(serializeManifest(first), serializeManifest(second));
  assert.equal(first.rootHash, second.rootHash);
});

test("conserve le vecteur golden du manifeste", async () => {
  const manifest = await buildManifest({ root: fixtureRoot });

  assert.equal(manifest.rootHash, EXPECTED_ROOT_HASH);
  assert.equal(manifest.manifestId, `sha256:${EXPECTED_ROOT_HASH}`);
});
