import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const CATALOG_PATH = "content/public/catalog/certifications.json";
export const CATALOG_SCHEMA_PATH = "schemas/certification-catalog.schema.json";
export const COVERAGE_SCHEMA_PATH = "schemas/coverage-matrix.schema.json";

export function readJson(path) {
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw);
}

export function loadCatalog(root) {
  return readJson(resolve(root, CATALOG_PATH));
}

export function parseDate(value, field) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${field} doit etre une date ISO YYYY-MM-DD`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`${field} contient une date invalide: ${value}`);
  }
  return date;
}

export function daysBetween(from, to) {
  return Math.floor((to.valueOf() - from.valueOf()) / 86_400_000);
}

export function isCertificationActiveOn(certification, dateValue) {
  if (!["active", "active-retiring"].includes(certification.status)) return false;
  if (!certification.lifecycle?.lastExamOn) return true;
  return dateValue <= certification.lifecycle.lastExamOn;
}

export function metadataFields(payload) {
  if (
    !["v3", "v4"].includes(payload?.schemaVersion) ||
    payload.metadata === null ||
    Array.isArray(payload.metadata) ||
    typeof payload.metadata !== "object"
  ) {
    return {};
  }
  return {
    provider: payload.metadata.provider,
    certification: payload.metadata.certification,
    blueprintVersion: payload.metadata.blueprintVersion,
    objective: payload.metadata.objective,
  };
}
