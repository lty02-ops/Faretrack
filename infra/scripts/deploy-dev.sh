#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/deployment-env.sh"
node infra/scripts/jenkins-client.js build
