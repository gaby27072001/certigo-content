#!/usr/bin/env node
// Deterministic, content-addressable manifest generator for certigo-content.
//
// Purpose (wp-p1-07): produce an IMMUTABLE, HASH-ADDRESSABLE content manifest.
// A given content set -> a deterministic root hash -> a stable, verifiable
// manifest id. Publishing a manifest is append-only: any content change yields
// a NEW manifest with a NEW root hash (never an in-place mutation).
//
// The generator is CONTENT-AGNOSTIC: it walks whatever content is present under
// content/public/questions/*.json and content/answerKey/solutions/*.json. It
// does NOT hard-code any sample id, so it keeps working unchanged when the real
// corpus (wp-p1-05) lands on main.
//
// Determinism contract:
//   - each item is canonicalised (recursively sorted keys, compact UTF-8) before
//     hashing, so semantically-identical content always hashes identically,
//     independent of on-disk whitespace / key order / a leading UTF-8 BOM;
//   - per-item hash  = SHA-256(canonical(parsed JSON));
//   - item size      = byte length of the canonical UTF-8 serialization
//     (i.e. the size of the artifact that a CDN would serve at hash key);
//   - root hash      = SHA-256(canonical(manifest body without rootHash/manifestId));
//   - NO timestamps or environment-dependent fields are hashed, so the same
//     content set always reproduces byte-for-byte the same manifest.
//
// Dependencies are pinned in package.json/package-lock.json and installed with
// `npm ci`. ESM native (.mjs).
//
// Usage:
//   node tools/gen_manifest.mjs                 # print manifest JSON (live content)
//   node tools/gen_manifest.mjs --out FILE      # write manifest JSON to FILE
//   node tools/gen_manifest.mjs --root DIR      # scan DIR/content/** instead of ./content
//   node tools/gen_manifest.mjs --root DIR --out FILE

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { glob } from "glob";
import { CATALOG_PATH, metadataFields } from "./lib/catalog.mjs";
import { compareOrdinal } from "./lib/deterministic.mjs";

export const MANIFEST_SCHEMA_ID = "certigo.content.manifest/v1";
export const EXTENDED_MANIFEST_SCHEMA_ID = "certigo.content.manifest/v2";
export const ALGORITHM = "sha256";
export const CANONICALIZATION = "json-sorted-keys-compact-utf8";

const LEGACY_CHANNELS = [
  { channel: "public", glob: "content/public/questions/*.json" },
  { channel: "answerKey", glob: "content/answerKey/solutions/*.json" },
];

const EXTENDED_CHANNELS = [
  {
    channel: "public",
    glob: "content/public/questions/**/*.json",
    resourceType: "question",
  },
  {
    channel: "public",
    glob: "content/public/catalog/*.json",
    resourceType: "certificationCatalog",
  },
  {
    channel: "public",
    glob: "content/public/coverage/**/*.json",
    resourceType: "coverageMatrix",
  },
  {
    channel: "answerKey",
    glob: "content/answerKey/solutions/**/*.json",
    resourceType: "solution",
  },
];

/**
 * Deterministic JSON serialization: recursively sorted object keys, compact
 * (no insignificant whitespace), UTF-8. Same value -> same string, always.
 * @param {unknown} value
 * @returns {string}
 */
export function canonicalize(value) {
  if (value === undefined) {
    throw new Error("valeur undefined interdite dans la canonicalisation JSON");
  }
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalize).join(",") + "]";
  }
  if (value !== null && typeof value === "object") {
    const keys = Object.keys(value).sort(compareOrdinal);
    return (
      "{" +
      keys.map((k) => JSON.stringify(k) + ":" + canonicalize(value[k])).join(",") +
      "}"
    );
  }
  // string | number | boolean | null
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new Error(`type non JSON interdit: ${typeof value}`);
  }
  return serialized;
}

/** SHA-256 hex of a UTF-8 string. */
export function sha256Hex(str) {
  return createHash("sha256").update(str, "utf8").digest("hex");
}

/** Read a JSON file tolerating a leading UTF-8 BOM (present in the real corpus). */
function loadJson(absPath) {
  const raw = readFileSync(absPath, "utf8");
  const parseable = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  return JSON.parse(parseable);
}

