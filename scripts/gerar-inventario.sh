#!/usr/bin/env bash
# Gera ansible/inventory/hosts.ini a partir das saídas do Terraform.
# Uso: scripts/gerar-inventario.sh <arquivo tf-outputs.json> <caminho da chave privada>
set -euo pipefail
OUT_JSON="$1"
KEY="$2"
APP_IP=$(jq -r '.app_public_ip.value' "$OUT_JSON")
DB_IP=$(jq -r '.db_internal_ip.value' "$OUT_JSON")
USER_NAME=$(jq -r '.ssh_user.value' "$OUT_JSON")
PREFIX=$(jq -r '.app_tag.value' "$OUT_JSON" | sed 's/-app$//')
DIR="$(cd "$(dirname "$0")/.." && pwd)/ansible/inventory"

cat > "$DIR/hosts.ini" <<INI
[app]
${PREFIX}-app ansible_host=${APP_IP}

[db]
${PREFIX}-db ansible_host=${DB_IP}

[db:vars]
ansible_ssh_common_args='-o ProxyCommand="ssh -W %h:%p -q -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -i ${KEY} ${USER_NAME}@${APP_IP}"'

[all:vars]
ansible_user=${USER_NAME}
ansible_ssh_private_key_file=${KEY}
db_internal_ip=${DB_IP}
INI
echo "Inventário gerado:"
cat "$DIR/hosts.ini"
