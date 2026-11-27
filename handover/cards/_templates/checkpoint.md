# C0: Phase <n> checkpoint: <what the phase delivered>

<!-- BEGIN GENERATED SCOPE -->
<!-- END GENERATED SCOPE -->

## Goal

Prove that everything built so far works together: the full test suite and the smoke test pass.

## Phase summary

| Card | Delivered |
|---|---|
| T00x | <one line> |

## Verify

Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card C0`.
The last line must be `GATE PASS C0`.

## Allowed fixes

If a gate fails, you may fix code only inside the files listed under Modify in the scope block
(the files this phase created or changed), and only to make an existing test pass as written.
If the fix needs any other file, a contract change, or a test change, STOP and write a BLOCKED
entry.

## Do NOT

- Do not add features, refactor, or change behaviour that already passes.
- Do not edit, skip or delete tests.
- Do not edit contract files, package manifests or lockfiles.

## Done when

- `verify.ps1 -Card C0` prints `GATE PASS C0`.
- Your report is appended to `handover/PROGRESS.md`.

## Report

Append to `handover/PROGRESS.md` under `## Log`:

```markdown
### C0: <title>
- Result: GATE PASS | GATE FAIL <step>
- Files changed: none | <list>
- Commands run: <command> -> <result>
- Deviations: none | <each fix made and why>
- Learnings: none | <one line>
```
