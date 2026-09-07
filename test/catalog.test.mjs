import assert from "node:assert/strict";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { afterEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { checkCatalogFreshness } from "../tools/check_catalog_freshness.mjs";
import { buildManifest, canonicalize } from "../tools/gen_manifest.mjs";
import {
  isCertificationActiveOn,
  isCertificationRecommendedOn,
  metadataFields,
  parseDate,
} from "../tools/lib/catalog.mjs";
import {
  packageContent,
  verifyPackagedContent,
} from "../tools/package_content.mjs";
import { validateContent } from "../tools/validate_content.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const temporaryRoots = [];
const expectedAws = [
  "aws:aif-c01",
  "aws:aip-c01",
  "aws:ans-c01",
  "aws:clf-c02",
  "aws:dea-c01",
  "aws:dop-c02",
  "aws:dva-c02",
  "aws:mla-c01",
  "aws:saa-c03",
  "aws:sap-c02",
  "aws:scs-c03",
  "aws:soa-c03",
];
const expectedGcp = [
  "gcp:associate-google-workspace-administrator",
  "gcp:cloud-architect",
  "gcp:cloud-database-engineer",
  "gcp:cloud-developer",
  "gcp:cloud-devops-engineer",
  "gcp:cloud-digital-leader",
  "gcp:cloud-engineer",
  "gcp:cloud-network-engineer",
  "gcp:cloud-security-engineer",
  "gcp:data-engineer",
  "gcp:data-practitioner",
  "gcp:generative-ai-leader",
  "gcp:machine-learning-engineer",
  "gcp:security-operations-engineer",
];
const expectedGcpProfessional = [
  "gcp:cloud-architect",
  "gcp:cloud-database-engineer",
  "gcp:cloud-developer",
  "gcp:cloud-devops-engineer",
  "gcp:cloud-network-engineer",
  "gcp:cloud-security-engineer",
  "gcp:data-engineer",
  "gcp:machine-learning-engineer",
  "gcp:security-operations-engineer",
];

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function treeSnapshot(root) {
  const snapshot = {};
  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else {
        snapshot[relative(root, path).replaceAll("\\", "/")] =
          readFileSync(path).toString("base64");
      }
    }
  }
  walk(root);
  return snapshot;
}

function catalogAt(root) {
  return resolve(root, "content", "public", "catalog", "certifications.json");
}

function resetCoverageForMetadataTests(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      resetCoverageForMetadataTests(path);
    } else if (entry.name.endsWith(".json")) {
      const matrix = readJson(path);
      for (const objective of matrix.objectives) objective.questionIds = [];
      if (matrix.status === "complete" || matrix.status === "in-progress") {
        matrix.status = "planned";
      }
      writeJson(path, matrix);
    }
  }
}

function createMetadataRoot() {
  const root = mkdtempSync(join(tmpdir(), "certigo-catalog-"));
  temporaryRoots.push(root);
  cpSync(resolve(repoRoot, "schemas"), resolve(root, "schemas"), { recursive: true });
  cpSync(
    resolve(repoRoot, "content", "public", "catalog"),
    resolve(root, "content", "public", "catalog"),
    { recursive: true }
  );
  cpSync(
    resolve(repoRoot, "content", "public", "coverage"),
    resolve(root, "content", "public", "coverage"),
    { recursive: true }
  );
  resetCoverageForMetadataTests(resolve(root, "content", "public", "coverage"));
  mkdirSync(resolve(root, "content", "public", "questions"), { recursive: true });
  mkdirSync(resolve(root, "content", "answerKey", "solutions"), { recursive: true });
  return root;
}

function addV3Pair(root, overrides = {}) {
  const id = overrides.id ?? "aws.aif-c01.domain-1.ai-basics.001";
  const publicMetadata = {
    provider: "aws",
    certification: "aws:aif-c01",
    blueprintVersion: "2026-08-17",
    objective: "domain-1",
    ...overrides.publicMetadata,
  };
  const privateMetadata = {
    ...publicMetadata,
    ...overrides.privateMetadata,
  };
  const publicPath =
    overrides.publicPath ??
    resolve(
      root,
      "content",
      "public",
      "questions",
      "aws",
      "aif-c01",
      `${id}.json`
    );
  const privatePath =
    overrides.privatePath ??
    resolve(
      root,
      "content",
      "answerKey",
      "solutions",
      "aws",
      "aif-c01",
      `${id}.json`
    );
  writeJson(publicPath, {
    id,
    schemaVersion: "v3",
    kind: "public",
    metadata: publicMetadata,
    prompt: "What is AI?",
    choices: overrides.choices ?? ["AAAA", "BBB", "CCCCC", "DDDDDD"],
  });
  writeJson(privatePath, {
    id,
    schemaVersion: "v3",
    kind: "answerKey",
    metadata: privateMetadata,
    correct: overrides.correct ?? "AAAA",
    rationale: "Because.",
    provenance: overrides.provenance ?? [
      "https://docs.aws.amazon.com/aws-certification/latest/ai-practitioner-01/ai-practitioner-01.html",
    ],
  });
  const matrixPath = resolve(
    root,
    "content",
    "public",
    "coverage",
    "aws",
    "aif-c01.json"
  );
  const matrix = readJson(matrixPath);
  matrix.status = "in-progress";
  matrix.objectives[0].questionIds = [id];
  writeJson(matrixPath, matrix);
  return id;
}

