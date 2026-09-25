import assert from "node:assert/strict";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  appliedDistractorIds,
  clozeBlankCount,
  EXERCISE_GUARDS_PATH,
  EXERCISE_GUARDS_SCHEMA,
  loadExerciseGuards,
  V5_ITEM_TYPES,
  v5PairViolations,
  v5PublicationGuardViolations,
  v5QuestionViolations,
  v5Violations,
} from "../tools/lib/exercise_v5.mjs";
import {
  loadBackendContract,
  validatePackagedPayloads,
} from "../tools/check_backend_contract.mjs";
import {
  inspectPublicArtifact,
  packageContent,
  verifyExercisePairs,
  verifyPackagedContent,
} from "../tools/package_content.mjs";
import { validateContent } from "../tools/validate_content.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const examplesRoot = resolve(repoRoot, "test", "fixtures", "exercise-items-v5");
const runtimeFixtureRoot = resolve(repoRoot, "tools", "__fixtures__", "runtime-v3");
const temporaryRoots = [];

after(() => {
  while (temporaryRoots.length > 0) {
    rmSync(temporaryRoots.pop(), { recursive: true, force: true });
  }
});

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function example(itemType) {
  return {
    question: readJson(resolve(examplesRoot, `${itemType}.question.json`)),
    solution: readJson(resolve(examplesRoot, `${itemType}.solution.json`)),
  };
}

function compile(schemaFile) {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  return ajv.compile(readJson(resolve(repoRoot, "schemas", schemaFile)));
}

const validateQuestion = compile("question.schema.json");
const validateSolution = compile("solution.schema.json");

function rulesOf(violations) {
  return [...new Set(violations.map((entry) => entry.rule))].sort();
}

test("les huit exemples du contrat v5 passent les schemas et les regles X1 a X9", () => {
  assert.equal(V5_ITEM_TYPES.length, 8);
  for (const itemType of V5_ITEM_TYPES) {
    const { question, solution } = example(itemType);
    assert.equal(question.itemType, itemType);
    assert.equal(validateQuestion(question), true, `${itemType}: ${JSON.stringify(validateQuestion.errors)}`);
    assert.equal(validateSolution(solution), true, `${itemType}: ${JSON.stringify(validateSolution.errors)}`);
    assert.deepEqual(v5Violations(question, solution), [], itemType);
  }
});

test("les variantes v2, v3 et v4 restent inchangees : v4 reste fermee a ses quatre types", () => {
  const v4 = readJson(
    resolve(runtimeFixtureRoot, "content", "public", "questions", "aws", "clf-c02",
      "aws.clf-c02.domain-1.cloud-value.001.json")
  );
  assert.equal(validateQuestion(v4), true);
  for (const itemType of ["ordering", "applied", "cloze", "matchPairs"]) {
    assert.equal(validateQuestion({ ...v4, itemType }), false, `v4 ${itemType}`);
  }
  // Un matchPairs ne se declare qu'en v5 : le champ matches n'existe pas en v4.
  assert.equal(
    validateQuestion({ ...v4, matches: [{ id: "x", label: "X" }, { id: "y", label: "Y" }] }),
    false
  );
});

test("un trou de cloze est une suite maximale d'au moins quatre soulignes", () => {
  assert.equal(clozeBlankCount("Un verrou ____ et un verrou ________."), 2);
  assert.equal(clozeBlankCount("Trois soulignes ___ ne font pas un trou."), 0);
  assert.equal(clozeBlankCount(example("cloze").question.prompt), 2);
});

