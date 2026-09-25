# AGENTS.md

## Repository purpose

This repository contains Certigo editorial content split across two trust zones:

- `content/public/questions/` for distributable question content (no answers)
- `content/answerKey/solutions/` for sensitive answer keys

Tooling and CI produce separate `public` and `private` artifacts with distinct manifests and hashes. Keep this boundary strict in every change.

## Working rules for agents

1. Preserve the public/private separation. Never move answer material into `content/public/questions/`.
2. A public question must not include answer fields: `correct`, `correctOptionIds`, `explanation`, `pairs` or `rationale`.
3. Maintain one-to-one mapping between public question IDs and private solutions.
4. Keep outputs deterministic: avoid machine-specific paths, timestamps, or non-canonical JSON formatting changes that could affect manifest determinism.
5. Make focused, minimal edits; do not refactor unrelated files.

## Setup

- Node.js `20.20.2` (see `.nvmrc`)
- npm `10.8.2`

Install dependencies with:

```bash
nvm use
npm ci
```

## Validation and packaging workflow

Run the smallest relevant checks during iteration, then run full validation before finalizing:

```bash
npm test
npm run validate
npm run manifest:check
npm run package
npm run package:verify
```

Useful targeted commands:

- `npm run package:public`
- `npm run package:private`
- `npm run policy:artifact-access`

## Projecting catalog freshness day by day

`npm run catalog:freshness` fails CI on the first day any source, provider catalog, snapshot or
`lifecycle.reviewOn` expires. The nearest deadline is often not the most visible one, so project it
instead of computing it. The check is offline and deterministic. Run it from the repository root. It
prints one line per day with the exit code and the error count, followed by the first messages:

```powershell
$start = (Get-Date).ToUniversalTime().Date   # or [datetime]'2026-10-15'
foreach ($offset in 0..10) {
  $day = $start.AddDays($offset).ToString('yyyy-MM-dd')
  $out = node tools/check_catalog_freshness.mjs --as-of $day 2>&1
  $errors = @($out | Where-Object { "$_" -match '^\s+- ' })
  "$day exit=$LASTEXITCODE errors=$($errors.Count)"
  $errors | Select-Object -First 3 | ForEach-Object { "  $_" }
}
```

```bash
start=$(date -u +%F)   # or start=2026-10-15
for offset in $(seq 0 10); do
  day=$(date -u -d "${start} +${offset} day" +%F)
  out=$(node tools/check_catalog_freshness.mjs --as-of "$day" 2>&1); status=$?
  printf '%s exit=%s errors=%s\n' "$day" "$status" "$(printf '%s\n' "$out" | grep -c '^  - ')"
  printf '%s\n' "$out" | grep '^  - ' | head -n 3
done
```

The first day with `exit=1` is the real deadline, and its messages name the entries to re-verify
against their official sources. Re-verifying an entry means updating `provenance.checkedOn` and,
per campaign, `asOf` with `freshness.reviewDueOn = asOf + maxAgeDays`. A `reviewOn` is cleared
only by reading the source again, never by moving its date. See `docs/editorial/README.md`, section
"Une echeance se dichotomise, elle ne se deduit pas".

## Backend content contract: expand before use

The Certigo backend re-validates every release at import against its **own embedded copies** of the
schemas (`backend/src/Certigo.Infrastructure/ContentContracts/Schemas/` in `gchambaud_microsoft/Certigo`).
Its C# catalog parser also rejects unknown properties. If content uses a field the backend does not
know yet, the import rejects the release, and by then the release is already published, which cannot
be undone. This happened with `lifecycle.transition`: PR #84 added it here, and the backend only
accepted it with Certigo#511.

`config/backend-accepted-schemas/` holds a copy of those backend schemas, pinned to a named Certigo
revision in `SOURCE.json`. `npm run contract:backend` (run by `package-gates` and by the
publication plan) fails when:

- any document of the built package (descriptor, manifests, payloads) is rejected by that copy, or
- the copy was edited by hand (its hashes no longer match `SOURCE.json`), or it is missing.

A content schema that is ahead of the copy is only reported as a note. What fails is **using** a
shape the backend rejects.

To use a new field or a new shape:

1. Open a Certigo PR that makes the backend accept it (schema and C# parser: the *expand* step), and
   get it merged.
2. Resynchronize the copy from a Certigo checkout of that merged revision. The bytes come from the
   `HEAD` git objects, not from the working tree:
   `npm run contract:backend -- --sync-from <path-to-Certigo-checkout>`
3. Only then change the content that uses the field, possibly in the same PR as step 2.

Before an import, the backend must also have been **deployed** with that revision. For the exact
importer, replay `CandidateContentPackageTests` from Certigo on the local `dist/` (see
`docs/runbooks/CONTENT_RELEASES.md` in Certigo).

## Provisional publication guards for v5 exercises

`config/exercise-publication-guards.json` holds temporary guards that the packager applies at
publication (`npm run package`, `package:verify`, `contract:backend` and the publication plan). They
are not contract rules, and `npm run validate` does not apply them.

- `allowAppliedDistractors` is `false`: an `applied` item whose options are not all cited by
  `correctOptionIds` is refused with `[v5:garde-applied]`. X5 allows such distractors, but the app
  only lets the learner submit once every option is placed, so the item would be impossible to pass.
  Certigo applies the same rule to its legacy corpus (`APPLIED_DISTRACTORS_NOT_YET_SUPPORTED`,
  decision Q-G, Certigo#530).
- Set the value to `true` only when **all three** lifting conditions of Certigo's `docs/EXERCICES.md`
  (section "Garde provisoire sur les distracteurs d'`applied`") hold:
  1. the app lets the learner submit an `applied` answer once 2 steps are placed, with accessible
     reordering;
  2. that app version is the only one learners have, checked on the latest distributed build;
  3. the parity vectors cover subsets.
  Deploying the backend alone is not enough. A missing file or key keeps the guard active, and an
  unreadable value fails the build.

## Expected change process

1. Update matching JSON pairs in the appropriate public/private locations.
2. Validate locally with the commands above.
3. Ensure generated artifacts and manifests remain deterministic and policy-compliant.

## Notes

- Historical and rollback artifact behavior is documented in `docs/adr/ADR-0002-separated-content-artifacts.md`.
- CI security checks include `npm audit`, OSV scanning on `package-lock.json`, and SBOM generation for tooling.
