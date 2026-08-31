#!/usr/bin/env node

import {
  closeSync,
  existsSync,
  fsyncSync,
  lstatSync,
  linkSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, isAbsolute, parse, relative, resolve, sep } from "node:path";
import { argv, cwd, platform } from "node:process";
import { pathToFileURL } from "node:url";
import { compareOrdinal } from "./lib/deterministic.mjs";
import { verifyPackagedContent } from "./package_content.mjs";

export const RELEASE_CONTAINERS = Object.freeze({
  descriptor: "content-release-descriptors",
  public: "content-public-releases",
  private: "content-private-releases",
});

const IMMUTABLE_ID = /^sha256:[0-9a-f]{64}$/;

function assertImmutableId(value, label) {
  if (!IMMUTABLE_ID.test(value)) {
    throw new Error(`[publish] ${label} invalide: ${value}`);
  }
}

export function safeDestinationPath(root, blobPath) {
  if (
    typeof blobPath !== "string" ||
    blobPath.length === 0 ||
    isAbsolute(blobPath) ||
    blobPath.includes("\\") ||
    blobPath.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new Error(`[publish] chemin blob non sur: ${blobPath}`);
  }
  const absoluteRoot = resolve(root);
  const segments = blobPath.split("/").map((segment) =>
    platform === "win32" ? segment.replaceAll(":", "%3A") : segment
  );
  const destination = resolve(absoluteRoot, ...segments);
  const rel = relative(absoluteRoot, destination);
  if (rel === "" || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error(`[publish] chemin blob hors destination: ${blobPath}`);
  }
  return destination;
}

function assertNoSymlinkAncestor(root, destination) {
  const absoluteRoot = resolve(root);
  const rel = relative(absoluteRoot, destination);
  let current = absoluteRoot;
  if (existsSync(current) && lstatSync(current).isSymbolicLink()) {
    throw new Error(`[publish] racine destination symbolique interdite: ${absoluteRoot}`);
  }
  for (const segment of rel.split(sep).slice(0, -1)) {
    current = resolve(current, segment);
    if (!existsSync(current)) break;
    if (lstatSync(current).isSymbolicLink()) {
      throw new Error(`[publish] ancetre symbolique interdit: ${current}`);
    }
  }
}

function assertNoSymlinkPath(path) {
  const absolute = resolve(path);
  const { root } = parse(absolute);
  let current = root;
  for (const segment of absolute.slice(root.length).split(sep).filter(Boolean)) {
    current = resolve(current, segment);
    if (!existsSync(current)) break;
    if (lstatSync(current).isSymbolicLink()) {
      throw new Error(`[publish] destination symbolique interdite: ${current}`);
    }
  }
}

function createOnlyFile(root, blobPath, bytes) {
  const destination = safeDestinationPath(root, blobPath);
  assertNoSymlinkAncestor(root, destination);
  if (existsSync(destination)) {
    const stat = lstatSync(destination);
    if (!stat.isFile() || !readFileSync(destination).equals(bytes)) {
      throw new Error(`[publish] collision immuable: ${blobPath}`);
    }
    return "unchanged";
  }

  const stagingRoot = resolve(dirname(resolve(root)), ".certigo-publish-staging");
  assertNoSymlinkPath(stagingRoot);
  mkdirSync(dirname(destination), { recursive: true });
  assertNoSymlinkAncestor(root, destination);
  mkdirSync(stagingRoot, { recursive: true });
  assertNoSymlinkPath(stagingRoot);
  const temporaryPath = resolve(stagingRoot, randomUUID());
  let handle;
  try {
    handle = openSync(temporaryPath, "wx");
    writeFileSync(handle, bytes);
    fsyncSync(handle);
    closeSync(handle);
    handle = undefined;
    linkSync(temporaryPath, destination);
  } catch (error) {
    if (error.code === "EEXIST" && readFileSync(destination).equals(bytes)) {
      return "unchanged";
    }
    throw error;
  } finally {
    if (handle !== undefined) closeSync(handle);
    if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
    try {
      rmdirSync(stagingRoot);
    } catch (error) {
      if (!["ENOENT", "ENOTEMPTY", "EEXIST"].includes(error.code)) throw error;
    }
  }
  if (!readFileSync(destination).equals(bytes)) {
    throw new Error(`[publish] verification locale echouee: ${blobPath}`);
  }
  return "created";
}

