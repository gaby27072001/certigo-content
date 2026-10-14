import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { glob } from "glob";
import { compileRuntime } from "./compile_runtime.mjs";
import { canonicalize, sha256Hex } from "./gen_manifest.mjs";
import { conceptIdFromQuestionId, domainIdFromObjective } from "./lib/schema_adapter.mjs";

const sourceRevision = "e60aba76b5b84677c4f891fb8dd660cdf8d3202c";
const samples = [
  ["microsoft", "az-104", "microsoft.az-104.section-1.az104-scenario-2026-06.001"],
  ["aws", "aip-c01", "aws.aip-c01.domain-5.retrieval-drift-troubleshooting-embeddings.002"],
  ["gcp", "machine-learning-engineer", "gcp.machine-learning-engineer.section-3.maintenance-capteurs-industriels.008"],
];
const suiteDirectory = "test/fixtures/apple-ui/v1";
const readJson = (path) => JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));

export async function buildAppleUiFixtures(root) {
  const files = new Map();
  const entries = [];
  const catalog = readJson(resolve(root, "content/public/catalog/certifications.json"));
  const publicQuestions = await glob("content/public/questions/**/*.json", { cwd: root });
  const tracks = await glob("content/public/runtime/tracks/**/*.json", { cwd: root });
  const inventory = {
    questionCount: publicQuestions.length,
    trackCount: tracks.length,
    trackModes: [...new Set(tracks.map((path) => readJson(resolve(root, path)).mode))].sort(),
    domainCount: (await glob("content/public/runtime/domains/**/*.json", { cwd: root })).length,
    conceptCount: (await glob("content/public/runtime/concepts/**/*.json", { cwd: root })).length,
    canonicalUnitCount: (await glob("content/public/runtime/units/**/*.json", { cwd: root })).length,
    canonicalLessonCount: (await glob("content/public/runtime/lessons/**/*.json", { cwd: root })).length,
    catalogAsOf: catalog.asOf,
  };
  mkdirSync(resolve(root, "dist"), { recursive: true });
  const temporary = mkdtempSync(resolve(root, "dist", "apple-ui-"));
  try {
    await compileRuntime({ root, outDir: temporary });
    const documents = readdirSync(resolve(temporary, "public")).map((name) =>
      readJson(resolve(temporary, "public", name))
    );
    function addFixture(path, value) {
      files.set(path, `${canonicalize(value)}\n`);
    }
    function pinnedPublicSource(sourcePath) {
      const data = readJson(resolve(root, sourcePath));
      const blob = execFileSync("git", ["-c", "core.longpaths=true", "show", `${sourceRevision}:${sourcePath}`], {
        cwd: root, encoding: "utf8",
      });
      if (canonicalize(data) !== canonicalize(JSON.parse(blob.replace(/^\uFEFF/, "")))) {
        throw new Error(`Fixture source diverges from pinned revision: ${sourcePath}`);
      }
      return data;
    }
    for (const [provider, slug, questionId] of samples) {
      const sourcePath = `content/public/questions/${provider}/${slug}/${questionId}.json`;
      const question = pinnedPublicSource(sourcePath);
      const certificationId = question.metadata.certification;
      const domainId = domainIdFromObjective(certificationId, question.metadata.objective);
      const conceptId = conceptIdFromQuestionId(questionId, certificationId);
      const trackPath = `content/public/runtime/tracks/${provider}/${slug}/${provider}.${slug}.track.main.json`;
      const domainPath = `content/public/runtime/domains/${provider}/${slug}/${domainId}.json`;
      const conceptPath = `content/public/runtime/concepts/${provider}/${slug}/${conceptId}.json`;
      const track = pinnedPublicSource(trackPath);
      const lesson = documents.find((document) =>
        document.type === "lesson" && document.blocks.some((block) => block.check?.id === questionId)
      );
      if (!lesson) throw new Error(`No actual compiler lesson for ${questionId}`);
      const publicCheck = lesson.blocks.find((block) => block.check?.id === questionId).check;
      const prefix = `${provider}-${slug}`;
      addFixture(`${prefix}/question.json`, question);
      addFixture(`${prefix}/track.json`, track);
      addFixture(`${prefix}/domain.json`, pinnedPublicSource(domainPath));
      addFixture(`${prefix}/concept.json`, pinnedPublicSource(conceptPath));
      addFixture(`${prefix}/compiled-check.json`, publicCheck);
      entries.push({
        directory: prefix, sourcePath, questionId, certificationId, domainId, conceptId,
        sourceRevision, sourceResourcePaths: { track: trackPath, domain: domainPath, concept: conceptPath },
        trackId: lesson.trackId, unitId: lesson.unitId, lessonId: lesson.lessonId,
        checkId: publicCheck.id,
        optionIds: publicCheck.options.map((option) => option.id),
        capability: "mcq",
        mappingEvidence: "tools/compile_runtime.mjs public output; not a live backend session",
      });
    }
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
  const payloads = [...files].map(([path, bytes]) => ({
    path, packageFileSize: Buffer.byteLength(bytes, "utf8"), packageFileSha256: sha256Hex(bytes),
    canonicalBodySize: Buffer.byteLength(bytes.slice(0, -1), "utf8"),
    canonicalBodySha256: sha256Hex(bytes.slice(0, -1)),
  }));
  files.set("index.json", `${canonicalize({
    suite: "certigo.apple-ui/v1", inventory, entries, payloads,
    releaseBinding: "not supplied: obtain active release/publicManifestId and lesson/session mapping from backend",
  })}\n`);
  return files;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--check")) throw new Error("Usage: node tools/apple_ui_fixtures.mjs [--check]");
  const root = resolve(".");
  const files = await buildAppleUiFixtures(root);
  for (const [path, bytes] of files) {
    const target = resolve(root, suiteDirectory, path);
    if (args.includes("--check")) {
      if (readFileSync(target, "utf8").replaceAll("\r\n", "\n") !== bytes) {
        throw new Error(`Fixture drift: ${path}`);
      }
    } else {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, bytes, "utf8");
    }
  }
  console.log(`[apple-ui] ${files.size} public fixtures ${args.includes("--check") ? "verified" : "generated"}`);
}
