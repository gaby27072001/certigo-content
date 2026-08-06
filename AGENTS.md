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

## Expected change process

1. Update matching JSON pairs in the appropriate public/private locations.
2. Validate locally with the commands above.
3. Ensure generated artifacts and manifests remain deterministic and policy-compliant.

## Notes

- Historical and rollback artifact behavior is documented in `docs/adr/ADR-0002-separated-content-artifacts.md`.
- CI security checks include `npm audit`, OSV scanning on `package-lock.json`, and SBOM generation for tooling.
