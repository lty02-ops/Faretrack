#!/usr/bin/env bash
set +x
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env}"
[[ -f "$ENV_FILE" ]] || { echo 'Create .env from .env.example first.' >&2; exit 1; }
set -a
source <(sed 's/\r$//' "$ENV_FILE")
set +a
export AWS_REGION="${AWS_REGION:-ap-northeast-2}" AWS_DEFAULT_REGION="${AWS_REGION:-ap-northeast-2}" AWS_PAGER=''
cd "$ROOT_DIR"
command -v node >/dev/null || { echo 'Install Node.js 22 in WSL.' >&2; exit 1; }
node -e 'if(Number(process.versions.node.split(".")[0])<22)process.exit(1)' || {
  echo 'Node.js 22 or newer is required.' >&2; exit 1;
}
