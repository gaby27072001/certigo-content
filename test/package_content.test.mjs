import assert from "node:assert/strict";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { afterEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  inspectPublicArtifact,
  packageContent,
  verifyArtifact,
  verifyPackagedContent,
} from "../tools/package_content.mjs";
import { canonicalize, sha256Hex } from "../tools/gen_manifest.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const temporaryRoots = [];

function createRoot() {
  const root = mkdtempSync(join(tmpdir(), "certigo-package-"));
  temporaryRoots.push(root);
  cpSync(resolve(repoRoot, "schemas"), resolve(root, "schemas"), { recursive: true });
  mkdirSync(resolve(root, "content", "public", "questions"), { recursive: true });
  mkdirSync(resolve(root, "content", "answerKey", "solutions"), { recursive: true });
  writeFileSync(
    resolve(root, "content", "public", "questions", "sample.json"),
    JSON.stringify({
      choices: ["A", "B"],
      prompt: "Question",
      kind: "public",
      schemaVersion: "v2",
      id: "sample",
    })
  );
  writeFileSync(
    resolve(root, "content", "answerKey", "solutions", "sample.json"),
    JSON.stringify({
      rationale: "Because",
      correct: "A",
      kind: "answerKey",
      schemaVersion: "v2",
      id: "sample",
    })
  );
  return root;
}

// Revision approuvee de la PR #25. L'artefact publie a cette revision est
// l'objet meme de la garantie ADR-0002 : pouvoir le reconstruire a l'identique.
//
// Ce test reconstruisait auparavant l'etat #25 en rembobinant a la main, entree
// par entree, le catalogue vivant. Ce proxy supposait le corpus v2 fige, et il
// avait silencieusement diverge : son golden public ne correspondait a AUCUN
// artefact reellement publie. Mesure du 2026-09-07 sur la revision elle-meme :
//
//   public   attendu ca890ec2...  ->  reel a3ab2254...   (diverge)
//   prive    attendu e3bfa7c2...  ->  reel e3bfa7c2...   (authentique)
//
// Seul le canal prive coincidait, parce qu'il n'avait pas bouge depuis #25.
// Reconstruire depuis la revision supprime le proxy, aligne le test sur son
// nom, et le rend insensible aux evolutions legitimes du contenu vivant.
const HISTORICAL_V2_REVISION = "87ae817";

function materializeRevision(revision) {
  const root = mkdtempSync(join(tmpdir(), "certigo-revision-"));
  temporaryRoots.push(root);
  const archivePath = join(root, "revision.tar");
  const exported = spawnSync(
    "git",
    ["archive", "--format=tar", "-o", archivePath, revision],
    { cwd: repoRoot, encoding: "utf8" }
  );
  if (exported.status !== 0) {
    throw new Error(
      `git archive ${revision} a echoue (statut ${exported.status}) : ` +
        `${(exported.stderr ?? "").trim()}\n` +
        "Ce test reconstruit une revision approuvee et exige donc l'historique " +
        "git complet. En CI, actions/checkout doit porter fetch-depth: 0 : un " +
        "clone superficiel ne contient qu'un seul commit."
    );
  }
  const extracted = spawnSync("tar", ["-xf", archivePath, "-C", root], {
    encoding: "utf8",
  });
  if (extracted.status !== 0) {
    throw new Error(
      `tar -xf a echoue (statut ${extracted.status}) : ${(extracted.stderr ?? "").trim()}`
    );
  }
  rmSync(archivePath);
  return root;
}

function treeSnapshot(root) {
  const snapshot = {};
  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else snapshot[relative(root, path).replaceAll("\\", "/")] = readFileSync(path).toString("base64");
    }

  }
  walk(root);
  return snapshot;
}

function rewriteManifest(artifactRoot, mutate) {
  const path = resolve(artifactRoot, "manifest.json");
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  mutate(manifest);
  const body = {
    schema: manifest.schema,
    channel: manifest.channel,
    artifact: manifest.artifact,
    algorithm: manifest.algorithm,
    serialization: manifest.serialization,
    fileCount: manifest.fileCount,
    files: manifest.files,
  };
  manifest.rootHash = sha256Hex(canonicalize(body));
  manifest.manifestId = `sha256:${manifest.rootHash}`;
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
}

afterEach(() => {
  while (temporaryRoots.length > 0) {
    rmSync(temporaryRoots.pop(), { recursive: true, force: true });
  }
});

