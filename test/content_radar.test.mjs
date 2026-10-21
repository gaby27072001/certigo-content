import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  validateRegistry, validateSnapshot, assertOfficialUrl, sha256, compareRadar, captureLive, MAX_BYTES
} from "../tools/lib/content_radar.mjs";
import { runRadar } from "../tools/check_content_radar.mjs";

const registry = JSON.parse(readFileSync(new URL("../config/content-radar-sources.json", import.meta.url), "utf8"));
const clone = (value) => structuredClone(value);
const provider = (id, source = registry) => source.providers.find((entry) => entry.id === id);
const snapshot = (...captures) => ({ schemaVersion: "certigo.content-radar-snapshot/v1", captures });
function capture(id, body, { source = registry, index = 0, date = "2026-10-21T08:00:00.000Z",
  type = "text/html", url } = {}) {
  const p = provider(id, source);
  const endpoint = p.discoveryEndpoints[index];
  const bytes = Buffer.from(body);
  return {
    providerId: id, endpointId: endpoint.id, url: url ?? endpoint.url, observedAt: date,
    contentType: type, bodyBase64: bytes.toString("base64"), sha256: sha256(bytes)
  };
}
const course = (id, title = "Original fixture training") =>
  `<a href="${provider(id).officialDomains[0]}/fixture-course">${title}</a>`;

test("radar validates all 35 selected groups, seven categories and both gated stages", () => {
  assert.equal(validateRegistry(registry), registry);
  assert.deepEqual(registry.providers.map((p) => p.id).sort(), [
    "microsoft", "aws", "gcp", "oracle", "openai", "anthropic", "mistral-ai", "nvidia", "huggingface",
    "cohere", "meta-ai", "apple", "databricks", "snowflake", "mongodb", "confluent", "dbt-labs",
    "linux-foundation-cncf", "hashicorp", "github", "red-hat", "docker", "gitlab", "cisco", "comptia",
    "isc2", "isaca", "offsec", "palo-alto-networks", "cloudflare", "salesforce", "servicenow",
    "sap", "atlassian", "pmi-scrum"
  ].sort());
  assert.equal(new Set(registry.providers.map((p) => p.category)).size, 7);
  for (const p of registry.providers) {
    assert.deepEqual(p.ingestionStages, ["stage1_announced_card", "stage2_blueprint_and_pack"]);
    assert.ok(p.cadenceMinutes >= 15 && p.cadenceMinutes <= 60);
  }
});

test("radar rejects schema drift, duplicates, noncanonical origins and missing categories", () => {
  for (const mutate of [
    (r) => { r.extra = true; },
    (r) => { r.providers[0].extra = true; },
    (r) => { r.providers[0].id = r.providers[1].id; },
    (r) => { r.providers[0].officialDomains.push(r.providers[0].officialDomains[0]); },
    (r) => { r.providers[0].officialDomains = ["https://localhost"]; },
    (r) => { r.providers[0].officialDomains = ["https://127.0.0.1"]; },
    (r) => { r.providers[0].officialDomains = ["https://LEARN.microsoft.com"]; },
    (r) => { r.providers[0].officialDomains = ["https://learn.microsoft.com/"]; },
    (r) => { r.providers[0].officialDomains = ["https://learn.microsoft.com:443"]; },
    (r) => { r.providers[0].officialDomains = r.providers[1].officialDomains; },
    (r) => { r.providers[0].discoveryEndpoints.push(clone(r.providers[0].discoveryEndpoints[0])); },
    (r) => { r.providers[0].cadenceMinutes = 1; },
    (r) => { provider("apple", r).category = "cloud-hyperscalers"; },
    (r) => { r.providers[0].ingestionStages.reverse(); }
  ]) {
    const r = clone(registry);
    mutate(r);
    assert.throws(() => validateRegistry(r));
  }
});

