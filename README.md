# pm04-infrastructure · KubeShop no Google Cloud

Projeto final PM-04 (DevOps e Infraestrutura). A loja **KubeShop** da Zibiska Korp roda em **2 máquinas virtuais no GCP**: o **Terraform** cria a infraestrutura, o **Ansible** configura as máquinas e sobe os contêineres, e o **GitHub Actions** dispara os dois com parâmetros. Este README também é o **manual de operação** do ambiente.

- Arquitetura e decisões: [docs/arquitetura.md](docs/arquitetura.md)
- Preparar o projeto do GCP: [docs/preparar-gcp.md](docs/preparar-gcp.md)
- Guias de estudo: [Pessoa A (Terraform e deploy)](docs/guia-A.md) · [Pessoa B (Ansible, loja e operação)](docs/guia-B.md)

## Estrutura

```
.github/workflows/  build-images.yml  deploy.yml  operations.yml
app/                frontend/ (React + Nginx)  api/ (Node.js/Express)
terraform/          main.tf network.tf vms.tf variables.tf outputs.tf backend.tf
ansible/            playbook.yml operations.yml ansible.cfg inventory/ group_vars/
                    roles/ os_updates docker mongodb app backup
scripts/            tf-init.sh gerar-inventario.sh abrir-ssh-pipeline.sh
docs/               arquitetura.md preparar-gcp.md guia-A.md guia-B.md
evidencias/         prints da apresentação (01-...png a 12-...png)
```

## Segredos e variáveis (Settings → Secrets and variables → Actions)

| Nome | Tipo | Para que serve |
|---|---|---|
| `GCP_SA_KEY` | Secret | Chave da conta de serviço que a pipeline usa no GCP |
| `GCP_PROJECT_ID` | Variable | ID do projeto do GCP |
| `TF_STATE_BUCKET` | Variable | Bucket GCS do Terraform State |
| `ADMIN_CIDR` | Variable | IP liberado para SSH na VM da loja (`x.x.x.x/32`), opcional |
| `SSH_PRIVATE_KEY` | Secret | Ansible entrar nas VMs |
| `SSH_PUBLIC_KEY` | Secret ou Variable | Terraform instalar a chave nas VMs |
| `MONGO_ROOT_PASSWORD` | Secret | Administrador do MongoDB |
| `MONGO_APP_PASSWORD` | Secret | Usuário `kubeshop` da loja no MongoDB |

## Pipelines

### 1. `build-images` — imagens da loja

Actions → **build-images** → Run workflow → `tag` = `1.0.0` (depois `1.0.1`). Publica `ghcr.io/<dono>/kubeshop-api:<tag>` e `ghcr.io/<dono>/kubeshop-frontend:<tag>`. Os pacotes precisam estar **públicos** para as VMs baixarem sem login.

### 2. `deploy` — criar ou atualizar o ambiente

Actions → **deploy** → Run workflow:

| Parâmetro | Exemplo | O que muda |
|---|---|---|
| `environment` | dev / homolog / prod | Nome e rótulos dos recursos e o state usado |
| `instance_name` | kubeshop | Prefixo do nome das VMs |
| `app_instance_type` | e2-small | Tamanho da VM da loja |
| `db_instance_type` | e2-small → e2-medium | Tamanho da VM do banco (Cenário 2) |
| `docker_image` | ghcr.io/eduardofritsche/kubeshop | De onde o Ansible baixa as imagens |
| `docker_tag` | 1.0.0 → 1.0.1 | Versão da loja (Cenário 2) |
| `update_os` | true / false | Aplica ou não as atualizações do sistema |
| `extra_packages` | curl,git,htop | Pacotes extras instalados nas VMs |

Job **Terraform**: `init` (state no GCS) → `fmt`/`validate` → `plan` → `apply`. Job **Ansible**: gera o inventário com os IPs do Terraform, libera SSH só para o IP da execução, roda o `playbook.yml` e fecha o SSH no fim (mesmo se falhar). Qualquer erro para a pipeline. O endereço da loja aparece no resumo da execução.

### 3. `operations` — rotinas de manutenção

| `action` | O que faz |
|---|---|
| `health` | Consulta `/api/health` (loja → API → banco), lista contêineres, disco, memória, carga e backups |
| `logs` | Últimas 80 linhas de log de cada contêiner e do backup agendado |
| `backup` | Gera um backup do banco agora (`mongodump`) em `/data/mongo/backups` |
| `restore` | Restaura o backup mais recente (ou o arquivo em `backup_file`) |
| `destroy` | `terraform destroy` do ambiente escolhido (apaga VMs, disco, IP e rede) |

## Os 3 cenários da apresentação

| Cenário | Parâmetros | Resultado esperado |
|---|---|---|
| 1 · Criação | `environment=dev`, `docker_tag=1.0.0`, `db_instance_type=e2-small`, `update_os=true`, `extra_packages=curl,git` | Terraform cria rede, firewall, 2 VMs, disco e IP; Ansible instala tudo; loja abre no IP mostrado |
| 2 · Atualização | `db_instance_type=e2-medium`, `docker_tag=1.0.1`, `extra_packages=curl,git,htop` | Terraform: `0 to add, 1 to change, 0 to destroy`; Ansible troca os contêineres para 1.0.1 e instala o htop; pedidos antigos continuam lá |
| 3 · Sem alterações | os mesmos do Cenário 2, com `update_os=false` | Terraform: `No changes`; Ansible: `changed=0` |

## Manual de operação

- **A loja está no ar?** `operations` → `health`. Deve mostrar `status: ok`, `database: ok` e a versão.
- **Algo falhou?** `operations` → `logs`. Erros da API aparecem no contêiner `api`; do banco, no `mongo`.
- **Backup:** automático todo dia às 03:00 (horário da VM, UTC), guardado 7 dias no disco de dados. Manual: `operations` → `backup`.
- **Restaurar:** `operations` → `restore` (opcional: `backup_file` com o nome mostrado no `health`/`backup`).
- **Trocar a versão da loja:** publique a imagem com `build-images` e rode `deploy` com o novo `docker_tag`.
- **Aumentar uma VM:** rode `deploy` com outro `*_instance_type`. A VM é parada, alterada e religada (sem perder dados).
- **Parar de gastar créditos:** `operations` → `destroy`. Para voltar, rode `deploy` de novo (Cenário 1).
- **Testar o isolamento do banco:** `nc -zv <db_external_ip> 27017` (IP nas saídas do Terraform) deve falhar.

## Rodar a loja no seu computador

```bash
docker network create ks
docker run -d --name mongo --network ks mongo:8.0
docker run -d --name api --network ks -e MONGO_HOST=mongo:27017 ghcr.io/eduardofritsche/kubeshop-api:1.0.0
docker run -d --name frontend --network ks -p 8080:80 ghcr.io/eduardofritsche/kubeshop-frontend:1.0.0
# abra http://localhost:8080
```