// Controles negatifs sur les regles croisees : chacun ne viole que SA regle, pour prouver
// que le moteur la detecte pour ce qu'elle est et non par effet de bord. Sauf X5, que le
// schema rejette aussi (un applied exige au moins deux etapes des deux cotes), tous
// restent valides pour les schemas : c'est la regle croisee, et elle seule, qui refuse.
const CROSS_RULE_CONTROLS = [
  {
    rule: "X1",
    itemType: "scenario",
    change: (question, solution) => { solution.itemType = "mcq"; },
  },
  {
    rule: "X2",
    itemType: "mcq",
    change: (question) => { question.options[2].id = question.options[1].id; },
  },
  {
    rule: "X3",
    itemType: "mcq",
    change: (question, solution) => { solution.correctOptionIds = ["z"]; },
  },
  {
    rule: "X4",
    itemType: "ordering",
    change: (question, solution) => { solution.correctOptionIds = ["s-mg", "s-sub", "s-rg"]; },
  },
  {
    rule: "X5",
    itemType: "applied",
    schemaAlsoRejects: true,
    change: (question, solution) => { solution.correctOptionIds = ["p-locate"]; },
  },
  {
    rule: "X6",
    itemType: "cloze",
    change: (question, solution) => { solution.correctOptionIds = ["o-cannotdelete"]; },
  },
  {
    rule: "X7",
    itemType: "matchPairs",
    change: (question, solution) => {
      solution.correctOptionIds = [
        "l-owner:r-unknown",
        "l-contributor:r-resources",
        "l-reader:r-read",
      ];
    },
  },
  {
    rule: "X8",
    itemType: "ordering",
    change: (question, solution) => {
      const byId = new Map(question.options.map((option) => [option.id, option]));
      question.options = solution.correctOptionIds.map((id) => byId.get(id));
    },
  },
  {
    rule: "X9",
    itemType: "matchPairs",
    change: (question, solution) => {
      const byId = new Map(question.matches.map((match) => [match.id, match]));
      question.matches = question.options.map((option) => {
        const token = solution.correctOptionIds.find((entry) => entry.startsWith(`${option.id}:`));
        return byId.get(token.split(":")[1]);
      });
    },
  },
];

// Controles negatifs sur les contraintes de schema propres a v5.
const SCHEMA_CONTROLS = [
  {
    name: "matches hors matchPairs",
    itemType: "mcq",
    target: "question",
    change: (question) => {
      question.matches = [{ id: "x", label: "X" }, { id: "y", label: "Y" }];
    },
  },
  {
    name: "matchPairs sans colonne droite",
    itemType: "matchPairs",
    target: "question",
    change: (question) => { delete question.matches; },
  },
  {
    name: "cle pairs dans une question publique",
    itemType: "matchPairs",
    target: "question",
    change: (question) => { question.pairs = ["l-owner:r-all"]; },
  },
  {
    name: "corrige sans itemType",
    itemType: "mcq",
    target: "solution",
    change: (question, solution) => { delete solution.itemType; },
  },
  {
    name: "mcq a deux bonnes reponses",
    itemType: "mcq",
    target: "solution",
    change: (question, solution) => { solution.correctOptionIds = ["a", "b"]; },
  },
  {
    name: "multi a deux options",
    itemType: "multi",
    target: "question",
    change: (question) => { question.options = question.options.slice(0, 2); },
  },
  {
    name: "cloze sans trou",
    itemType: "cloze",
    target: "question",
    change: (question) => { question.prompt = question.prompt.replaceAll("____", "..."); },
  },
  {
    name: "jeton matchPairs sans separateur",
    itemType: "matchPairs",
    target: "solution",
    change: (question, solution) => { solution.correctOptionIds[0] = "l-owner-r-all"; },
  },
];

test("rejette les 17 controles negatifs : un par regle X1 a X9 et huit de schema", () => {
  assert.equal(CROSS_RULE_CONTROLS.length + SCHEMA_CONTROLS.length, 17);
  assert.deepEqual(
    CROSS_RULE_CONTROLS.map((control) => control.rule),
    ["X1", "X2", "X3", "X4", "X5", "X6", "X7", "X8", "X9"]
  );

  for (const control of CROSS_RULE_CONTROLS) {
    const { question, solution } = example(control.itemType);
    control.change(question, solution);
    assert.deepEqual(
      rulesOf(v5Violations(question, solution)),
      [control.rule],
      `${control.rule} (${control.itemType})`
    );
    const schemaAccepts = validateQuestion(question) && validateSolution(solution);
    assert.equal(schemaAccepts, !control.schemaAlsoRejects, `${control.rule}: schema`);
  }

  for (const control of SCHEMA_CONTROLS) {
    const { question, solution } = example(control.itemType);
    control.change(question, solution);
    const validate = control.target === "question" ? validateQuestion : validateSolution;
    const document = control.target === "question" ? question : solution;
    assert.equal(validate(document), false, control.name);
    // L'autre fichier du couple reste valide : le refus vient de la contrainte visee.
    const other = control.target === "question" ? validateSolution(solution) : validateQuestion(question);
    assert.equal(other, true, `${control.name}: l'autre fichier doit rester valide`);
  }
});

test("X7 exige aussi le meme cardinal des deux colonnes et une association bijective", () => {
  const unbalanced = example("matchPairs");
  unbalanced.question.matches.push({ id: "r-none", label: "Rien" });
  assert.deepEqual(rulesOf(v5QuestionViolations(unbalanced.question)), ["X7"]);

  const notBijective = example("matchPairs");
  notBijective.solution.correctOptionIds = [
    "l-owner:r-all",
    "l-contributor:r-all",
    "l-reader:r-read",
  ];
  assert.deepEqual(rulesOf(v5PairViolations(notBijective.question, notBijective.solution)), ["X7"]);
});

