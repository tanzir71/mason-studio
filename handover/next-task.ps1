# next-task.ps1 - print the id of the next ready card, or list every card with its status.
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File handover/next-task.ps1 [-List]
# Exit code 0 with an id printed, 2 when no card is ready.
param([switch]$List)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib.ps1')

$graph = Get-Graph
$state = Get-State

if ($List) {
    $rows = foreach ($c in @($graph.cards)) {
        $st = Get-CardStatus $state $c.id
        $sessions = 0
        if ($state.Contains($c.id)) { $sessions = $state[$c.id].sessions }
        [pscustomobject]@{
            Id       = $c.id
            Type     = $c.type
            Phase    = $c.phase
            Status   = $st
            Sessions = $sessions
            Title    = $c.title
        }
    }
    $rows | Format-Table -AutoSize | Out-String -Width 200 | Write-Host
    $counts = $rows | Group-Object Status | ForEach-Object { "$($_.Name)=$($_.Count)" }
    Write-Host ("Totals: " + ($counts -join ', '))
}

$next = Get-NextCard $graph $state
if ($null -eq $next) {
    if (-not $List) { Write-Host 'No card is ready (all passed, or the rest are blocked or waiting on blocked cards).' }
    exit 2
}
if ($List) { Write-Host "Next: $($next.id) $($next.title)" } else { Write-Output $next.id }
exit 0
