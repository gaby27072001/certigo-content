import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compileRuntime } from "../tools/compile_runtime.mjs";
import { materializeRuntime } from "../tools/materialize_runtime.mjs";
import { validateContent } from "../tools/validate_content.mjs";

const ROOT = join(import.meta.dirname, "..");

function snapshotDirectory(directory) {
  const snapshot = {};
  const walk = (current, prefix = "") => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      const absolute = join(current, entry.name);
      if (entry.isDirectory()) walk(absolute, relative);
      else snapshot[relative] = readFileSync(absolute).toString("base64");
    }
  };
  walk(directory);
  return snapshot;
}

describe("materialize_runtime", () => {
  it("--check passes against committed runtime resources", () => {
    execFileSync("node", ["tools/materialize_runtime.mjs", "--check"], {
      cwd: ROOT,
      stdio: "pipe",
    });
  });

  it("is idempotent (second run produces no changes)", async () => {
    const temporaryRoot = mkdtempSync(join(tmpdir(), "certigo-runtime-materialize-"));
    cpSync(join(ROOT, "content"), join(temporaryRoot, "content"), {
      recursive: true,
    });
    execFileSync("node", ["tools/materialize_runtime.mjs", "--root", temporaryRoot], {
      cwd: ROOT,
      stdio: "pipe",
    });
    execFileSync("node", [
      "tools/materialize_runtime.mjs",
      "--root",
      temporaryRoot,
      "--check",
    ], {
      cwd: ROOT,
      stdio: "pipe",
    });
    const trackPath = join(
      temporaryRoot,
      "content/public/runtime/tracks/microsoft/ai-900/microsoft.ai-900.track.main.json"
    );
    const crlfTrack = readFileSync(trackPath, "utf8")
      .replace(/\r\n?/g, "\n")
      .replace(/\n/g, "\r\n");
    writeFileSync(trackPath, crlfTrack);
    await materializeRuntime({ root: temporaryRoot });
    assert.equal(readFileSync(trackPath, "utf8"), crlfTrack);
    const track = readFileSync(trackPath, "utf8");
    writeFileSync(trackPath, track.replace('"status":"retired"', '"status":"active"'));
    assert.throws(
      () =>
        execFileSync(
          "node",
          ["tools/materialize_runtime.mjs", "--root", temporaryRoot, "--check"],
          { cwd: ROOT, stdio: "pipe" }
        ),
      (error) => error.status === 1
    );
    rmSync(temporaryRoot, { recursive: true, force: true });
  });

  it("preserves authored guided resources and package inputs during regeneration", async () => {
    const temporaryRoot = mkdtempSync(join(tmpdir(), "certigo-runtime-authored-"));
    try {
      cpSync(join(ROOT, "content"), join(temporaryRoot, "content"), {
        recursive: true,
      });
      cpSync(join(ROOT, "schemas"), join(temporaryRoot, "schemas"), {
        recursive: true,
      });
      cpSync(join(ROOT, "config"), join(temporaryRoot, "config"), {
        recursive: true,
      });

      const trackPath = join(
        temporaryRoot,
        "content/public/runtime/tracks/microsoft/az-900/microsoft.az-900.track.main.json"
      );
      const track = JSON.parse(readFileSync(trackPath, "utf8"));
      const questionBankTrack = structuredClone(track);
      const unitId = "microsoft.az-900.unit.authored-ownership";
      const lessonId = "microsoft.az-900.lesson.authored-ownership";
      const conceptDirectory = join(
        temporaryRoot,
        "content/public/runtime/concepts/microsoft/az-900"
      );
      const concepts = readdirSync(conceptDirectory)
        .sort()
        .map((file) =>
          JSON.parse(readFileSync(join(conceptDirectory, file), "utf8"))
        );
      const domainId = track.domainIds[0];
      const unitPath = join(
        temporaryRoot,
        `content/public/runtime/units/microsoft/az-900/${unitId}.json`
      );
      const lessonPath = join(
        temporaryRoot,
        `content/public/runtime/lessons/microsoft/az-900/${lessonId}.json`
      );

      track.mode = "guided";
      track.unitIds = [unitId];
      track.summary = "Synthetic authored-guided preservation fixture.";
      mkdirSync(join(temporaryRoot, "content/public/runtime/units/microsoft/az-900"), {
        recursive: true,
      });
      mkdirSync(join(temporaryRoot, "content/public/runtime/lessons/microsoft/az-900"), {
        recursive: true,
      });
      writeFileSync(trackPath, `${JSON.stringify(track, null, 2)}\n`);
      writeFileSync(unitPath, `${JSON.stringify({
        schema: "certigo.runtime.unit/v1",
        resourceType: "unit",
        id: unitId,
        certificationId: track.certificationId,
        blueprintVersion: track.blueprintVersion,
        domainId,
        title: "Synthetic authored unit",
        lessonIds: [lessonId],
        lifecycle: track.lifecycle,
      }, null, 2)}\n`);
      writeFileSync(lessonPath, `${JSON.stringify({
        schema: "certigo.runtime.lesson/v1",
        resourceType: "lesson",
        id: lessonId,
        certificationId: track.certificationId,
        blueprintVersion: track.blueprintVersion,
        unitId,
        title: "Synthetic authored lesson",
        estimatedMinutes: 5,
        blocks: concepts.map((concept, index) => ({
          id: `${lessonId}.block.${String(index + 1).padStart(3, "0")}`,
          type: "concept",
          conceptId: concept.id,
          body: `Synthetic fixture concept block ${index + 1}.`,
        })),
        lifecycle: track.lifecycle,
      }, null, 2)}\n`);

      const authoredBytes = new Map(
        [trackPath, unitPath, lessonPath].map((path) => [
          path,
          readFileSync(path, "utf8"),
        ])
      );
      const contentRoot = join(temporaryRoot, "content");
      const before = snapshotDirectory(contentRoot);
      const valid = await validateContent({ root: temporaryRoot });
      assert.deepEqual(valid.errors, []);

      await materializeRuntime({ root: temporaryRoot });
      for (const [path, bytes] of authoredBytes) {
        assert.equal(readFileSync(path, "utf8"), bytes, `${path} changed`);
      }
      const check = await materializeRuntime({
        root: temporaryRoot,
        check: true,
      });
      assert.equal(check.ok, true);

      const after = snapshotDirectory(contentRoot);
      assert.deepEqual(after, before);

      const orphanLessonId = "microsoft.az-900.lesson.authored-orphan";
      const duplicateUnitId = "microsoft.az-900.unit.authored-conflict";
      const duplicateLessonId = "microsoft.az-900.lesson.authored-conflict";
      const duplicateGuidedTrack = {
        ...track,
        id: "microsoft.az-900.track.authored-duplicate",
        unitIds: [duplicateUnitId],
      };
      const duplicateTrackPath = join(
        temporaryRoot,
        "content/public/runtime/tracks/microsoft/az-900/microsoft.az-900.track.authored-duplicate.json"
      );
      const duplicateUnitPath = join(
        temporaryRoot,
        `content/public/runtime/units/microsoft/az-900/${duplicateUnitId}.json`
      );
      const duplicateLessonPath = join(
        temporaryRoot,
        `content/public/runtime/lessons/microsoft/az-900/${duplicateLessonId}.json`
      );
      const orphanLessonPath = join(
        temporaryRoot,
        `content/public/runtime/lessons/microsoft/az-900/${orphanLessonId}.json`
      );
      const authoredLesson = JSON.parse(authoredBytes.get(lessonPath));
      const blocksForLesson = (id) =>
        authoredLesson.blocks.map((block, index) => ({
          ...block,
          id: `${id}.block.${String(index + 1).padStart(3, "0")}`,
        }));
      const writeJson = (path, data) =>
        writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);

      writeJson(duplicateUnitPath, {
        schema: "certigo.runtime.unit/v1",
        resourceType: "unit",
        id: duplicateUnitId,
        certificationId: track.certificationId,
        blueprintVersion: track.blueprintVersion,
        domainId,
        title: "Synthetic conflict unit",
        lessonIds: [duplicateLessonId],
        lifecycle: track.lifecycle,
      });
      writeJson(duplicateLessonPath, {
        ...authoredLesson,
        id: duplicateLessonId,
        unitId: duplicateUnitId,
        title: "Synthetic conflict lesson",
        blocks: blocksForLesson(duplicateLessonId),
      });
      writeJson(orphanLessonPath, {
        ...authoredLesson,
        id: orphanLessonId,
        title: "Synthetic orphan lesson",
        blocks: blocksForLesson(orphanLessonId),
      });
      writeFileSync(
        trackPath,
        `${JSON.stringify(questionBankTrack, null, 2)}\n`
      );
      writeFileSync(
        duplicateTrackPath,
        `${JSON.stringify(duplicateGuidedTrack, null, 2)}\n`
      );
      await materializeRuntime({ root: temporaryRoot });
      for (const path of [unitPath, lessonPath]) {
        assert.equal(readFileSync(path, "utf8"), authoredBytes.get(path));
      }
      const conflicting = await validateContent({ root: temporaryRoot });
      assert.ok(
        conflicting.errors.some(
          (error) =>
            error.includes("[runtime:track]") &&
            error.includes("plusieurs tracks pour microsoft:az-900")
        )
      );
      assert.ok(
        conflicting.errors.some(
          (error) => error.includes("[runtime:orphan]") && error.includes(unitId)
        )
      );
      assert.ok(
        conflicting.errors.some(
          (error) =>
            error.includes("[runtime:orphan]") && error.includes(orphanLessonId)
        )
      );
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });
});

