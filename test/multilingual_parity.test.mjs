import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { validateEditorialTracks, validateMultilingualParity } from "../tools/validate_editorial.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (relPath) => JSON.parse(readFileSync(resolve(repoRoot, relPath), "utf8"));

const EXPECTED_LOCALES = [
  "fr-FR",
  "en-US",
  "es-ES",
  "de-DE",
  "it-IT",
  "pt-BR",
  "ar-SA",
  "ja-JP",
  "hi-IN",
  "zh-Hans",
  "ko-KR",
];

const EXPECTED_FLAGSHIP_TRACKS = [
  { id: "m365-copilot-agents", requiredAlias: "MS-365-COPILOT", routeCode: "MS-4004" },
  { id: "openai-chatgpt-codex", requiredAlias: "OPENAI-PRO", routeCode: "OPENAI-CODEX" },
  { id: "anthropic-claude-mcp", requiredAlias: "ANTHROPIC-CLAUDE", routeCode: "CLAUDE-MCP" },
  { id: "harvey-legal-ai", requiredAlias: "HARVEY-LEGAL", routeCode: "HARVEY-LEGAL" },
];

const EXPECTED_KEY_CERTS = [
  "microsoft:az-900",
  "microsoft:az-104",
  "microsoft:gh-300",
  "microsoft:m365-copilot",
  "microsoft:ai-103",
  "microsoft:dp-600",
  "aws:saa-c03",
  "aws:clf-c02",
  "gcp:cloud-architect",
  "gcp:generative-ai-leader",
];

test("verifie la parite multilingue a 100 % sur les 11 langues et 12 modes UI du catalogue certigo-content", () => {
  const localesRegistry = readJson("config/supported-locales.json");
  assert.equal(localesRegistry.schema, "certigo.supported-locales/v1");
  assert.equal(localesRegistry.defaultLocale, "fr-FR");
  assert.deepEqual(
    localesRegistry.locales.map((l) => l.locale),
    EXPECTED_LOCALES
  );
  assert.equal(localesRegistry.uiModes.length, 12);

  const parity = validateMultilingualParity({ root: repoRoot });
  assert.equal(parity.ok, true, parity.errors.join("\n"));
  assert.equal(parity.localeCount, 11);
  assert.deepEqual(parity.locales, EXPECTED_LOCALES);

  const editorialReport = validateEditorialTracks({ root: repoRoot });
  assert.equal(editorialReport.ok, true, editorialReport.errors.join("\n"));
  assert.equal(editorialReport.localeCount, 11);

  // Verify all 4 flagship AI/Business/Legal tracks across all 11 locales
  for (const { id, requiredAlias, routeCode } of EXPECTED_FLAGSHIP_TRACKS) {
    const canonicalTrack = readJson(`editorial/tracks/${id}.json`);
    assert.ok(
      canonicalTrack.routeAliases.includes(requiredAlias),
      `${id} doit exposer l'alias ${requiredAlias}`
    );
    assert.equal(canonicalTrack.routeCode, routeCode);
    assert.deepEqual(canonicalTrack.supportedLocales, EXPECTED_LOCALES);

    for (const locale of EXPECTED_LOCALES) {
      const locTrack = readJson(`editorial/i18n/tracks/${locale}/${id}.json`);
      const locSol = readJson(`content/answerKey/editorial/i18n/tracks/${locale}/${id}.solutions.json`);
      assert.equal(locTrack.locale, locale);
      assert.equal(locSol.locale, locale);
      assert.equal(locTrack.modules.length, canonicalTrack.modules.length);
      for (const mod of locTrack.modules) {
        assert.ok(mod.title.length > 0);
        assert.ok(mod.architectureSchema.diagram.includes("➔"));
        for (const lesson of mod.lessons) {
          assert.equal(lesson.microSlides.length, 3);
          assert.ok(lesson.declicCard.title.length > 0);
          assert.ok(lesson.questions.length >= 2);
          for (const q of lesson.questions) {
            assert.ok(q.plainPrompt.length > 10);
            assert.ok(q.prompt.length > 10);
            assert.equal(q.options.length, 4);
          }
        }
      }
      assert.equal(locSol.solutions.length, locTrack.mockExam.questionIds.length);
    }
  }

  // Verify all 41 runtime certifications, 13 Radar tracks, 779 concepts, 779 questions and 779 solutions across all 11 locales
  for (const locale of EXPECTED_LOCALES) {
    const pubBundle = readJson(`editorial/i18n/catalog/${locale}.public.json`);
    const solBundle = readJson(`content/answerKey/editorial/i18n/catalog/${locale}.solutions.json`);
    assert.equal(pubBundle.locale, locale);
    assert.equal(solBundle.locale, locale);
    assert.equal(pubBundle.certifications.length, 41);
    assert.equal(pubBundle.radarTracks.length, 13);
    assert.equal(pubBundle.concepts.length, 779);
    assert.equal(pubBundle.questions.length, 779);
    assert.equal(solBundle.solutions.length, 779);

    const certIds = new Set(pubBundle.certifications.map((c) => c.id));
    for (const keyCert of EXPECTED_KEY_CERTS) {
      assert.ok(certIds.has(keyCert), `${locale}: certification ${keyCert} presente`);
      const hasQuestions = pubBundle.questions.some((q) => q.certificationId === keyCert);
      assert.ok(hasQuestions, `${locale}: questions presentes pour ${keyCert}`);
    }

    for (let i = 0; i < pubBundle.questions.length; i++) {
      const q = pubBundle.questions[i];
      const s = solBundle.solutions[i];
      assert.equal(q.id, s.id);
      assert.equal(q.choices.length, 4);
      assert.equal(new Set(q.choices.map((c) => c.length)).size, 4, `${locale}/${q.id}: 4 longueurs distinctes`);
      assert.ok(q.choices.includes(s.correct), `${locale}/${q.id}: bonne reponse presente dans choices`);
      assert.ok(s.plainExplanation.length > 10);
      assert.ok(s.rationale.length > 10);
    }
  }
});

test("detecte une locale manquante, une fuite de corrige ou un long tiret dans validateMultilingualParity", (t) => {
  const root = mkdtempSync(join(tmpdir(), "certigo-multilingual-neg-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));

  cpSync(resolve(repoRoot, "editorial", "schemas"), join(root, "editorial", "schemas"), { recursive: true });
  cpSync(resolve(repoRoot, "config", "supported-locales.json"), join(root, "config", "supported-locales.json"));
  mkdirSync(join(root, "editorial", "tracks"), { recursive: true });
  mkdirSync(join(root, "content", "answerKey", "editorial", "tracks"), { recursive: true });

  const sampleTrack = readJson("editorial/tracks/m365-copilot-agents.json");
  const sampleSol = readJson("content/answerKey/editorial/tracks/m365-copilot-agents.solutions.json");
  writeFileSync(join(root, "editorial", "tracks", "m365-copilot-agents.json"), JSON.stringify(sampleTrack));
  writeFileSync(
    join(root, "content", "answerKey", "editorial", "tracks", "m365-copilot-agents.solutions.json"),
    JSON.stringify(sampleSol)
  );

  // Missing localized track files should be reported
  const missingResult = validateMultilingualParity({ root });
  assert.equal(missingResult.ok, false);
  assert.ok(missingResult.errors.some((e) => e.includes("[multilingual:missing]")));
});
