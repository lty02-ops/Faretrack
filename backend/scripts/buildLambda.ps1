$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$dist = Join-Path $root "dist"
$stage = Join-Path $dist "lambda-stage"
$archive = Join-Path $dist "faretrack-lambda.zip"

if (Test-Path $stage) {
  Remove-Item -LiteralPath $stage -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $stage | Out-Null
Copy-Item -LiteralPath (Join-Path $root "package.json") -Destination $stage
Copy-Item -LiteralPath (Join-Path $root "package-lock.json") -Destination $stage
Copy-Item -LiteralPath (Join-Path $root "backend") -Destination $stage -Recurse

npm ci --omit=dev --prefix $stage

if (Test-Path $archive) {
  Remove-Item -LiteralPath $archive -Force
}

tar.exe -a -c -f $archive -C $stage .
if ($LASTEXITCODE -ne 0) {
  throw "Failed to create Lambda deployment package."
}
Remove-Item -LiteralPath $stage -Recurse -Force

Write-Output "Lambda package created: $archive"
