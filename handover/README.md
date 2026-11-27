# Handover

This folder is a complete, pre-planned build for an executor model (DeepSeek V4.1 Flash by
default). It was written by a planner (Claude with the `deepseek-handover` skill).

| File | Owner | Purpose |
|---|---|---|
| `00-OVERVIEW.md` | planner | Requirements, stack, module map, seam matrix, phases |
| `01-CONTRACTS.md` | generated | Every contract file, verbatim |
| `TASK-GRAPH.json` | planner | Cards, dependencies, file scopes, verify commands |
| `cards/` | planner | One instruction file per card |
| `EXECUTOR-RULES.md` | planner | Rules every executor session follows |
| `PROGRESS.md` | executor + scripts | Append-only reports and run log |
| `BLOCKED.md` | executor + scripts | Cards that could not pass, for the planner to repair |
| `STATE.json` | scripts | Card status (todo / passed / blocked) |
| `loop.config.json` | you | `mode` (`ide` or `loop`), the CLI harness for loop mode, timeouts |
| `ide.ps1` | planner | IDE mode: next card, finish (gate + commit), block, status |
| `*.ps1` | planner | Gate, init, next-task, CLI run loop |
| `.run/` | scripts (gitignored) | Logs, prompts, temp files |

## Run it in your IDE (default, no API key)

Use an IDE whose agent has the model built in (for example DeepSeek in Trae, Cursor, Windsurf or
Kilo Code). The agent reads the pointer in `AGENTS.md` (and the IDE's own rules file, if the
planner wrote one) and does one card per chat.

1. Open the repo folder in the IDE. Set the chat to agent mode with the DeepSeek model.
2. Start a new chat and say: **next card**.
3. The agent runs `handover/ide.ps1 next`, does the card, checks it with `verify.ps1`, then runs
   `handover/ide.ps1 finish`, which re-runs the gate itself and commits the card.
4. When it says the card is done, start a new chat and say **next card** again. A new chat per
   card keeps the model's context small, which is what keeps it reliable.

The first `next` makes the first commit if the repo has none, and the first installs can take
several minutes. If your IDE stops long commands early, run the same command once in your own
terminal:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File handover/ide.ps1 next
powershell -NoProfile -ExecutionPolicy Bypass -File handover/ide.ps1 status
```

## Run it unattended from a terminal (loop mode, needs an API key)

Set `"mode": "loop"` in `loop.config.json`, then:

```powershell
$env:DEEPSEEK_API_KEY = "<your DeepSeek API key>"
powershell -NoProfile -ExecutionPolicy Bypass -File handover\run-loop.ps1 -DryRun   # review the first prompt
powershell -NoProfile -ExecutionPolicy Bypass -File handover\run-loop.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File handover\run-loop.ps1 -MaxCards 3
powershell -NoProfile -ExecutionPolicy Bypass -File handover\next-task.ps1 -List
powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T004
```

The repo must be a git repository with a clean working tree. In both modes each passed card
becomes one commit, and failed attempts are stashed (`git stash list`), never discarded.

## When it stops

If cards are blocked, give `handover/BLOCKED.md` back to the planner ("repair the handover").
The planner edits or splits cards, then resets them; you continue with "next card" (or rerun
the loop).