test("radar URL allowlist is exact, HTTPS-only and rejects credentials, ports and deceptive hosts", () => {
  const p = provider("openai");
  for (const url of [
    "http://academy.openai.com/course", "https://academy.openai.com.evil.test/course",
    "https://evil.test/course", "https://academy.openai.com@evil.test/course",
    "https://user@academy.openai.com/course", "https://academy.openai.com:8443/course",
    "https://academy.openai.com:443/course", "https://sub.academy.openai.com/course",
    "https://academy.openai.com/course#part", "file:///course", "javascript:alert(1)"
  ]) {
    assert.throws(() => assertOfficialUrl(url, p));
    const r = clone(registry);
    provider("openai", r).discoveryEndpoints[0].url = url;
    assert.throws(() => validateRegistry(r));
  }
});

test("08:00 fixtures detect OpenAI, Anthropic and NVIDIA immediately without network or invented questions", () => {
  const ids = ["openai", "anthropic", "nvidia"];
  const known = snapshot(...ids.map((id) => capture(id, "", { date: "2026-10-21T07:59:00.000Z" })));
  const observed = snapshot(...ids.map((id) => capture(id, course(id))));
  const start = performance.now();
  const report = compareRadar(registry, known, observed);
  assert.ok(performance.now() - start < 2000, "fixture comparison should take less than two seconds");
  assert.equal(report.events.filter((event) => event.type === "new_item").length, 3);
  assert.equal(report.drafts.length, 3);
  for (const draft of report.drafts) {
    assert.equal(draft.status, "announced");
    assert.equal(draft.publishable, false);
    assert.equal(draft.verificationState, "needs-editorial-review");
    assert.equal(draft.announcedOn, null);
    assert.equal(draft.questionCount, 0);
    assert.equal("questions" in draft, false);
    assert.equal(draft.provenance.sha256, observed.captures.find((c) => c.providerId === draft.providerId).sha256);
    assert.ok(draft.requiredGates.includes("backend-contract"));
    assert.ok(draft.requiredGates.includes("publication-approval"));
  }
  assert.equal(report.runtimeModified, false);
  assert.ok(report.coverage.unobservedEndpoints.length > 0);
  assert.deepEqual(compareRadar(registry, known, snapshot(...observed.captures.toReversed())), report);
});

test("first capture is initial inventory, not an invented new announcement; replay is idempotent", () => {
  const observed = snapshot(capture("openai", course("openai")));
  const initial = compareRadar(registry, snapshot(), observed);
  assert.equal(initial.events[0].type, "initial_inventory");
  assert.equal(initial.drafts.length, 0);
  assert.deepEqual(compareRadar(registry, observed, observed).events, []);
  const missing = compareRadar(registry, observed, snapshot());
  assert.equal(missing.removalsInferred, false);
  assert.equal(missing.events.length, 0);
});

test("source hash changes are not a blueprint assertion; changed title is not a new offering", () => {
  const known = snapshot(capture("openai", course("openai")));
  const observed = snapshot(capture("openai", `${course("openai", "Updated fixture course")}<!-- dynamic noise -->`));
  const report = compareRadar(registry, known, observed);
  assert.deepEqual(report.events.map((e) => e.type), ["source_changed", "item_changed"]);
  assert.equal(report.drafts.length, 0);
});

test("an offering already known through another endpoint is not a new offering", () => {
  const r = clone(registry);
  provider("openai", r).discoveryEndpoints.push({
    id: "fixture-second", url: "https://academy.openai.com/fixture-second", format: "html-links"
  });
  const known = snapshot(capture("openai", course("openai"), { source: r }));
  const observed = snapshot(capture("openai", course("openai"), { source: r, index: 1 }));
  const report = compareRadar(r, known, observed);
  assert.equal(report.events.length, 0);
  assert.equal(report.drafts.length, 0);
});

