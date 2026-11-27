# ide.ps1 - run the handover from an IDE chat whose agent already has the model built in
# (for example DeepSeek inside Trae, Cursor, Windsurf or Kilo Code). No API key, no CLI harness:
# the IDE agent does the card, this script picks the card, runs the gate itself and commits.
# One card per chat.
#
# Usage (from the repo root, in the IDE terminal):
#   powershell -NoProfile -ExecutionPolicy Bypass -File handover/ide.ps1 next              # this chat's card
#   powershell -NoProfile -ExecutionPolicy Bypass -File handover/ide.ps1 next -Card T004    # a specific ready card
#   powershell -NoProfile -ExecutionPolicy Bypass -File handover/ide.ps1 finish            # gate; commit on GATE PASS
#   powershell -NoProfile -ExecutionPolicy Bypass -File handover/ide.ps1 block -Reason "<one line>"
#   powershell -NoProfile -ExecutionPolicy Bypass -File handover/ide.ps1 status
#
# Exit codes: 0 ok, 1 not done or failed (read the printed lines), 2 no card left to run.
# Compatible with Windows PowerShell 5.1 and PowerShell 7+. Keep this file ASCII-only.
param(
    [Parameter(Position = 0)][ValidateSet('next', 'finish', 'block', 'status')][string]$Action = 'next',
    [string]$Card = '',
    [string]$Reason = '',
    [switch]$SkipInit
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib.ps1')
Initialize-HandoverDirs

$script:IdePath = Join-Path $script:RunDir 'ide.json'
$script:Ps = 'powershell -NoProfile -ExecutionPolicy Bypass -File'

# ---------------------------------------------------------------- small helpers

function Get-IdeState {
    $s = [ordered]@{ current = ''; started = ''; attempts = 0; last_commit = ''; init_stamp = '' }
    if (Test-Path -LiteralPath $script:IdePath) {
        try {
            $o = Read-JsonFile $script:IdePath
            foreach ($k in @('current', 'started', 'last_commit', 'init_stamp')) { $s[$k] = [string](Get-Prop $o $k '') }
            $s['attempts'] = [int](Get-Prop $o 'attempts' 0)
        } catch { }
    }
    return $s
}

function Save-IdeState($S) { Write-TextFile $script:IdePath (($S | ConvertTo-Json -Depth 3) + "`n") }

function Get-HeadShort {
    $r = Invoke-Git @('rev-parse', '--short', 'HEAD')
    if ($r.Code -ne 0) { return '' }
    return $r.Out.Trim()
}

function Add-IdeLog([string]$Line) {
    Add-TextToFile (Join-Path $script:HandoverDir 'PROGRESS.md') ('- ' + (Get-Date).ToString('yyyy-MM-dd HH:mm') + " [ide] $Line`n")
}

function Get-MaxAttempts($CardObj) {
    $exec = Get-Prop $script:Graph 'executor'
    $budget = Get-Prop $CardObj 'budget'
    $default = [int](Get-Prop $exec 'max_attempts' 3)
    return [int](Get-Prop $CardObj 'max_attempts' (Get-Prop $budget 'max_attempts' $default))
}

function Invoke-Commit([string]$Message, [string[]]$Paths) {
    if ($null -ne $Paths -and $Paths.Count -gt 0) { $null = Invoke-Git (@('add', '--') + $Paths) }
    else { $null = Invoke-Git @('add', '-A') }
    $r = Invoke-Git @('commit', '-q', '-m', $Message)
    if ($r.Code -ne 0 -and $r.Out -notmatch 'nothing to commit|nothing added to commit') {
        if ($r.Out -match 'user\.email|user\.name|identity') {
            Write-Host '[ide] git does not know who you are yet. Ask the user to run these two commands once, then run this again:'
            Write-Host '  git config --global user.name "<your name>"'
            Write-Host '  git config --global user.email "<your email>"'
            exit 1
        }
        throw "git commit failed: $($r.Out)"
    }
}

function Get-IdeStashRef([string]$Message) {
    $r = Invoke-Git @('stash', 'list')
    foreach ($line in ($r.Out -split "`n")) {
        if ($line.Contains($Message)) { return ($line -split ':')[0] }
    }
    return ''
}

# Changes to these files decide whether init (install) has to run again.
function Get-InitStamp {
    $parts = @()
    foreach ($step in @(Get-Prop (Get-Prop $script:Graph 'project') 'init' @())) {
        $w = [string](Get-Prop $step 'when_exists' '')
        if (-not $w) { continue }
        $p = Join-Path $script:RepoRoot $w
        if (Test-Path -LiteralPath $p -PathType Leaf) {
            $i = Get-Item -LiteralPath $p
            $parts += ($w + ':' + $i.Length + ':' + $i.LastWriteTimeUtc.Ticks)
        } else {
            $parts += ($w + ':' + [string](Test-Path -LiteralPath $p))
        }
    }
    return ($parts -join '|')
}

function Get-OpenBlockers {
    $list = @()
    foreach ($c in @($script:Graph.cards)) {
        if ((Get-CardStatus $script:State $c.id) -eq 'blocked') { $list += $c }
    }
    return ,$list
}

function Write-Totals {
    $counts = @{}
    foreach ($c in @($script:Graph.cards)) {
        $st = Get-CardStatus $script:State $c.id
        if (-not $counts.ContainsKey($st)) { $counts[$st] = 0 }
        $counts[$st]++
    }
    Write-Host ('[ide] cards: ' + (($counts.Keys | Sort-Object | ForEach-Object { "$_=$($counts[$_])" }) -join ', ') + " (of $(@($script:Graph.cards).Count))")
}

function Write-Brief($CardObj, [bool]$Resumed) {
    $id = [string]$CardObj.id
    $line = '=' * 72
    Write-Host ''
    Write-Host $line
    Write-Host "YOUR CARD: $id  $($CardObj.title)"
    Write-Host "Type: $(Get-Prop $CardObj 'type' 'build'), phase $(Get-Prop $CardObj 'phase' '?'), effort $(Get-Prop $CardObj 'effort' 'high')"
    Write-Host "Card file: handover/$($CardObj.file)"
    if ($Resumed) {
        Write-Host ''
        Write-Host 'RESUMING: this card was started in an earlier chat. Files changed so far:'
        $changed = Get-ChangedFiles
        if ($changed.Count -eq 0) { Write-Host '  (none)' } else { $changed | ForEach-Object { Write-Host "  $_" } }
        Write-Host 'Read them before editing, then continue from the first step that is not done.'
    }
    Write-Host $line
    Write-Host '1. Read handover/EXECUTOR-RULES.md, then the card file above, in full.'
    Write-Host "2. Do the card's Steps in order, using your IDE's file tools for every file."
    Write-Host "3. Check:  $script:Ps handover/verify.ps1 -Card $id"
    Write-Host '4. On GATE PASS, append your report to handover/PROGRESS.md (template at the end of the card).'
    Write-Host "5. Finish: $script:Ps handover/ide.ps1 finish"
    Write-Host '   It runs the gate again and commits. Then stop and tell the user to open a new chat.'
    Write-Host "Stuck (see EXECUTOR-RULES): $script:Ps handover/ide.ps1 block -Reason `"<one line>`""
    Write-Host 'No API key is needed. Do not run run-loop.ps1. Do not commit, stash or reset yourself.'
    Write-Host $line
}

function Invoke-Block($CardObj, [string]$Why, [string]$RaisedBy) {
    $id = [string]$CardObj.id
    $title = [string]$CardObj.title
    $blockedPath = Join-Path $script:HandoverDir 'BLOCKED.md'
    $progressPath = Join-Path $script:HandoverDir 'PROGRESS.md'
    $committedBlocked = ''
    $show = Invoke-Git @('show', 'HEAD:handover/BLOCKED.md')
    if ($show.Code -eq 0) { $committedBlocked = $show.Out }
    $progressText = Read-TextFile $progressPath
    $blockedText = Read-TextFile $blockedPath
    $heading = '(?m)^##\s+' + [regex]::Escape($id) + ':'
    $agentEntry = ([regex]::Matches($blockedText, $heading).Count -gt [regex]::Matches($committedBlocked, $heading).Count)

    $stashMsg = "handover $id ide " + (Get-Date).ToString('yyyyMMdd-HHmmss')
    $null = Invoke-Git @('stash', 'push', '-u', '-m', $stashMsg)
    $stashRef = Get-IdeStashRef $stashMsg
    Write-TextFile $progressPath $progressText
    Write-TextFile $blockedPath $blockedText
    $preserved = 'nothing to preserve (no changes)'
    if ($stashRef) { $preserved = "$stashRef `"$stashMsg`"" }

    if ($agentEntry) {
        Add-TextToFile $blockedPath ("- Preserved work: $preserved`n")
    } else {
        $entry = "`n## ${id}: $title`n- Status: open`n- Raised by: $RaisedBy`n- Attempts: $($script:Ide.attempts)`n" +
                 "- Failing gate: $Why`n- Suspected cause: unknown`n- Preserved work: $preserved`n"
        Add-TextToFile $blockedPath $entry
    }
    Set-CardState $script:State $id 'blocked' $Why
    Add-IdeLog "$id BLOCKED ($Why); work preserved: $preserved"
    Save-State $script:State
    Invoke-Commit "${id}: blocked (ledgers)" @('handover/PROGRESS.md', 'handover/BLOCKED.md', 'handover/STATE.json')
    $script:Ide.current = ''
    $script:Ide.attempts = 0
    $script:Ide.last_commit = Get-HeadShort
    Save-IdeState $script:Ide
    Write-Host ''
    Write-Host "BLOCKED $id. The work is saved in git stash ($preserved) and the entry is in handover/BLOCKED.md."
    Write-Host 'Stop now. Tell the user: ask the planner to repair the handover (handover/BLOCKED.md).'
}

# ---------------------------------------------------------------- actions

function Invoke-Next {
    if ($null -eq (Get-Command git -ErrorAction SilentlyContinue)) {
        Write-Host '[ide] Git is not installed or not on PATH. Ask the user to install Git for Windows, then run this again.'
        exit 1
    }
    if ((Invoke-Git @('rev-parse', '--is-inside-work-tree')).Code -ne 0) {
        $null = Invoke-Git @('init', '-q')
        Write-Host '[ide] created a git repository in this folder'
    }
    if ((Invoke-Git @('rev-parse', '--verify', 'HEAD')).Code -ne 0) {
        Invoke-Commit 'chore: add the build handover' @()
        Write-Host "[ide] committed the handover as the first commit ($(Get-HeadShort))"
        $script:Ide.last_commit = Get-HeadShort
        Save-IdeState $script:Ide
    }

    # A card from an earlier chat that is still open: resume it.
    if ($script:Ide.current) {
        $st = Get-CardStatus $script:State $script:Ide.current
        if ($st -ne 'passed' -and $st -ne 'blocked') {
            if ($Card -and $Card -ne $script:Ide.current) {
                Write-Host "[ide] Card $($script:Ide.current) is still in progress. Finish it (ide.ps1 finish) or block it (ide.ps1 block) before starting $Card."
                exit 1
            }
            Write-Brief (Get-Card $script:Graph $script:Ide.current) $true
            exit 0
        }
        $script:Ide.current = ''
        Save-IdeState $script:Ide
    }

    $dirty = Get-ChangedFiles
    if ($dirty.Count -gt 0) {
        Write-Host '[ide] The working tree has changes that belong to no card:'
        $dirty | ForEach-Object { Write-Host "  $_" }
        Write-Host 'Stop. Tell the user to commit or stash these changes themselves, then say "next card" again.'
        exit 1
    }

    $blockers = Get-OpenBlockers
    $stopAfter = 2
    try { $stopAfter = [int](Get-Prop (Get-LoopConfig '') 'stop_after_blocked' 2) } catch { }
    $blockedCheckpoint = @($blockers | Where-Object { [string]$_.type -eq 'checkpoint' })
    if ($blockedCheckpoint.Count -gt 0 -or $blockers.Count -ge $stopAfter) {
        Write-Host "[ide] $($blockers.Count) card(s) are blocked: $((@($blockers) | ForEach-Object { $_.id }) -join ', ')."
        Write-Host 'Stop. Tell the user: ask the planner to repair the handover (handover/BLOCKED.md).'
        exit 1
    }

    if (-not $SkipInit) {
        $stamp = Get-InitStamp
        if ($stamp -ne $script:Ide.init_stamp) {
            Write-Host '[ide] preparing the repo (installs can take several minutes the first time; wait for this command to finish)'
            & (Join-Path $script:HandoverDir 'init.ps1')
            if ($LASTEXITCODE -ne 0) {
                Write-Host '[ide] init failed (see the lines above). Stop and tell the user what is missing; do not try to fix the environment yourself.'
                exit 1
            }
            $script:Ide.init_stamp = Get-InitStamp
            Save-IdeState $script:Ide
        }
    }

    $anyPassed = $false
    foreach ($k in $script:State.Keys) { if ($script:State[$k].status -eq 'passed') { $anyPassed = $true } }
    $baseline = @(Get-Prop $script:Graph 'baseline' @())
    $head = Get-HeadShort
    if ($anyPassed -and $baseline.Count -gt 0 -and $head -ne $script:Ide.last_commit) {
        Write-Host '[ide] the last commit was not made by ide.ps1; running the baseline gate'
        if (-not (Invoke-CommandList $baseline 'baseline')) {
            Write-Host '[ide] Baseline gate failed: the repo is not green. Stop and tell the user to ask the planner to repair it.'
            exit 1
        }
        $script:Ide.last_commit = $head
        Save-IdeState $script:Ide
    }

    if ($Card) {
        $target = Get-Card $script:Graph $Card
        if ((Get-CardStatus $script:State $Card) -eq 'passed') { Write-Host "[ide] $Card has already passed."; exit 2 }
        foreach ($d in (ConvertTo-StringArray (Get-Prop $target 'depends_on'))) {
            if ((Get-CardStatus $script:State $d) -ne 'passed') { Write-Host "[ide] $Card depends on $d, which has not passed yet."; exit 1 }
        }
    } else {
        $target = Get-NextCard $script:Graph $script:State
    }
    if ($null -eq $target) {
        Write-Totals
        Write-Host '[ide] No ready card left. The build is complete, or the remaining cards wait on blocked ones.'
        exit 2
    }
    $script:Ide.current = [string]$target.id
    $script:Ide.started = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
    $script:Ide.attempts = 0
    Save-IdeState $script:Ide
    Write-Totals
    Write-Brief $target $false
    exit 0
}

function Invoke-Finish {
    if (-not $script:Ide.current) {
        Write-Host "[ide] No card is in progress. Run: $script:Ps handover/ide.ps1 next"
        exit 1
    }
    $c = Get-Card $script:Graph $script:Ide.current
    $id = [string]$c.id
    $gate = Invoke-CardGate $script:Graph $c
    if ($gate.Pass) {
        Set-CardState $script:State $id 'passed' ''
        Add-IdeLog "$id PASSED"
        Save-State $script:State
        Invoke-Commit "${id}: $($c.title)" @()
        $head = Get-HeadShort
        $script:Ide.current = ''
        $script:Ide.attempts = 0
        $script:Ide.last_commit = $head
        Save-IdeState $script:Ide
        $next = Get-NextCard $script:Graph $script:State
        Write-Host ''
        Write-Host "DONE $id (commit $head)."
        if ($null -ne $next) { Write-Host "Next ready card: $($next.id) $($next.title)" } else { Write-Host 'No ready card left.' }
        Write-Host 'Stop now. Tell the user: open a new chat and say "next card". Do not start the next card in this chat.'
        exit 0
    }
    $script:Ide.attempts = [int]$script:Ide.attempts + 1
    Save-IdeState $script:Ide
    $max = Get-MaxAttempts $c
    if ($script:Ide.attempts -ge $max) {
        Invoke-Block $c "gate $($gate.Step) failed $($script:Ide.attempts) times: $($gate.Reason)" 'ide'
        exit 1
    }
    Write-Host ''
    Write-Host "NOT DONE $id. The gate failed at $($gate.Step) (finish attempt $($script:Ide.attempts) of $max)."
    Write-Host 'Read the log named above, fix only files in your card, run verify.ps1 until GATE PASS, then run finish again.'
    exit 1
}

function Invoke-BlockAction {
    if (-not $script:Ide.current) {
        Write-Host '[ide] No card is in progress, so there is nothing to block.'
        exit 1
    }
    $why = $Reason
    if (-not $why) { $why = 'executor stopped (no reason given)' }
    Invoke-Block (Get-Card $script:Graph $script:Ide.current) $why 'executor'
    exit 1
}

function Invoke-Status {
    Write-Totals
    if ($script:Ide.current) { Write-Host "[ide] in progress: $($script:Ide.current) (started $($script:Ide.started), finish attempts $($script:Ide.attempts))" }
    $next = Get-NextCard $script:Graph $script:State
    if ($null -ne $next) { Write-Host "[ide] next ready card: $($next.id) $($next.title)" }
    $blockers = Get-OpenBlockers
    if ($blockers.Count -gt 0) { Write-Host "[ide] blocked: $((@($blockers) | ForEach-Object { $_.id }) -join ', ') (see handover/BLOCKED.md)" }
    exit 0
}

# ---------------------------------------------------------------- main

Push-Location $script:RepoRoot
try {
    $script:Graph = Get-Graph
    $script:State = Get-State
    $script:Ide = Get-IdeState
    switch ($Action) {
        'next'   { Invoke-Next }
        'finish' { Invoke-Finish }
        'block'  { Invoke-BlockAction }
        'status' { Invoke-Status }
    }
} finally {
    Pop-Location
}