function manifestFiles(distRoot, artifact, manifestId) {
  const artifactRoot = resolve(distRoot, artifact);
  const manifest = JSON.parse(readFileSync(resolve(artifactRoot, "manifest.json"), "utf8"));
  assertImmutableId(manifestId, `${artifact}ManifestId`);
  if (manifest.manifestId !== manifestId) {
    throw new Error(`[publish] identite ${artifact} incoherente`);
  }
  return ["manifest.json", ...manifest.files.map((entry) => entry.path).sort(compareOrdinal)]
    .map((path) => ({
      source: safeDestinationPath(artifactRoot, path),
      blobPath: `manifests/${manifestId}/${path}`,
    }));
}

export async function buildPublicationPlan(options = {}) {
  const root = resolve(options.root ?? cwd());
  const distRoot = resolve(root, options.outDir ?? "dist");
  const verified = await verifyPackagedContent({ root, outDir: relative(root, distRoot) });
  if (!verified.release) {
    throw new Error("[publish] release.json runtime requis; aucun descripteur publiable");
  }

  const { release } = verified;
  assertImmutableId(release.releaseId, "releaseId");
  const publicFiles = manifestFiles(distRoot, "public", release.publicManifestId);
  const privateFiles = manifestFiles(distRoot, "private", release.privateManifestId);
  const descriptorSource = resolve(distRoot, "release.json");
  const descriptorRelative = relative(realpathSync(distRoot), realpathSync(descriptorSource));
  if (
    descriptorRelative === ".." ||
    descriptorRelative.startsWith(`..${sep}`) ||
    isAbsolute(descriptorRelative)
  ) {
    throw new Error("[publish] descripteur hors dist");
  }

  return {
    schema: "certigo.content.publication-plan/v1",
    releaseId: release.releaseId,
    publicManifestId: release.publicManifestId,
    privateManifestId: release.privateManifestId,
    surfaces: [
      {
        name: "public",
        container: RELEASE_CONTAINERS.public,
        files: publicFiles,
      },
      {
        name: "private",
        container: RELEASE_CONTAINERS.private,
        files: privateFiles,
      },
      {
        name: "descriptor",
        container: RELEASE_CONTAINERS.descriptor,
        files: [{
          source: descriptorSource,
          blobPath: `releases/${release.releaseId}/release.json`,
        }],
      },
    ],
  };
}

export async function publishLocalRelease(options = {}) {
  const destinationRoot = resolve(options.destinationRoot);
  assertNoSymlinkPath(destinationRoot);
  const plan = await buildPublicationPlan(options);
  const report = {
    schema: "certigo.content.publication-report/v1",
    mode: options.dryRun ? "dry-run" : "local",
    releaseId: plan.releaseId,
    surfaces: [],
  };

  for (const surface of plan.surfaces) {
    let created = 0;
    let unchanged = 0;
    for (const file of surface.files) {
      safeDestinationPath(resolve(destinationRoot, surface.container), file.blobPath);
      if (options.dryRun) continue;
      const status = createOnlyFile(
        resolve(destinationRoot, surface.container),
        file.blobPath,
        readFileSync(file.source)
      );
      if (status === "created") created++;
      else unchanged++;
    }
    report.surfaces.push({
      name: surface.name,
      container: surface.container,
      fileCount: surface.files.length,
      created,
      unchanged,
      paths: surface.files.map((file) => file.blobPath),
    });
  }
  return report;
}

function parseArgs(cliArgs) {
  const options = { dryRun: false };
  for (let index = 0; index < cliArgs.length; index++) {
    const argument = cliArgs[index];
    if (["--root", "--out", "--destination"].includes(argument)) {
      const value = cliArgs[++index];
      if (value === undefined || value.startsWith("-")) {
        throw new Error(`valeur manquante pour ${argument}`);
      }
      if (argument === "--root") options.root = value;
      else if (argument === "--out") options.outDir = value;
      else options.destinationRoot = value;
    } else if (argument === "--dry-run") options.dryRun = true;
    else if (argument === "--help" || argument === "-h") options.help = true;
    else throw new Error(`argument inconnu: ${argument}`);
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
        "Usage: node tools/publish_release.mjs --destination DIR [--root DIR] [--out DIR] [--dry-run]"
      );
    } else {
      if (!options.destinationRoot) throw new Error("--destination est requis");
      console.log(JSON.stringify(await publishLocalRelease(options), null, 2));
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
