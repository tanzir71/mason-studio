# init.ps1 - check required tools and run the project's init commands from TASK-GRAPH.json.
# Safe to run any time; run-loop.ps1 calls it before every run.
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File handover/init.ps1
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib.ps1')
Initialize-HandoverDirs

$graph = Get-Graph
$project = Get-Prop $graph 'project'
$failed = @()

Push-Location $script:RepoRoot
try {
    $inside = Invoke-Git @('rev-parse', '--is-inside-work-tree')
    if ($inside.Code -ne 0) { Write-Host '[init] This folder is not a git repository. Run: git init'; exit 1 }

    foreach ($req in @(Get-Prop $project 'requires' @())) {
        $name = [string](Get-Prop $req 'name' 'tool')
        $check = [string](Get-Prop $req 'check' '')
        if (-not $check) { continue }
        $log = Join-Path $script:LogDir "init-require-$name.log"
        $r = Invoke-Logged -CommandLine $check -LogPath $log -TimeoutSec 60
        if ($r.ExitCode -ne 0) {
            $failed += $name
            Write-Host "[init] MISSING: $name ($check failed; see handover/.run/logs/init-require-$name.log)"
        } else {
            $first = (@($r.Output -split "`r?`n") | Where-Object { $_ -ne '' } | Select-Object -First 1)
            Write-Host "[init] ok: $name $first"
        }
    }
    if ($failed.Count -gt 0) { Write-Host "[init] Install the missing tools, then rerun."; exit 1 }

    $n = 0
    foreach ($step in @(Get-Prop $project 'init' @())) {
        $n++
        $cmd = [string](Get-Prop $step 'cmd' '')
        $whenExists = [string](Get-Prop $step 'when_exists' '')
        if ($whenExists -and -not (Test-Path -LiteralPath (Join-Path $script:RepoRoot $whenExists))) {
            Write-Host "[init] skip: $cmd (waiting for $whenExists)"
            continue
        }
        $timeout = [int](Get-Prop $step 'timeout_sec' 900)
        $log = Join-Path $script:LogDir "init-$n.log"
        Write-Host "[init] run: $cmd"
        $r = Invoke-Logged -CommandLine $cmd -LogPath $log -TimeoutSec $timeout -Shell ([string](Get-Prop $step 'shell' 'cmd'))
        if ($r.ExitCode -ne 0) {
            Write-Host (Get-Tail $r.Output 30)
            Write-Host "[init] FAILED: $cmd (see handover/.run/logs/init-$n.log)"
            exit 1
        }
    }
    Write-Host '[init] done'
    exit 0
} finally { Pop-Location }
