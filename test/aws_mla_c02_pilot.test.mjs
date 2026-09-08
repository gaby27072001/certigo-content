import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const certification = "mla-c02";
const expectedDomainCounts = {
  "domain-1": 2,
  "domain-2": 2,
  "domain-3": 2,
  "domain-4": 2,
};

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function jsonFiles(directory) {
  return readdirSync(directory)
    .filter((file) => file.endsWith(".json"))
    .sort();
}

test("valide le lot pilote de 8 questions AWS MLA-C02", () => {
  const publicRoot = resolve(
    repoRoot,
    "content",
    "public",
    "questions",
    "aws",
    certification
  );
  const privateRoot = resolve(
    repoRoot,
    "content",
    "answerKey",
    "solutions",
    "aws",
    certification
  );
  const coveragePath = resolve(
    repoRoot,
    "content",
    "public",
    "coverage",
    "aws",
    `${certification}.json`
  );

  const publicFiles = jsonFiles(publicRoot);
  const privateFiles = jsonFiles(privateRoot);

  assert.equal(publicFiles.length, 8, "8 questions publiques attendues pour le pilote");
  assert.deepEqual(privateFiles, publicFiles, "fichiers public/prive en miroir");

  const coverage = readJson(coveragePath);
  assert.equal(coverage.status, "in-progress", "matrice pilote non complete");
  assert.equal(coverage.certification, "aws:mla-c02");

  const prompts = new Set();
  const actualDomainCounts = Object.fromEntries(
    Object.keys(expectedDomainCounts).map((domain) => [domain, 0])
  );
  const answerPositions = [0, 0, 0, 0];
  const lengthRanks = [0, 0, 0, 0];
  const questionIds = [];

  for (const file of publicFiles) {
    const question = readJson(resolve(publicRoot, file));
    const solution = readJson(resolve(privateRoot, file));

    assert.equal(question.prompt.length >= 300, true, `${file}: scenario trop court`);
    assert.equal(question.choices.length, 4, `${file}: quatre choix requis`);
    assert.equal(new Set(question.choices).size, 4, `${file}: choix distincts requis`);

    const choiceLengths = question.choices.map((choice) => choice.length);
    assert.equal(
      new Set(choiceLengths).size,
      4,
      `${file}: longueurs de choix distinctes requises`
    );
    assert.equal(
      Math.max(...choiceLengths) / Math.min(...choiceLengths) <= 1.5,
      true,
      `${file}: longueur des choix trop revelatrice`
    );

    assert.equal(prompts.has(question.prompt), false, `${file}: prompt duplique`);
    prompts.add(question.prompt);

    assert.deepEqual(solution.metadata, question.metadata, `${file}: metadata public/prive`);
    assert.equal(question.id, solution.id, `${file}: id public/prive`);

    const answerPosition = question.choices.indexOf(solution.correct);
    assert.notEqual(answerPosition, -1, `${file}: reponse hors choices`);
    answerPositions[answerPosition] += 1;

    const sortedLengths = [...choiceLengths].sort((left, right) => left - right);
    const rank = sortedLengths.indexOf(choiceLengths[answerPosition]);
    lengthRanks[rank] += 1;

    assert.equal(
      solution.rationale.includes("Sources officielles AWS :"),
      true,
      `${file}: citation de provenance absente de la rationale`
    );
    assert.equal(
      Array.isArray(solution.provenance) && solution.provenance.length > 0,
      true,
      `${file}: champ provenance manquant`
    );
    for (const url of solution.provenance) {
      const host = new URL(url).hostname;
      assert.equal(
        ["aws.amazon.com", "docs.aws.amazon.com"].includes(host),
        true,
        `${file}: source de provenance non officielle ${host}`
      );
    }
    const rationaleUrls = solution.rationale.match(/https:\/\/[^\s]+/g) ?? [];
    assert.equal(rationaleUrls.length > 0, true, `${file}: URL officielle absente de la rationale`);
    for (const rawUrl of rationaleUrls) {
      const host = new URL(rawUrl.replace(/[.,;]+$/, "")).hostname;
      assert.equal(
        ["aws.amazon.com", "docs.aws.amazon.com"].includes(host),
        true,
        `${file}: source non officielle ${host} dans la rationale`
      );
    }

    actualDomainCounts[question.metadata.objective] += 1;
    questionIds.push(question.id);
  }

  assert.deepEqual(
    actualDomainCounts,
    expectedDomainCounts,
    `${certification}: allocation 2 par domaine attendue pour le pilote`
  );
  assert.deepEqual(
    answerPositions,
    [2, 2, 2, 2],
    `${certification}: positions de reponse equilibrees 2/2/2/2`
  );
  assert.deepEqual(
    lengthRanks,
    [2, 2, 2, 2],
    `${certification}: rangs de longueur de la reponse correcte equilibres 2/2/2/2`
  );

  const coverageQuestionIds = coverage.objectives.flatMap((objective) => objective.questionIds);
  assert.deepEqual(
    [...coverageQuestionIds].sort(),
    [...questionIds].sort(),
    `${certification}: matrice et fichiers de questions doivent correspondre exactement`
  );
});
