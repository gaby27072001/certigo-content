import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import { canonicalize } from "../tools/gen_manifest.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const suiteRoot = resolve(repoRoot, "test/fixtures/apple-compat/v1");
const outcomes = readJson(resolve(suiteRoot, "expected-outcomes.json"));
const sourceSchema = readJson(resolve(repoRoot, "schemas/question.schema.json"));
const backendSchema = readJson(
  resolve(repoRoot, "config/backend-accepted-schemas/question.schema.json")
);
const sourceValidator = new Ajv2020({ allErrors: true, strict: true }).compile(
  sourceSchema
);
const backendValidator = new Ajv2020({ allErrors: true, strict: true }).compile(
  backendSchema
);

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function readFixture(relativePath) {
  return readJson(resolve(suiteRoot, relativePath));
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function forbiddenAnswerKeys(value, path = "$") {
  const forbidden = new Set([
    "correct",
    "correctOptionIds",
    "explanation",
    "pairs",
    "rationale",
  ]);
  const findings = [];

  function walk(node, currentPath) {
    if (Array.isArray(node)) {
      node.forEach((child, index) => walk(child, `${currentPath}[${index}]`));
      return;
    }
    if (node === null || typeof node !== "object") return;
    for (const [key, child] of Object.entries(node)) {
      const childPath = `${currentPath}.${key}`;
      if (forbidden.has(key)) findings.push(childPath);
      walk(child, childPath);
    }
  }

  walk(value, path);
  return findings;
}

test("Apple compatibility v1 fixtures match source and pinned backend question schemas", () => {
  assert.equal(outcomes.suite, "certigo.apple-compat/v1");
  assert.deepEqual(
    outcomes.vectors.map((vector) => vector.file),
    [
      "supported/question-v3.json",
      "supported/question-v4-mcq.json",
      "capability-probes/question-v4-spot-the-issue.json",
    ]
  );

  for (const vector of outcomes.vectors) {
    const question = readFixture(vector.file);
    assert.equal(question.schemaVersion, vector.schemaVersion, vector.file);
    assert.equal(sourceValidator(question), true, JSON.stringify(sourceValidator.errors));
    assert.equal(backendValidator(question), true, JSON.stringify(backendValidator.errors));
    assert.deepEqual(forbiddenAnswerKeys(question), [], vector.file);

    const canonicalBody = Buffer.from(canonicalize(question), "utf8");
    const packageFile = Buffer.from(`${canonicalize(question)}\n`, "utf8");
    assert.deepEqual(
      {
        size: canonicalBody.byteLength,
        sha256: sha256(canonicalBody),
      },
      vector.payloadDigests.canonicalBody,
      `${vector.file}: canonical body uses no LF`
    );
    assert.deepEqual(
      {
        size: packageFile.byteLength,
        sha256: sha256(packageFile),
      },
      vector.payloadDigests.packageFile,
      `${vector.file}: package payload bytes include one LF`
    );
  }
});

test("a schema-valid item outside the Apple profile is unsupported capability, not malformed", () => {
  const vector = outcomes.vectors.find((entry) =>
    entry.file.endsWith("question-v4-spot-the-issue.json")
  );
  const question = readFixture(vector.file);

  assert.equal(sourceValidator(question), true);
  assert.equal(backendValidator(question), true);
  assert.equal(vector.contract, "valid");
  assert.equal(vector.client, "unsupported-capability");
  assert.equal(vector.notMalformed, true);
  assert.equal(vector.profile, outcomes.capabilityProfile.id);
  assert.ok(
    !outcomes.capabilityProfile.supportedItemTypes.includes(question.itemType)
  );
});

test("negative mutations have explicit malformed outcomes and never become stored fixtures", () => {
  const source = readFixture("supported/question-v4-mcq.json");
  const backendSource = structuredClone(source);
  const negativeById = new Map(outcomes.negativeCases.map((entry) => [entry.id, entry]));
  const unknownProperty = structuredClone(source);
  unknownProperty[negativeById.get("unknown-property").mutation.addProperty] = true;
  const answerLeak = structuredClone(source);
  answerLeak[
    negativeById.get("answer-bearing-property").mutation.addForbiddenProperty
  ] = ["fixture-only-sentinel"];

  for (const [caseId, mutation] of [
    ["unknown-property", unknownProperty],
    ["answer-bearing-property", answerLeak],
  ]) {
    const expected = negativeById.get(caseId);
    assert.equal(expected.expected, "malformed");
    assert.equal(sourceValidator(mutation), expected.schemaValid);
    assert.equal(backendValidator(mutation), expected.schemaValid);
  }
  assert.deepEqual(forbiddenAnswerKeys(backendSource), []);
  assert.deepEqual(forbiddenAnswerKeys(answerLeak), [
    "$.correctOptionIds",
  ]);
});
