#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TERRAFORM_DIR="$ROOT_DIR/infra/terraform"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing environment file: $ENV_FILE" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

required_variables=(
  TF_VAR_google_client_id
  TF_VAR_google_client_secret
  TF_VAR_kakao_client_id
  TF_VAR_kakao_client_secret
  SERPAPI_API_KEY
  FIREBASE_SERVICE_ACCOUNT_FILE
)

for variable in "${required_variables[@]}"; do
  if [[ -z "${!variable:-}" ]]; then
    echo "Missing required variable in $ENV_FILE: $variable" >&2
    exit 1
  fi
done

if [[ ! -f "$FIREBASE_SERVICE_ACCOUNT_FILE" ]]; then
  echo "Firebase service account file not found: $FIREBASE_SERVICE_ACCOUNT_FILE" >&2
  exit 1
fi

for command in npm zip terraform aws; do
  command -v "$command" >/dev/null 2>&1 || {
    echo "Required command not found: $command" >&2
    exit 1
  }
done

echo "[1/4] Building Lambda package"
bash "$ROOT_DIR/backend/scripts/buildLambda.sh"

echo "[2/4] Applying Terraform"
terraform -chdir="$TERRAFORM_DIR" init -reconfigure \
  -backend-config="environments/dev.backend.hcl"

apply_arguments=(-var-file="environments/dev.tfvars")
if [[ "${AUTO_APPROVE:-false}" == "true" ]]; then
  apply_arguments+=(-auto-approve)
fi
terraform -chdir="$TERRAFORM_DIR" apply "${apply_arguments[@]}"

echo "[3/4] Updating application secrets"
aws secretsmanager put-secret-value \
  --region ap-northeast-2 \
  --secret-id faretrack-dev/serpapi \
  --secret-string "$(printf '{\"apiKey\":\"%s\"}' "$SERPAPI_API_KEY")" \
  --query '{Name:Name,VersionId:VersionId}' \
  --output json

aws secretsmanager put-secret-value \
  --region ap-northeast-2 \
  --secret-id faretrack-dev/firebase \
  --secret-string "file://$FIREBASE_SERVICE_ACCOUNT_FILE" \
  --query '{Name:Name,VersionId:VersionId}' \
  --output json

echo "[4/4] Writing local Android deployment settings"
api_base_url="$(terraform -chdir="$TERRAFORM_DIR" output -raw api_base_url)"
cognito_client_id="$(terraform -chdir="$TERRAFORM_DIR" output -raw cognito_android_client_id)"
cognito_domain="$(terraform -chdir="$TERRAFORM_DIR" output -raw cognito_hosted_ui_domain)"

cat > "$ROOT_DIR/android/faretrack.local.properties" <<EOF
faretrack.apiBaseUrl=$api_base_url
faretrack.cognitoClientId=$cognito_client_id
faretrack.cognitoDomain=$cognito_domain
EOF

echo
echo "Deployment complete"
echo "API: $api_base_url"
echo "Android settings: $ROOT_DIR/android/faretrack.local.properties"
echo "Build the APK in Android Studio, or run: cd $ROOT_DIR/android && ./gradlew assembleDebug"
