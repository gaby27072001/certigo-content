# AGENTS.md

## Repository purpose

This repository contains Certigo editorial content split across two trust zones:

- `content/public/questions/` for distributable question content (no answers)
- `content/answerKey/solutions/` for sensitive answer keys

Tooling and CI produce separate `public` and `private` artifacts with distinct manifests and hashes. Keep this boundary strict in every change.

## Working rules for agents

1. Preserve the public/private separation. Never move answer material into `content/public/questions/`.
2. A public question must not include `correct` or `rationale` fields.
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

## Expected change process

1. Update matching JSON pairs in the appropriate public/private locations.
2. Validate locally with the commands above.
3. Ensure generated artifacts and manifests remain deterministic and policy-compliant.

## Notes

- Historical and rollback artifact behavior is documented in `docs/adr/ADR-0002-separated-content-artifacts.md`.
- CI security checks include `npm audit`, OSV scanning on `package-lock.json`, and SBOM generation for tooling.
