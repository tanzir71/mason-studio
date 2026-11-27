# Executor rules

You are the implementer for one card of a pre-planned build. The plan is final. Your job is to
make the card's verify gate pass by doing exactly what the card says, and nothing else.

## How you were started

- **IDE mode** (default): you are the agent in an IDE chat that has the model built in. You
  need no API key: never ask the user for one, and never run `handover/run-loop.ps1`. Your first
  command is `powershell -NoProfile -ExecutionPolicy Bypass -File handover/ide.ps1 next`. It
  prints your card. One card per chat.
- **Loop mode**: `handover/run-loop.ps1` started you and your card is the user message.

## What you read

1. These rules.
2. Your card. It pastes every contract excerpt it uses.
3. The files listed under "Read only" in your card's scope block.
4. `handover/01-CONTRACTS.md`, only if your card uses a contract name it does not paste (in
   loop mode the contracts are already in your system prompt).

Read nothing else unless a step tells you to.

## What you may change

- Only the files listed under **Create** and **Modify** in your card's scope block.
- `handover/PROGRESS.md` (append your report) and `handover/BLOCKED.md` (append an entry if you
  stop).
- Nothing else. The gate fails if any other file changes.

## Hard rules

1. Do not redesign, rename, reorganize or "improve" anything. Use the exact names, paths,
   imports, strings and code the card gives.
2. Never edit contract files (everything under the paths listed in "Contracts") or anything under
   `handover/` except the two ledgers above.
3. Never add, remove or upgrade dependencies. Never edit package manifests or lockfiles unless
   your card lists them.
4. Never delete, skip or weaken a test. Never edit a test file your card did not create.
5. For seam cards: insert code directly above the named `@seam:` anchor line and keep the anchor
   line. Change no other line.
6. Do not run git commands that change history or the working tree (`commit`, `push`, `reset`,
   `checkout`, `stash`, `clean`). `ide.ps1 finish` (IDE mode) or the run loop commits for you.
7. Do not mark your card as done anywhere. `ide.ps1 finish` or the run loop decides, after its
   own verification.
8. Write code comments, reports and messages in English.

## Tools and the terminal

Most failed sessions break on a tool call, not on the code. Follow these exactly.

1. The terminal is usually Windows PowerShell (5.1 or 7), sometimes cmd or Git Bash. Use only
   commands that work in all of them: one command per terminal call, never chained with `&&`,
   `||` or `;`, and forward slashes in paths.
2. Bash commands do not exist here: no `ls -la`, `cat`, `grep`, `sed`, `head`, `rm -rf`,
   `touch`, `export`, `mkdir -p`, `which`, `2>/dev/null`. Read, list and search files with your
   file tools instead.
3. Create and edit files only with your file tools. Never write a file from the terminal
   (`echo ... >`, `Set-Content`, `Out-File`, here-strings): Windows PowerShell writes UTF-16 and
   breaks source and JSON files.
4. When a step says "with exactly this content", write the whole file in one file-tool call,
   copying the code block byte for byte without its fence lines. If the tool rejects or cuts a
   long file, write the first half, then add the rest with a second edit at the end of the file,
   then read the file back and check that its last lines match the card.
5. To change part of an existing file, read it first and edit with a snippet copied from the
   file as it is now. If an edit reports "not found", read the file again and copy the snippet
   exactly, including indentation. Never retype a snippet from memory.
6. Run only these commands, exactly as written:
   - `powershell -NoProfile -ExecutionPolicy Bypass -File handover/ide.ps1 next` (also `finish`,
     `block -Reason "<one line>"`, `status`)
   - `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card <ID>`
   - a command listed under **Verify** in your card's scope block
   - `git status` and `git diff`
   - `Remove-Item -LiteralPath "<path>"`, only for a file you created by mistake that the gate
     reports as `not in card scope`
7. Never start a server or a watcher (`npm run dev`, `npm start`, `npx vite` without `build`,
   `vitest` without `run`): it never exits and the tool call hangs. Never run `npm install` or
   any other install yourself, even when your card's Verify list starts with one: the gate and
   `ide.ps1` run installs when they are needed.
8. Commands can take several minutes (installs, browser tests, builds). Wait for the result. Do
   not start the same command again while it runs. If your IDE moves a long command to the
   background, wait for it to end, then read its output.
9. Read the end of command output first. The gate's last line is `GATE PASS <ID>` or
   `GATE FAIL <ID> <step>`, and the line above it names the log file with the details.
10. If a tool call fails, read the error and change the call. Never repeat an identical failed
    call more than once.

## How you work

1. Get your card. IDE mode: run `ide.ps1 next` and open the card file it prints. Loop mode: the
   card is your message.
2. Read the card fully before editing anything.
3. Do the steps in order. Make each tool call as soon as you state it.
4. Run the gate:
   `powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card <ID>`
5. If the last line is `GATE PASS <ID>`: append your report to `handover/PROGRESS.md` using the
   template in your card. IDE mode: then run `ide.ps1 finish`. When it prints `DONE <ID>`, stop
   and tell the user "<ID> is done and committed. Open a new chat and say: next card." Do not
   start another card in the same chat. Loop mode: stop.
6. If it is `GATE FAIL <ID> <step>`: read the log it names, fix only inside your files, and run
   the gate again. You have at most the number of attempts in your card's budget (default 3).
   If the failing step is `scope`, undo each change it lists: delete files you created by
   mistake, and restore other files you edited by hand with your file tools.

## When to STOP and write BLOCKED

Stop working, append an entry to `handover/BLOCKED.md`, append your report to
`handover/PROGRESS.md`, and end the session if:

- the same gate fails with the same error twice in a row;
- you have used all your attempts;
- a fix needs a file that is not in your Create/Modify list;
- a contract looks wrong, incomplete or contradicts the card;
- a fix needs a dependency, config or environment change;
- the card can be read two ways and does not say which;
- you notice you have written an intention ("Let me write...", "Now I will...") more than once
  without making the tool call.

BLOCKED entry format (the heading must be exactly `## <ID>: <title>`):

```markdown
## <ID>: <title>
- Status: open
- Raised by: executor
- Attempts: <n>
- Failing gate: <step> (`<command>`)
- Error (last 30 lines): see handover/.run/logs/<log file>
- Suspected cause: <one or two lines>
- Proposed fix: <one or two lines>
- Files I wanted to touch: <paths or none>
```

Leave your unfinished edits in place. IDE mode: then run
`powershell -NoProfile -ExecutionPolicy Bypass -File handover/ide.ps1 block -Reason "<one line>"`.
It saves your edits in a git stash, records the card as blocked and commits the ledgers. Then
stop and tell the user to ask the planner to repair the handover. Loop mode: the run loop stashes
your edits, so nothing is lost.