afterEach(() => {
  while (temporaryRoots.length > 0) {
    rmSync(temporaryRoots.pop(), { recursive: true, force: true });
  }
});

test("inventorie exactement les certifications AWS et Google Cloud actives", async () => {
  const catalog = readJson(catalogAt(repoRoot));
  const aws = catalog.certifications
    .filter((certification) => certification.provider === "aws")
    .map((certification) => certification.id);
  const gcp = catalog.certifications
    .filter((certification) => certification.provider === "gcp")
    .map((certification) => certification.id);

  assert.deepEqual(aws, expectedAws);
  assert.deepEqual(gcp, expectedGcp);
  assert.equal(catalog.asOf, "2026-08-31");
  assert.ok(aws.includes("aws:aip-c01"));
  assert.ok(!aws.includes("aws:mls-c01"));

  const ans = catalog.certifications.find(
    (certification) => certification.id === "aws:ans-c01"
  );
  assert.equal(ans.status, "active-retiring");
  assert.equal(ans.lifecycle.recommendThrough, "2026-12-31");
  assert.equal(ans.lifecycle.lastExamOn, "2026-12-31");
  assert.equal(ans.lifecycle.reviewOn, "2027-01-01");
  assert.equal(ans.provenance.checkedOn, "2026-09-05");
  assert.equal(ans.lifecycle.transition, "announced");
  assert.equal(ans.lifecycle.successor, undefined);
  assert.ok(
    ans.provenance.sources.some(
      (source) =>
        source.kind === "lifecycle" &&
        source.url ===
          "https://aws.amazon.com/certification/certified-advanced-networking-specialty/"
    )
  );
  assert.equal(
    readJson(resolve(repoRoot, "content", "public", "coverage", "aws", "ans-c01.json"))
      .status,
    "retiring"
  );

  const mla = catalog.certifications.find(
    (certification) => certification.id === "aws:mla-c01"
  );
  assert.equal(mla.status, "active-retiring");
  assert.equal(mla.lifecycle.recommendThrough, "2026-09-28");
  assert.equal(mla.lifecycle.lastExamOn, "2027-01-13");
  assert.equal(mla.lifecycle.reviewOn, "2027-01-14");
  assert.equal(mla.lifecycle.successor, "aws:mla-c02");
  assert.equal(mla.provenance.checkedOn, "2026-09-04");
  assert.ok(
    mla.provenance.sources.some(
      (source) =>
        source.kind === "lifecycle" &&
        source.url ===
          "https://aws.amazon.com/blogs/training-and-certification/september-2026-new-offerings/"
    )
  );
  assert.equal(
    readJson(resolve(repoRoot, "content", "public", "coverage", "aws", "mla-c01.json"))
      .status,
    "retiring"
  );
  assert.equal(mla.lifecycle.transition, "announced");

  // Vague 1 de la campagne de verification : les deux transitions AWS dont les
  // sources officielles se contredisent sont encadrees et non tranchees.
  for (const [id, bracket] of [
    ["aws:sap-c02", { recommendThrough: "2026-11-16", lastExamOn: "2026-11-17" }],
    ["aws:dva-c02", { recommendThrough: "2026-11-30", lastExamOn: "2026-12-01" }],
  ]) {
    const entry = catalog.certifications.find(
      (certification) => certification.id === id
    );
    assert.equal(entry.status, "active-retiring", `${id}: statut`);
    assert.equal(entry.lifecycle.transition, "announced", `${id}: transition`);
    assert.equal(entry.lifecycle.recommendThrough, bracket.recommendThrough, `${id}: borne basse`);
    assert.equal(entry.lifecycle.lastExamOn, bracket.lastExamOn, `${id}: borne haute`);
    assert.equal(entry.provenance.checkedOn, "2026-09-05", `${id}: date de verification`);
    assert.ok(
      entry.lifecycle.recommendThrough < entry.lifecycle.lastExamOn,
      `${id}: l'encadrement doit rester un intervalle`
    );
  }
});

