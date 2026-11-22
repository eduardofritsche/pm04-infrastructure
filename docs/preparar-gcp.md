# Preparar o projeto do GCP (Pessoa A, uma vez só)

Tudo abaixo roda no **Cloud Shell** (ícone `>_` no topo do console do GCP), já logado na conta que tem o teste grátis.

## 1. Criar o projeto e ligar o faturamento

1. Console → seletor de projetos → **Novo projeto** → nome `pm04-kubeshop`. Anote o **ID do projeto** (pode ser diferente do nome, ex.: `pm04-kubeshop-123456`).
2. Faturamento → vincular o projeto à conta de faturamento do teste grátis.

## 2. Comandos do Cloud Shell

Troque só a primeira linha pelo ID do seu projeto:

```bash
export PROJECT_ID="pm04-kubeshop"          # <- ID do projeto
export BUCKET="${PROJECT_ID}-tfstate"
export SA="github-pipeline"

gcloud config set project "$PROJECT_ID"

# APIs usadas pelo Terraform e pela pipeline
gcloud services enable compute.googleapis.com storage.googleapis.com iam.googleapis.com cloudresourcemanager.googleapis.com

# Bucket do Terraform State (com versionamento, para recuperar um state antigo)
gcloud storage buckets create "gs://${BUCKET}" --location=southamerica-east1 --uniform-bucket-level-access
gcloud storage buckets update "gs://${BUCKET}" --versioning

# Conta de serviço da pipeline, com permissões mínimas:
#  - Compute Admin: criar rede, firewall, VMs, discos e IPs
#  - Storage Object Admin só no bucket do state
gcloud iam service-accounts create "$SA" --display-name="GitHub Actions PM-04"
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${SA}@${PROJECT_ID}.iam.gserviceaccount.com" --role="roles/compute.admin"
gcloud storage buckets add-iam-policy-binding "gs://${BUCKET}" \
  --member="serviceAccount:${SA}@${PROJECT_ID}.iam.gserviceaccount.com" --role="roles/storage.objectAdmin"

# Chave JSON da conta de serviço (vira o secret GCP_SA_KEY)
gcloud iam service-accounts keys create key.json --iam-account="${SA}@${PROJECT_ID}.iam.gserviceaccount.com"
cat key.json      # copie TODO o conteúdo para o secret GCP_SA_KEY
rm key.json       # depois de copiar, apague do Cloud Shell

echo "GCP_PROJECT_ID=${PROJECT_ID}"
echo "TF_STATE_BUCKET=${BUCKET}"
```

> Se a organização bloquear criação de chaves (`iam.disableServiceAccountKeyCreation`), avise no chat: dá para trocar por Workload Identity Federation.

## 3. Cadastrar no GitHub

Repositório → **Settings → Secrets and variables → Actions**:

| Nome | Onde | Valor |
|---|---|---|
| `GCP_SA_KEY` | aba **Secrets** | conteúdo inteiro do `key.json` |
| `GCP_PROJECT_ID` | aba **Variables** | ID do projeto |
| `TF_STATE_BUCKET` | aba **Variables** | `<ID do projeto>-tfstate` |
| `ADMIN_CIDR` | aba **Variables** | seu IP público + `/32` (veja em https://api.ipify.org). Opcional: sem ele, só a pipeline entra por SSH. |

Pessoa B já cadastrou `SSH_PRIVATE_KEY`, `SSH_PUBLIC_KEY`, `MONGO_ROOT_PASSWORD` e `MONGO_APP_PASSWORD`.

## 4. Depois da apresentação

```bash
gcloud iam service-accounts keys list --iam-account="github-pipeline@${PROJECT_ID}.iam.gserviceaccount.com"
gcloud iam service-accounts keys delete <KEY_ID> --iam-account="github-pipeline@${PROJECT_ID}.iam.gserviceaccount.com"
```
