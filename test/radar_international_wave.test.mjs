import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { validateRadarTracks, validateRegistry } from "../tools/lib/content_radar.mjs";
import { validateCatalog } from "../tools/validate_catalog.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

const expectedMicrosoftRadarWave = [
  "ai-103",
  "dp-600",
  "gh-100",
  "gh-200",
  "gh-300",
  "gh-500",
  "gh-900",
];

const expectedInternationalRadarTracks = [
  "anthropic:claude-human-agent-teams",
  "apple:apple-device-support",
  "comptia:security-plus-sy0-701",
  "databricks:genai-engineer-associate",
  "github:gh-300",
  "hashicorp:terraform-associate-004",
  "linux-foundation-cncf:cka",
  "openai:academy-ai-foundations",
  "snowflake:snowpro-core-cof-c03",
];

test("valide la premiere vague de 7 pistes Microsoft/GitHub/AI/Fabric dans le catalogue runtime", () => {
  const catalog = readJson(resolve(repoRoot, "content/public/catalog/certifications.json"));

  for (const slug of expectedMicrosoftRadarWave) {
    const id = `microsoft:${slug}`;
    const entry = catalog.certifications.find((c) => c.id === id);
    assert.ok(entry, `certification absente du catalogue: ${id}`);
    assert.equal(entry.status, "active");
    assert.equal(entry.provenance.checkedOn, "2026-10-21");
    assert.equal(entry.lifecycle.transition, "none-announced");

    const publicDir = resolve(repoRoot, "content/public/questions/microsoft", slug);
    const privateDir = resolve(repoRoot, "content/answerKey/solutions/microsoft", slug);
    const coveragePath = resolve(repoRoot, "content/public/coverage/microsoft", `${slug}.json`);

    const publicFiles = readdirSync(publicDir).filter((f) => f.endsWith(".json")).sort();
    const privateFiles = readdirSync(privateDir).filter((f) => f.endsWith(".json")).sort();
    const expectedCount = Math.max(4, entry.blueprint.objectives.length);
    assert.equal(publicFiles.length, expectedCount, `${id}: ${expectedCount} questions attendues`);
    assert.deepEqual(privateFiles, publicFiles, `${id}: parite public/prive`);

    const coverage = readJson(coveragePath);
    assert.equal(coverage.status, "in-progress");
    assert.equal(coverage.certification, id);
    for (const objective of coverage.objectives) {
      assert.ok(
        objective.questionIds.length >= 1,
        `${id}/${objective.objective}: chaque domaine distribuable doit avoir au moins une question`
      );
    }

    const positions = [0, 0, 0, 0];
    const ranks = [0, 0, 0, 0];
    for (const file of publicFiles) {
      const q = readJson(resolve(publicDir, file));
      const s = readJson(resolve(privateDir, file));
      assert.equal(q.choices.length, 4);
      const lengths = q.choices.map((c) => c.length);
      assert.equal(new Set(lengths).size, 4, `${file}: longueurs distinctes requises`);
      const pos = q.choices.indexOf(s.correct);
      assert.notEqual(pos, -1, `${file}: bonne reponse presente dans choices`);
      positions[pos]++;
      const sorted = [...lengths].sort((a, b) => a - b);
      ranks[sorted.indexOf(lengths[pos])]++;
      for (const url of s.provenance) {
        assert.equal(new URL(url).hostname, "learn.microsoft.com");
      }
    }
    const minPerBucket = Math.floor(publicFiles.length / 4);
    const maxPerBucket = Math.ceil(publicFiles.length / 4);
    assert.ok(
      positions.every((c) => c >= minPerBucket && c <= maxPerBucket),
      `${id}: equilibre des positions ${positions.join("/")}`
    );
    assert.ok(
      ranks.every((c) => c >= minPerBucket && c <= maxPerBucket),
      `${id}: equilibre des rangs ${ranks.join("/")}`
    );
  }
});

test("valide les 9 pistes phares internationales du Radar 35 fournisseurs et validate_catalog.mjs", async () => {
  const registry = validateRegistry(readJson(resolve(repoRoot, "config/content-radar-sources.json")));
  const tracksCatalog = readJson(resolve(repoRoot, "config/content-radar-tracks.json"));
  const runtimeCatalog = readJson(resolve(repoRoot, "content/public/catalog/certifications.json"));

  const validated = validateRadarTracks(registry, tracksCatalog, {
    runtimeCatalog,
    asOf: "2026-10-21",
  });
  assert.deepEqual(
    validated.tracks.map((t) => t.id),
    expectedInternationalRadarTracks
  );
  assert.equal(validated.asOf, "2026-10-21");
  assert.equal(validated.freshness.reviewDueOn, "2026-11-20");

  const report = await validateCatalog({ root: repoRoot, asOf: "2026-10-21" });
  assert.equal(report.ok, true, report.errors.join("\n"));
  assert.equal(report.certificationCount, 40);
  assert.equal(report.activeCertificationCount, 38);
  assert.equal(report.recommendedCertificationCount, 37);
  assert.equal(report.radarProviderCount, 35);
  assert.equal(report.radarTrackCount, 9);
});
