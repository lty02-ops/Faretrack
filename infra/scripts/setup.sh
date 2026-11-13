#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/deployment-env.sh"
for tool in aws terraform; do
  command -v "$tool" >/dev/null || { echo "Install $tool in WSL first." >&2; exit 1; }
done
node infra/scripts/validate-deployment-inputs.js
node infra/scripts/jenkins-client.js check
account_id=$(aws sts get-caller-identity --query Account --output text)
bucket="faretrack-terraform-state-$account_id"
export account_id
node <<'NODE'
const fs = require('node:fs');
const backend = fs.readFileSync('infra/terraform/environments/dev.backend.hcl', 'utf8');
const bucket = backend.match(/^bucket\s*=\s*"([^"]+)"/m)?.[1];
if (bucket !== `faretrack-terraform-state-${process.env.account_id}` || process.env.AWS_REGION !== 'ap-northeast-2') {
  throw new Error('AWS account/region must match environments/dev.backend.hcl. Check your AWS profile before setup.');
}
NODE
echo "AWS account: $account_id / region: $AWS_REGION"
terraform -chdir=infra/bootstrap init -input=false
if ! terraform -chdir=infra/bootstrap state show aws_s3_bucket.terraform_state >/dev/null 2>&1; then
  if aws s3api head-bucket --bucket "$bucket" >/dev/null 2>&1; then
    terraform -chdir=infra/bootstrap import -input=false aws_s3_bucket.terraform_state "$bucket"
  fi
fi
terraform -chdir=infra/bootstrap apply -input=false -auto-approve
node infra/scripts/jenkins-client.js setup
echo 'Setup complete. Run: bash infra/scripts/deploy-dev.sh'