describe("runtime lifecycle", () => {
  it("all catalog certifications have at least one runtime concept", () => {
    const catalog = JSON.parse(
      readFileSync(join(ROOT, "content/public/catalog/certifications.json"), "utf8")
    );
    for (const cert of catalog.certifications) {
      const provider = cert.id.split(":")[0];
      const slug = cert.id.split(":")[1];
      const trackDir = join(ROOT, `content/public/runtime/tracks/${provider}/${slug}`);
      assert.ok(
        existsSync(trackDir),
        `Missing runtime track for ${cert.id}`
      );
    }
  });

  it("all coverage matrices reference existing questions", () => {
    const catalog = JSON.parse(
      readFileSync(join(ROOT, "content/public/catalog/certifications.json"), "utf8")
    );
    for (const cert of catalog.certifications) {
      const provider = cert.id.split(":")[0];
      const slug = cert.id.split(":")[1];
      const covPath = join(ROOT, `content/public/coverage/${provider}/${slug}.json`);
      assert.ok(existsSync(covPath), `Missing coverage for ${cert.id}`);
      const cov = JSON.parse(readFileSync(covPath, "utf8"));
      const totalQuestions = cov.objectives
        ? cov.objectives.reduce((sum, obj) => sum + (obj.questionIds?.length || 0), 0)
        : (cov.questionIds?.length || 0);
      assert.ok(
        totalQuestions > 0,
        `Empty coverage for ${cert.id}`
      );
    }
  });

  it("preserves retired tracks as history without compiling them as active", async () => {
    const outDir = "dist/runtime-lifecycle-test";
    const retiredTrack = join(
      ROOT,
      "content/public/runtime/tracks/microsoft/ai-900/microsoft.ai-900.track.main.json"
    );
    assert.equal(JSON.parse(readFileSync(retiredTrack, "utf8")).lifecycle.status, "retired");

    await compileRuntime({ root: ROOT, outDir });
    assert.equal(
      existsSync(join(ROOT, outDir, "public", "microsoft.ai-900.track.main.json")),
      false
    );
    assert.equal(
      existsSync(join(ROOT, outDir, "public", "microsoft.ai-901.track.main.json")),
      true
    );
    rmSync(join(ROOT, outDir), { recursive: true, force: true });
  });

  it("package produces byte-for-byte reproducible output", () => {
    const snapshots = [];
    for (const out of ["dist-repro-a", "dist-repro-b"]) {
      rmSync(join(ROOT, out), { recursive: true, force: true });
      execFileSync("node", ["tools/package_content.mjs", "--out", out], {
        cwd: ROOT,
        stdio: "pipe",
      });
      const snapshot = {};
      const walk = (directory, prefix = "") => {
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
          const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
          const absolute = join(directory, entry.name);
          if (entry.isDirectory()) walk(absolute, relative);
          else snapshot[relative] = readFileSync(absolute).toString("base64");
        }
      };
      walk(join(ROOT, out));
      snapshots.push(snapshot);
    }
    assert.deepEqual(snapshots[0], snapshots[1]);
    rmSync(join(ROOT, "dist-repro-a"), { recursive: true, force: true });
    rmSync(join(ROOT, "dist-repro-b"), { recursive: true, force: true });
  });
});
