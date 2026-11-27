# T000: <Verb-first title, one concept>

<!-- BEGIN GENERATED SCOPE -->
<!-- END GENERATED SCOPE -->

## Goal

<One sentence: the observable outcome when this card passes.>

## Context

<2-4 lines. Which module this is, which cards came before (what they built), which cards come
after (what they will need from this one). Information only.>

## Contracts (do not modify)

```ts
// <contract file path>
<paste the exact excerpt this card uses: types, interface, signature with its doc comment>
```

## Current state

`<path of the stub>` currently contains:

```ts
<paste the stub, at most ~40 lines>
```

## Steps

1. In `<path>`, <exact action naming the function, class or export>.
2. ...
3. Create `<test path>` with these tests (names exact):
   - `test("<name>")`: <what it arranges, calls and asserts>
   - ...
4. Run the gate (see Verify).

## Acceptance criteria

- WHEN <event> THE SYSTEM SHALL <behaviour>. (test: "<test name>")
- IF <unwanted condition> THEN THE SYSTEM SHALL <behaviour>. (test: "<test name>")

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T000`.
The last line must be `GATE PASS T000`. On `GATE FAIL T000 <step>`, open the log the gate names
under `handover/.run/logs/`, fix inside your files only, and rerun.

## Do NOT

- Do not edit any contract file or anything under `handover/` except PROGRESS.md and BLOCKED.md.
- Do not add dependencies or edit package manifests or lockfiles.
- Do not import from other modules; use only the contracts.
- Do not delete, skip or weaken any test.
- <card-specific tempting wrong moves>

## Done when

- `verify.ps1 -Card T000` prints `GATE PASS T000`.
- Only the files in the scope block changed.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### T000: <title>
- Result: GATE PASS | GATE FAIL <step>
- Files changed: <list>
- Commands run: <command> -> <result>
- Deviations: none | <each choice this card did not dictate>
- Learnings: none | <one line>
```
