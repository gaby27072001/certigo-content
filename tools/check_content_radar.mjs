#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync, existsSync, realpathSync } from "node:fs";
import { resolve, relative, isAbsolute, dirname, basename } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { validateRegistry, validateRadarTracks, validateSnapshot, compareRadar, captureLive } from "./lib/content_radar.mjs";

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

export async function runRadar(args) {
  const options = {};
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--live" || arg === "--help") options[arg.slice(2)] = true;
    else if (["--registry", "--known", "--snapshot", "--out"].includes(arg)) {
      const value = args[++index];
      if (!value || value.startsWith("--")) throw new Error(`${arg} exige une valeur`);
      if (options[arg.slice(2)]) throw new Error(`argument duplique: ${arg}`);
      options[arg.slice(2)] = value;
    } else throw new Error(`argument inconnu: ${arg}`);
  }
  if (options.help) return { help: "radar:check [--registry FILE] [--known SNAPSHOT] [--snapshot SNAPSHOT | --live] [--out NEW_DIR]" };
  if (options.live && options.snapshot) throw new Error("--live et --snapshot sont exclusifs");
  if ((options.known || options.out) && !(options.live || options.snapshot)) {
    throw new Error("--known/--out exige --snapshot ou --live");
  }
  if (options.out) {
    const root = realpathSync(fileURLToPath(new URL("..", import.meta.url)));
    const out = resolve(options.out);
    // Resolve the existing parent too, so an external junction cannot target content/.
    const fromRoot = relative(root, resolve(realpathSync(dirname(out)), basename(out)));
    if (!isAbsolute(fromRoot) && fromRoot !== ".." && !fromRoot.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)) {
      throw new Error("radar: la sortie doit etre hors du depot, jamais dans les sources publiables");
    }
    if (existsSync(resolve(options.out))) throw new Error(`radar sortie deja existante: ${options.out}`);
  }
  const registry = validateRegistry(readJson(resolve(options.registry ?? "config/content-radar-sources.json")));
  if (!options.registry && existsSync(resolve("config/content-radar-tracks.json"))) {
    validateRadarTracks(registry, readJson(resolve("config/content-radar-tracks.json")));
  }
  if (!options.live && !options.snapshot) {
    return { ok: true, mode: "registry-validation-only", providers: registry.providers.length,
      categories: new Set(registry.providers.map((provider) => provider.category)).size, networkAccessed: false };
  }
  const known = options.known ? readJson(resolve(options.known)) :
    { schemaVersion: "certigo.content-radar-snapshot/v1", captures: [] };
  validateSnapshot(registry, known);
  const result = options.live ? await captureLive(registry) :
    { snapshot: readJson(resolve(options.snapshot)), failures: [] };
  const report = { ...compareRadar(registry, known, result.snapshot),
    ok: result.failures.length === 0, failures: result.failures };
  if (options.out) {
    const out = resolve(options.out);
    if (existsSync(out)) throw new Error(`radar sortie deja existante: ${out}`);
    mkdirSync(out, { recursive: true });
    writeFileSync(resolve(out, "snapshot.json"), json(result.snapshot));
    writeFileSync(resolve(out, "radar-delta-report.json"), json(report));
  }
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = await runRadar(process.argv.slice(2));
    console.log(json(result));
    if (result.ok === false) process.exitCode = 1;
  } catch (error) {
    console.error(`[radar] ${error.message}`);
    process.exitCode = 1;
  }
}