test("valide exhaustivement le catalogue reel et les vagues completes", async () => {
  const result = await validateContent({ root: repoRoot });
  assert.deepEqual(result.errors, []);
  assert.equal(result.certificationCount, 32);
  assert.equal(result.coverageCount, 32);

  const catalog = readJson(catalogAt(repoRoot));
  const completedGcpProfessional = [];
  const expectedSpecialtyDistribution = new Map([
    ["aws:ans-c01", [7, 6, 5, 6]],
    ["aws:scs-c03", [4, 4, 4, 5, 4, 3]],
  ]);
  const questionIds = [];
  for (const certification of catalog.certifications) {
    const matrix = readJson(
      resolve(
        repoRoot,
        "content",
        "public",
        "coverage",
        certification.provider,
        `${certification.slug}.json`
      )
    );
    assert.equal(matrix.certification, certification.id);
    assert.ok(matrix.objectives.every((objective) => Array.isArray(objective.questionIds)));
    questionIds.push(...matrix.objectives.flatMap((objective) => objective.questionIds));
    const questionCount = matrix.objectives.reduce(
      (total, objective) => total + objective.questionIds.length,
      0
    );
    const expectedDistribution = expectedSpecialtyDistribution.get(certification.id);
    if (expectedDistribution) {
      assert.deepEqual(
        matrix.objectives.map((objective) => objective.questionIds.length),
        expectedDistribution
      );
      assert.equal(questionCount, 24);
    }
    if (
      certification.provider === "gcp" &&
      certification.level === "professional"
    ) {
      completedGcpProfessional.push(certification.id);
      assert.equal(matrix.status, "complete");
      assert.equal(questionCount, 24);
      assert.ok(
        matrix.objectives.every((objective) => objective.questionIds.length > 0)
      );
    } else if (!expectedDistribution && matrix.status === "planned") {
      assert.equal(questionCount, 0);
    }
    if (matrix.status === "complete") {
      assert.ok(matrix.objectives.every((objective) => objective.questionIds.length > 0));
    }
    const sum = certification.blueprint.objectives.reduce(
      (total, objective) => total + objective.weightPercent,
      0
    );
    if (certification.provider === "aws") assert.equal(sum, 100);
    else assert.ok(sum >= 99 && sum <= 101);
  }
  assert.deepEqual(completedGcpProfessional, expectedGcpProfessional);
  assert.equal(questionIds.length, new Set(questionIds).size);
});

test("applique automatiquement la date de retrait ANS-C01 a l'inventaire actif", () => {
  const catalog = readJson(catalogAt(repoRoot));
  const ans = catalog.certifications.find(
    (certification) => certification.id === "aws:ans-c01"
  );

  assert.equal(isCertificationActiveOn(ans, "2026-12-31"), true);
  assert.equal(isCertificationActiveOn(ans, "2027-01-01"), false);
  assert.equal(isCertificationRecommendedOn(ans, "2026-12-31"), true);
  assert.equal(isCertificationRecommendedOn(ans, "2027-01-01"), false);
  assert.equal(
    isCertificationActiveOn({ ...ans, status: "retired" }, "2026-08-17"),
    false
  );
  assert.equal(
    isCertificationRecommendedOn({ ...ans, status: "retired" }, "2026-08-17"),
    false
  );

  const current = checkCatalogFreshness({ root: repoRoot, asOf: "2026-08-31" });
  assert.deepEqual(current.errors, []);
  assert.ok(current.activeCertificationIds.includes("aws:ans-c01"));
  assert.ok(current.recommendedCertificationIds.includes("aws:ans-c01"));

  const transition = checkCatalogFreshness({
    root: repoRoot,
    asOf: "2027-01-01",
  });
  assert.ok(!transition.activeCertificationIds.includes("aws:ans-c01"));
  assert.ok(transition.excludedCertificationIds.includes("aws:ans-c01"));
  assert.ok(!transition.recommendedCertificationIds.includes("aws:ans-c01"));
  assert.ok(transition.nonRecommendedCertificationIds.includes("aws:ans-c01"));
  assert.ok(
    transition.errors.some((error) => error.includes("transition a reverifier"))
  );
});

test("applique les bornes linguistiques de transition MLA-C01", () => {
  const catalog = readJson(catalogAt(repoRoot));
  const mla = catalog.certifications.find(
    (certification) => certification.id === "aws:mla-c01"
  );

  // Dernier jour de MLA-C01 en anglais : encore actif et encore recommande.
  assert.equal(isCertificationActiveOn(mla, "2026-09-28"), true);
  assert.equal(isCertificationRecommendedOn(mla, "2026-09-28"), true);
  // Debut de la livraison beta MLA-C02 : MLA-C01 reste actif (ja/ko/zh-CN)
  // mais n'est plus recommande.
  assert.equal(isCertificationActiveOn(mla, "2026-09-29"), true);
  assert.equal(isCertificationRecommendedOn(mla, "2026-09-29"), false);
  // Retrait toutes langues a la GA MLA-C02 du 14 janvier 2027.
  assert.equal(isCertificationActiveOn(mla, "2027-01-13"), true);
  assert.equal(isCertificationActiveOn(mla, "2027-01-14"), false);

  const current = checkCatalogFreshness({ root: repoRoot, asOf: "2026-09-04" });
  assert.deepEqual(current.errors, []);
  assert.ok(current.activeCertificationIds.includes("aws:mla-c01"));
  assert.ok(current.recommendedCertificationIds.includes("aws:mla-c01"));

  const transition = checkCatalogFreshness({ root: repoRoot, asOf: "2027-01-14" });
  assert.ok(!transition.activeCertificationIds.includes("aws:mla-c01"));
  assert.ok(transition.excludedCertificationIds.includes("aws:mla-c01"));
  assert.ok(
    transition.errors.some((error) =>
      error.includes("aws:mla-c01: transition a reverifier")
    )
  );
});

