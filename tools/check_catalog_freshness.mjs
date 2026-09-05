#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { argv, cwd } from "node:process";
import { pathToFileURL } from "node:url";
import {
  CATALOG_PATH,
  daysBetween,
  isCertificationActiveOn,
  isCertificationRecommendedOn,
  loadCatalog,
  parseDate,
} from "./lib/catalog.mjs";

export const TRANSITION_EXEMPTIONS_PATH = "config/catalog-transition-exemptions.json";

// Une exemption absente vaut "pas d'exemption", jamais "exempte par defaut" :
// un fichier manquant doit durcir la gate, pas la neutraliser.
function loadTransitionExemptions(root) {
  const path = resolve(root, TRANSITION_EXEMPTIONS_PATH);
  if (!existsSync(path)) return new Map();
  const raw = readFileSync(path, "utf8");
  const document = JSON.parse(raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw);
  const entries = new Map();
  for (const exemption of document.exemptions ?? []) {
    parseDate(exemption.expiresOn, `exemption ${exemption.id}.expiresOn`);
    entries.set(exemption.id, exemption.expiresOn);
  }
  return entries;
}

export function checkCatalogFreshness(options = {}) {
  const root = resolve(options.root ?? cwd());
  const catalogPath = resolve(root, CATALOG_PATH);
  if (!existsSync(catalogPath)) {
    throw new Error(`[catalog:freshness] catalogue introuvable: ${catalogPath}`);
  }

  const catalog = loadCatalog(root);
  const exemptions = loadTransitionExemptions(root);
  const asOf =
    options.asOf ??
    new Date().toISOString().slice(0, 10);
  const checkedDate = parseDate(asOf, "asOf");
  const catalogDate = parseDate(catalog.asOf, "catalog.asOf");
  const dueDate = parseDate(catalog.freshness?.reviewDueOn, "catalog.freshness.reviewDueOn");
  const errors = [];

  if (checkedDate < catalogDate) {
    errors.push(`date de controle ${asOf} anterieure au snapshot ${catalog.asOf}`);
  }
  const ageDays = daysBetween(catalogDate, checkedDate);
  if (ageDays > catalog.freshness.maxAgeDays || checkedDate > dueDate) {
    errors.push(
      `snapshot age de ${ageDays} jour(s), revue exigee au plus tard le ${catalog.freshness.reviewDueOn}`
    );
  }

  for (const provider of catalog.providers) {
    if (provider.checkedOn === null) continue;
    const providerAge = daysBetween(
      parseDate(provider.checkedOn, `provider ${provider.id}.checkedOn`),
      checkedDate
    );
    if (providerAge > catalog.freshness.maxAgeDays) {
      errors.push(`catalogue fournisseur ${provider.id} age de ${providerAge} jour(s)`);
    }
  }

  for (const certification of catalog.certifications) {
    const sourceAge = daysBetween(
      parseDate(
        certification.provenance.checkedOn,
        `${certification.id}.provenance.checkedOn`
      ),
      checkedDate
    );
    if (sourceAge > catalog.freshness.maxAgeDays) {
      errors.push(`${certification.id}: sources agees de ${sourceAge} jour(s)`);
    }
    if (
      certification.lifecycle?.reviewOn &&
      checkedDate >= parseDate(certification.lifecycle.reviewOn, `${certification.id}.reviewOn`)
    ) {
      errors.push(
        `${certification.id}: transition a reverifier depuis le ${certification.lifecycle.reviewOn}`
      );
    }

    // Silence de cycle de vie. Volontairement independant du controle d'age
    // ci-dessus : les deux peuvent etre vrais en meme temps et un operateur a
    // besoin de voir les deux. "sources agees" se corrige en rafraichissant une
    // date ; "ne declare pas transition" exige d'aller lire la source officielle.
    if (["active", "active-retiring"].includes(certification.status)) {
      const declared = certification.lifecycle?.transition;
      if (!declared) {
        const expiresOn = exemptions.get(certification.id);
        if (expiresOn === undefined) {
          errors.push(
            `[lifecycle:transition] ${certification.id}: ne declare pas lifecycle.transition et ne figure pas dans ${TRANSITION_EXEMPTIONS_PATH}`
          );
        } else if (
          checkedDate >= parseDate(expiresOn, `exemption ${certification.id}.expiresOn`)
        ) {
          errors.push(
            `[lifecycle:transition] ${certification.id}: exemption expiree le ${expiresOn}; verifier la source officielle et declarer lifecycle.transition ("announced" avec lastExamOn, ou "none-announced")`
          );
        }
      }
    }
  }

  const activeCertificationIds = catalog.certifications
    .filter((certification) => isCertificationActiveOn(certification, asOf))
    .map((certification) => certification.id);
  const excludedCertificationIds = catalog.certifications
    .filter((certification) => !isCertificationActiveOn(certification, asOf))
    .map((certification) => certification.id);
  const recommendedCertificationIds = catalog.certifications
    .filter((certification) => isCertificationRecommendedOn(certification, asOf))
    .map((certification) => certification.id);
  const nonRecommendedCertificationIds = catalog.certifications
    .filter((certification) => !isCertificationRecommendedOn(certification, asOf))
    .map((certification) => certification.id);

  return {
    asOf,
    catalogAsOf: catalog.asOf,
    ageDays,
    errors,
    activeCertificationIds,
    excludedCertificationIds,
    recommendedCertificationIds,
    nonRecommendedCertificationIds,
  };
}

function parseArgs(cliArgs) {
  const options = {};
  for (let index = 0; index < cliArgs.length; index++) {
    const argument = cliArgs[index];
    if (argument === "--root" || argument === "--as-of") {
      const value = cliArgs[++index];
      if (value === undefined || value.startsWith("-")) {
        throw new Error(`valeur manquante pour ${argument}`);
      }
      if (argument === "--root") options.root = value;
      else options.asOf = value;
    } else if (argument === "--help" || argument === "-h") {
      options.help = true;
    } else {
      throw new Error(`argument inconnu: ${argument}`);
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
        "Usage: node tools/check_catalog_freshness.mjs [--root DIR] [--as-of YYYY-MM-DD]"
      );
    } else {
      const result = checkCatalogFreshness(options);
      console.log(
        `[catalog:freshness] snapshot=${result.catalogAsOf}, controle=${result.asOf}, actifs=${result.activeCertificationIds.length}, recommandes=${result.recommendedCertificationIds.length}`
      );
      if (result.excludedCertificationIds.length > 0) {
        console.log(
          `[catalog:freshness] exclus automatiquement: ${result.excludedCertificationIds.join(", ")}`
        );
      }
      if (result.nonRecommendedCertificationIds.length > 0) {
        console.log(
          `[catalog:freshness] non recommandes: ${result.nonRecommendedCertificationIds.join(", ")}`
        );
      }
      if (result.errors.length > 0) {
        for (const error of result.errors) console.error(`  - ${error}`);
        process.exitCode = 1;
      } else {
        console.log("[catalog:freshness] OK");
      }
    }
  } catch (error) {
    console.error(`[catalog:freshness] erreur fatale: ${error.message}`);
    process.exitCode = 1;
  }
}
