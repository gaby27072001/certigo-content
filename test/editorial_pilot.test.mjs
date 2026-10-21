import { it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateEditorial } from "../tools/validate_editorial.mjs";
import { materializeRuntime } from "../tools/materialize_runtime.mjs";
import { buildManifest } from "../tools/gen_manifest.mjs";
import { packageContent } from "../tools/package_content.mjs";
import { compareOrdinal } from "../tools/lib/deterministic.mjs";

const ROOT = join(import.meta.dirname, "..");
const PILOT = "editorial/pilots/responsible-ai-assistants.json";
const original = () => JSON.parse(readFileSync(join(ROOT, PILOT), "utf8"));

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "certigo-editorial-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  cpSync(join(ROOT, "schemas"), join(root, "schemas"), { recursive: true });
  cpSync(join(ROOT, "editorial", "schemas"), join(root, "editorial", "schemas"), {
    recursive: true,
  });
  mkdirSync(join(root, "editorial", "pilots"), { recursive: true });
  writeFileSync(join(root, PILOT), JSON.stringify(original()));
  return root;
}

it("validates the authored pilot offline with deterministic diagnostics", () => {
  const result = validateEditorial({ root: ROOT });
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.deepEqual(result, validateEditorial({ root: ROOT }));
  assert.ok(result.files.includes(PILOT));
  const pilot = original();
  assert.deepEqual(pilot.lessons.map((lesson) => lesson.id), [
    "verify-claims", "retrieval-not-training", "stop-and-escalate",
  ]);
  assert.equal(pilot.sources.length, 4);
});

const invalidCases = [
  ["unknown root property", (p) => { p.certificationId = "aws:aif-c01"; }, "schema"],
  ["unknown nested property", (p) => { p.lessons[0].practice.correct = "a"; }, "schema"],
  ["empty teaching text", (p) => { p.lessons[0].hook = "  "; }, "schema"],
  ["invalid date", (p) => { p.asOf = "2026-02-30"; }, "schema"],
  ["non-AWS source", (p) => { p.sources[0].url = "https://example.com/source"; }, "schema"],
  ["spoofed AWS host", (p) => { p.sources[0].url = "https://docs.aws.amazon.com.evil.test/bedrock/latest/userguide/knowledge-base.html"; }, "schema"],
  ["wrong locale", (p) => { p.locale = "en-US"; }, "schema"],
  ["release status", (p) => { p.status = "published"; }, "schema"],
  ["empty lessons", (p) => { p.lessons = []; }, "schema"],
  ["empty sources", (p) => { p.sources = []; }, "schema"],
  ["duplicate reference", (p) => { p.lessons[0].sourceIds.push(p.lessons[0].sourceIds[0]); }, "schema"],
  ["duplicate source id", (p) => { p.sources[1].id = p.sources[0].id; }, "source dupliquee"],
  ["duplicate source URL", (p) => { p.sources[1].url = p.sources[0].url; }, "URL dupliquee"],
  ["unreviewed snapshot", (p) => { p.sources[0].checkedOn = "2026-10-13"; }, "non revue"],
  ["unknown source reference", (p) => { p.lessons[0].sourceIds = ["absent"]; }, "source inconnue"],
  ["unused source", (p) => { p.sources.push({ ...p.sources[0], id: "unused", url: "https://docs.aws.amazon.com/bedrock/latest/userguide/unused.html" }); }, "non utilisee"],
  ["duplicate lesson id", (p) => { p.lessons[1].id = p.lessons[0].id; }, "lesson dupliquee"],
  ["incorrect total duration", (p) => { p.estimatedMinutes++; }, "duree totale"],
  ["filename mismatch", (p) => { p.id = "other-pilot"; }, "chemin divergent"],
];

for (const [name, mutate, expected] of invalidCases) {
  it(`rejects ${name}`, (t) => {
    const root = fixture(t);
    const pilot = original();
    mutate(pilot);
    writeFileSync(join(root, PILOT), JSON.stringify(pilot));
    const result = validateEditorial({ root });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((error) => error.includes(expected)), result.errors.join("\n"));
  });
}

it("fails explicitly for malformed JSON and a missing pilot", (t) => {
  const root = fixture(t);
  writeFileSync(join(root, PILOT), "{");
  assert.match(validateEditorial({ root }).errors[0], /editorial:json/);
  rmSync(join(root, PILOT));
  assert.match(validateEditorial({ root }).errors[0], /editorial:missing/);
});

it("sorts file diagnostics ordinally, independently of file creation order", (t) => {
  const root = fixture(t);
  for (const id of ["z-pilot", "a-pilot"]) {
    writeFileSync(join(root, "editorial", "pilots", `${id}.json`), JSON.stringify({ ...original(), id }));
  }
  const result = validateEditorial({ root });
  assert.equal(result.ok, true);
  assert.deepEqual(result.files, [
    "editorial/pilots/a-pilot.json", PILOT, "editorial/pilots/z-pilot.json",
  ]);
});

it("CLI reports success, failure, usage and invalid arguments", (t) => {
  const root = fixture(t);
  const run = (...args) => spawnSync(process.execPath, [
    join(ROOT, "tools", "validate_editorial.mjs"), ...args,
  ], { cwd: root, encoding: "utf8" });
  assert.equal(run("--root", root).status, 0);
  assert.match(run("--help").stdout, /Usage:/);
  assert.match(run("-h").stdout, /Usage:/);
  for (const args of [["--root"], ["--root", "--help"], ["--unknown"]]) {
    assert.equal(run(...args).status, 1);
  }
  writeFileSync(join(root, PILOT), "{}");
  assert.equal(run().status, 1);
  rmSync(join(root, "editorial", "schemas", "editorial-pilot.schema.json"));
  const missingSchema = run();
  assert.equal(missingSchema.status, 1);
  assert.match(missingSchema.stderr, /ENOENT/);
});

it("survives runtime regeneration byte-for-byte without entering content manifests", async (t) => {
  const root = fixture(t);
  cpSync(join(ROOT, "tools", "__fixtures__", "runtime-v3", "content"), join(root, "content"), {
    recursive: true,
  });
  const bytes = readFileSync(join(root, PILOT));
  await materializeRuntime({ root });
  const before = await buildManifest({ root });
  for (let pass = 0; pass < 2; pass++) {
    await materializeRuntime({ root });
    assert.deepEqual(readFileSync(join(root, PILOT)), bytes);
    assert.equal((await materializeRuntime({ root, check: true })).ok, true);
  }
  assert.equal(validateEditorial({ root }).ok, true);
  rmSync(join(root, PILOT));
  assert.deepEqual(await buildManifest({ root }), before);
});

it("does not change any public or private package bytes", async (t) => {
  const root = fixture(t);
  cpSync(join(ROOT, "tools", "__fixtures__", "runtime-v3", "content"), join(root, "content"), {
    recursive: true,
  });
  function snapshot(directory) {
    return readdirSync(directory, { withFileTypes: true })
      .sort((a, b) => compareOrdinal(a.name, b.name))
      .map((entry) => {
        const path = join(directory, entry.name);
        return [entry.name, entry.isDirectory() ? snapshot(path) : readFileSync(path)];
      });
  }
  const before = await packageContent({ root });
  const bytes = snapshot(join(root, "dist"));
  rmSync(join(root, PILOT));
  assert.deepEqual(await packageContent({ root }), before);
  assert.deepEqual(snapshot(join(root, "dist")), bytes);
});