test("declare la transition de cycle de vie ou une exemption datee", () => {
  const exemptions = readJson(
    resolve(repoRoot, "config", "catalog-transition-exemptions.json")
  );
  const catalog = readJson(catalogAt(repoRoot));
  const active = catalog.certifications.filter((certification) =>
    ["active", "active-retiring"].includes(certification.status)
  );
  const exempted = new Map(
    exemptions.exemptions.map((entry) => [entry.id, entry.expiresOn])
  );

  // Toute entree active est soit declarante, soit exemptee : aucun silence muet.
  for (const certification of active) {
    const declared = Boolean(certification.lifecycle?.transition);
    assert.equal(
      declared || exempted.has(certification.id),
      true,
      `${certification.id} ne declare pas transition et n'est pas exemptee`
    );
  }

  // Invariant central : une exemption qui expire APRES la peremption des sources
  // serait inerte, l'entree tombant d'abord sur "sources agees" - le mauvais motif.
  const maxAgeDays = catalog.freshness.maxAgeDays;
  for (const certification of active) {
    const expiresOn = exempted.get(certification.id);
    if (!expiresOn) continue;
    const staleOn = new Date(
      parseDate(certification.provenance.checkedOn, "checkedOn").valueOf() +
        (maxAgeDays + 1) * 86_400_000
    )
      .toISOString()
      .slice(0, 10);
    assert.ok(
      expiresOn <= staleOn,
      `${certification.id}: exemption ${expiresOn} posterieure a la peremption ${staleOn}`
    );
  }

  // Les expirations restent etalees tant que la liste est assez grande pour
  // qu'un regroupement recree une falaise. La liste ne fait que retrecir au fil
  // de la campagne, donc exiger un nombre fixe de dates distinctes echouerait
  // sur un residu legitime : le seuil est proportionnel a ce qui reste.
  const distinct = new Set(exemptions.exemptions.map((entry) => entry.expiresOn));
  if (exemptions.exemptions.length >= 10) {
    assert.ok(
      distinct.size >= 3,
      `${exemptions.exemptions.length} exemptions groupees sur ${distinct.size} date(s)`
    );
  }
  const perDate = new Map();
  for (const entry of exemptions.exemptions) {
    perDate.set(entry.expiresOn, (perDate.get(entry.expiresOn) ?? 0) + 1);
  }
  for (const [expiresOn, count] of perDate) {
    assert.ok(
      count <= 12,
      `${count} exemptions expirent le ${expiresOn}: falaise reconstituee`
    );
  }
});

test("distingue peremption des sources et silence de cycle de vie", () => {
  const catalog = readJson(catalogAt(repoRoot));
  const expiredExemptions = new Set(
    readJson(resolve(repoRoot, "config", "catalog-transition-exemptions.json"))
      .exemptions.filter((entry) => entry.expiresOn <= "2026-09-17")
      .map((entry) => entry.id)
  );

  // Avant toute expiration : gate verte.
  const today = checkCatalogFreshness({ root: repoRoot, asOf: "2026-09-05" });
  assert.deepEqual(today.errors, []);

  // Apres expiration ET peremption : les DEUX motifs remontent, distincts.
  const both = checkCatalogFreshness({ root: repoRoot, asOf: "2026-09-17" });
  const silence = both.errors.filter((error) => error.includes("[lifecycle:transition]"));
  const staleness = both.errors.filter((error) => error.includes("sources agees"));
  assert.ok(silence.length > 0, "silence de cycle de vie absent");
  assert.ok(staleness.length > 0, "peremption des sources absente");

  // Un motif ne doit pas masquer l'autre sur une meme entree. L'entree est
  // derivee du catalogue, non codee en dur : la campagne de fraicheur retire
  // une a une les entrees muettes, donc un identifiant fige transforme un
  // succes de campagne en echec de test - c'est ce qui est arrive a
  // gcp:cloud-architect. La derivation garde la force de l'assertion, parce
  // qu'elle exige d'abord qu'une telle entree existe : sans ce garde-fou, une
  // liste vide ferait passer le test sans rien mesurer.
  const silentAndStale = catalog.certifications.filter((certification) => {
    if (!["active", "active-retiring"].includes(certification.status)) return false;
    if (certification.lifecycle?.transition) return false;
    if (!expiredExemptions.has(certification.id)) return false;
    const staleOn = new Date(
      Date.parse(certification.provenance.checkedOn) +
        (catalog.freshness.maxAgeDays + 1) * 86_400_000
    )
      .toISOString()
      .slice(0, 10);
    return staleOn <= "2026-09-17";
  });
  assert.ok(
    silentAndStale.length > 0,
    "aucune entree a la fois muette et perimee au 2026-09-17 : " +
      "le test ne mesure plus rien et doit basculer sur un catalogue synthetique"
  );
  for (const certification of silentAndStale) {
    assert.ok(
      silence.some((error) => error.includes(certification.id)),
      `${certification.id} : silence de cycle de vie absent`
    );
    assert.ok(
      staleness.some((error) => error.includes(certification.id)),
      `${certification.id} : peremption des sources absente`
    );
  }

  // Le message d'exemption expiree oriente vers la source officielle,
  // pas vers une donnee malformee.
  assert.ok(
    silence.some(
      (error) =>
        error.includes("exemption expiree") && error.includes("source officielle")
    )
  );
});

