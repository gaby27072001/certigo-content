import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { compareOrdinal } from "./deterministic.mjs";

export const MAX_BYTES = 2 * 1024 * 1024;
export const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const registryValidator = ajv.compile(JSON.parse(readFileSync(
  new URL("../../schemas/content-radar-sources.schema.json", import.meta.url), "utf8"
)));
const text = { type: "string", minLength: 1 };
const snapshotValidator = ajv.compile({
  type: "object", additionalProperties: false, required: ["schemaVersion", "captures"],
  properties: {
    schemaVersion: { const: "certigo.content-radar-snapshot/v1" },
    captures: {
      type: "array", maxItems: 1000,
      items: {
        type: "object", additionalProperties: false,
        required: ["providerId", "endpointId", "url", "observedAt", "contentType", "bodyBase64", "sha256"],
        properties: {
          providerId: text, endpointId: text, url: text,
          observedAt: { type: "string", format: "date-time" }, contentType: text,
          bodyBase64: { type: "string", maxLength: Math.ceil(MAX_BYTES / 3) * 4 },
          sha256: { type: "string", pattern: "^[a-f0-9]{64}$" }
        }
      }
    }
  }
});
const feedValidator = ajv.compile({
  type: "object", additionalProperties: false, required: ["items"],
  properties: {
    items: {
      type: "array", maxItems: 10000,
      items: {
        type: "object", additionalProperties: false, required: ["url", "title", "kind"],
        properties: {
          url: text, title: { type: "string", minLength: 1, maxLength: 200 },
          kind: { enum: ["certification", "training"] }
        }
      }
    }
  }
});

function assertSchema(validate, value, label) {
  if (!validate(value)) throw new Error(`${label}: ${ajv.errorsText(validate.errors)}`);
}

export function assertOfficialUrl(value, provider) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`radar URL invalide: ${value}`);
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash ||
      !provider.officialDomains.includes(url.origin) || url.href !== value) {
    throw new Error(`radar URL non autorisee (${provider.id}): ${value}`);
  }
  return url;
}

export function validateRegistry(registry) {
  assertSchema(registryValidator, registry, "radar registre");
  const ids = new Set();
  const origins = new Set();
  const categories = new Set();
  for (const provider of registry.providers) {
    if (ids.has(provider.id)) throw new Error(`radar fournisseur duplique: ${provider.id}`);
    ids.add(provider.id);
    categories.add(provider.category);
    for (const origin of provider.officialDomains) {
      const url = new URL(origin);
      // Only canonical DNS names, not IP literals, localhost, credentials, paths or ports.
      if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(url.hostname) ||
          url.origin !== origin || url.pathname !== "/" || origins.has(origin)) {
        throw new Error(`radar domaine non canonique ou duplique: ${origin}`);
      }
      origins.add(origin);
    }
    const endpoints = new Set();
    const urls = new Set();
    for (const endpoint of provider.discoveryEndpoints) {
      assertOfficialUrl(endpoint.url, provider);
      if (endpoint.itemUrl) assertOfficialUrl(endpoint.itemUrl, provider);
      if (endpoints.has(endpoint.id) || urls.has(endpoint.url)) {
        throw new Error(`radar endpoint duplique: ${provider.id}/${endpoint.id}`);
      }
      endpoints.add(endpoint.id);
      urls.add(endpoint.url);
    }
  }
  if (categories.size !== 7) throw new Error("radar: les sept categories sont requises");
  return registry;
}

const captureKey = (capture) => `${capture.providerId}/${capture.endpointId}`;
function endpointMap(registry) {
  return new Map(registry.providers.flatMap((provider) =>
    provider.discoveryEndpoints.map((endpoint) => [`${provider.id}/${endpoint.id}`, { provider, endpoint }])
  ));
}

