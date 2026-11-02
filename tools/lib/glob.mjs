import { existsSync, readdirSync } from "node:fs";
import { resolve, sep } from "node:path";

function segmentToRegex(segment) {
  let out = "^";
  for (let i = 0; i < segment.length; i++) {
    const ch = segment[i];
    if (ch === "*") {
      out += "[^/]*";
    } else if (ch === "?") {
      out += "[^/]";
    } else if (ch === "{") {
      const close = segment.indexOf("}", i + 1);
      if (close !== -1) {
        const choices = segment
          .slice(i + 1, close)
          .split(",")
          .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
        out += `(?:${choices.join("|")})`;
        i = close;
        continue;
      }
      out += "\\{";
    } else if (/[.+^$()|[\]\\]/.test(ch)) {
      out += `\\${ch}`;
    } else {
      out += ch;
    }
  }
  out += "$";
  return new RegExp(out);
}

function matchSegments(patternSegments, pathSegments, pIdx = 0, sIdx = 0) {
  while (pIdx < patternSegments.length) {
    const pat = patternSegments[pIdx];
    if (pat === "**") {
      while (pIdx + 1 < patternSegments.length && patternSegments[pIdx + 1] === "**") {
        pIdx++;
      }
      if (pIdx === patternSegments.length - 1) return true;
      for (let nextS = sIdx; nextS <= pathSegments.length; nextS++) {
        if (matchSegments(patternSegments, pathSegments, pIdx + 1, nextS)) {
          return true;
        }
      }
      return false;
    }
    if (sIdx >= pathSegments.length) return false;
    if (!pat.test(pathSegments[sIdx])) return false;
    pIdx++;
    sIdx++;
  }
  return sIdx === pathSegments.length;
}

export function globSync(pattern, options = {}) {
  const cwd = resolve(options.cwd ?? ".");
  const posix = Boolean(options.posix);
  const absolute = Boolean(options.absolute);
  const normalizedPattern = pattern.replaceAll("\\", "/").replace(/^\.\//, "");
  const rawSegments = normalizedPattern.split("/").filter(Boolean);

  const prefixSegments = [];
  for (const seg of rawSegments) {
    if (seg.includes("*") || seg.includes("?") || seg.includes("{")) break;
    prefixSegments.push(seg);
  }

  const startDir = prefixSegments.length > 0 ? resolve(cwd, ...prefixSegments) : cwd;
  if (!existsSync(startDir)) return [];

  const compiledSegments = rawSegments.map((seg) => (seg === "**" ? "**" : segmentToRegex(seg)));
  const canRecurse =
    rawSegments.includes("**") || rawSegments.length > prefixSegments.length + 1;

  const results = [];

  function walk(currentAbs, relSegments) {
    let entries;
    try {
      entries = readdirSync(currentAbs, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".") && rawSegments[relSegments.length] !== entry.name) {
        continue;
      }
      const nextRel = [...relSegments, entry.name];
      const nextAbs = resolve(currentAbs, entry.name);
      if (entry.isDirectory()) {
        if (canRecurse) walk(nextAbs, nextRel);
      } else if (entry.isFile() || entry.isSymbolicLink()) {
        if (matchSegments(compiledSegments, nextRel)) {
          if (absolute) {
            results.push(posix ? nextAbs.replaceAll("\\", "/") : nextAbs);
          } else {
            const relPath = nextRel.join(posix ? "/" : sep);
            results.push(relPath);
          }
        }
      }
    }
  }

  walk(startDir, prefixSegments);
  return results;
}

export async function glob(pattern, options = {}) {
  return globSync(pattern, options);
}

glob.sync = globSync;
export default glob;