test("rejette une declaration de transition incoherente", async () => {
  const root = createMetadataRoot();
  const catalog = readJson(catalogAt(root));
  const announced = catalog.certifications.find(
    (certification) => certification.id === "aws:saa-c03"
  );
  announced.lifecycle = { transition: "announced" };
  const silent = catalog.certifications.find(
    (certification) => certification.id === "aws:dea-c01"
  );
  silent.lifecycle = { transition: "none-announced", successor: "aws:dea-c02" };
  writeJson(catalogAt(root), catalog);

  const result = await validateContent({ root });
  assert.ok(
    result.errors.some(
      (error) =>
        error.includes("[catalog:transition]") &&
        error.includes("aws:saa-c03") &&
        error.includes("lastExamOn")
    ),
    "announced sans lastExamOn doit echouer"
  );
  assert.ok(
    result.errors.some(
      (error) =>
        error.includes("[catalog:transition]") &&
        error.includes("aws:dea-c01") &&
        error.includes("successor")
    ),
    "none-announced avec successor doit echouer"
  );
});

test("une entree declarante sort de la gate sans exemption", () => {
  const root = createMetadataRoot();
  const catalog = readJson(catalogAt(root));
  for (const certification of catalog.certifications) {
    if (!["active", "active-retiring"].includes(certification.status)) continue;
    certification.lifecycle = {
      ...(certification.lifecycle ?? {}),
      transition: certification.lifecycle?.lastExamOn ? "announced" : "none-announced",
    };
  }
  writeJson(catalogAt(root), catalog);

  // Aucun fichier d'exemption dans ce root : l'absence durcit la gate,
  // donc seule la declaration peut la faire passer.
  const result = checkCatalogFreshness({ root, asOf: "2026-09-05" });
  assert.deepEqual(
    result.errors.filter((error) => error.includes("[lifecycle:transition]")),
    []
  );
});

test("un fichier d'exemptions absent ne vaut pas exemption", () => {
  const root = createMetadataRoot();
  const result = checkCatalogFreshness({ root, asOf: "2026-09-05" });
  const silence = result.errors.filter((error) => error.includes("[lifecycle:transition]"));
  assert.ok(silence.length > 0, "un fichier absent doit durcir la gate, pas la neutraliser");
  assert.ok(silence.some((error) => error.includes("ne figure pas dans")));
});

test("detecte catalogue stale, date invalide et catalogue absent", () => {
  const stale = checkCatalogFreshness({ root: repoRoot, asOf: "2026-10-01" });
  assert.ok(stale.errors.some((error) => error.includes("snapshot age")));
  const before = checkCatalogFreshness({ root: repoRoot, asOf: "2026-08-30" });
  assert.ok(before.errors.some((error) => error.includes("anterieure")));
  assert.throws(() => parseDate("2026-02-30", "test"), /date invalide/);
  assert.throws(() => parseDate("17-08-2026", "test"), /YYYY-MM-DD/);

  const root = mkdtempSync(join(tmpdir(), "certigo-no-catalog-"));
  temporaryRoots.push(root);
  assert.throws(() => checkCatalogFreshness({ root }), /catalogue introuvable/);
});

test("refuse undefined en canonicalisation et ignore metadata v3 non objet", () => {
  assert.throws(() => canonicalize({ value: undefined }), /undefined interdite/);
  assert.deepEqual(metadataFields({ schemaVersion: "v3", metadata: null }), {});
  assert.deepEqual(metadataFields({ schemaVersion: "v3", metadata: [] }), {});
  assert.deepEqual(metadataFields({ schemaVersion: "v3", metadata: "invalid" }), {});
});

test("accepte une paire v3 namespacee et la rattache a sa matrice", async () => {
  const root = createMetadataRoot();
  const id = addV3Pair(root);
  const result = await validateContent({ root });
  assert.deepEqual(result.errors, []);
  assert.equal(result.pairCount, 1);

  const summary = await packageContent({ root, outDir: "dist-first" });
  await packageContent({ root, outDir: "dist-second" });
  assert.deepEqual(
    treeSnapshot(resolve(root, "dist-first")),
    treeSnapshot(resolve(root, "dist-second"))
  );
  assert.equal(summary.certificationCount, 32);
  const publicManifest = readJson(
    resolve(root, "dist-first", "public", "manifest.json")
  );
  const question = publicManifest.files.find((entry) => entry.id === id);
  assert.equal(publicManifest.schema, "certigo.content.package-manifest/v2");
  assert.deepEqual(
    {
      resourceType: question.resourceType,
      provider: question.provider,
      certification: question.certification,
      blueprintVersion: question.blueprintVersion,
      objective: question.objective,
    },
    {
      resourceType: "question",
      provider: "aws",
      certification: "aws:aif-c01",
      blueprintVersion: "2026-08-17",
      objective: "domain-1",
    }
  );
  assert.equal(
    question.path,
    `questions/aws/aif-c01/${id}.json`
  );
  assert.ok(
    !publicManifest.files.some((entry) => entry.resourceType === "solution")
  );
  await verifyPackagedContent({ root, outDir: "dist-first" });
});

test("rejette une provenance privee v3 hors des domaines officiels", async () => {
  const root = createMetadataRoot();
  addV3Pair(root, { provenance: ["https://example.com/unofficial"] });

  const result = await validateContent({ root });

  assert.ok(
    result.errors.some(
      (error) =>
        error.includes("[solution:provenance]") &&
        error.includes('hote non officiel "example.com"')
    )
  );
});

