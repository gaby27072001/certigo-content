// Versioned v2/v3 → v4 adapters for the runtime compiler.
// Preserves sourceSchema + provenance in adapted output without
// mutating any source file on disk.

import { createHash } from "node:crypto";

/** Deterministic slug from a free-text string. */
export function slugify(text) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/** Deterministic short hash for choice option IDs. */
function choiceHash(text) {
  return createHash("sha256")
    .update(text, "utf8")
    .digest("hex")
    .slice(0, 8);
}

/** Generate a stable option ID from a choice string. */
function optionId(choice) {
  const slug = slugify(choice);
  const prefix = slug.length > 0 ? slug.slice(0, 39) : "option";
  return `${prefix}-${choiceHash(choice)}`;
}

/**
 * Derive a concept ID from a question ID.
 * e.g. "aws.clf-c02.domain-1.cloud-value.001" → "aws.clf-c02.concept.cloud-value"
 */
export function conceptIdFromQuestionId(questionId, certificationId) {
  const parts = questionId.split(".");
  const provider = certificationId.split(":")[0];
  const slug = certificationId.split(":")[1];
  // For v3 IDs like "aws.clf-c02.domain-1.cloud-value.001", descriptive part is index 3
  // For v2 IDs like "az900-l-cloud-models-check-1", derive differently
  if (parts.length >= 5) {
    return `${provider}.${slug}.concept.${parts[3]}`;
  }
  // v2 fallback: extract descriptive part from flat ID
  const match = questionId.match(/^[a-z0-9]+-l-(.+)-check-\d+$/);
  if (match) return `${provider}.${slug}.concept.${match[1]}`;
  return `${provider}.${slug}.concept.${slugify(questionId)}`;
}

/**
 * Derive a domain ID from certification and objective.
 */
export function domainIdFromObjective(certificationId, objectiveId) {
  const provider = certificationId.split(":")[0];
  const slug = certificationId.split(":")[1];
  return `${provider}.${slug}.domain.${objectiveId}`;
}

/** Adapter report entry. */
function adapterReport(sourceSchema, adaptedFields) {
  return { sourceSchema, adaptedFields };
}

/**
 * Adapt a v3 question + solution pair to the v4 shape expected by the compiler.
 * Returns { question, solution, adapterReport }.
 */
export function adaptV3Question(question, solution, certificationId, objectiveId, coverageDomainId, coverageConceptId) {
  const options = question.choices.map((choice) => ({
    id: optionId(choice),
    label: choice,
  }));

  const correctChoice = solution.correct;
  const correctOption = options.find((opt) => opt.label === correctChoice);
  if (!correctOption) {
    throw new Error(
      `[adapter:v3] ${question.id}: correct choice not found in options`
    );
  }

  const adaptedQuestion = {
    id: question.id,
    schemaVersion: "v4",
    kind: "public",
    metadata: {
      ...question.metadata,
      domainId: coverageDomainId,
      conceptId: coverageConceptId,
    },
    itemType: "mcq",
    difficulty: 2,
    prompt: question.prompt,
    options,
  };

  const adaptedSolution = {
    id: solution.id,
    schemaVersion: "v4",
    kind: "answerKey",
    correctOptionIds: [correctOption.id],
    rationale: solution.rationale,
  };

  return {
    question: adaptedQuestion,
    solution: adaptedSolution,
    report: adapterReport("v3", ["itemType", "options", "correctOptionIds", "domainId", "conceptId"]),
  };
}

/**
 * Adapt a v2 question + solution pair to the v4 shape.
 * v2 has no metadata; certification/objective must be externally provided.
 */
export function adaptV2Question(
  question,
  solution,
  certificationId,
  blueprintVersion,
  objectiveId,
  domainId,
  conceptId
) {
  const options = question.choices.map((choice) => ({
    id: optionId(choice),
    label: choice,
  }));

  const correctChoice = solution.correct;
  const correctOption = options.find((opt) => opt.label === correctChoice);
  if (!correctOption) {
    throw new Error(
      `[adapter:v2] ${question.id}: correct choice not found in options`
    );
  }

  const provider = certificationId.split(":")[0];
  const slug = certificationId.split(":")[1];

  const adaptedQuestion = {
    id: question.id,
    schemaVersion: "v4",
    kind: "public",
    metadata: {
      provider,
      certification: certificationId,
      blueprintVersion,
      objective: objectiveId,
      domainId,
      conceptId,
    },
    itemType: "mcq",
    difficulty: 2,
    prompt: question.prompt,
    options,
  };

  const adaptedSolution = {
    id: solution.id,
    schemaVersion: "v4",
    kind: "answerKey",
    correctOptionIds: [correctOption.id],
    rationale: solution.rationale,
  };

  return {
    question: adaptedQuestion,
    solution: adaptedSolution,
    report: adapterReport("v2", ["metadata", "itemType", "options", "correctOptionIds", "domainId", "conceptId"]),
  };
}

/**
 * Check whether a question needs adaptation.
 */
export function needsAdaptation(question) {
  return question.schemaVersion === "v2" || question.schemaVersion === "v3";
}

/**
 * Detect which certification a v2 flat question belongs to (from ID prefix).
 * Returns null for unclassifiable questions.
 */
export function classifyV2Question(questionId) {
  const prefixMap = [
    { prefix: "ai901-l-", certification: "microsoft:ai-901" },
    { prefix: "ai900-l-", certification: "microsoft:ai-900" },
    { prefix: "az104-l-", certification: "microsoft:az-104" },
    { prefix: "az104-scenario-", certification: "microsoft:az-104" },
    { prefix: "az900-l-", certification: "microsoft:az-900" },
    { prefix: "dp900-l-", certification: "microsoft:dp-900" },
    { prefix: "sc900-l-", certification: "microsoft:sc-900" },
  ];
  for (const { prefix, certification } of prefixMap) {
    if (questionId.startsWith(prefix)) return certification;
  }
  return null;
}
