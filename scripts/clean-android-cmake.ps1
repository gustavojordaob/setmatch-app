# Limpa daemons Gradle + pastas .cxx (força recompilação CMake com cache curto C:\g)
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$gradleHome = "C:\g"

New-Item -ItemType Directory -Force -Path $gradleHome | Out-Null
$env:GRADLE_USER_HOME = $gradleHome

Write-Host "Parando daemons Gradle..."
Set-Location "$root\android"
.\gradlew.bat --stop 2>$null

Write-Host "Removendo .cxx (CMake)..."
Get-ChildItem "$root\node_modules" -Directory -Recurse -Filter ".cxx" -ErrorAction SilentlyContinue |
  ForEach-Object { Remove-Item $_.FullName -Recurse -Force -ErrorAction SilentlyContinue }

Write-Host "Pronto. GRADLE_USER_HOME=$gradleHome"
Write-Host "Agora: npm run android:arm64"
