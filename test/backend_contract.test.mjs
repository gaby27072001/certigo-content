import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  BACKEND_SCHEMA_PATH,
  BACKEND_SCHEMAS_DIRECTORY,
  BACKEND_SOURCE_FILE,
  checkBackendContract,
  loadBackendContract,
  normalizedSha256,
  syncBackendSchemas,
  validatePackagedPayloads,
} from "../tools/check_backend_contract.mjs";
import { packageContent } from "../tools/package_content.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const temporaryRoots = [];
let distDir;

function temporary(prefix) {
  const path = mkdtempSync(join(tmpdir(), prefix));
  temporaryRoots.push(path);
  return path;
}

// Une racine minimale : la copie vendue et les schemas de contrat, sans corpus.
function contractRoot() {
  const root = temporary("certigo-contract-root-");
  cpSync(resolve(repoRoot, BACKEND_SCHEMAS_DIRECTORY), resolve(root, BACKEND_SCHEMAS_DIRECTORY), {
    recursive: true,
  });
  cpSync(resolve(repoRoot, "schemas"), resolve(root, "schemas"), { recursive: true });
  return root;
}

before(async () => {
  distDir = temporary("certigo-contract-dist-");
  await packageContent({ root: repoRoot, outDir: distDir });
});

after(() => {
  while (temporaryRoots.length > 0) {
    rmSync(temporaryRoots.pop(), { recursive: true, force: true });
  }
});

test("la copie des schemas du backend est integre et nomme sa revision Certigo", () => {
  const contract = loadBackendContract({ root: repoRoot });
  assert.deepEqual(contract.errors, []);
  assert.match(contract.source.revision, /^[0-9a-f]{40}$/);
  assert.equal(contract.source.path, BACKEND_SCHEMA_PATH);
  // Chaque schema de contrat de ce depot a sa contrepartie cote backend.
  const contentSchemas = readdirSync(resolve(repoRoot, "schemas")).filter((name) =>
    name.endsWith(".schema.json")
  );
  for (const name of contentSchemas) {
    assert.ok(contract.schemas.has(name), `${name}: absent de la copie backend`);
  }
});

test("le paquet livre est entierement accepte par les schemas du backend", async () => {
  const result = await checkBackendContract({ root: repoRoot, distDir });
  assert.deepEqual(result.errors, []);
  // Temoin positif : l'instrument a lu chaque famille de document, pas zero.
  for (const key of [
    "release",
    "public/certificationCatalog",
    "public/coverageMatrix",
    "public/question",
    "public/concept",
    "public/domain",
    "public/track",
    "private/solution",
  ]) {
    assert.ok(result.counts[key] > 0, `${key}: aucun document controle`);
  }
  const manifest = JSON.parse(readFileSync(resolve(distDir, "public", "manifest.json"), "utf8"));
  const privateManifest = JSON.parse(
    readFileSync(resolve(distDir, "private", "manifest.json"), "utf8")
  );
  const checked = Object.values(result.counts).reduce((sum, count) => sum + count, 0);
  assert.equal(checked, 1 + manifest.fileCount + privateManifest.fileCount);
});

test("echoue quand le contenu livre utilise un champ que le backend ignore (incident #84)", () => {
  // Rejoue l'incident mesure le 2026-09-23 : un backend qui ne connait pas
  // lifecycle.transition refuse le catalogue, alors que le contenu est valide
  // contre ses propres schemas.
  const contract = loadBackendContract({ root: repoRoot });
  const schemas = new Map(contract.schemas);
  const catalogSchema = structuredClone(schemas.get("certification-catalog.schema.json"));
  delete catalogSchema.$defs.lifecycle.properties.transition;
  schemas.set("certification-catalog.schema.json", catalogSchema);

  const result = validatePackagedPayloads({
    distDir,
    schemas,
    resourceTypes: ["certificationCatalog"],
  });
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /public\/catalog\/certifications\.json/);
  assert.match(result.errors[0], /propriete inconnue du backend "transition"/);
});

test("echoue quand une copie vendue est modifiee hors synchronisation", async () => {
  const root = contractRoot();
  const path = resolve(root, BACKEND_SCHEMAS_DIRECTORY, "question.schema.json");
  writeFileSync(path, readFileSync(path, "utf8").replace('"type"', '"type" '), "utf8");

  const result = await checkBackendContract({ root, distDir });
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /question\.schema\.json: copie modifiee hors synchronisation/);
  assert.match(result.errors[0], /expand avant usage/);
});

test("echoue ferme quand la copie backend est absente", async () => {
  const root = temporary("certigo-contract-empty-");
  const result = await checkBackendContract({ root, distDir });
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /introuvable : garde inoperante/);
});

test("signale sans echouer un schema de contrat en avance sur le backend", async () => {
  const root = contractRoot();
  // Les schemas du depot peuvent deja etre en avance sur la copie (par exemple la
  // variante v5, acceptee ici avant de l'etre par le backend). Le temoin mesure donc
  // l'ecart AJOUTE par un schema de plus, pas un ecart absolu.
  const baseline = await checkBackendContract({ root, distDir });
  assert.deepEqual(baseline.errors, []);
  writeFileSync(resolve(root, "schemas", "future.schema.json"), "{}\n", "utf8");

  const result = await checkBackendContract({ root, distDir });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(
    result.schemaDrift,
    [...baseline.schemaDrift, "future.schema.json"].sort()
  );
});

test("--sync-from copie les octets de HEAD et enregistre la revision Certigo", () => {
  const certigo = temporary("certigo-fake-backend-");
  const schemaDirectory = resolve(certigo, BACKEND_SCHEMA_PATH);
  mkdirSync(schemaDirectory, { recursive: true });
  writeFileSync(resolve(schemaDirectory, "question.schema.json"), '{\r\n  "type": "object"\r\n}\r\n');
  const run = (...args) =>
    execFileSync("git", ["-C", certigo, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  run("init", "--quiet");
  run("-c", "core.autocrlf=false", "add", ".");
  run(
    "-c", "user.name=test", "-c", "user.email=test@example.invalid",
    "commit", "--quiet", "-m", "schemas"
  );
  // Modification non commitee : elle ne doit pas entrer dans la copie.
  writeFileSync(resolve(schemaDirectory, "question.schema.json"), '{"type":"string"}\n');
  const revision = run("rev-parse", "HEAD").trim();

  const root = temporary("certigo-sync-root-");
  const source = syncBackendSchemas({ root, from: certigo });
  assert.equal(source.revision, revision);
  assert.match(source.committedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  assert.deepEqual(Object.keys(source.files), ["question.schema.json"]);

  const copied = readFileSync(resolve(root, BACKEND_SCHEMAS_DIRECTORY, "question.schema.json"));
  assert.equal(copied.toString("utf8"), '{\n  "type": "object"\n}\n');
  assert.equal(source.files["question.schema.json"], normalizedSha256(copied));
  const written = JSON.parse(
    readFileSync(resolve(root, BACKEND_SCHEMAS_DIRECTORY, BACKEND_SOURCE_FILE), "utf8")
  );
  assert.deepEqual(written, source);
  assert.deepEqual(loadBackendContract({ root }).errors, []);
});