test("rejette une URL de provenance privee v3 impossible a analyser", async () => {
  const root = createMetadataRoot();
  addV3Pair(root, { provenance: ["https://"] });

  const result = await validateContent({ root });

  assert.ok(
    result.errors.some(
      (error) =>
        error.includes("[solution:provenance]") &&
        error.includes('URL invalide "https://"')
    )
  );
});

function completeAifMatrix(root, ids) {
  setAifMatrixStatus(root, ids, "complete");
}

function setAifMatrixStatus(root, ids, status) {
  const matrixPath = resolve(
    root,
    "content",
    "public",
    "coverage",
    "aws",
    "aif-c01.json"
  );
  const matrix = readJson(matrixPath);
  matrix.status = status;
  matrix.objectives[0].questionIds = ids;
  writeJson(matrixPath, matrix);
}

test("rejette une question complete sans exactement quatre choix", async () => {
  const root = createMetadataRoot();
  const id = addV3Pair(root, {
    choices: ["aaa", "bb", "c"],
    correct: "bb",
  });
  completeAifMatrix(root, [id]);

  const result = await validateContent({ root });

  assert.ok(
    result.errors.some((error) => error.includes("exactement quatre choix"))
  );
});

test("rejette des longueurs de choix non distinctes", async () => {
  const root = createMetadataRoot();
  const id = addV3Pair(root, {
    choices: ["aaaa", "bbb", "cc", "dd"],
    correct: "bbb",
  });
  completeAifMatrix(root, [id]);

  const result = await validateContent({ root });

  assert.ok(
    result.errors.some((error) => error.includes("longueurs distinctes"))
  );
});

test("rejette une reponse v3 dont le ratio de longueur revele la cle", async () => {
  const root = createMetadataRoot();
  const id = addV3Pair(root, {
    choices: [
      "a".repeat(100),
      "b".repeat(20),
      "c".repeat(30),
      "d".repeat(40),
    ],
    correct: "a".repeat(100),
  });
  completeAifMatrix(root, [id]);

  const result = await validateContent({ root });

  assert.ok(
    result.errors.some((error) => error.includes("ratio de longueur"))
  );
});

test("rejette une distribution desequilibree des rangs de longueur", async () => {
  const root = createMetadataRoot();
  const cases = [
    [90, 100, 105, 110, 0],
    [91, 101, 106, 111, 0],
    [90, 100, 105, 110, 1],
    [90, 100, 105, 110, 2],
  ];
  const ids = cases.map((lengths, index) => {
    const rank = lengths[4];
    const choices = lengths
      .slice(0, 4)
      .map((length, choiceIndex) =>
        String.fromCharCode(97 + choiceIndex).repeat(length)
      );
    return addV3Pair(root, {
      id: `aws.aif-c01.domain-1.length-rank.${index + 1}`.replace(
        /\.(\d)$/,
        ".00$1"
      ),
      choices,
      correct: choices[rank],
    });
  });
  completeAifMatrix(root, ids);

  const result = await validateContent({ root });

  assert.ok(
    result.errors.some(
      (error) =>
        error.includes("rangs de longueur 2/1/1/0") &&
        error.includes("attendu 1/1/1/1")
    )
  );
});

test("controle aussi les rangs lorsque le total n'est pas divisible par quatre", async () => {
  const root = createMetadataRoot();
  const ids = Array.from({ length: 5 }, (_, index) => {
    const choices = [90, 100, 105, 110].map((length, choiceIndex) =>
      String.fromCharCode(97 + choiceIndex).repeat(length)
    );
    return addV3Pair(root, {
      id: `aws.aif-c01.domain-1.uneven-rank.00${index + 1}`,
      choices,
      correct: choices[0],
    });
  });
  completeAifMatrix(root, ids);

  const result = await validateContent({ root });

  assert.ok(
    result.errors.some(
      (error) =>
        error.includes("rangs de longueur 5/0/0/0") &&
        error.includes("chaque rang entre 1 et 2")
    )
  );
});

test("applique les controles editoriaux a une matrice in-progress publiee", async () => {
  const root = createMetadataRoot();
  const id = addV3Pair(root, {
    choices: [
      "a".repeat(100),
      "b".repeat(20),
      "c".repeat(30),
      "d".repeat(40),
    ],
    correct: "a".repeat(100),
  });
  setAifMatrixStatus(root, [id], "in-progress");

  const result = await validateContent({ root });

  assert.ok(
    result.errors.some((error) => error.includes("ratio de longueur"))
  );
});

