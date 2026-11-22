#!/usr/bin/env bash
# terraform init com o state no bucket GCS, um prefixo por ambiente.
# Uso: scripts/tf-init.sh <environment>
set -euo pipefail
: "${TF_STATE_BUCKET:?Cadastre a variable TF_STATE_BUCKET no GitHub}"
cd "$(dirname "$0")/../terraform"
terraform init -input=false \
  -backend-config="bucket=${TF_STATE_BUCKET}" \
  -backend-config="prefix=kubeshop/${1}"
