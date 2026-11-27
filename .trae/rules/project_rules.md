<!-- deepseek-handover executor pointer -->
## Handover executor

This repo is built card by card from `handover/`. The plan there is final; do not redesign it.

When the user says "next card", "continue" or "start", or names a card id (T003, S002, C1):

1. Run `powershell -NoProfile -ExecutionPolicy Bypass -File handover/ide.ps1 next`
   (with `-Card <ID>` when the user named one). It prints your card.
2. Follow `handover/EXECUTOR-RULES.md` exactly and work only on that card.
3. End with `powershell -NoProfile -ExecutionPolicy Bypass -File handover/ide.ps1 finish`, then stop.

You run inside the IDE with its built-in model: no API key is needed. Never ask for one, and
never run `handover/run-loop.ps1` (it drives a separate CLI agent). If `handover/run-loop.ps1`
started you, your card is the message and the same rules apply.
<!-- /deepseek-handover executor pointer -->
