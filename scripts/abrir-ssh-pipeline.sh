#!/usr/bin/env bash
# Libera SSH na VM da loja só para o IP desta execução da pipeline (regra temporária).
# Uso: scripts/abrir-ssh-pipeline.sh <abrir|fechar> <tf-outputs.json>
set -euo pipefail
ACTION="$1"
OUT_JSON="$2"
if [ ! -s "$OUT_JSON" ]; then echo "Sem saídas do Terraform; nada a fazer."; exit 0; fi
NETWORK=$(jq -r '.network_name.value' "$OUT_JSON")
TAG=$(jq -r '.app_tag.value' "$OUT_JSON")
RULE="${TAG%-app}-ci-ssh-${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}"

if [ "$ACTION" = "abrir" ]; then
  MY_IP=$(curl -fsS https://api.ipify.org)
  echo "Liberando SSH para o IP da pipeline ${MY_IP} (regra ${RULE})"
  gcloud compute firewall-rules create "$RULE" \
    --project "$GCP_PROJECT_ID" --network "$NETWORK" --direction INGRESS \
    --allow tcp:22 --source-ranges "${MY_IP}/32" --target-tags "$TAG" \
    --description "Temporaria: SSH da execucao ${GITHUB_RUN_ID:-local} do GitHub Actions" --quiet
else
  echo "Removendo a regra temporária ${RULE}"
  gcloud compute firewall-rules delete "$RULE" --project "$GCP_PROJECT_ID" --quiet || true
fi
