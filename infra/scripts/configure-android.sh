#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
mkdir -p "$ROOT_DIR/dist"
# Export only public application settings, never the full Terraform state.
api_base_url="$(terraform -chdir="$ROOT_DIR/infra/terraform" output -raw api_base_url)"
cognito_client_id="$(terraform -chdir="$ROOT_DIR/infra/terraform" output -raw cognito_android_client_id)"
cognito_domain="$(terraform -chdir="$ROOT_DIR/infra/terraform" output -raw cognito_hosted_ui_domain)"
callback_url="$(terraform -chdir="$ROOT_DIR/infra/terraform" output -raw social_provider_callback_url)"
export api_base_url cognito_client_id cognito_domain callback_url ROOT_DIR
node <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const env = process.env;
if ([env.api_base_url, env.cognito_client_id, env.cognito_domain, env.callback_url].some(v => !v || /[\r\n]/.test(v))) {
  throw new Error('Invalid deployment output');
}
fs.writeFileSync(path.join(env.ROOT_DIR, 'android/faretrack.local.properties'), [
  `faretrack.apiBaseUrl=${env.api_base_url}`,
  `faretrack.cognitoClientId=${env.cognito_client_id}`,
  `faretrack.cognitoDomain=${env.cognito_domain}`, ''
].join('\n'));
fs.writeFileSync(path.join(env.ROOT_DIR, 'dist/deployment-info.json'), JSON.stringify({
  apiBaseUrl: env.api_base_url, cognitoClientId: env.cognito_client_id,
  cognitoDomain: env.cognito_domain, socialProviderCallbackUrl: env.callback_url
}, null, 2) + '\n');
NODE
echo 'Android settings and deployment-info.json generated.'
