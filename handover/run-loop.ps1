# run-loop.ps1 - drive the executor through the handover, one card per fresh session.
#
#   init -> baseline gate -> next ready card -> render prompt -> executor session
#   -> independent verify -> commit (pass) | stash + retry once + BLOCKED (fail) -> repeat
#
# Usage (from the repo root):
#   powershell -NoProfile -ExecutionPolicy Bypass -File handover\run-loop.ps1 -DryRun
#   powershell -NoProfile -ExecutionPolicy Bypass -File handover\run-loop.ps1
#   powershell -NoProfile -ExecutionPolicy Bypass -File handover\run-loop.ps1 -Card T003
#   powershell -NoProfile -ExecutionPolicy Bypass -File handover\run-loop.ps1 -MaxCards 5
#
# Loop mode only. In IDE mode ("mode": "ide" in loop.config.json, the default) the agent in your
# IDE runs one card per chat with handover/ide.ps1 instead, and no API key is needed.
#
# Nothing is ever discarded: failed attempts are stashed with "git stash push -u", logs stay in
# handover\.run\logs, and ledgers are committed.
param(
    [switch]$DryRun,
    [string]$Card,
    [int]$MaxCards = 0,
    [string]$Harness,
    [string]$ConfigPath,
    [switch]$SkipInit
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib.ps1')
Initialize-HandoverDirs

function Write-Step([string]$Text) { Write-Host ''; Write-Host "==> $Text" }

function Resolve-EnvValue([string]$Value, [switch]$Soft) {
    $out = $Value
    $ms = [regex]::Matches($Value, '\$\{env:([A-Za-z_][A-Za-z0-9_]*)\}')
    foreach ($m in $ms) {
        $name = $m.Groups[1].Value
        $v = [Environment]::GetEnvironmentVariable($name)
        if ([string]::IsNullOrEmpty($v)) {
            if ($Soft) { $v = "<missing:$name>" } else { throw "Environment variable $name is not set. Only loop mode needs it (a CLI harness calling the API). To run inside your IDE with its built-in model instead, set `"mode`": `"ide`" in handover/loop.config.json and run handover/ide.ps1 next. For loop mode set it first, for example: `$env:$name = '<value>'" }
        }
        $out = $out.Replace($m.Value, $v)
    }
    return $out
}

function Get-HarnessPreset($Config, [string]$Name) {
    $presets = Get-Prop $Config 'harnesses'
    $p = $null
    if ($null -ne $presets) { $p = $presets.PSObject.Properties[$Name] }
    if ($null -eq $p) { throw "Harness '$Name' is not defined in loop.config.json -> harnesses." }
    return $p.Value
}

function Get-PromptText($CardObj, [string]$Note) {
    $cardPath = Join-Path $script:HandoverDir ([string]$CardObj.file)
    $text = Read-TextFile $cardPath
    if (-not $text) { throw "Card file not found: handover/$($CardObj.file)" }
    $text = $text.TrimEnd() + "`n"
    if ($Note) { $text += "`n---`n`n## Note from the run loop`n`n$Note`n" }
    return $text
}

function Add-LoopLog([string]$Line) {
    Add-TextToFile (Join-Path $script:HandoverDir 'PROGRESS.md') ("- " + (Get-Date).ToString('yyyy-MM-dd HH:mm') + " [loop] $Line`n")
}

function Save-LedgersAndState($State, [string]$Message) {
    Save-State $State
    $null = Invoke-Git @('add', '--', 'handover/PROGRESS.md', 'handover/BLOCKED.md', 'handover/STATE.json')
    $r = Invoke-Git @('commit', '-m', $Message)
    if ($r.Code -ne 0 -and $r.Out -notmatch 'nothing to commit') { throw "git commit failed: $($r.Out)" }
}

function Invoke-Harness($Preset, $CardObj, [int]$SessionNo, [int]$TimeoutMin) {
    $id = [string]$CardObj.id
    $budget = Get-Prop $CardObj 'budget'
    $exec = Get-Prop $script:Graph 'executor'
    $maxTurns = [int](Get-Prop $budget 'max_turns' (Get-Prop $exec 'max_turns' 40))
    $effort = [string](Get-Prop $CardObj 'effort' (Get-Prop $exec 'default_effort' 'high'))
    $map = @{
        '{PREFIX_FILE}' = 'handover/.run/PREFIX.md'
        '{PROMPT_FILE}' = "handover/.run/PROMPT-$id.md"
        '{CARD_ID}'     = $id
        '{MAX_TURNS}'   = [string]$maxTurns
        '{EFFORT}'      = $effort
    }
    $argList = @()
    foreach ($a in (ConvertTo-StringArray (Get-Prop $Preset 'args'))) {
        $v = $a
        foreach ($k in $map.Keys) { $v = $v.Replace($k, $map[$k]) }
        $argList += $v
    }
    $envVars = @{ HANDOVER_CARD = $id }
    $envObj = Get-Prop $Preset 'env'
    if ($null -ne $envObj) {
        foreach ($p in $envObj.PSObject.Properties) { $envVars[$p.Name] = (Resolve-EnvValue ([string]$p.Value)) }
    }
    $stdin = $null
    if ([string](Get-Prop $Preset 'prompt_mode' 'stdin') -eq 'stdin') { $stdin = Join-Path $script:RunDir "PROMPT-$id.md" }
    $log = Join-Path $script:LogDir "$id-session-$SessionNo.log"
    Write-Host "[loop] executor session $SessionNo for $id (effort $effort, max turns $maxTurns, timeout $TimeoutMin min)"
    $r = Invoke-Logged -Exe ([string]$Preset.exe) -ArgList $argList -LogPath $log -StdinPath $stdin -TimeoutSec ($TimeoutMin * 60) -EnvVars $envVars -Echo
    Write-Host ''
    Write-Host "[loop] session ended: exit $($r.ExitCode)$(if ($r.TimedOut) { ' (timed out)' } else { '' }); log handover/.run/logs/$id-session-$SessionNo.log"
    return $r
}

function Get-StashRef([string]$Message) {
    $r = Invoke-Git @('stash', 'list')
    foreach ($line in ($r.Out -split "`n")) {
        if ($line.Contains($Message)) { return ($line -split ':')[0] }
    }
    return ''
}

function Invoke-OneCard($CardObj) {
    $id = [string]$CardObj.id
    $title = [string]$CardObj.title
    $note = ''
    $restarts = 0
    $maxRestarts = [int](Get-Prop $script:Config 'max_session_restarts' 1)
    $timeoutMin = [int](Get-Prop $script:Config 'session_timeout_min' 30)
    $blockedPath = Join-Path $script:HandoverDir 'BLOCKED.md'
    $progressPath = Join-Path $script:HandoverDir 'PROGRESS.md'

    while ($true) {
        $sessionNo = 1
        if ($script:State.Contains($id)) { $sessionNo = [int]$script:State[$id].sessions + 1 }
        Write-TextFile (Join-Path $script:RunDir "PROMPT-$id.md") (Get-PromptText $CardObj $note)

        if ($DryRun) {
            Write-Host "[dry-run] next card: $id $title"
            Write-Host "[dry-run] prompt: handover/.run/PROMPT-$id.md"
            Write-Host "[dry-run] prefix: handover/.run/PREFIX.md"
            $preset = Get-HarnessPreset $script:Config $script:HarnessName
            Write-Host "[dry-run] harness: $script:HarnessName -> $($preset.exe) $((ConvertTo-StringArray (Get-Prop $preset 'args')) -join ' ')"
            return 'dryrun'
        }

        $blockedBefore = Read-TextFile $blockedPath
        $preset = Get-HarnessPreset $script:Config $script:HarnessName
        $session = Invoke-Harness $preset $CardObj $sessionNo $timeoutMin
        if (-not $script:State.Contains($id)) { Set-CardState $script:State $id 'todo' '' }
        $script:State[$id].sessions = $sessionNo

        $blockedAfter = Read-TextFile $blockedPath
        $newBlockedText = ''
        if ($blockedAfter.Length -gt $blockedBefore.Length) { $newBlockedText = $blockedAfter.Substring($blockedBefore.Length) }
        $agentBlocked = ($newBlockedText -match ('(?m)^##\s+' + [regex]::Escape($id) + ':'))

        Write-Step "Independent gate for $id"
        $gate = Invoke-CardGate $script:Graph $CardObj

        if ($gate.Pass -and -not $agentBlocked) {
            Set-CardState $script:State $id 'passed' ''
            Add-LoopLog "$id PASSED (session $sessionNo)"
            Save-State $script:State
            $null = Invoke-Git @('add', '-A')
            $c = Invoke-Git @('commit', '-m', "${id}: $title")
            if ($c.Code -ne 0) { throw "git commit failed for ${id}: $($c.Out)" }
            $head = (Invoke-Git @('rev-parse', '--short', 'HEAD')).Out
            Write-Host "[loop] $id passed and committed ($head)"
            return 'passed'
        }

        # Failure path: preserve everything, then decide.
        $progressText = Read-TextFile $progressPath
        $blockedText = Read-TextFile $blockedPath
        $stashMsg = "handover $id session $sessionNo"
        $null = Invoke-Git @('stash', 'push', '-u', '-m', $stashMsg)
        $stashRef = Get-StashRef $stashMsg
        Write-TextFile $progressPath $progressText
        Write-TextFile $blockedPath $blockedText
        $gateLog = ''
        if ($gate.LogPath) { $gateLog = (ConvertTo-RelPath $gate.LogPath) -replace '\\', '/' }
        $sessionLog = "handover/.run/logs/$id-session-$sessionNo.log"
        $preserved = 'nothing to preserve (no changes)'
        if ($stashRef) { $preserved = "$stashRef `"$stashMsg`"" }

        if ($agentBlocked) {
            Add-TextToFile $blockedPath ("- Preserved work: $preserved`n- Session log: $sessionLog`n")
            Set-CardState $script:State $id 'blocked' 'executor raised BLOCKED'
            Add-LoopLog "$id BLOCKED by executor (session $sessionNo); work preserved: $preserved"
            Save-LedgersAndState $script:State "${id}: blocked (ledgers)"
            Write-Host "[loop] $id blocked by the executor. See handover/BLOCKED.md"
            return 'blocked'
        }

        if ($restarts -lt $maxRestarts) {
            $restarts++
            $why = "gate step '$($gate.Step)': $($gate.Reason)"
            if ($session.TimedOut) { $why = "the session timed out after $timeoutMin minutes" }
            $note = "A previous session for this card failed ($why). Its changes were stashed as `"$stashMsg`" and are not in the working tree. Start the card again from its Steps section."
            if ($gateLog) { $note += " The failing gate log was $gateLog." }
            Add-LoopLog "$id failed in session $sessionNo ($why); restarting in a fresh session"
            Write-Host "[loop] $id failed ($why). Restarting in a fresh session."
            continue
        }

        $entry = "`n## ${id}: $title`n- Status: open`n- Raised by: loop`n- Attempts: $sessionNo sessions`n" +
                 "- Failing gate: $($gate.Step) ($($gate.Reason))`n"
        if ($gateLog) { $entry += "- Error (last 30 lines): see $gateLog`n" }
        if ($session.TimedOut) { $entry += "- Note: last session timed out after $timeoutMin minutes`n" }
        $entry += "- Suspected cause: unknown (the executor did not write a BLOCKED entry)`n- Preserved work: $preserved`n- Session log: $sessionLog`n"
        Add-TextToFile $blockedPath $entry
        Set-CardState $script:State $id 'blocked' "gate $($gate.Step) failed"
        Add-LoopLog "$id BLOCKED by loop after $sessionNo sessions; work preserved: $preserved"
        Save-LedgersAndState $script:State "${id}: blocked (ledgers)"
        Write-Host "[loop] $id blocked after $sessionNo sessions. See handover/BLOCKED.md"
        return 'blocked'
    }
}

# ------------------------------------------------------------------ main

Push-Location $script:RepoRoot
try {
    $script:Graph = Get-Graph
    $script:Config = Get-LoopConfig $ConfigPath
    $script:HarnessName = $Harness
    if (-not $script:HarnessName) { $script:HarnessName = [string](Get-Prop $script:Config 'harness' 'claude-code') }
    $script:State = Get-State

    $mode = [string](Get-Prop $script:Config 'mode' 'loop')
    if ($mode -eq 'ide' -and -not $Harness) {
        Write-Host 'This handover is set to IDE mode (handover/loop.config.json: "mode": "ide").'
        Write-Host 'Nothing to start here and no API key needed: open the repo in your IDE, start a new chat and say "next card".'
        Write-Host 'The IDE agent runs: powershell -NoProfile -ExecutionPolicy Bypass -File handover/ide.ps1 next'
        Write-Host 'To drive a CLI harness from this script instead, set "mode": "loop" (or pass -Harness claude-code).'
        exit 0
    }

    Write-Step 'Preflight'
    if ((Invoke-Git @('rev-parse', '--is-inside-work-tree')).Code -ne 0) { throw 'Not a git repository. Run: git init' }
    if ((Invoke-Git @('rev-parse', '--verify', 'HEAD')).Code -ne 0) { throw 'The repository has no commits. Commit the handover first: git add -A; git commit -m "handover: plan"' }
    $dirty = Get-ChangedFiles
    if ($dirty.Count -gt 0 -and -not $DryRun) {
        Write-Host 'The working tree has uncommitted changes:'
        $dirty | ForEach-Object { Write-Host "  $_" }
        throw 'Commit or stash them first (for example: git stash push -u -m "before handover run").'
    }
    $preset = Get-HarnessPreset $script:Config $script:HarnessName
    $envObj = Get-Prop $preset 'env'
    if ($null -ne $envObj) {
        foreach ($p in $envObj.PSObject.Properties) { $null = Resolve-EnvValue ([string]$p.Value) -Soft:$DryRun }
    }
    Write-Host "[loop] harness: $script:HarnessName ($($preset.exe))"

    if (-not $SkipInit) {
        Write-Step 'Init'
        $initScript = Join-Path $script:HandoverDir 'init.ps1'
        & $initScript
        if ($LASTEXITCODE -ne 0) { throw 'init.ps1 failed. Fix the environment and rerun.' }
    }

    $anyPassed = $false
    foreach ($k in $script:State.Keys) { if ($script:State[$k].status -eq 'passed') { $anyPassed = $true } }
    $baseline = @(Get-Prop $script:Graph 'baseline' @())
    if ($anyPassed -and $baseline.Count -gt 0) {
        Write-Step 'Baseline gate'
        if (-not (Invoke-CommandList $baseline 'baseline')) { throw 'Baseline gate failed: the repo is not green. Fix it (or ask the planner to repair) before running more cards.' }
    }

    $rules = Read-TextFile (Join-Path $script:HandoverDir 'EXECUTOR-RULES.md')
    $contracts = Read-TextFile (Join-Path $script:HandoverDir '01-CONTRACTS.md')
    $prefix = $rules.TrimEnd() + "`n`n" + $contracts.TrimEnd() + "`n"
    $prefixPath = Join-Path $script:RunDir 'PREFIX.md'
    if ((Read-TextFile $prefixPath) -ne $prefix) { Write-TextFile $prefixPath $prefix }

    $done = 0
    $blockedInARow = 0
    $stopAfterBlocked = [int](Get-Prop $script:Config 'stop_after_blocked' 2)
    $summary = @()
    while ($true) {
        if ($Card) {
            $target = Get-Card $script:Graph $Card
            if ((Get-CardStatus $script:State $Card) -eq 'passed') { Write-Host "[loop] $Card has already passed."; break }
            foreach ($d in (ConvertTo-StringArray (Get-Prop $target 'depends_on'))) {
                if ((Get-CardStatus $script:State $d) -ne 'passed') { throw "$Card depends on $d, which has not passed yet." }
            }
        } else {
            $target = Get-NextCard $script:Graph $script:State
        }
        if ($null -eq $target) { Write-Host '[loop] No ready card left.'; break }

        Write-Step "Card $($target.id): $($target.title)"
        $outcome = Invoke-OneCard $target
        $summary += "$($target.id) $outcome"
        if ($outcome -eq 'dryrun') { break }
        $done++
        if ($outcome -eq 'blocked') {
            $blockedInARow++
            if ([string]$target.type -eq 'checkpoint') { Write-Host '[loop] A checkpoint is blocked; stopping so the planner can repair the phase.'; break }
            if ($blockedInARow -ge $stopAfterBlocked) { Write-Host "[loop] $blockedInARow cards blocked in a row; stopping. This usually means a plan-level problem."; break }
        } else {
            $blockedInARow = 0
        }
        if ($Card) { break }
        if ($MaxCards -gt 0 -and $done -ge $MaxCards) { Write-Host "[loop] Reached -MaxCards $MaxCards."; break }
    }

    Write-Step 'Summary'
    $summary | ForEach-Object { Write-Host "  $_" }
    $counts = @{}
    foreach ($c in @($script:Graph.cards)) {
        $st = Get-CardStatus $script:State $c.id
        if (-not $counts.ContainsKey($st)) { $counts[$st] = 0 }
        $counts[$st]++
    }
    Write-Host ('  Totals: ' + (($counts.Keys | Sort-Object | ForEach-Object { "$_=$($counts[$_])" }) -join ', '))
    if ($counts.ContainsKey('blocked')) {
        Write-Host '  Some cards are blocked. Ask the planner (Claude with the deepseek-handover skill) to repair the handover using handover/BLOCKED.md.'
    }
} finally {
    Pop-Location
}
