#!/usr/bin/env bash
set -euo pipefail
set +x
: "${SERPAPI_API_KEY:?Required}"
: "${FIREBASE_SERVICE_ACCOUNT_FILE:?Required}"
umask 077
SECRET_PAYLOAD_FILE="$(mktemp)"
export SECRET_PAYLOAD_FILE
trap 'rm -f "$SECRET_PAYLOAD_FILE"' EXIT
node -e 'require("node:fs").writeFileSync(process.env.SECRET_PAYLOAD_FILE, JSON.stringify({apiKey: process.env.SERPAPI_API_KEY}))'
aws secretsmanager put-secret-value \
  --region ap-northeast-2 --secret-id faretrack-dev/serpapi \
  --secret-string "file://$SECRET_PAYLOAD_FILE" \
  --query '{Name:Name,VersionId:VersionId}' --output json
aws secretsmanager put-secret-value \
  --region ap-northeast-2 --secret-id faretrack-dev/firebase \
  --secret-string "file://$FIREBASE_SERVICE_ACCOUNT_FILE" \
  --query '{Name:Name,VersionId:VersionId}' --output json