test("produit deux artefacts byte-identical avec des manifestes distincts", async () => {
  const root = createRoot();
  await packageContent({ root, outDir: "dist-first" });
  await packageContent({ root, outDir: "dist-second" });

  assert.deepEqual(
    treeSnapshot(resolve(root, "dist-first")),
    treeSnapshot(resolve(root, "dist-second"))
  );

  const publicManifest = JSON.parse(
    readFileSync(resolve(root, "dist-first", "public", "manifest.json"), "utf8")
  );
  const privateManifest = JSON.parse(
    readFileSync(resolve(root, "dist-first", "private", "manifest.json"), "utf8")
  );
  assert.notEqual(publicManifest.manifestId, privateManifest.manifestId);
  assert.deepEqual(publicManifest.files.map((entry) => entry.path), ["questions/sample.json"]);
  assert.deepEqual(privateManifest.files.map((entry) => entry.path), ["solutions/sample.json"]);
});

test("conserve le package v3 runtime byte-identical", async () => {
  const outDir = mkdtempSync(join(tmpdir(), "certigo-package-v3-golden-"));
  temporaryRoots.push(outDir);

  const result = await packageContent({ root: repoRoot, outDir });

  // 146 paires v2 heritees (232 a l'origine, moins les 86 orphelines retirees :
  // elles portaient sur des certifications absentes du catalogue et n'etaient
  // atteignables par aucune matrice), puis les vagues v3 successives.
  assert.equal(result.sourcePairCount, 146 + 42 + 42 + 60 + 100 + 72 + 48 + 216 + 8);
  assert.ok(result.release !== null);
  assert.equal(existsSync(resolve(outDir, "release.json")), true);
  assert.deepEqual(
    result.packages.map(({ artifact, manifestId }) => ({ artifact, manifestId })),
    [
      {
        artifact: "public",
        manifestId:
          "sha256:c33c8839257785823a88e841362194053345097452eb5f3cedaa7de95269b669",
      },
      {
        artifact: "private",
        manifestId:
          "sha256:ee6ae56bcfefea808006ff76c584f0e9272b83d8efbc3d762da405329a8e3db1",
      },
    ]
  );
  assert.equal(
    sha256Hex(canonicalize(treeSnapshot(outDir))),
    "b207137c1e1d7c277ec49ea14bfbe5c8d3972ab2bd41c866ea60a1ebc547241d"
  );
});

test("reconstruit a l'identique l'artefact publie a la revision #25", async () => {
  const root = materializeRevision(HISTORICAL_V2_REVISION);
  const outDir = resolve(root, "dist-golden");
  const result = await packageContent({ root, outDir });

  assert.equal(result.sourcePairCount, 232);
  assert.equal(result.release, null);
  assert.equal(existsSync(resolve(outDir, "release.json")), false);
  assert.deepEqual(
    result.packages.map(({ artifact, manifestId }) => ({ artifact, manifestId })),
    [
      {
        artifact: "public",
        manifestId:
          "sha256:a3ab2254673515990410268a93f95afd5605f19e29637373d7b20d412fa08869",
      },
      {
        artifact: "private",
        manifestId:
          "sha256:e3bfa7c20c03503384a68d8e261bcbb88f749292a273744a5ba4a309fc48c901",
      },
    ]
  );
  // Corrobore par deux constructions independantes du 2026-09-07 : l'outillage
  // de la revision #25 lui-meme, et l'outillage courant, produisent le meme
  // arbre (495 fichiers). La constante n'est donc pas la simple sortie du test.
  assert.equal(
    sha256Hex(canonicalize(treeSnapshot(outDir))),
    "c8720f3665593a2da00540f43cbde5436fd826293dfe950d5af221d47ab50eac"
  );
});

test("revalide un package historique v1 sans release descriptor", async () => {
  const root = createRoot();
  await packageContent({ root });

  const verified = await verifyPackagedContent({ root });
  assert.equal(verified.release, null);
  assert.equal(verified.packages.length, 2);
});

test("la gate finale rejette une fuite injectee recursivement dans dist/public", async () => {
  const root = createRoot();
  await packageContent({ root });
  const leakPath = resolve(root, "dist", "public", "nested", "answerKey", "leak.json");
  mkdirSync(dirname(leakPath), { recursive: true });
  writeFileSync(leakPath, JSON.stringify({ nested: { rationale: "secret" } }));

  assert.throws(
    () => inspectPublicArtifact(resolve(root, "dist", "public")),
    /\[anti-leak\].*(answerKey|rationale|corrige)/i
  );
});

test("la verification rejette un fichier non declare et un hash altere", async () => {
  const root = createRoot();
  await packageContent({ root });
  const artifactRoot = resolve(root, "dist", "public");
  const schemaPath = resolve(root, "schemas", "package-manifest.schema.json");
  writeFileSync(resolve(artifactRoot, "questions", "sample.json"), "{}\n");
  writeFileSync(resolve(artifactRoot, "undeclared.json"), "{}\n");

  assert.throws(
    () => verifyArtifact({ artifactRoot, expectedChannel: "public", schemaPath }),
    /fichier non declare.*hash incorrect/
  );
});