export function validateSnapshot(registry, snapshot) {
  validateRegistry(registry);
  assertSchema(snapshotValidator, snapshot, "radar snapshot");
  const endpoints = endpointMap(registry);
  const keys = new Set();
  for (const capture of snapshot.captures) {
    const key = captureKey(capture);
    const entry = endpoints.get(key);
    if (!entry || keys.has(key)) throw new Error(`radar capture inconnue ou dupliquee: ${key}`);
    keys.add(key);
    assertOfficialUrl(capture.url, entry.provider);
    if (new Date(capture.observedAt).toISOString() !== capture.observedAt) {
      throw new Error(`radar date non canonique: ${key}`);
    }
    const bytes = Buffer.from(capture.bodyBase64, "base64");
    if (bytes.toString("base64") !== capture.bodyBase64 || bytes.length > MAX_BYTES ||
        sha256(bytes) !== capture.sha256) throw new Error(`radar preuve/hash invalide: ${key}`);
    if (entry.endpoint.format === "html-links" && !/^text\/html(?:;|$)/i.test(capture.contentType)) {
      throw new Error(`radar HTML attendu: ${key}`);
    }
    if (entry.endpoint.format === "json-items" && !/^application\/json(?:;|$)/i.test(capture.contentType)) {
      throw new Error(`radar JSON attendu: ${key}`);
    }
  }
  return snapshot;
}

function decodeEntities(value) {
  return value.replace(/&(?:amp|quot|apos|lt|gt|#(\d+)|#x([a-f0-9]+));/gi, (entity, dec, hex) => {
    const code = dec ? Number(dec) : hex ? parseInt(hex, 16) : undefined;
    if (code !== undefined) return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
    return { "&amp;": "&", "&quot;": '"', "&apos;": "'", "&lt;": "<", "&gt;": ">" }[entity.toLowerCase()];
  });
}