/** id convention (mirrors validator): file basename without the .json suffix. */
function idFromPath(posixPath) {
  const base = posixPath.split("/").pop() ?? posixPath;
  return base.replace(/\.json$/i, "");
}

function extendedIdentity(resourceType, data) {
  if (resourceType === "certificationCatalog") return "certification-catalog";
  if (resourceType === "coverageMatrix") return data.certification;
  return data.id;
}

function extendedMetadata(resourceType, data) {
  if (resourceType === "coverageMatrix") {
    return {
      provider: data.provider,
      certification: data.certification,
      blueprintVersion: data.blueprintVersion,
    };
  }
  return metadataFields(data);
}

/**
 * Build the manifest (body + rootHash + manifestId) for the content set found
 * under `root`/content/**. Fully deterministic and content-agnostic.
 * @param {{root?: string}} [opts]
 */
export async function buildManifest(opts = {}) {
  const root = resolve(opts.root ?? ".");
  const extended = existsSync(resolve(root, CATALOG_PATH));
  const channels = extended ? EXTENDED_CHANNELS : LEGACY_CHANNELS;
  const items = [];

  for (const { channel, glob: pattern, resourceType } of channels) {
    const files = (await glob(pattern, { cwd: root, posix: true })).sort(compareOrdinal);
    for (const path of files) {
      const abs = resolve(root, path);
      const data = loadJson(abs);
      const canonical = canonicalize(data);
      const item = {
        channel,
        id: extended ? extendedIdentity(resourceType, data) : idFromPath(path),
        path,
        hash: sha256Hex(canonical),
        size: Buffer.byteLength(canonical, "utf8"),
      };
      if (extended) {
        item.resourceType = resourceType;
        Object.assign(item, extendedMetadata(resourceType, data));
      }
      items.push(item);
    }
  }

  // Global deterministic ordering (by path) regardless of discovery order.
  items.sort((a, b) => compareOrdinal(a.path, b.path));

  // Body = the hashed part (NO rootHash / manifestId, NO timestamps).
  const body = {
    schema: extended ? EXTENDED_MANIFEST_SCHEMA_ID : MANIFEST_SCHEMA_ID,
    algorithm: ALGORITHM,
    canonicalization: CANONICALIZATION,
    itemCount: items.length,
    items,
  };

  const rootHash = sha256Hex(canonicalize(body));

  // Emitted manifest = body + self-descriptive addressing fields.
  return {
    schema: body.schema,
    algorithm: body.algorithm,
    canonicalization: body.canonicalization,
    itemCount: body.itemCount,
    items: body.items,
    manifestId: `sha256:${rootHash}`,
    rootHash,
  };
}

/** Deterministic pretty serialization used for the committed manifest file. */
export function serializeManifest(manifest) {
  return JSON.stringify(manifest, null, 2) + "\n";
}

// ---- CLI ------------------------------------------------------------------
function parseArgs(argv) {
  const args = { root: ".", out: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--root" || a === "--out") {
        const value = argv[++i];
        if (value === undefined || value.startsWith("-")) {
          throw new Error(`valeur manquante pour ${a}`);
        }
        if (a === "--root") args.root = value;
        else args.out = value;
    }
    else if (a === "--help" || a === "-h") args.help = true;
    else throw new Error(`argument inconnu: ${a}`);
  }
  return args;
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMain) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        console.log(
          "Usage: node tools/gen_manifest.mjs [--root DIR] [--out FILE]\n" +
            "  Genere un manifeste de contenu deterministe et adressable par hash."
        );
    } else {
        const rootAbs = resolve(args.root);
        const contentDir = resolve(rootAbs, "content");
        if (!existsSync(contentDir)) {
          throw new Error(`[gen-manifest] repertoire introuvable: ${contentDir}`);
        }
        const manifest = await buildManifest({ root: rootAbs });
        const serialized = serializeManifest(manifest);
        if (args.out) {
          writeFileSync(resolve(args.out), serialized);
          console.error(
            `[gen-manifest] ${manifest.itemCount} item(s) -> ${args.out}\n` +
              `[gen-manifest] rootHash=${manifest.rootHash}\n` +
              `[gen-manifest] manifestId=${manifest.manifestId}`
          );
        } else {
          process.stdout.write(serialized);
        }
    }
  } catch (error) {
    console.error(`[gen-manifest] ${error.message}`);
    process.exitCode = 1;
  }
}