test("un build mono-canal preserve l'autre artefact existant", async () => {
  const root = createRoot();
  await packageContent({ root });
  const publicBefore = treeSnapshot(resolve(root, "dist", "public"));

  await packageContent({ root, channel: "private" });

  assert.deepEqual(treeSnapshot(resolve(root, "dist", "public")), publicBefore);
  assert.ok(readFileSync(resolve(root, "dist", "reports", "public-anti-leak.json")));
});

test("couple strictement artifact, channel, path, id et payload", async () => {
  const channelRoot = createRoot();
  await packageContent({ root: channelRoot });
  const publicRoot = resolve(channelRoot, "dist", "public");
  rewriteManifest(publicRoot, (manifest) => {
    manifest.channel = "answerKey";
  });
  assert.throws(
    () =>
      verifyArtifact({
        artifactRoot: publicRoot,
        expectedChannel: "public",
        schemaPath: resolve(channelRoot, "schemas", "package-manifest.schema.json"),
      }),
    /channel attendu public|schema.*const/
  );

  const pathRoot = createRoot();
  await packageContent({ root: pathRoot });
  const privateRoot = resolve(pathRoot, "dist", "private");
  renameSync(
    resolve(privateRoot, "solutions", "sample.json"),
    resolve(privateRoot, "solutions", "renamed.json")
  );
  rewriteManifest(privateRoot, (manifest) => {
    manifest.files[0].path = "solutions/renamed.json";
  });
  assert.throws(
    () =>
      verifyArtifact({
        artifactRoot: privateRoot,
        expectedChannel: "private",
        schemaPath: resolve(pathRoot, "schemas", "package-manifest.schema.json"),
      }),
    /couplage path\/id incorrect/
  );

  const payloadRoot = createRoot();
  await packageContent({ root: payloadRoot });
  const payloadArtifactRoot = resolve(payloadRoot, "dist", "private");
  const payloadPath = resolve(payloadArtifactRoot, "solutions", "sample.json");
  const payload = JSON.parse(readFileSync(payloadPath, "utf8"));
  payload.id = "other";
  const serialized = `${canonicalize(payload)}\n`;
  writeFileSync(payloadPath, serialized);
  rewriteManifest(payloadArtifactRoot, (manifest) => {
    manifest.files[0].hash = sha256Hex(serialized);
    manifest.files[0].size = Buffer.byteLength(serialized);
  });
  assert.throws(
    () =>
      verifyArtifact({
        artifactRoot: payloadArtifactRoot,
        expectedChannel: "private",
        schemaPath: resolve(payloadRoot, "schemas", "package-manifest.schema.json"),
      }),
    /couplage payload\/id incorrect/
  );
});

test("utilise un tri ordinal stable, independant de la locale", async () => {
  const root = createRoot();
  for (const id of ["Zeta", "alpha"]) {
    writeFileSync(
      resolve(root, "content", "public", "questions", `${id}.json`),
      JSON.stringify({
        id,
        schemaVersion: "v2",
        kind: "public",
        prompt: id,
        choices: ["A", "B"],
      })
    );
    writeFileSync(
      resolve(root, "content", "answerKey", "solutions", `${id}.json`),
      JSON.stringify({
        id,
        schemaVersion: "v2",
        kind: "answerKey",
        correct: "A",
        rationale: id,
      })
    );
  }
  await packageContent({ root });
  const manifest = JSON.parse(
    readFileSync(resolve(root, "dist", "public", "manifest.json"), "utf8")
  );
  assert.deepEqual(
    manifest.files.map((entry) => entry.path),
    ["questions/Zeta.json", "questions/alpha.json", "questions/sample.json"]
  );
});

test("refuse les liens symboliques et types speciaux dans un artefact", async (context) => {
  const root = createRoot();
  await packageContent({ root });
  const publicRoot = resolve(root, "dist", "public");
  const target = resolve(publicRoot, "questions", "sample.json");
  const link = resolve(publicRoot, "linked.json");
  try {
    symlinkSync(target, link, "file");
  } catch (error) {
    if (error.code === "EPERM" || error.code === "EACCES") {
      context.skip(`liens symboliques indisponibles: ${error.code}`);
      return;
    }
    throw error;
  }
  assert.throws(() => inspectPublicArtifact(publicRoot), /lien symbolique interdit/);

  if (process.platform !== "win32") {
    rmSync(link);
    const fifo = resolve(publicRoot, "special");
    const result = spawnSync("mkfifo", [fifo], { encoding: "utf8" });
    if (result.status === 0) {
      assert.throws(() => inspectPublicArtifact(publicRoot), /type de fichier interdit/);
    }
  }
});