test("rejette les divergences de namespace, metadata et couverture v3", async () => {
  const root = createMetadataRoot();
  const id = addV3Pair(root, {
    publicPath: resolve(
      root,
      "content",
      "public",
      "questions",
      "gcp",
      "wrong",
      "aws.aif-c01.domain-1.ai-basics.001.json"
    ),
    privateMetadata: { objective: "domain-2" },
  });

  const matrixPath = resolve(
    root,
    "content",
    "public",
    "coverage",
    "aws",
    "aif-c01.json"
  );
  const matrix = readJson(matrixPath);
  matrix.objectives[0].questionIds = [];
  matrix.objectives[1].questionIds = [id];
  writeJson(matrixPath, matrix);

  const result = await validateContent({ root });
  assert.ok(result.errors.some((error) => error.includes("[namespace:path]")));
  assert.ok(result.errors.some((error) => error.includes("[integrity:metadata]")));
  assert.ok(
    result.errors.some(
      (error) =>
        error.includes("[coverage:question]") ||
        error.includes("[coverage:missing-question]")
    )
  );
});

test("retourne des erreurs structurees si metadata v3 manque", async () => {
  const root = createMetadataRoot();
  const id = addV3Pair(root);
  const questionPath = resolve(
    root,
    "content",
    "public",
    "questions",
    "aws",
    "aif-c01",
    `${id}.json`
  );
  const question = readJson(questionPath);
  delete question.metadata;
  writeJson(questionPath, question);

  const result = await validateContent({ root });
  assert.ok(result.errors.some((error) => error.includes("[schema:question]")));
});

test("conserve un enregistrement retire tout en l'excluant des actifs", async () => {
  const root = createMetadataRoot();
  const catalog = readJson(catalogAt(root));
  const ans = catalog.certifications.find(
    (certification) => certification.id === "aws:ans-c01"
  );
  ans.status = "retired";
  delete ans.lifecycle.reviewOn;
  writeJson(catalogAt(root), catalog);

  const matrixPath = resolve(
    root,
    "content",
    "public",
    "coverage",
    "aws",
    "ans-c01.json"
  );
  const matrix = readJson(matrixPath);
  matrix.status = "retired";
  writeJson(matrixPath, matrix);

  const result = await validateContent({ root });
  assert.deepEqual(result.errors, []);
  assert.equal(isCertificationActiveOn(ans, catalog.asOf), false);
});

test("rejette les ecarts semantiques du catalogue et les sources non officielles", async () => {
  const root = createMetadataRoot();
  const catalog = readJson(catalogAt(root));
  catalog.certifications[0].officialUrl = "https://example.com/fake";
  catalog.providers[0].sourceHosts.push("example.com");
  catalog.certifications.find(
    (certification) => certification.provider === "gcp"
  ).officialUrl = "https://example.com/fake-gcp";
  catalog.certifications[0].blueprint.objectives[0].weightPercent = 19;
  catalog.certifications.find(
    (certification) => certification.id === "aws:ans-c01"
  ).lifecycle.recommendThrough = "2027-01-01";
  catalog.certifications.reverse();
  writeJson(catalogAt(root), catalog);
  rmSync(resolve(root, "content", "public", "coverage", "aws", "aif-c01.json"));

  const result = await validateContent({ root });
  assert.ok(result.errors.some((error) => error.includes("[catalog:order]")));
  assert.ok(result.errors.some((error) => error.includes("sourceHosts")));
  assert.ok(result.errors.some((error) => error.includes("hote non officiel")));
  assert.ok(result.errors.some((error) => error.includes("[catalog:weight]")));
  assert.ok(
    result.errors.some(
      (error) =>
        error.includes("[catalog:lifecycle]") &&
        error.includes("recommendThrough")
    )
  );
  assert.ok(result.errors.some((error) => error.includes("[coverage:missing]")));
});

test("genere un manifeste v2 deterministe incluant catalogue et couverture", async () => {
  const first = await buildManifest({ root: repoRoot });
  const second = await buildManifest({ root: repoRoot });
  assert.deepEqual(first, second);
  assert.equal(first.schema, "certigo.content.manifest/v3");
  assert.ok(
    first.items.some(
      (item) =>
        item.resourceType === "certificationCatalog" &&
        item.path === "content/public/catalog/certifications.json"
    )
  );
  assert.ok(
    first.items.some(
      (item) =>
        item.resourceType === "coverageMatrix" &&
        item.certification === "gcp:cloud-architect"
    )
  );
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const validate = ajv.compile(
    readJson(resolve(repoRoot, "schemas", "manifest.schema.json"))
  );
  assert.equal(validate(first), true, JSON.stringify(validate.errors));
});

// --- Registres de dette : garde-fous [coverage:question] et [editorial:answer-length] ---
// Ces tests fixent les deux trous observes avant leur correction : une question v2
// pouvait etre rattachee a n'importe quelle certification, et la regle editoriale
// n'etait mesuree que si la solution portait une provenance.

const LEDGER_DAY = "2026-09-07";

function addLegacyPair(root, id) {
  writeJson(resolve(root, "content", "public", "questions", `${id}.json`), {
    id,
    schemaVersion: "v2",
    kind: "public",
    prompt: `Question ${id}`,
    choices: ["Alpha", "Bravo", "Charlie", "Delta"],
  });
  writeJson(resolve(root, "content", "answerKey", "solutions", `${id}.json`), {
    id,
    schemaVersion: "v2",
    kind: "answerKey",
    correct: "Alpha",
    rationale: "Parce que.",
  });
  return id;
}

function bindToMatrix(root, provider, certification, ids) {
  const path = resolve(
    root,
    "content",
    "public",
    "coverage",
    provider,
    `${certification}.json`
  );
  const matrix = readJson(path);
  matrix.objectives[0].questionIds = ids;
  writeJson(path, matrix);
}

