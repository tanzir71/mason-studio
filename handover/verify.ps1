# verify.ps1 - run the gate for one card: scope check, contract presence, then the card's verify commands.
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File handover/verify.ps1 -Card T003
# Last line of output is "GATE PASS <ID>" or "GATE FAIL <ID> <step>". Exit code 0 on pass, 1 on fail.
param(
    [Parameter(Mandatory = $true)][string]$Card,
    [switch]$Echo
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib.ps1')
Initialize-HandoverDirs

$graph = Get-Graph
$c = Get-Card $graph $Card
$result = Invoke-CardGate $graph $c -Echo:$Echo
if ($result.Pass) { exit 0 } else { exit 1 }
