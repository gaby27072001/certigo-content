#!/usr/bin/env node
// Unified catalog validator for certigo-content (runtime certification catalog + 35-provider Radar international tracks).

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { argv, cwd } from "node:process";
import { pathToFileURL } from "node:url";
import { checkCatalogFreshness } from "./check_catalog_freshness.mjs";
import { CATALOG_PATH, loadCatalog } from "./lib/catalog.mjs";
import { validateRadarTracks, validateRegistry } from "./lib/content_radar.mjs";
import { validateContent } from "./validate_content.mjs";

const RADAR_REGISTRY_PATH = "config/content-radar-sources.json";
const RADAR_TRACKS_PATH = "config/content-radar-tracks.json";

function readJson(path) {
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw);
}

export async function validateCatalog(options = {}) {
  const root = resolve(options.root ?? cwd());
  const errors = [];

  const contentResult = await validateContent({ root, asOf: options.asOf });
  errors.push(...contentResult.errors);

  const catalog = loadCatalog(root);
  const freshnessAsOf = options.asOf ?? catalog.asOf;
  const freshnessResult = checkCatalogFreshness({ root, asOf: freshnessAsOf });
  for (const error of freshnessResult.errors) {
    errors.push(`[catalog:freshness] ${error}`);
  }

  let radarTrackCount = 0;
  let radarProviderCount = 0;
  const registryPath = resolve(root, RADAR_REGISTRY_PATH);
  const tracksPath = resolve(root, RADAR_TRACKS_PATH);
  if (existsSync(registryPath)) {
    try {
      const registry = validateRegistry(readJson(registryPath));
      radarProviderCount = registry.providers.length;
      if (existsSync(tracksPath)) {
        const tracksCatalog = validateRadarTracks(
          registry,
          readJson(tracksPath),
          { runtimeCatalog: catalog, asOf: options.asOf ?? null }
        );
        radarTrackCount = tracksCatalog.tracks.length;
      }
    } catch (error) {
      errors.push(`[radar:catalog] ${error.message}`);
    }
  }

  return {
    ok: errors.length === 0,
    asOf: freshnessAsOf,
    catalogPath: CATALOG_PATH,
    certificationCount: contentResult.certificationCount,
    activeCertificationCount: freshnessResult.activeCertificationIds.length,
    recommendedCertificationCount: freshnessResult.recommendedCertificationIds.length,
    radarProviderCount,
    radarTrackCount,
    errors,
  };
}

function parseArgs(cliArgs) {
  const options = {};
  for (let index = 0; index < cliArgs.length; index++) {
    const arg = cliArgs[index];
    if (arg === "--root" || arg === "--as-of") {
      const value = cliArgs[++index];
      if (value === undefined || value.startsWith("-")) {
        throw new Error(`valeur manquante pour ${arg}`);
      }
      if (arg === "--root") options.root = value;
      else options.asOf = value;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else {
      throw new Error(`argument inconnu: ${arg}`);
    }
  }
  return options;
}

const isMain =
  argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(argv[1])).href;

if (isMain) {
  try {
    const options = parseArgs(argv.slice(2));
    if (options.help) {
      console.log(
        "Usage: node tools/validate_catalog.mjs [--root DIR] [--as-of YYYY-MM-DD]"
      );
    } else {
      const result = await validateCatalog(options);
      console.log(
        `[catalog:validate] certifications=${result.certificationCount} (actifs=${result.activeCertificationCount}, recommandes=${result.recommendedCertificationCount}), radarProviders=${result.radarProviderCount}, radarTracks=${result.radarTrackCount}, asOf=${result.asOf}`
      );
      if (!result.ok) {
        for (const error of result.errors) console.error(`  - ${error}`);
        process.exitCode = 1;
      } else {
        console.log("[catalog:validate] OK");
      }
    }
  } catch (error) {
    console.error(`[catalog:validate] erreur fatale: ${error.message}`);
    process.exitCode = 1;
  }
}
