# Apple content compatibility fixtures v1

This directory is a language-neutral fixture suite for clients consuming the
existing Certigo public content contract. It adds no content schema, API, or
publication format.

`expected-outcomes.json` is the test contract. It distinguishes:

- schema-valid content supported by the `apple-basic-v1` capability profile;
- schema-valid content that the profile cannot render, which must be reported
  as `unsupported-capability` rather than malformed or silently skipped;
- malformed mutations, which clients and validators must reject.

The `v4-spot-the-issue.json` probe is valid against both the repository schema
and the currently pinned backend schema. The example profile intentionally
supports only `mcq`, so it demonstrates capability handling without claiming
that the question is corrupt or changing what the backend accepts.

Each payload digest has two explicit byte definitions:

- `canonicalBody`: recursively sorted keys, compact JSON, UTF-8, no trailing
  line feed. Its size and SHA-256 match the content-manifest item hash model.
- `packageFile`: the same canonical JSON followed by one LF, UTF-8. Its size
  and SHA-256 match the bytes stored in a package payload file.

These payload vectors do not replace validation of package manifests, root
hashes, release descriptors, or package activation. Consumers must continue to
use the existing manifest and release contracts.

The fixtures contain public question shapes only. Negative answer-leak cases
are mutations performed in memory by the test; no solution or answer-key
fixture is stored here.

## Extraction

The suite is repository content at `test/fixtures/apple-compat/v1/`. A consumer
repository can pin this repository revision and copy this directory into its
test resources, preserving the directory structure. Do not copy private
`content/answerKey/` files or infer answer keys from public fixture values.

Run the producer-side checks with:

```powershell
node --test test/apple_compat_fixtures.test.mjs
```
