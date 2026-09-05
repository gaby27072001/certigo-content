import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const expectedDomains = {
  "dop-c02": {
    "domain-1": 5,
    "domain-2": 4,
    "domain-3": 4,
    "domain-4": 4,
    "domain-5": 3,
    "domain-6": 4,
  },
  "aip-c01": {
    "domain-1": 7,
    "domain-2": 6,
    "domain-3": 5,
    "domain-4": 3,
    "domain-5": 3,
  },
  "sap-c02": {
    "domain-1": 6,
    "domain-2": 7,
    "domain-3": 6,
    "domain-4": 5,
  },
};

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function jsonFiles(directory) {
  return readdirSync(directory)
    .filter((file) => file.endsWith(".json"))
    .sort();
}

function contentTokens(text) {
  return new Set(
    (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
      (token) => token.length > 5
    )
  );
}

function overlap(left, right) {
  const shared = [...left].filter((token) => right.has(token)).length;
  const total = new Set([...left, ...right]).size;
  return total === 0 ? 0 : shared / total;
}

test("valide les 72 scenarios de la vague AWS Professional", () => {
  const prompts = new Set();

  for (const [certification, domainCounts] of Object.entries(expectedDomains)) {
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
    const publicFiles = jsonFiles(publicRoot);
    const privateFiles = jsonFiles(privateRoot);

    assert.equal(publicFiles.length, 24, `${certification}: questions publiques`);
    assert.deepEqual(
      privateFiles,
      publicFiles,
      `${certification}: fichiers public/prive en miroir`
    );

    const actualDomainCounts = Object.fromEntries(
      Object.keys(domainCounts).map((domain) => [domain, 0])
    );
    const answerPositions = [0, 0, 0, 0];
    let correctLongestCount = 0;
    let correctHighestOverlapCount = 0;
    let keyedManualCount = 0;
    let distractorManualCount = 0;
    const questionIds = [];

    for (const file of publicFiles) {
      const question = readJson(resolve(publicRoot, file));
      const solution = readJson(resolve(privateRoot, file));

      assert.equal(question.prompt.length >= 300, true, `${file}: scenario trop court`);
      assert.equal(question.choices.length, 4, `${file}: quatre choix requis`);
      assert.equal(
        new Set(question.choices).size,
        4,
        `${file}: choix distincts requis`
      );
      const choiceLengths = question.choices.map((choice) => choice.length);
      assert.equal(
        Math.max(...choiceLengths) / Math.min(...choiceLengths) <= 1.5,
        true,
        `${file}: longueur des choix trop revelatrice`
      );
      for (const choice of question.choices) {
        assert.doesNotMatch(
          choice,
          /\ben (?:supposant|estimant|considerant|acceptant|comptant|se fiant)\b/i,
          `${file}: distracteur auto-disqualifiant`
        );
        assert.doesNotMatch(
          choice,
          /\bce qui (?:laisse|expose|n['’]apporte|ignore|viole|contredit|prolonge|augmente|elimine|delegue)\b|\bqui aurai(?:t|ent)\b/i,
          `${file}: verdict editorial dans un choix`
        );
      }
      assert.equal(prompts.has(question.prompt), false, `${file}: prompt duplique`);
      prompts.add(question.prompt);

      assert.deepEqual(
        solution.metadata,
        question.metadata,
        `${file}: metadata public/prive`
      );
      assert.equal(
        solution.rationale.includes("Sources officielles AWS :"),
        true,
        `${file}: provenance privee absente`
      );
      const urls = solution.rationale.match(/https:\/\/[^\s)]+/g) ?? [];
      assert.equal(urls.length > 0, true, `${file}: URL officielle absente`);
      for (const rawUrl of urls) {
        const host = new URL(rawUrl.replace(/[.,;]+$/, "")).hostname;
        assert.equal(
          ["aws.amazon.com", "docs.aws.amazon.com"].includes(host),
          true,
          `${file}: source non officielle ${host}`
        );
      }

      const answerPosition = question.choices.indexOf(solution.correct);
      assert.notEqual(answerPosition, -1, `${file}: reponse hors choices`);
      answerPositions[answerPosition] += 1;
      if (choiceLengths[answerPosition] === Math.max(...choiceLengths)) {
        correctLongestCount += 1;
      }
      question.choices.forEach((choice, index) => {
        if (!/\bmanuel(?:le)?(?:ment)?\b/i.test(choice)) return;
        if (index === answerPosition) keyedManualCount += 1;
        else distractorManualCount += 1;
      });
      const promptTokens = contentTokens(question.prompt);
      const choiceOverlaps = question.choices.map((choice) =>
        overlap(promptTokens, contentTokens(choice))
      );
      if (choiceOverlaps[answerPosition] === Math.max(...choiceOverlaps)) {
        correctHighestOverlapCount += 1;
      }
      if (certification === "aip-c01") {
        const bestDistractorOverlap = Math.max(
          ...choiceOverlaps.filter((_, index) => index !== answerPosition)
        );
        assert.equal(
          choiceOverlaps[answerPosition] <= bestDistractorOverlap * 1.5,
          true,
          `${file}: reponse trop proche lexicalement du prompt`
        );
      }
      actualDomainCounts[question.metadata.objective] += 1;
      questionIds.push(question.id);
    }

    assert.deepEqual(
      actualDomainCounts,
      domainCounts,
      `${certification}: allocation par ponderation`
    );
    assert.deepEqual(
      answerPositions,
      [6, 6, 6, 6],
      `${certification}: positions de reponse equilibrees`
    );
    assert.equal(
      correctLongestCount >= 4 && correctLongestCount <= 10,
      true,
      `${certification}: longueur de la reponse correcte trop predictive`
    );
    if (certification === "aip-c01") {
      assert.equal(
        correctHighestOverlapCount <= 10,
        true,
        `${certification}: recopie lexicale du prompt trop predictive`
      );
    }
    assert.equal(
      keyedManualCount === 0 && distractorManualCount > 0,
      false,
      `${certification}: vocabulaire manuel reserve aux distracteurs`
    );

    const matrix = readJson(
      resolve(
        repoRoot,
        "content",
        "public",
        "coverage",
        "aws",
        `${certification}.json`
      )
    );
    // Une matrice entierement redigee vaut "complete", sauf si le catalogue
    // declare la certification en retrait : validate_content exige alors
    // "retiring". L'attente est derivee du catalogue plutot que codee en dur,
    // pour que le test controle la coherence reelle et non une forme figee.
    const catalogEntry = readJson(
      resolve(repoRoot, "content", "public", "catalog", "certifications.json")
    ).certifications.find((entry) => entry.id === `aws:${certification}`);
    const expectedMatrixStatus =
      catalogEntry.status === "active-retiring" ? "retiring" : "complete";
    assert.equal(
      matrix.status,
      expectedMatrixStatus,
      `${certification}: matrice ${expectedMatrixStatus}`
    );
    assert.deepEqual(
      matrix.objectives.flatMap((objective) => objective.questionIds).sort(),
      questionIds.sort(),
      `${certification}: bijection matrice/questions`
    );
  }

  assert.equal(prompts.size, 72);
});
