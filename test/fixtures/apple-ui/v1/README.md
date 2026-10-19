# Real public Apple UI samples v1

Separate from the immutable `apple-compat/v1` vectors. These samples preserve
three real public v3 questions (Microsoft, AWS, Google Cloud) from the source
revision recorded in `index.json`, plus existing track/domain/concept shapes.
They are test data, not a distributable release or newly authored lessons.

`compiled-check.json` is public output from the existing Node runtime compiler,
not a question source DTO or an HTTP API DTO. The index records lesson/unit IDs
observed in that compiler output, not invented client IDs. v3 choice labels
become stable option IDs through the existing adapter; clients submit the
backend's option IDs, not array positions or independently generated hashes.

## Use and boundaries

Copy only this directory to consumer test resources and pin the content commit.
All JSON payloads are canonical sorted compact UTF-8 with a trailing LF.
`index.json` distinguishes sizes/SHA-256 of that file from the canonical body
without LF; the index itself is test metadata, not a new content schema.

The corpus is questionBank content: there are no canonical units/lessons.
The compiler derives practice lessons; the backend must confirm its discovery
route, exact session mapping, active release and manifest binding. Do not turn
compiler evidence into a claim that these lessons are imported or active.
No active release ID, API route, correction, progress or resume token is invented.
Corrections must come from post-submit server feedback, never from this bank.
V1 resume uses an owner-scoped durable local outbox, not an assumed server
latest-attempt route. Design mockups may use clearly synthetic feedback/progress
states, but must not invent a correction for these real public questions.

Long AWS stems and French diacritics/punctuation exercise wrapping, scrolling,
Dynamic Type and VoiceOver reading in the UI. Assert full stems/labels remain
accessible, option identity survives display order changes, and controls do not
truncate selectable labels. Node tests verify data, not Apple accessibility.
All samples are mcq. Unsupported capabilities are tested separately by
`apple-compat/v1`; a valid unsupported item is not malformed.

Regenerate with `node tools/apple_ui_fixtures.mjs`, verify with
`node tools/apple_ui_fixtures.mjs --check` or
`node --test test/apple_ui_fixtures.test.mjs`.
The existing compiler validates the full corpus, creates isolated temporary
public/private projections locally, copies only public checks here and removes
its temporary output. No publication or backend import occurs.
