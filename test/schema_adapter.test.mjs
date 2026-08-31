import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  slugify,
  conceptIdFromQuestionId,
  domainIdFromObjective,
  adaptV3Question,
  adaptV2Question,
  needsAdaptation,
  classifyV2Question,
} from "../tools/lib/schema_adapter.mjs";

describe("schema_adapter", () => {
  describe("slugify", () => {
    it("lowercases and replaces spaces with hyphens", () => {
      assert.equal(slugify("Hello World"), "hello-world");
    });
    it("strips non-alphanumeric characters", () => {
      assert.equal(slugify("A/B (test)"), "a-b-test");
    });
    it("collapses consecutive hyphens", () => {
      assert.equal(slugify("a -- b"), "a-b");
    });
  });

  describe("needsAdaptation", () => {
    it("returns true for v2", () => {
      assert.ok(needsAdaptation({ schemaVersion: "v2" }));
    });
    it("returns true for v3", () => {
      assert.ok(needsAdaptation({ schemaVersion: "v3" }));
    });
    it("returns false for v4", () => {
      assert.ok(!needsAdaptation({ schemaVersion: "v4" }));
    });
  });

  describe("classifyV2Question", () => {
    it("maps az900 prefix", () => {
      assert.equal(classifyV2Question("az900-l-cloud-models-check-1"), "microsoft:az-900");
    });
    it("maps ai901 prefix", () => {
      assert.equal(classifyV2Question("ai901-l-something-check-1"), "microsoft:ai-901");
    });
    it("maps az104-scenario prefix", () => {
      assert.equal(classifyV2Question("az104-scenario-2026-01"), "microsoft:az-104");
    });
    it("returns null for unclassified", () => {
      assert.equal(classifyV2Question("l-core-012bd132-check-1"), null);
    });
    it("returns null for unknown prefix", () => {
      assert.equal(classifyV2Question("ms900-l-something-check-1"), null);
    });
  });

  describe("conceptIdFromQuestionId", () => {
    it("extracts concept from v3 dotted ID", () => {
      const result = conceptIdFromQuestionId("aws.saa-c03.s3-lifecycle-policies-check-1", "aws:saa-c03");
      assert.match(result, /^aws\.saa-c03\.concept\./);
    });
    it("extracts concept from v2 flat ID", () => {
      const result = conceptIdFromQuestionId("az900-l-cloud-models-check-1", "microsoft:az-900");
      assert.match(result, /^microsoft\.az-900\.concept\./);
    });
  });

  describe("domainIdFromObjective", () => {
    it("creates domain from objective slug", () => {
      const result = domainIdFromObjective("microsoft:az-900", "section-1");
      assert.equal(result, "microsoft.az-900.domain.section-1");
    });
  });

  describe("adaptV3Question", () => {
    const v3q = {
      id: "aws.saa-c03.s3-lifecycle-policies-check-1",
      schemaVersion: "v3",
      kind: "public",
      metadata: {
        provider: "aws",
        certification: "aws:saa-c03",
        blueprintVersion: "1.0",
        objective: "design-resilient-architectures",
      },
      prompt: "Which S3 feature?",
      choices: ["Option A", "Option B"],
    };
    const v3sol = { id: "aws.saa-c03.s3-lifecycle-policies-check-1", correct: "Option A", rationale: "test" };

    it("produces a closed v4 payload and reports its source schema", () => {
      const domainId = "aws.saa-c03.domain.design-resilient-architectures";
      const conceptId = "aws.saa-c03.concept.s3-lifecycle-policies";
      const result = adaptV3Question(v3q, v3sol, "aws:saa-c03", "design-resilient-architectures", domainId, conceptId);
      assert.equal(result.question.schemaVersion, "v4");
      assert.equal(result.report.sourceSchema, "v3");
      assert.equal("_sourceSchema" in result.question, false);
      assert.equal(result.question.itemType, "mcq");
      assert.ok(Array.isArray(result.question.options));
      assert.ok(result.question.options[0].id);
      assert.ok(result.question.options[0].label);
      assert.ok(result.question.metadata.domainId);
      assert.ok(result.question.metadata.conceptId);
      assert.equal(result.solution.correctOptionIds[0], result.question.options[0].id);
    });
  });

  describe("adaptV2Question", () => {
    const v2q = {
      id: "az900-l-cloud-models-check-1",
      schemaVersion: "v2",
      kind: "public",
      prompt: "What is IaaS?",
      choices: ["Choice 1", "Choice 2"],
    };
    const v2sol = { id: "az900-l-cloud-models-check-1", correct: "Choice 1", rationale: "test" };

    it("produces a closed v4 payload and reports its source schema", () => {
      const domainId = "microsoft.az-900.domain.section-1";
      const conceptId = conceptIdFromQuestionId(v2q.id, "microsoft:az-900");
      const result = adaptV2Question(v2q, v2sol, "microsoft:az-900", "2026-08-17", "section-1", domainId, conceptId);
      assert.equal(result.question.schemaVersion, "v4");
      assert.equal(result.report.sourceSchema, "v2");
      assert.equal("_sourceSchema" in result.question, false);
      assert.equal(result.question.metadata.certification, "microsoft:az-900");
      assert.ok(result.question.metadata.conceptId.startsWith("microsoft.az-900.concept."));
    });
  });

  describe("determinism", () => {
    it("produces identical output for same input", () => {
      const v2q = {
        id: "az900-l-cloud-models-check-1",
        schemaVersion: "v2",
        kind: "public",
        prompt: "What is IaaS?",
        choices: ["Choice 1", "Choice 2"],
      };
      const v2sol = { id: "az900-l-cloud-models-check-1", correct: "Choice 1", rationale: "test" };
      const domainId = "microsoft.az-900.domain.section-1";
      const conceptId = conceptIdFromQuestionId(v2q.id, "microsoft:az-900");
      const a = adaptV2Question(v2q, v2sol, "microsoft:az-900", "2026-08-17", "section-1", domainId, conceptId);
      const b = adaptV2Question(v2q, v2sol, "microsoft:az-900", "2026-08-17", "section-1", domainId, conceptId);
      assert.deepStrictEqual(a, b);
    });
  });
});