test("X8 accepte un applied dont les distracteurs cachent l'ordre et refuse l'ordre publie", () => {
  // Les etapes citees, prises dans l'ordre publie, forment ici la reponse meme si un
  // distracteur les separe : c'est interdit.
  const revealed = example("applied");
  revealed.question.options = ["p-locate", "p-readonly", "p-remove", "p-delete"].map((id) =>
    revealed.question.options.find((option) => option.id === id)
  );
  assert.deepEqual(rulesOf(v5PairViolations(revealed.question, revealed.solution)), ["X8"]);
});

const EXERCISE_SLUGS = {
  mcq: "exercise-mcq",
  multi: "exercise-multi",
  scenario: "exercise-scenario",
  spotTheIssue: "exercise-spot-the-issue",
  ordering: "exercise-ordering",
  applied: "exercise-applied",
  cloze: "exercise-cloze",
  matchPairs: "exercise-match-pairs",
};

function v5Id(itemType) {
  return `aws.clf-c02.domain-1.${EXERCISE_SLUGS[itemType]}.001`;
}

// Racine de contenu runtime complete (fixture runtime-v3) enrichie des huit exemples,
// rattaches a la banque de questions AWS de la fixture. Seuls l'id et la metadata sont
// adaptes ; la charge d'exercice (prompt, options, matches, corrige) est celle du contrat.
//
// Par defaut, l'applied est livre SANS son distracteur, pour rester publiable sous la garde
// provisoire (config/exercise-publication-guards.json) ; `appliedDistractors: true` garde
// l'exemple du contrat tel quel. `guards` ecrit un reglage de garde dans la racine.
function createV5Root({ appliedDistractors = false, guards } = {}) {
  const root = mkdtempSync(join(tmpdir(), "certigo-exercise-v5-"));
  temporaryRoots.push(root);
  cpSync(resolve(runtimeFixtureRoot, "content"), resolve(root, "content"), { recursive: true });
  cpSync(resolve(repoRoot, "schemas"), resolve(root, "schemas"), { recursive: true });
  if (guards !== undefined) {
    writeJson(resolve(root, EXERCISE_GUARDS_PATH), guards);
  }
  const coveragePath = resolve(root, "content", "public", "coverage", "aws", "clf-c02.json");
  const coverage = readJson(coveragePath);
  for (const itemType of V5_ITEM_TYPES) {
    const { question, solution } = example(itemType);
    const id = v5Id(itemType);
    question.id = id;
    question.metadata = {
      provider: "aws",
      certification: "aws:clf-c02",
      blueprintVersion: "2026-08-17",
      objective: "domain-1",
      domainId: "aws.clf-c02.domain.cloud-concepts",
      conceptId: "aws.clf-c02.concept.variable-spend",
    };
    solution.id = id;
    if (itemType === "applied" && !appliedDistractors) {
      question.options = question.options.filter((option) =>
        solution.correctOptionIds.includes(option.id)
      );
    }
    writeJson(resolve(root, "content", "public", "questions", "aws", "clf-c02", `${id}.json`), question);
    writeJson(resolve(root, "content", "answerKey", "solutions", "aws", "clf-c02", `${id}.json`), solution);
    coverage.objectives[0].questionIds.push(id);
  }
  writeJson(coveragePath, coverage);
  return root;
}

function sourcePath(root, channel, itemType) {
  const base = channel === "public"
    ? ["content", "public", "questions"]
    : ["content", "answerKey", "solutions"];
  return resolve(root, ...base, "aws", "clf-c02", `${v5Id(itemType)}.json`);
}

