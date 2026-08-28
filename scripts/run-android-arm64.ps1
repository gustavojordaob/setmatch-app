# Build Android só arm64 (POCO / celular físico) + cache Gradle em caminho curto (Windows MAX_PATH).
$ErrorActionPreference = "Stop"
$gradleHome = "C:\g"
New-Item -ItemType Directory -Force -Path $gradleHome | Out-Null
$env:GRADLE_USER_HOME = $gradleHome

Set-Location (Split-Path $PSScriptRoot -Parent)

Write-Host "GRADLE_USER_HOME=$gradleHome (gradlew.bat também força C:\g no Windows)"
Write-Host "Arquitetura: arm64-v8a (gradle.properties + --all-arch)"
Write-Host "Conecte o celular via USB e feche emuladores Android."

Set-Location "$((Split-Path $PSScriptRoot -Parent))\android"
Write-Host "Parando daemons Gradle antigos (cache longo)..."
.\gradlew.bat --stop 2>$null
Set-Location (Split-Path $PSScriptRoot -Parent)

npx expo run:android --all-arch @args
