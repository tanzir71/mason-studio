# S000: <Verb-first title naming producer and consumer>

<!-- BEGIN GENERATED SCOPE -->
<!-- END GENERATED SCOPE -->

## Goal

<One sentence: what is connected and what now works end to end.>

## Context

Seam <producer> → <consumer> (<seam type>). <Which build cards produced each side. Which seam
cards come before and after at the same anchors.>

## Contracts (do not modify)

```ts
// <contract file path>
<exact excerpt of every symbol crossing this boundary>
```

## Touch list

### <file path> (modify)

Anchor: `<exact anchor line>`

Insert directly above the anchor:

```ts
<exact code>
```

Before:

```ts
<2-6 lines including the anchor, as the file is now>
```

After:

```ts
<the same lines after the insertion, anchor kept>
```

### <test file path> (create)

```ts
<exact test file content, or exact test names and assertions>
```

## Steps

1. Open `<file>`. Insert the code from the touch list directly above `<anchor>`. Keep the anchor.
2. ...
3. Create `<test file>` exactly as given.
4. Run the gate (see Verify).

## Acceptance criteria

- WHEN <event crossing the boundary> THE SYSTEM SHALL <observable result>. (test: "<name>")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card S000`.
The last line must be `GATE PASS S000`. If it prints `GATE FAIL S000 scope`, you changed a file
or line outside the touch list: undo that change.

## Do NOT

- Do not change any line other than the insertions in the touch list.
- Do not move, rename or delete any `@seam:` anchor line.
- Do not edit the producer's or the consumer's module code beyond the touch list.
- Do not edit contract files, package manifests or lockfiles.

## Done when

- `verify.ps1 -Card S000` prints `GATE PASS S000`.
- Only the files in the touch list changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### S000: <title>
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