test("le validateur accepte les huit types v5 et nomme chaque regle croisee violee", async () => {
  const root = createV5Root({ appliedDistractors: true });
  const accepted = await validateContent({ root });
  assert.deepEqual(accepted.errors, []);
  assert.equal(accepted.pairCount, 5 + 8);

  const orderingPath = sourcePath(root, "public", "ordering");
  const ordering = readJson(orderingPath);
  const answer = readJson(sourcePath(root, "private", "ordering")).correctOptionIds;
  ordering.options = answer.map((id) => ordering.options.find((option) => option.id === id));
  writeJson(orderingPath, ordering);
  const scenarioSolutionPath = sourcePath(root, "private", "scenario");
  writeJson(scenarioSolutionPath, { ...readJson(scenarioSolutionPath), itemType: "mcq" });
  const mcqPath = sourcePath(root, "public", "mcq");
  const mcq = readJson(mcqPath);
  mcq.options[2].id = mcq.options[1].id;
  writeJson(mcqPath, mcq);

  const rejected = await validateContent({ root });
  for (const [rule, id] of [
    ["X8", v5Id("ordering")],
    ["X1", v5Id("scenario")],
    ["X2", v5Id("mcq")],
  ]) {
    assert.ok(
      rejected.errors.some((error) => error.startsWith(`[v5:${rule}]`) && error.includes(id)),
      `${rule} attendu pour ${id}: ${rejected.errors.join(" | ")}`
    );
  }
});

test("le validateur refuse la cle pairs dans le contenu public", async () => {
  const root = createV5Root();
  const matchPath = sourcePath(root, "public", "matchPairs");
  writeJson(matchPath, { ...readJson(matchPath), pairs: ["l-owner:r-all"] });
  const result = await validateContent({ root });
  assert.ok(result.errors.some((error) => error.startsWith("[anti-leak]") && error.includes('"pairs"')));
  assert.ok(result.errors.some((error) => error.startsWith("[schema:question]")));
});

test("le packager livre l'ordre auteur des options, sans tri par id, et rejoue X1 a X9", async () => {
  const root = createV5Root();
  const packaged = await packageContent({ root });
  const verified = await verifyPackagedContent({ root });
  assert.equal(verified.release.releaseId, packaged.releaseId);

  const distRoot = resolve(root, "dist");
  for (const itemType of ["ordering", "applied", "matchPairs"]) {
    const source = readJson(sourcePath(root, "public", itemType));
    const published = readJson(
      resolve(distRoot, "public", "questions", "aws", "clf-c02", `${v5Id(itemType)}.json`)
    );
    const sourceOrder = source.options.map((option) => option.id);
    assert.deepEqual(published.options.map((option) => option.id), sourceOrder, itemType);
    // Temoin : un tri par id aurait change l'ordre, donc l'egalite ci-dessus prouve
    // l'absence de tri et non une coincidence.
    assert.notDeepEqual([...sourceOrder].sort(), sourceOrder, `${itemType}: temoin de tri`);
  }
  const publishedMatches = readJson(
    resolve(distRoot, "public", "questions", "aws", "clf-c02", `${v5Id("matchPairs")}.json`)
  ).matches.map((match) => match.id);
  assert.deepEqual(
    publishedMatches,
    readJson(sourcePath(root, "public", "matchPairs")).matches.map((match) => match.id)
  );

  // Les regles croisees sont rejouees sur les artefacts, pas seulement sur les sources.
  const shippedSolution = resolve(
    distRoot, "private", "solutions", "aws", "clf-c02", `${v5Id("ordering")}.json`
  );
  const solution = readJson(shippedSolution);
  solution.correctOptionIds = solution.correctOptionIds.slice(0, 3);
  writeFileSync(shippedSolution, JSON.stringify(solution), "utf8");
  assert.throws(() => verifyExercisePairs(distRoot), /\[v5:X4\]/);
});

test("la gate anti-fuite de l'artefact public detecte la cle pairs", async () => {
  const root = createV5Root();
  await packageContent({ root });
  writeJson(resolve(root, "dist", "public", "leak.json"), { nested: { pairs: ["a:b"] } });
  assert.throws(() => inspectPublicArtifact(resolve(root, "dist", "public")), /pairs/);
});

test("la porte de livraison exclut ensemble une question v5 et son corrige sans metadata", async () => {
  const root = createV5Root();
  const catalogPath = resolve(root, "content", "public", "catalog", "certifications.json");
  const catalog = readJson(catalogPath);
  const clf = catalog.certifications.find((entry) => entry.id === "aws:clf-c02");
  clf.status = "active-retiring";
  clf.lifecycle = {
    transition: "announced",
    lastExamOn: "2026-12-31",
    recommendThrough: "2026-08-16",
    reviewOn: "2027-01-01",
  };
  writeJson(catalogPath, catalog);
  const coveragePath = resolve(root, "content", "public", "coverage", "aws", "clf-c02.json");
  writeJson(coveragePath, { ...readJson(coveragePath), status: "retiring" });

  const packaged = await packageContent({ root });
  assert.deepEqual(packaged.deliveryGate.excludedCertifications, ["aws:clf-c02"]);
  for (const channel of ["public", "private"]) {
    const manifest = readJson(resolve(root, "dist", channel, "manifest.json"));
    assert.ok(
      !manifest.files.some((entry) => entry.id.startsWith("aws.clf-c02.")),
      `${channel}: aucun fichier aws:clf-c02 ne doit etre livre`
    );
  }
  await verifyPackagedContent({ root });
});

