import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");

describe("materialize_runtime", () => {
  it("--check passes against committed runtime resources", () => {
    execFileSync("node", ["tools/materialize_runtime.mjs", "--check"], {
      cwd: ROOT,
      stdio: "pipe",
    });
  });

  it("is idempotent (second run produces no changes)", () => {
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
    rmSync(temporaryRoot, { recursive: true, force: true });
  });
});

describe("runtime lifecycle", () => {
  it("all 32 certifications have at least one runtime concept", () => {
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
