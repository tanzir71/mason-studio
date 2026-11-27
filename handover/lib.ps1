# lib.ps1 - shared functions for the deepseek-handover run loop.
# Dot-source it: . "$PSScriptRoot\lib.ps1"
# Compatible with Windows PowerShell 5.1 and PowerShell 7+. Keep this file ASCII-only.

Set-StrictMode -Version 2.0

try { [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false) } catch { }

$script:HandoverDir = $PSScriptRoot
$script:RepoRoot = Split-Path -Parent $PSScriptRoot
$script:RunDir = Join-Path $script:HandoverDir '.run'
$script:LogDir = Join-Path $script:RunDir 'logs'
$script:TmpDir = Join-Path $script:RunDir 'tmp'

function Initialize-HandoverDirs {
    foreach ($d in @($script:RunDir, $script:LogDir, $script:TmpDir)) {
        if (-not (Test-Path -LiteralPath $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null }
    }
}

function Test-IsWindowsHost {
    if ($PSVersionTable.PSEdition -eq 'Desktop') { return $true }
    $v = Get-Variable -Name IsWindows -ErrorAction SilentlyContinue
    if ($null -ne $v) { return [bool]$v.Value }
    return $true
}

# ---------------------------------------------------------------- files and JSON

function Read-TextFile([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) { return '' }
    return [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
}

function Write-TextFile([string]$Path, [string]$Text) {
    $enc = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Text, $enc)
}

function Add-TextToFile([string]$Path, [string]$Text) {
    $enc = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::AppendAllText($Path, $Text, $enc)
}

function Read-JsonFile([string]$Path) {
    $text = Read-TextFile $Path
    if ([string]::IsNullOrWhiteSpace($text)) { throw "Missing or empty JSON file: $Path" }
    if ($text.Length -gt 0 -and [int]$text[0] -eq 0xFEFF) { $text = $text.Substring(1) }
    return ($text | ConvertFrom-Json)
}

function Get-Prop($Object, [string]$Name, $Default = $null) {
    if ($null -eq $Object) { return $Default }
    $p = $Object.PSObject.Properties[$Name]
    if ($null -eq $p -or $null -eq $p.Value) { return $Default }
    return $p.Value
}

function ConvertTo-StringArray($Value) {
    $out = @()
    if ($null -eq $Value) { return ,$out }
    foreach ($v in @($Value)) { if ($null -ne $v -and "$v" -ne '') { $out += [string]$v } }
    return ,$out
}

function Get-Graph {
    return Read-JsonFile (Join-Path $script:HandoverDir 'TASK-GRAPH.json')
}

function Get-LoopConfig([string]$Path) {
    if (-not $Path) { $Path = Join-Path $script:HandoverDir 'loop.config.json' }
    return Read-JsonFile $Path
}

function Get-Card($Graph, [string]$Id) {
    foreach ($c in @($Graph.cards)) { if ($c.id -eq $Id) { return $c } }
    throw "Card '$Id' not found in TASK-GRAPH.json"
}

# ---------------------------------------------------------------- state

function Get-State {
    $path = Join-Path $script:HandoverDir 'STATE.json'
    $state = [ordered]@{}
    if (Test-Path -LiteralPath $path) {
        $obj = Read-JsonFile $path
        $cards = Get-Prop $obj 'cards'
        if ($null -ne $cards) {
            foreach ($p in $cards.PSObject.Properties) {
                $v = $p.Value
                $state[$p.Name] = [ordered]@{
                    status   = [string](Get-Prop $v 'status' 'todo')
                    sessions = [int](Get-Prop $v 'sessions' 0)
                    updated  = [string](Get-Prop $v 'updated' '')
                    note     = [string](Get-Prop $v 'note' '')
                }
            }
        }
    }
    return $state
}

function Save-State($State) {
    $path = Join-Path $script:HandoverDir 'STATE.json'
    $doc = [ordered]@{ schema = 'deepseek-handover/state-v1'; cards = $State }
    Write-TextFile $path (($doc | ConvertTo-Json -Depth 6) + "`n")
}

function Get-CardStatus($State, [string]$Id) {
    if ($State.Contains($Id)) { return $State[$Id].status }
    return 'todo'
}

function Set-CardState($State, [string]$Id, [string]$Status, [string]$Note) {
    if (-not $State.Contains($Id)) {
        $State[$Id] = [ordered]@{ status = 'todo'; sessions = 0; updated = ''; note = '' }
    }
    $State[$Id].status = $Status
    $State[$Id].updated = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
    if ($null -ne $Note) { $State[$Id].note = $Note }
}

function Get-NextCard($Graph, $State) {
    foreach ($c in @($Graph.cards)) {
        $st = Get-CardStatus $State $c.id
        if ($st -eq 'passed' -or $st -eq 'blocked') { continue }
        $ready = $true
        foreach ($d in (ConvertTo-StringArray (Get-Prop $c 'depends_on'))) {
            if ((Get-CardStatus $State $d) -ne 'passed') { $ready = $false; break }
        }
        if ($ready) { return $c }
    }
    return $null
}

# ---------------------------------------------------------------- git

function Invoke-Git([string[]]$GitArgs) {
    $ErrorActionPreference = 'Continue'
    $out = & git @GitArgs 2>&1 | ForEach-Object { "$_" }
    return [pscustomobject]@{ Code = $LASTEXITCODE; Out = (@($out) -join "`n") }
}

# Run artifacts and IDE workspace folders never count as card changes (IDE agents and editors
# write settings and history there on their own).
$script:IgnoredWorkspaceGlobs = @('handover/.run/*', '.vscode/*', '.idea/*', '.history/*', '.trae/*',
    '.cursor/*', '.windsurf/*', '.kilocode/*', '.clinerules/*', '.roo/*', '.zed/*', '.lingma/*', '.qoder/*')

function Test-IgnoredWorkspacePath([string]$Path) {
    foreach ($g in $script:IgnoredWorkspaceGlobs) { if ($Path -like $g) { return $true } }
    return $false
}

function Get-ChangedFiles {
    $ErrorActionPreference = 'Continue'
    $raw = (& git -c core.quotepath=false status --porcelain=v1 -z -uall 2>$null) -join "`n"
    $files = @()
    if ([string]::IsNullOrEmpty($raw)) { return ,$files }
    $parts = $raw.Split([char]0)
    $i = 0
    while ($i -lt $parts.Length) {
        $e = $parts[$i]; $i++
        if ($e.Length -lt 4) { continue }
        $xy = $e.Substring(0, 2)
        $files += ($e.Substring(3) -replace '\\', '/')
        if ($xy[0] -eq 'R' -or $xy[0] -eq 'C') {
            if ($i -lt $parts.Length) { $files += ($parts[$i] -replace '\\', '/'); $i++ }
        }
    }
    $files = @($files | Where-Object { -not (Test-IgnoredWorkspacePath $_) } | Select-Object -Unique)
    return ,$files
}

# ---------------------------------------------------------------- globs and scope

function ConvertTo-LikePattern([string]$Glob) {
    $g = ($Glob -replace '\\', '/') -replace '\*\*', '*'
    $pieces = $g.Split('*')
    $escaped = @()
    foreach ($p in $pieces) { $escaped += [System.Management.Automation.WildcardPattern]::Escape($p) }
    return ($escaped -join '*')
}

function Test-PathMatch([string]$Path, [string[]]$Globs) {
    foreach ($g in $Globs) {
        if ([string]::IsNullOrEmpty($g)) { continue }
        if ($Path -like (ConvertTo-LikePattern $g)) { return $true }
    }
    return $false
}

function Get-CardScope($Graph, $Card) {
    $files = Get-Prop $Card 'files'
    $allowed = @()
    $allowed += ConvertTo-StringArray (Get-Prop $files 'create')
    $allowed += ConvertTo-StringArray (Get-Prop $files 'modify')
    $allowed += ConvertTo-StringArray (Get-Prop $Graph 'always_allowed')
    $forbidden = @()
    $forbidden += ConvertTo-StringArray (Get-Prop $files 'forbidden')
    $forbidden += ConvertTo-StringArray (Get-Prop $Graph 'protected')
    $forbidden += ConvertTo-StringArray (Get-Prop (Get-Prop $Graph 'contracts') 'files')
    return [pscustomobject]@{ Allowed = $allowed; Forbidden = $forbidden }
}

function Test-CardScope($Graph, $Card) {
    $scope = Get-CardScope $Graph $Card
    $violations = @()
    $cardFiles = Get-Prop $Card 'files'
    $explicitList = @()
    $explicitList += ConvertTo-StringArray (Get-Prop $cardFiles 'create')
    $explicitList += ConvertTo-StringArray (Get-Prop $cardFiles 'modify')
    foreach ($f in (Get-ChangedFiles)) {
        $explicit = (Test-PathMatch $f $explicitList)
        if ((Test-PathMatch $f $scope.Forbidden) -and (-not $explicit)) {
            $violations += "forbidden: $f"
        } elseif (-not (Test-PathMatch $f $scope.Allowed)) {
            $violations += "not in card scope: $f"
        }
    }
    return [pscustomobject]@{ Ok = ($violations.Count -eq 0); Violations = $violations }
}

# ---------------------------------------------------------------- process runner

function Format-ShellArg([string]$Arg) {
    if (Test-IsWindowsHost) {
        if ($Arg -match '["%\r\n]') { throw "Argument contains a character that cmd.exe cannot pass safely (double quote, percent or newline): $Arg" }
        return '"' + $Arg + '"'
    }
    return "'" + ($Arg -replace "'", "'\''") + "'"
}

function ConvertTo-RelPath([string]$AbsPath) {
    $root = $script:RepoRoot.TrimEnd('\', '/')
    if ($AbsPath.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
        return $AbsPath.Substring($root.Length).TrimStart('\', '/')
    }
    return $AbsPath
}

function Read-NewText([string]$Path, [ref]$Offset) {
    if (-not (Test-Path -LiteralPath $Path)) { return '' }
    $fs = $null
    try {
        $share = [System.IO.FileShare]::ReadWrite -bor [System.IO.FileShare]::Delete
        $fs = New-Object System.IO.FileStream($Path, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, $share)
        if ($fs.Length -le $Offset.Value) { return '' }
        [void]$fs.Seek($Offset.Value, [System.IO.SeekOrigin]::Begin)
        $count = [int]($fs.Length - $Offset.Value)
        $buf = New-Object byte[] $count
        $read = $fs.Read($buf, 0, $count)
        $Offset.Value += $read
        return [System.Text.Encoding]::UTF8.GetString($buf, 0, $read)
    } catch { return '' } finally { if ($null -ne $fs) { $fs.Dispose() } }
}

# Runs one command line through cmd.exe (Windows) or sh (elsewhere) with stdout+stderr to LogPath.
# CommandLine is raw shell text (gate commands) unless -ArgList is given (harness), in which case
# Exe and ArgList are quoted here. Returns ExitCode, TimedOut, LogPath, Output.
function Invoke-Logged {
    param(
        [string]$CommandLine,
        [string]$Exe,
        [string[]]$ArgList,
        [Parameter(Mandatory = $true)][string]$LogPath,
        [string]$StdinPath,
        [int]$TimeoutSec = 300,
        [hashtable]$EnvVars,
        [switch]$Echo,
        [string]$Shell = 'cmd'
    )
    Initialize-HandoverDirs
    $isWin = Test-IsWindowsHost
    $stamp = [guid]::NewGuid().ToString('N').Substring(0, 8)
    if (Test-Path -LiteralPath $LogPath) { Remove-Item -LiteralPath $LogPath -Force }
    $relLog = ConvertTo-RelPath $LogPath
    $relIn = $null
    if ($StdinPath) { $relIn = ConvertTo-RelPath $StdinPath }
    $ps1 = $null

    if ($Exe) {
        $parts = @((Format-ShellArg $Exe))
        foreach ($a in @($ArgList)) { $parts += (Format-ShellArg $a) }
        $line = ($parts -join ' ')
    } else {
        $line = $CommandLine
    }

    if ($Shell -eq 'powershell') {
        $ps1 = Join-Path $script:TmpDir "cmd-$stamp.ps1"
        Write-TextFile $ps1 ($line + "`r`nexit `$LASTEXITCODE`r`n")
        $psExe = 'powershell'
        if (-not $isWin) { $psExe = 'pwsh' }
        $line = (Format-ShellArg $psExe) + ' -NoProfile -ExecutionPolicy Bypass -File ' + (Format-ShellArg (ConvertTo-RelPath $ps1))
    }

    if ($isWin) {
        $script = Join-Path $script:TmpDir "run-$stamp.cmd"
        $body = '@echo off' + "`r`n" + 'call ' + $line
        if ($relIn) { $body += ' < "' + $relIn + '"' } else { $body += ' < NUL' }
        $body += ' > "' + $relLog + '" 2>&1' + "`r`n" + 'exit /b %ERRORLEVEL%' + "`r`n"
        Write-TextFile $script $body
        $fileName = 'cmd.exe'
        $arguments = '/d /c "' + (ConvertTo-RelPath $script) + '"'
    } else {
        $script = Join-Path $script:TmpDir "run-$stamp.sh"
        $body = $line
        if ($relIn) { $body += " < '" + $relIn + "'" } else { $body += ' < /dev/null' }
        $body += " > '" + $relLog + "' 2>&1`n"
        Write-TextFile $script $body
        $fileName = '/bin/sh'
        $arguments = "'" + (ConvertTo-RelPath $script) + "'"
    }

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $fileName
    $psi.Arguments = $arguments
    $psi.WorkingDirectory = $script:RepoRoot
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    if ($EnvVars) { foreach ($k in $EnvVars.Keys) { $psi.EnvironmentVariables[$k] = [string]$EnvVars[$k] } }

    $proc = [System.Diagnostics.Process]::Start($psi)
    $offset = [long]0
    $timedOut = $false
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    while (-not $proc.WaitForExit(1000)) {
        if ($Echo) { $t = Read-NewText $LogPath ([ref]$offset); if ($t) { Write-Host -NoNewline $t } }
        if ($TimeoutSec -gt 0 -and $sw.Elapsed.TotalSeconds -gt $TimeoutSec) {
            $timedOut = $true
            if ($isWin) { & taskkill.exe /PID $proc.Id /T /F 2>&1 | Out-Null } else { try { $proc.Kill() } catch { } }
            [void]$proc.WaitForExit(10000)
            break
        }
    }
    $proc.WaitForExit()
    if ($Echo) { $t = Read-NewText $LogPath ([ref]$offset); if ($t) { Write-Host -NoNewline $t } }
    $code = $proc.ExitCode
    if ($timedOut) { $code = 124; Add-TextToFile $LogPath "`n[handover] TIMEOUT after $TimeoutSec seconds; process tree killed.`n" }
    Remove-Item -LiteralPath $script -Force -ErrorAction SilentlyContinue
    if ($ps1) { Remove-Item -LiteralPath $ps1 -Force -ErrorAction SilentlyContinue }
    return [pscustomobject]@{ ExitCode = $code; TimedOut = $timedOut; LogPath = $LogPath; Output = (Read-TextFile $LogPath) }
}

function Get-Tail([string]$Text, [int]$Lines = 30) {
    $all = @($Text -split "`r?`n")
    if ($all.Count -le $Lines) { return ($all -join "`n") }
    return (($all[($all.Count - $Lines)..($all.Count - 1)]) -join "`n")
}

# ---------------------------------------------------------------- gates

# Runs one verify item. Returns Ok, Reason, LogPath.
function Invoke-VerifyItem($Item, [string]$LogPath, [switch]$Echo) {
    $cmd = [string](Get-Prop $Item 'cmd' '')
    if (-not $cmd) { return [pscustomobject]@{ Ok = $false; Reason = 'verify item has no cmd'; LogPath = $LogPath } }
    $expectExit = [int](Get-Prop $Item 'expect_exit' 0)
    $timeout = [int](Get-Prop $Item 'timeout_sec' 300)
    $shell = [string](Get-Prop $Item 'shell' 'cmd')
    $r = Invoke-Logged -CommandLine $cmd -LogPath $LogPath -TimeoutSec $timeout -Shell $shell -Echo:$Echo
    if ($r.TimedOut) { return [pscustomobject]@{ Ok = $false; Reason = "timed out after $timeout s"; LogPath = $LogPath } }
    if ($r.ExitCode -ne $expectExit) { return [pscustomobject]@{ Ok = $false; Reason = "exit code $($r.ExitCode), expected $expectExit"; LogPath = $LogPath } }
    foreach ($s in (ConvertTo-StringArray (Get-Prop $Item 'expect_contains'))) {
        if (-not $r.Output.Contains($s)) { return [pscustomobject]@{ Ok = $false; Reason = "output does not contain '$s'"; LogPath = $LogPath } }
    }
    foreach ($s in (ConvertTo-StringArray (Get-Prop $Item 'expect_not_contains'))) {
        if ($r.Output.Contains($s)) { return [pscustomobject]@{ Ok = $false; Reason = "output contains forbidden text '$s'"; LogPath = $LogPath } }
    }
    return [pscustomobject]@{ Ok = $true; Reason = ''; LogPath = $LogPath }
}

# Full gate for one card. Prints progress and the final GATE line. Returns Pass, Step, Reason, LogPath.
function Invoke-CardGate($Graph, $Card, [switch]$Echo) {
    $id = $Card.id
    Push-Location $script:RepoRoot
    try {
        Write-Host "[gate $id] scope"
        $scope = Test-CardScope $Graph $Card
        if (-not $scope.Ok) {
            foreach ($v in $scope.Violations) { Write-Host "  $v" }
            Write-Host "GATE FAIL $id scope"
            return [pscustomobject]@{ Pass = $false; Step = 'scope'; Reason = ($scope.Violations -join '; '); LogPath = '' }
        }
        Write-Host "[gate $id] contracts"
        $cfiles = ConvertTo-StringArray (Get-Prop (Get-Prop $Graph 'contracts') 'files')
        foreach ($f in $cfiles) {
            if (-not (Test-Path -LiteralPath (Join-Path $script:RepoRoot $f))) {
                Write-Host "  missing contract file: $f"
                Write-Host "GATE FAIL $id contracts"
                return [pscustomobject]@{ Pass = $false; Step = 'contracts'; Reason = "missing contract file $f"; LogPath = '' }
            }
        }
        $n = 0
        foreach ($item in @(Get-Prop $Card 'verify' @())) {
            $n++
            $log = Join-Path $script:LogDir "$id-verify-$n.log"
            Write-Host "[gate $id] verify-$n  $($item.cmd)"
            $r = Invoke-VerifyItem $item $log -Echo:$Echo
            if (-not $r.Ok) {
                Write-Host "  $($r.Reason)"
                Write-Host "  log: handover/.run/logs/$id-verify-$n.log (last 30 lines below)"
                Write-Host (Get-Tail (Read-TextFile $log) 30)
                Write-Host "GATE FAIL $id verify-$n"
                return [pscustomobject]@{ Pass = $false; Step = "verify-$n"; Reason = $r.Reason; LogPath = $log }
            }
        }
        Write-Host "GATE PASS $id"
        return [pscustomobject]@{ Pass = $true; Step = ''; Reason = ''; LogPath = '' }
    } finally { Pop-Location }
}

function Invoke-CommandList($Items, [string]$Prefix) {
    $n = 0
    foreach ($item in @($Items)) {
        $n++
        $log = Join-Path $script:LogDir "$Prefix-$n.log"
        Write-Host "[$Prefix] $($item.cmd)"
        $r = Invoke-VerifyItem $item $log
        if (-not $r.Ok) {
            Write-Host "  $($r.Reason)"
            Write-Host (Get-Tail (Read-TextFile $log) 30)
            return $false
        }
    }
    return $true
}