test("tant que la copie backend n'a pas v5, la garde expand avant usage refuserait ce paquet", async () => {
  const root = createV5Root();
  await packageContent({ root });
  const backend = loadBackendContract({ root: repoRoot });
  assert.deepEqual(backend.errors, []);
  const result = validatePackagedPayloads({
    distDir: resolve(root, "dist"),
    schemas: backend.schemas,
    resourceTypes: ["question", "solution"],
  });
  const refusedIds = new Set(V5_ITEM_TYPES.map(v5Id));
  const refused = result.errors.filter((error) =>
    [...refusedIds].some((id) => error.includes(id))
  );
  // Seize fichiers v5 (huit questions, huit corriges) sont refuses, et rien d'autre.
  assert.equal(refused.length, 16, result.errors.join(" | "));
  assert.equal(result.errors.length, 16);
});

test("la garde provisoire est active dans ce depot : un applied avec distracteurs n'est pas publiable", () => {
  // Temoin volontaire : lever la garde (allowAppliedDistractors: true) est une decision
  // qui attend l'interface de selection partielle de Certigo, et doit se voir en revue.
  assert.deepEqual(loadExerciseGuards(repoRoot), { allowAppliedDistractors: false });
  const { question, solution } = example("applied");
  assert.deepEqual(appliedDistractorIds(question, solution), ["p-readonly"]);
  assert.deepEqual(appliedDistractorIds(...Object.values(example("ordering"))), []);
  assert.deepEqual(
    v5PublicationGuardViolations(question, solution).map((entry) => entry.rule),
    ["garde-applied"]
  );
  assert.deepEqual(
    v5PublicationGuardViolations(question, solution, { allowAppliedDistractors: true }),
    []
  );
  // La garde ne fait pas partie du contrat : l'exemple reste conforme a X1-X9.
  assert.deepEqual(v5Violations(question, solution), []);
});

test("la garde refuse a la publication un applied avec distracteurs, et se leve par son reglage", async () => {
  const guarded = createV5Root({ appliedDistractors: true });
  const validation = await validateContent({ root: guarded });
  assert.deepEqual(validation.errors, [], "la garde n'est pas une regle de validation");
  await assert.rejects(
    () => packageContent({ root: guarded }),
    (error) =>
      /\[v5:garde-applied\]/.test(error.message) &&
      error.message.includes(v5Id("applied")) &&
      error.message.includes("p-readonly")
  );

  const explicit = createV5Root({
    appliedDistractors: true,
    guards: { schema: EXERCISE_GUARDS_SCHEMA, allowAppliedDistractors: false },
  });
  await assert.rejects(() => packageContent({ root: explicit }), /\[v5:garde-applied\]/);

  const lifted = createV5Root({
    appliedDistractors: true,
    guards: { schema: EXERCISE_GUARDS_SCHEMA, allowAppliedDistractors: true },
  });
  await packageContent({ root: lifted });
  const published = readJson(
    resolve(lifted, "dist", "public", "questions", "aws", "clf-c02", `${v5Id("applied")}.json`)
  );
  assert.ok(published.options.some((option) => option.id === "p-readonly"));
  await verifyPackagedContent({ root: lifted });

  // La verification finale relit le reglage : reactiver la garde refuse le meme dist.
  writeJson(resolve(lifted, EXERCISE_GUARDS_PATH), {
    schema: EXERCISE_GUARDS_SCHEMA,
    allowAppliedDistractors: false,
  });
  await assert.rejects(() => verifyPackagedContent({ root: lifted }), /\[v5:garde-applied\]/);
});

test("un reglage de garde illisible echoue ferme au lieu de lever la garde", async () => {
  const wrongSchema = createV5Root({ guards: { schema: "autre", allowAppliedDistractors: true } });
  assert.throws(() => loadExerciseGuards(wrongSchema), /schema attendu/);
  await assert.rejects(() => packageContent({ root: wrongSchema }), /schema attendu/);

  const notBoolean = createV5Root({
    guards: { schema: EXERCISE_GUARDS_SCHEMA, allowAppliedDistractors: "oui" },
  });
  assert.throws(() => loadExerciseGuards(notBoolean), /doit etre un booleen/);
});