test("configured blueprint raw-byte hash change is associated with the existing item", () => {
  const r = clone(registry);
  const p = provider("openai", r);
  p.discoveryEndpoints.push({ id: "fixture-blueprint", url: "https://academy.openai.com/fixture.pdf",
    format: "blueprint", itemUrl: "https://academy.openai.com/fixture-course" });
  const known = snapshot(capture("openai", "fixture pdf v1", { source: r, index: 1, type: "application/pdf" }));
  const observed = snapshot(capture("openai", "fixture pdf v2", { source: r, index: 1, type: "application/pdf" }));
  const report = compareRadar(r, known, observed);
  assert.equal(report.events[0].type, "blueprint_changed");
  assert.equal(report.events[0].url, p.discoveryEndpoints[1].itemUrl);
  assert.equal(report.drafts.length, 0);
});

test("snapshots reject tampering, unknown endpoints, duplicate captures and stale time", () => {
  const good = snapshot(capture("openai", course("openai")));
  for (const mutate of [
    (s) => { s.captures[0].sha256 = "0".repeat(64); },
    (s) => { s.captures[0].bodyBase64 = "!"; },
    (s) => { s.captures[0].url = "https://evil.test/"; },
    (s) => { s.captures[0].endpointId = "unknown"; },
    (s) => { s.captures[0].providerId = "unknown"; },
    (s) => { s.captures[0].contentType = "application/json"; },
    (s) => { s.captures[0].observedAt = "2026-10-21"; },
    (s) => { s.captures.push(clone(s.captures[0])); },
    (s) => { s.untrusted = true; }
  ]) {
    const bad = clone(good); mutate(bad);
    assert.throws(() => validateSnapshot(registry, bad));
  }
  assert.throws(() => compareRadar(registry, good,
    snapshot(capture("openai", "", { date: "2026-10-21T07:59:00.000Z" }))), /anterieure/);
});

test("HTML is heuristic: no scripts or third-party links, no execution, no title loss from entities", () => {
  const body = `<script>${course("openai")}</script><a href="https://evil.test/training">Training evil</a>
    <a href="http://academy.openai.com/no">Course insecure</a>
    <a href="/fixture-safe#top"><b>Course</b> A &amp; B</a><a href="/legal">Legal</a>`;
  const report = compareRadar(registry, snapshot(capture("openai", "")), snapshot(capture("openai", body)));
  assert.equal(report.drafts.length, 1);
  assert.equal(report.drafts[0].title, "Course A & B");
  assert.equal(report.drafts[0].url, "https://academy.openai.com/fixture-safe");
  assert.equal(report.coverage.endpoints[0].completeness, "heuristic-links-only");
});

test("structured JSON adapter validates every candidate URL and rejects unrecognized shapes", () => {
  const r = clone(registry);
  provider("openai", r).discoveryEndpoints[0].format = "json-items";
  const feed = { items: [{ url: "https://academy.openai.com/fixture", title: "Fixture only", kind: "training" }] };
  const known = snapshot(capture("openai", '{"items":[]}', { source: r, type: "application/json" }));
  const observed = snapshot(capture("openai", JSON.stringify(feed), { source: r, type: "application/json" }));
  assert.equal(compareRadar(r, known, observed).drafts.length, 1);
  for (const value of [
    { items: [{ ...feed.items[0], url: "https://evil.test/" }] },
    { items: [feed.items[0], feed.items[0]] },
    { items: [{ ...feed.items[0], questions: [] }] }, { results: [] }
  ]) {
    assert.throws(() => compareRadar(r, known,
      snapshot(capture("openai", JSON.stringify(value), { source: r, type: "application/json" }))));
  }
});

