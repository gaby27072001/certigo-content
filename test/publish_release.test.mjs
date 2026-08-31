import assert from "node:assert/strict";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import { packageContent } from "../tools/package_content.mjs";
import {
  buildPublicationPlan,
  publishLocalRelease,
  safeDestinationPath,
} from "../tools/publish_release.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixtureRoot = resolve(repoRoot, "tools", "__fixtures__", "runtime-v3");
const temporaryRoots = [];

function createRuntimeRoot() {
  const root = mkdtempSync(join(tmpdir(), "certigo-publisher-"));
  temporaryRoots.push(root);
  cpSync(resolve(fixtureRoot, "content"), resolve(root, "content"), { recursive: true });
  cpSync(resolve(repoRoot, "schemas"), resolve(root, "schemas"), { recursive: true });
  return root;
}

afterEach(() => {
  while (temporaryRoots.length > 0) {
    rmSync(temporaryRoots.pop(), { recursive: true, force: true });
  }
});

test("produit le plan golden exact des trois surfaces #290/#304", async () => {
  const root = createRuntimeRoot();
  await packageContent({ root });
  const plan = await buildPublicationPlan({ root });

  assert.equal(
    plan.releaseId,
    "sha256:6094410ae57637d55681fdeec3eae50fbfd69ba953741d069c95a478bee73f7f"
  );
  assert.deepEqual(
    plan.surfaces.map(({ name, container }) => ({ name, container })),
    [
      { name: "public", container: "content-public-releases" },
      { name: "private", container: "content-private-releases" },
      { name: "descriptor", container: "content-release-descriptors" },
    ]
  );
  assert.equal(
    plan.surfaces[0].files[0].blobPath,
    `manifests/${plan.publicManifestId}/manifest.json`
  );
  assert.equal(
    plan.surfaces[1].files[0].blobPath,
    `manifests/${plan.privateManifestId}/manifest.json`
  );
  assert.deepEqual(
    plan.surfaces[2].files.map((file) => file.blobPath),
    [`releases/${plan.releaseId}/release.json`]
  );
});

test("dry-run ne cree rien et la publication locale est idempotente", async () => {
  const root = createRuntimeRoot();
  const destinationRoot = resolve(root, "published");
  await packageContent({ root });

  const dryRun = await publishLocalRelease({ root, destinationRoot, dryRun: true });
  assert.equal(dryRun.mode, "dry-run");
  assert.equal(existsSync(destinationRoot), false);

  const first = await publishLocalRelease({ root, destinationRoot });
  const second = await publishLocalRelease({ root, destinationRoot });
  assert.ok(first.surfaces.every((surface) => surface.created === surface.fileCount));
  assert.ok(second.surfaces.every((surface) => surface.unchanged === surface.fileCount));
  assert.equal(existsSync(resolve(destinationRoot, ".certigo-publish-staging")), false);
  assert.deepEqual(
    readFileSync(safeDestinationPath(
      resolve(destinationRoot, "content-release-descriptors"),
      `releases/${first.releaseId}/release.json`
    )),
    readFileSync(resolve(root, "dist", "release.json"))
  );
});

test("refuse traversal et collision immuable", async () => {
  const root = createRuntimeRoot();
  const destinationRoot = resolve(root, "published");
  await packageContent({ root });
  assert.throws(
    () => safeDestinationPath(destinationRoot, "manifests/../../private.json"),
    /chemin blob non sur/
  );

  const plan = await buildPublicationPlan({ root });
  const collision = safeDestinationPath(
    resolve(destinationRoot, "content-public-releases"),
    plan.surfaces[0].files[0].blobPath
  );
  mkdirSync(dirname(collision), { recursive: true });
  writeFileSync(collision, "different\n");
  await assert.rejects(
    () => publishLocalRelease({ root, destinationRoot }),
    /collision immuable/
  );
  assert.equal(
    existsSync(resolve(destinationRoot, "content-release-descriptors")),
    false
  );
});

test("une panne partielle ne publie jamais le descripteur", async () => {
  const root = createRuntimeRoot();
  const destinationRoot = resolve(root, "published");
  await packageContent({ root });
  mkdirSync(resolve(destinationRoot, "content-private-releases"), { recursive: true });
  writeFileSync(
    resolve(destinationRoot, "content-private-releases", "manifests"),
    "blocks-directory\n"
  );

  await assert.rejects(() => publishLocalRelease({ root, destinationRoot }));
  assert.equal(
    existsSync(resolve(destinationRoot, "content-public-releases", "manifests")),
    true
  );
  assert.equal(
    existsSync(resolve(destinationRoot, "content-release-descriptors")),
    false
  );
});

test("refuse une racine de destination symbolique", async (context) => {
  const root = createRuntimeRoot();
  const outside = resolve(root, "outside");
  const destinationRoot = resolve(root, "published-link");
  await packageContent({ root });
  mkdirSync(outside);
  try {
    symlinkSync(outside, destinationRoot, "junction");
  } catch (error) {
    if (error.code === "EPERM" || error.code === "EACCES") {
      context.skip(`junction indisponible: ${error.code}`);
      return;
    }
    throw error;
  }

  await assert.rejects(
    () => publishLocalRelease({ root, destinationRoot }),
    /destination symbolique interdite/
  );
});

test("refuse une zone de staging symbolique avant toute copie", async (context) => {
  const root = createRuntimeRoot();
  const destinationRoot = resolve(root, "published");
  const outside = resolve(root, "outside-staging");
  await packageContent({ root });
  mkdirSync(destinationRoot);
  mkdirSync(outside);
  try {
    symlinkSync(
      outside,
      resolve(destinationRoot, ".certigo-publish-staging"),
      "junction"
    );
  } catch (error) {
    if (error.code === "EPERM" || error.code === "EACCES") {
      context.skip(`junction indisponible: ${error.code}`);
      return;
    }
    throw error;
  }

  await assert.rejects(
    () => publishLocalRelease({ root, destinationRoot }),
    /destination symbolique interdite/
  );
  assert.equal(
    existsSync(resolve(destinationRoot, "content-public-releases")),
    false
  );
});