function itemsFor(capture, provider, endpoint) {
  const body = Buffer.from(capture.bodyBase64, "base64").toString("utf8");
  if (endpoint.format === "blueprint") return [];
  if (endpoint.format === "json-items") {
    const feed = JSON.parse(body);
    assertSchema(feedValidator, feed, "radar feed");
    for (const item of feed.items) assertOfficialUrl(item.url, provider);
    if (new Set(feed.items.map((item) => item.url)).size !== feed.items.length) {
      throw new Error("radar feed: URL dupliquee");
    }
    return feed.items;
  }
  const items = new Map();
  const html = body.replace(/<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "");
  for (const match of html.matchAll(/<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a\s*>/gi)) {
    const title = decodeEntities(match[3].replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
    if (!/\b(certifi(?:cation|cations|ed)|training|courses?|formations?|cours|parcours)\b/i.test(title) ||
        title.length > 200) continue;
    const href = decodeEntities(match[2]);
    let url;
    try {
      url = new URL(href, capture.url);
    } catch {
      continue; // Navigation junk is not an item and is never fetched.
    }
    url.hash = "";
    // External navigation is ignored, not followed or turned into a candidate.
    if (url.protocol !== "https:" || !provider.officialDomains.includes(url.origin) ||
        url.username || url.password || url.port) continue;
    const item = { url: url.href, title, kind: /certifi/i.test(title) ? "certification" : "training" };
    if (!items.has(item.url)) items.set(item.url, item);
  }
  return [...items.values()];
}

export function compareRadar(registry, known, observed) {
  validateSnapshot(registry, known);
  validateSnapshot(registry, observed);
  const endpoints = endpointMap(registry);
  const previous = new Map(known.captures.map((capture) => [captureKey(capture), capture]));
  const knownItems = new Map();
  for (const capture of known.captures) {
    const { provider, endpoint } = endpoints.get(captureKey(capture));
    for (const item of itemsFor(capture, provider, endpoint)) {
      knownItems.set(`${provider.id}/${item.url}`, item);
    }
  }
  const currentKeys = new Set(observed.captures.map(captureKey));
  const events = [];
  const drafts = new Map();
  const coverage = [];
  for (const capture of [...observed.captures].sort((a, b) => compareOrdinal(captureKey(a), captureKey(b)))) {
    const key = captureKey(capture);
    const { provider, endpoint } = endpoints.get(key);
    const prior = previous.get(key);
    if (prior && capture.observedAt < prior.observedAt) throw new Error(`radar observation anterieure: ${key}`);
    const items = itemsFor(capture, provider, endpoint);
    coverage.push({
      key, itemCount: items.length, baselinePresent: Boolean(prior),
      completeness: endpoint.format === "html-links" ? "heuristic-links-only" : "supplied-endpoint-only"
    });
    const provenance = { url: capture.url, sha256: capture.sha256, observedAt: capture.observedAt, endpointId: endpoint.id };
    if (prior && prior.sha256 !== capture.sha256) {
      events.push({
        type: endpoint.format === "blueprint" ? "blueprint_changed" : "source_changed",
        providerId: provider.id, url: endpoint.itemUrl ?? capture.url,
        previousSha256: prior.sha256, provenance
      });
    }
    for (const item of items.sort((a, b) => compareOrdinal(a.url, b.url))) {
      const old = knownItems.get(`${provider.id}/${item.url}`);
      if (old && old.title === item.title && old.kind === item.kind) continue;
      const type = old ? "item_changed" : prior ? "new_item" : "initial_inventory";
      events.push({ type, providerId: provider.id, ...item, provenance });
      if (type !== "new_item") continue;
      const id = `${provider.id}:${sha256(item.url).slice(0, 24)}`;
      drafts.set(id, {
        schemaVersion: "certigo.content-radar-draft/v1",
        id, providerId: provider.id, title: item.title, kind: item.kind, url: item.url,
        status: "announced", verificationState: "needs-editorial-review",
        announcedOn: null, publishable: false, questionCount: 0,
        provenance, stage: "stage1_announced_card",
        requiredGates: ["official-announcement-review", "blueprint-and-rights-review",
          "original-content-review", "schema-and-answer-separation", "backend-contract",
          "package-verification", "publication-approval"]
      });
    }
  }
  return {
    schemaVersion: "certigo.radar-delta-report/v1",
    coverage: {
      configuredEndpoints: endpoints.size, observedEndpoints: coverage.length,
      unobservedEndpoints: [...endpoints.keys()].filter((key) => !currentKeys.has(key)).sort(compareOrdinal),
      endpoints: coverage
    },
    removalsInferred: false, runtimeModified: false,
    events, drafts: [...drafts.values()].sort((a, b) => compareOrdinal(a.id, b.id))
  };
}

async function fetchCapture(provider, endpoint, fetchImpl, clock) {
  let url = endpoint.url;
  const signal = AbortSignal.timeout(10000);
  for (let hop = 0; hop <= 3; hop++) {
    assertOfficialUrl(url, provider);
    const response = await fetchImpl(url, {
      redirect: "manual", signal,
      headers: { Accept: endpoint.format === "json-items" ? "application/json" : "*/*" }
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location || hop === 3) throw new Error("radar redirection absente ou excessive");
      url = new URL(location, url).href;
      continue;
    }
    if (response.status !== 200) {
      await response.body?.cancel();
      throw new Error(`radar HTTP ${response.status}: ${url}`);
    }
    if (response.url && response.url !== url) throw new Error("radar redirection automatique interdite");
    const chunks = [];
    let size = 0;
    if (!response.body) throw new Error("radar corps absent");
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > MAX_BYTES) throw new Error("radar corps trop volumineux");
      chunks.push(Buffer.from(chunk));
    }
    const bytes = Buffer.concat(chunks);
    return {
      providerId: provider.id, endpointId: endpoint.id, url,
      observedAt: clock().toISOString(),
      contentType: response.headers.get("content-type") ?? "application/octet-stream",
      bodyBase64: bytes.toString("base64"), sha256: sha256(bytes)
    };
  }
  throw new Error("radar redirections excessives");
}

export async function captureLive(registry, { fetchImpl = fetch, clock = () => new Date() } = {}) {
  validateRegistry(registry);
  const snapshot = { schemaVersion: "certigo.content-radar-snapshot/v1", captures: [] };
  const failures = [];
  const queue = [...endpointMap(registry).values()];
  async function worker() {
    while (queue.length) {
      const { provider, endpoint } = queue.shift();
      try {
        const capture = await fetchCapture(provider, endpoint, fetchImpl, clock);
        validateSnapshot(registry, { ...snapshot, captures: [capture] });
        itemsFor(capture, provider, endpoint);
        snapshot.captures.push(capture);
      } catch (error) {
        failures.push({ key: `${provider.id}/${endpoint.id}`, message: error.message });
      }
    }
  }
  await Promise.all(Array.from({ length: 4 }, () => worker()));
  snapshot.captures.sort((a, b) => compareOrdinal(captureKey(a), captureKey(b)));
  failures.sort((a, b) => compareOrdinal(a.key, b.key));
  return { snapshot, failures };
}
