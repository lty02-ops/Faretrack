#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STAGE_DIR="$ROOT_DIR/dist/lambda-package"
ARCHIVE_PATH="$ROOT_DIR/dist/faretrack-lambda.zip"

rm -rf "$STAGE_DIR" "$ARCHIVE_PATH"
mkdir -p "$STAGE_DIR/backend"

cp "$ROOT_DIR/package.json" "$ROOT_DIR/package-lock.json" "$STAGE_DIR/"
cp -R "$ROOT_DIR/backend/src" "$STAGE_DIR/backend/"
npm ci --omit=dev --prefix "$STAGE_DIR"

(
  cd "$STAGE_DIR"
  zip -qr "$ARCHIVE_PATH" .
)

rm -rf "$STAGE_DIR"
echo "Created $ARCHIVE_PATH"