test("live collector is bounded to four requests, does not authenticate and records HTTP failures", async () => {
  let active = 0; let max = 0; let calls = 0;
  const result = await captureLive(registry, { fetchImpl: async (_url, options) => {
    assert.equal(options.redirect, "manual");
    assert.equal(options.headers.Authorization, undefined);
    active++; calls++; max = Math.max(max, active);
    await new Promise((resolve) => setTimeout(resolve, 1));
    active--;
    return new Response("blocked", { status: 403 });
  } });
  assert.equal(result.snapshot.captures.length, 0);
  assert.equal(result.failures.length, calls);
  assert.ok(max <= 4);
  assert.match(result.failures[0].message, /HTTP 403/);
});

test("live redirects never fetch an unlisted host or HTTP URL", async () => {
  const calls = [];
  const result = await captureLive(registry, { fetchImpl: async (url) => {
    calls.push(url);
    return new Response(null, { status: 302, headers: { location: "https://evil.test/steal" } });
  } });
  assert.equal(result.failures.length, calls.length);
  assert.equal(calls.some((url) => url.includes("evil.test")), false);
  assert.ok(result.failures.every((failure) => /non autorisee/.test(failure.message)));
});

test("live permits only validated in-allowlist redirect hops and captures exact SHA256 bytes", async () => {
  const calls = new Map();
  const result = await captureLive(registry, { clock: () => new Date("2026-10-21T08:00:00.000Z"),
    fetchImpl: async (url) => {
      const count = calls.get(url) ?? 0; calls.set(url, count + 1);
      if (!url.endsWith("?fixture=1")) return new Response(null, {
        status: 302, headers: { location: `${new URL(url).pathname}?fixture=1` }
      });
      return new Response("<html></html>", { headers: { "content-type": "text/html" } });
    } });
  assert.equal(result.failures.length, 0);
  assert.equal(result.snapshot.captures.length, registry.providers.flatMap((p) => p.discoveryEndpoints).length);
  for (const c of result.snapshot.captures) assert.equal(c.sha256, sha256("<html></html>"));
});

test("live oversized, timeout, redirect-loop and wrong-type responses fail explicitly", async () => {
  for (const fetchImpl of [
    async () => new Response("x".repeat(MAX_BYTES + 1), { headers: { "content-type": "text/html" } }),
    async () => { throw new Error("fixture timeout"); },
    async (url) => new Response(null, { status: 302, headers: { location: url } }),
    async () => new Response("{}", { headers: { "content-type": "application/json" } })
  ]) {
    const result = await captureLive(registry, { fetchImpl });
    assert.equal(result.snapshot.captures.length, 0);
    assert.ok(result.failures.length >= 35);
  }
});

test("CLI defaults to offline registry validation and fails on unknown/missing/conflicting arguments", async () => {
  assert.deepEqual(await runRadar([]), {
    ok: true, mode: "registry-validation-only", providers: 35, categories: 7, networkAccessed: false
  });
  for (const args of [["--unknown"], ["--snapshot"], ["--live", "--snapshot", "x"],
    ["--known", "x"], ["--out", "x"], ["--live", "--out", "content/radar"]]) {
    await assert.rejects(runRadar(args));
  }
});

test("CLI replay writes a deterministic report outside the repo, never overwrites baseline/output", async () => {
  const dir = mkdtempSync(join(tmpdir(), "certigo-radar-"));
  try {
    const known = join(dir, "known.json"); const observed = join(dir, "observed.json");
    const before = JSON.stringify(snapshot(capture("openai", "")));
    writeFileSync(known, before);
    writeFileSync(observed, JSON.stringify(snapshot(capture("openai", course("openai")))));
    const args = ["--known", known, "--snapshot", observed];
    const a = await runRadar([...args, "--out", join(dir, "a")]);
    const b = await runRadar([...args, "--out", join(dir, "b")]);
    assert.deepEqual(a, b);
    assert.equal(readFileSync(join(dir, "a", "radar-delta-report.json"), "utf8"),
      readFileSync(join(dir, "b", "radar-delta-report.json"), "utf8"));
    assert.equal(readFileSync(known, "utf8"), before);
    await assert.rejects(runRadar([...args, "--out", join(dir, "a")]), /existante/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
