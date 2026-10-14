import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { buildAppleUiFixtures } from "../tools/apple_ui_fixtures.mjs";
import { inspectPublicArtifact } from "../tools/package_content.mjs";

const root = resolve(import.meta.dirname, "..");
const fixtureRoot = resolve(root, "test/fixtures/apple-ui/v1");

test("real Apple UI samples preserve compiler mapping and public canonical resource contracts", async () => {
  const generated = await buildAppleUiFixtures(root);
  const ajv = new Ajv2020({ strict: true });
  addFormats(ajv);
  const read = (path) => JSON.parse(readFileSync(path, "utf8"));
  const questionSchema = ajv.compile(read(resolve(root, "schemas/question.schema.json")));
  const runtimeSchema = ajv.compile(read(resolve(root, "schemas/runtime-resource.schema.json")));
  for (const [path, bytes] of generated) {
    assert.equal(readFileSync(resolve(fixtureRoot, path), "utf8").replaceAll("\r\n", "\n"), bytes, path);
    const data = JSON.parse(bytes);
    if (path.endsWith("/question.json")) assert.ok(questionSchema(data), path);
    if (/\/(track|domain|concept)\.json$/.test(path)) assert.ok(runtimeSchema(data), path);
  }
  inspectPublicArtifact(fixtureRoot);
  const index = read(resolve(fixtureRoot, "index.json"));
  assert.deepEqual(index.inventory.trackModes, ["questionBank"]);
  assert.equal(index.inventory.canonicalUnitCount, 0);
  assert.equal(index.inventory.canonicalLessonCount, 0);
  assert.equal(index.entries.length, 3);
  for (const entry of index.entries) {
    const question = read(resolve(fixtureRoot, entry.directory, "question.json"));
    const check = read(resolve(fixtureRoot, entry.directory, "compiled-check.json"));
    assert.equal(check.id, question.id);
    assert.equal(check.stem, question.prompt);
    assert.deepEqual(check.options.map((option) => option.label), question.choices);
    assert.equal(new Set(entry.optionIds).size, question.choices.length);
  }
  const texts = index.entries.map((entry) =>
    read(resolve(fixtureRoot, entry.directory, "question.json")).prompt);
  assert.ok(texts.some((text) => text.length > 1000), "long scrollable stem");
  assert.ok(texts.some((text) => /[éèà’]/u.test(text)), "non-ASCII text preserved");
});