function writeLedger(root, file, collection, entries) {
  writeJson(resolve(root, "config", file), {
    schema: `certigo.${collection}/v1`,
    note: "fixture",
    [collection]: entries,
  });
}

const legacyErrors = (result) =>
  result.errors.filter(
    (error) =>
      error.includes("[coverage:question]") && error.includes("(v2)")
  );

test("refuse une question v2 rattachee a une certification qui ne l'inventorie pas", async () => {
  const root = createMetadataRoot();
  const intrus = addLegacyPair(root, "l-core-mos-word-expert-check-1");
  bindToMatrix(root, "microsoft", "sc-900", [intrus]);

  // 1. Sans inventaire : le rattachement n'est prouve par rien, donc refuse.
  const sansInventaire = await validateContent({ root, asOf: LEDGER_DAY });
  assert.ok(
    legacyErrors(sansInventaire).some((error) => error.includes(intrus)),
    "une question v2 hors inventaire doit etre refusee"
  );

  // 2. Inventoriee sous une AUTRE certification : toujours refusee. Sans cela
  //    l'inventaire serait une liste blanche globale et non un rattachement.
  writeLedger(root, "legacy-coverage-inventory.json", "inventories", [
    {
      certification: "microsoft:az-900",
      expiresOn: "2026-11-30",
      questionIds: [intrus],
    },
  ]);
  const mauvaiseCertification = await validateContent({ root, asOf: LEDGER_DAY });
  assert.ok(
    legacyErrors(mauvaiseCertification).some((error) => error.includes(intrus)),
    "l'inventaire doit rattacher a une certification precise"
  );

  // 3. Inventoriee sous la bonne certification : acceptee.
  writeLedger(root, "legacy-coverage-inventory.json", "inventories", [
    {
      certification: "microsoft:sc-900",
      expiresOn: "2026-11-30",
      questionIds: [intrus],
    },
  ]);
  const inventoriee = await validateContent({ root, asOf: LEDGER_DAY });
  assert.deepEqual(legacyErrors(inventoriee), []);

  // 4. Le lendemain de l'expiration, la dispense cesse.
  const expiree = await validateContent({ root, asOf: "2026-11-30" });
  assert.ok(
    legacyErrors(expiree).some((error) => error.includes(intrus)),
    "une entree expiree ne doit plus dispenser"
  );
});

test("un inventaire absent durcit la validation au lieu de la neutraliser", async () => {
  const root = createMetadataRoot();
  const id = addLegacyPair(root, "l-core-orphelin-check-1");
  bindToMatrix(root, "microsoft", "sc-900", [id]);

  const result = await validateContent({ root, asOf: LEDGER_DAY });

  assert.ok(legacyErrors(result).some((error) => error.includes(id)));
});

test("mesure la regle editoriale meme sans provenance sur la solution", async () => {
  const root = createMetadataRoot();
  const id = addV3Pair(root, {
    choices: [
      "Une reponse correcte nettement plus longue que toutes les autres options",
      "Court",
      "Un peu plus",
      "Encore un peu plus long",
    ],
    correct:
      "Une reponse correcte nettement plus longue que toutes les autres options",
    provenance: undefined,
  });
  // Le champ provenance reste absent : c'est exactement la cohorte que la
  // regle ignorait auparavant.
  const solutionPath = resolve(
    root,
    "content",
    "answerKey",
    "solutions",
    "aws",
    "aif-c01",
    `${id}.json`
  );
  const solution = readJson(solutionPath);
  delete solution.provenance;
  writeJson(solutionPath, solution);

  const sansRegistre = await validateContent({ root, asOf: LEDGER_DAY });
  assert.ok(
    sansRegistre.errors.some(
      (error) =>
        error.includes("[editorial:answer-length]") &&
        error.includes(id) &&
        error.includes("ratio")
    ),
    "une paire sans provenance doit etre soumise a la regle editoriale"
  );

  // Inscrite au registre de dette : toleree, mais nommement et jusqu'a une date.
  writeLedger(root, "editorial-debt.json", "debts", [
    {
      certification: "aws:aif-c01",
      expiresOn: "2026-11-30",
      questionIds: [id],
    },
  ]);
  const avecRegistre = await validateContent({ root, asOf: LEDGER_DAY });
  assert.deepEqual(
    avecRegistre.errors.filter((error) =>
      error.includes("[editorial:answer-length]")
    ),
    []
  );

  const expire = await validateContent({ root, asOf: "2026-12-01" });
  assert.ok(
    expire.errors.some(
      (error) =>
        error.includes("[editorial:answer-length]") && error.includes(id)
    ),
    "une dette expiree redevient une erreur"
  );
});

test("rejette une date d'expiration malformee au lieu de la comparer", async () => {
  const root = createMetadataRoot();
  writeLedger(root, "editorial-debt.json", "debts", [
    { certification: "aws:aif-c01", expiresOn: "30/11/2026", questionIds: [] },
  ]);

  await assert.rejects(
    () => validateContent({ root, asOf: LEDGER_DAY }),
    /expiresOn invalide/
  );
});
