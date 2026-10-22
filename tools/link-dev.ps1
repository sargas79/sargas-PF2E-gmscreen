<#
.SYNOPSIS
  Links this repository into Foundry's Data/modules folder for development.

.DESCRIPTION
  Creates a directory junction (no admin rights needed) named after the module id,
  pointing at this repository. Foundry then loads the module straight from your
  working copy; reload the world (F5) after each change.

.PARAMETER DataPath
  Your Foundry user data "Data" folder. Defaults to the standard Windows location.

.EXAMPLE
  ./tools/link-dev.ps1 -DataPath "E:\FoundryData\Data"
#>
param(
  [string]$DataPath = (Join-Path $env:LOCALAPPDATA "FoundryVTT\Data")
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$moduleId = (Get-Content (Join-Path $repoRoot "module.json") -Raw | ConvertFrom-Json).id
$modulesDir = Join-Path $DataPath "modules"
$link = Join-Path $modulesDir $moduleId

if (-not (Test-Path $modulesDir)) {
  throw "Foundry modules folder not found: $modulesDir. Pass -DataPath with your Foundry Data folder."
}
if (Test-Path $link) {
  throw "$link already exists. Remove it first if you want to re-link."
}

New-Item -ItemType Junction -Path $link -Target $repoRoot | Out-Null
Write-Host "Linked $link -> $repoRoot"
