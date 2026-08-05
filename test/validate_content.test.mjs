import assert from "node:assert/strict";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import { validateContent } from "../tools/validate_content.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const temporaryRoots = [];

function createRoot() {
  const root = mkdtempSync(join(tmpdir(), "certigo-content-"));
  temporaryRoots.push(root);
  cpSync(resolve(repoRoot, "schemas"), resolve(root, "schemas"), { recursive: true });
  mkdirSync(resolve(root, "content", "public", "questions"), { recursive: true });
  mkdirSync(resolve(root, "content", "answerKey", "solutions"), { recursive: true });
  return root;
}

function publicQuestion(id, extra = {}) {
  return {
    id,
    schemaVersion: "v2",
    kind: "public",
    prompt: `Question ${id}`,
    choices: ["A", "B"],
    ...extra,
  };
}

function solution(id) {
  return {
    id,
    schemaVersion: "v2",
    kind: "answerKey",
    correct: "A",
    rationale: `Rationale ${id}`,
  };
}

function writeJson(root, relativePath, value, { bom = false } = {}) {
  const path = resolve(root, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${bom ? "\ufeff" : ""}${JSON.stringify(value, null, 2)}\n`);
}

function writePair(root, id, options = {}) {
  writeJson(
    root,
    `content/public/questions/${options.publicFile ?? id}.json`,
    publicQuestion(id, options.publicExtra),
    { bom: options.bom }
  );
  writeJson(
    root,
    `content/answerKey/solutions/${options.solutionFile ?? id}.json`,
    solution(id)
  );
}

afterEach(() => {
  while (temporaryRoots.length > 0) {
    rmSync(temporaryRoots.pop(), { recursive: true, force: true });
  }
});

test("accepte un BOM UTF-8 en tete d'une question valide", async () => {
  const root = createRoot();
  writePair(root, "bom", { bom: true });

  const result = await validateContent({ root });

  assert.deepEqual(result.errors, []);
  assert.equal(result.pairCount, 1);
});

test("signale un JSON invalide avec le chemin du fichier", async () => {
  const root = createRoot();
  writeFileSync(resolve(root, "content", "public", "questions", "broken.json"), "{");

  const result = await validateContent({ root });

  assert.ok(
    result.errors.some(
      (error) => error.includes("[schema:question]") && error.includes("JSON invalide")
    )
  );
});

test("rejette les identifiants dupliques dans les deux canaux", async () => {
  const root = createRoot();
  writePair(root, "duplicate", { publicFile: "public-first", solutionFile: "private-first" });
  writeJson(
    root,
    "content/public/questions/public-second.json",
    publicQuestion("duplicate")
  );
  writeJson(
    root,
    "content/answerKey/solutions/private-second.json",
    solution("duplicate")
  );

  const result = await validateContent({ root });

  assert.ok(result.errors.some((error) => error.includes('id public duplique "duplicate"')));
  assert.ok(result.errors.some((error) => error.includes('id answerKey duplique "duplicate"')));
});

test("signale les orphelins des deux canaux", async () => {
  const root = createRoot();
  writeJson(root, "content/public/questions/public-only.json", publicQuestion("public-only"));
  writeJson(root, "content/answerKey/solutions/private-only.json", solution("private-only"));

  const result = await validateContent({ root });

  assert.ok(result.errors.some((error) => error.includes('"public-only"') && error.includes("SANS solution")));
  assert.ok(result.errors.some((error) => error.includes('"private-only"') && error.includes("SANS question")));
});

test("detecte une fuite de corrige dans un payload public", async () => {
  const root = createRoot();
  writePair(root, "leak", { publicExtra: { correct: "A" } });

  const result = await validateContent({ root });

  assert.ok(result.errors.some((error) => error.includes("[anti-leak]") && error.includes('"correct"')));
});
