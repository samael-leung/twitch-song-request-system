# Start directly using the existing Node.js runtime; no tunnel software.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js is required by the application."
}
Write-Host "Dashboard: http://localhost:3000/dashboard"
Write-Host "Twitch authorization: http://localhost:3000/auth/twitch"
npm start
exit $LASTEXITCODE
