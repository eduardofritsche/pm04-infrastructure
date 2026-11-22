# Handoff do PM-04 · o que foi feito e o que falta

_Atualizado em 22/11/2026, 18h30 (UTC). Escrito pelo Claude da Pessoa B (Eduardo) para a Pessoa A e o Claude dela._

> **Para o Claude que está lendo:** o código do repositório **já está escrito, revisado e mergeado na `main`**. Ele segue o "Passo a passo do PM-04" (versão GCP). **Não reescreva** Terraform, Ansible, pipelines nem a loja. O trabalho agora é preparar o GCP, rodar as pipelines e corrigir só o que falhar, a partir do log. Se precisar mudar algo, faça uma mudança pequena e explique o motivo.

## 1. Estado atual

| Item | Situação |
|---|---|
| Repositório `eduardofritsche/pm04-infrastructure` | PR #1 (loja + build-images) e PR #2 (Terraform, Ansible, deploy, operations, docs) **mergeados** |
| Imagens Docker | `ghcr.io/eduardofritsche/kubeshop-api` e `kubeshop-frontend`, tags **1.0.0** e **1.0.1**, publicadas e **públicas** |
| Secrets cadastrados pela Pessoa B | `SSH_PRIVATE_KEY`, `SSH_PUBLIC_KEY` (como **secret**; o código lê `vars.SSH_PUBLIC_KEY \|\| secrets.SSH_PUBLIC_KEY`, então não precisa mover), `MONGO_ROOT_PASSWORD`, `MONGO_APP_PASSWORD` |
| Falta cadastrar (Pessoa A) | `GCP_SA_KEY` (secret), `GCP_PROJECT_ID`, `TF_STATE_BUCKET`, `ADMIN_CIDR` (variables) |
| Projeto no GCP | **Ainda não existe** |
| Rodado no GCP de verdade | **Ainda não** |

## 2. Estrutura do repositório

```
.github/workflows/  build-images.yml  deploy.yml  operations.yml
app/                frontend/ (React + Nginx, /api → contêiner "api")  api/ (Node/Express + MongoDB)
terraform/          main.tf network.tf vms.tf variables.tf outputs.tf backend.tf
ansible/            playbook.yml operations.yml ansible.cfg group_vars/all.yml inventory/
                    roles/ os_updates docker mongodb app backup
scripts/            tf-init.sh  gerar-inventario.sh  abrir-ssh-pipeline.sh
docs/               arquitetura.md preparar-gcp.md guia-A.md guia-B.md HANDOFF.md
evidencias/         prints (vazia)
README.md           também é o manual de operação
```

Decisões importantes (detalhes em `docs/arquitetura.md`):
- Região `southamerica-east1`, zona `southamerica-east1-a`. Duas VMs Ubuntu 24.04: `<instance_name>-<env>-app` (IP externo fixo) e `<instance_name>-<env>-db` (IP interno fixo `10.10.0.10`, IP externo só de saída, nenhuma porta aberta para a internet).
- O disco de dados do Mongo é separado e fica montado em `/data/mongo`. As VMs têm `allow_stopping_for_update = true`, então trocar o tipo da VM dá "1 to change" sem recriar.
- O state fica no bucket GCS, com o prefixo `kubeshop/<environment>`.
- O SSH da pipeline é uma regra de firewall **temporária**, criada e apagada pelo `gcloud` em cada execução (fora do Terraform, para o Cenário 3 dar "No changes"). O Ansible entra no banco passando pela VM da loja (`ProxyCommand`).
- A autenticação no GCP usa chave de conta de serviço (`GCP_SA_KEY`), como no plano. Workload Identity Federation não foi usado.

## 3. O que foi testado (e o que não)

Testado fora do GCP:
- A loja: a stack completa em contêineres (Mongo 8 com senha + API + frontend). Pedido criado e listado em "Meus pedidos".
- `terraform validate`, e `terraform test` com provider simulado (plan e apply).
- `ansible-lint` (perfil production) e `actionlint` sem erros.
- O playbook em **2 VMs simuladas** (contêineres Ubuntu 24.04 com systemd, banco acessível só via a VM da loja):
  - Cenário 1 ok.
  - Cenário 2 (1.0.1 + htop + update_os) ok, com o pedido antigo preservado.
  - Cenário 3 com `changed=0` nas duas.
  - operations: backup, restore (pedidos voltaram), health e logs ok.

**Não testado:** nada rodou no GCP real. É lá que podem aparecer erros de permissão da conta de serviço, cota, imagem, tempo de boot ou apt lock. Corrija pelo log.

## 4. O que falta, por pessoa

### Pessoa A (infraestrutura)
1. Criar a conta do GCP (teste grátis) e o projeto `pm04-kubeshop`.
2. Rodar no Cloud Shell os comandos de **`docs/preparar-gcp.md`** (ativam as APIs, criam o bucket do state e a conta de serviço `github-pipeline`, e geram a chave).
3. Cadastrar no GitHub: `GCP_SA_KEY` (secret), `GCP_PROJECT_ID`, `TF_STATE_BUCKET` e `ADMIN_CIDR` (variables).
4. **Cenário 1:** Actions → deploy → `environment=dev`, `docker_tag=1.0.0`, `db_instance_type=e2-small`, `update_os=true`, `extra_packages=curl,git`.
5. **Cenário 2:** `db_instance_type=e2-medium`, `docker_tag=1.0.1`, `extra_packages=curl,git,htop`. Esperado: `0 to add, 1 to change, 0 to destroy`.
6. **Cenário 3:** os mesmos do Cenário 2, com `update_os=false`. Esperado: `No changes` e `changed=0`.
7. Tirar os prints **01, 02, 04, 05, 07 e 12** (lista no plano e no README).
8. Rodar `operations` → `destroy` sempre que pararem de trabalhar, na véspera (para mostrar o Cenário 1 ao vivo) e depois da apresentação. Depois, apagar a chave da conta de serviço.

### Pessoa B (configuração)
1. Testar a loja no IP que aparece no fim do deploy: sacola, pedido e "Meus pedidos".
2. Testar o isolamento: `nc -zv <db_external_ip> 27017` deve falhar.
3. Rodar `operations` com `backup`, depois com `restore`, depois `health` e `logs`.
4. Tirar os prints **03, 06, 08, 09, 10 e 11**.
5. Montar o PDF final com os prints e enviar na Blackboard (prazo 27/11).

### Claude (pendente)
- `docs/custos.md`: custo mensal com preços oficiais do GCP e as premissas.
- O documento de entrega (PDF), com espaço para cada print e a tabela de validação da demanda.
- Os slides, o roteiro de fala dividido entre A e B e as perguntas prováveis.
- Correções pelos logs das pipelines.

## 5. Se der erro

Cole a parte vermelha do log da execução no chat. Causas mais prováveis e onde olhar:

| Sintoma | Onde |
|---|---|
| "Falta cadastrar: ..." | Primeiro passo do deploy. Faltou uma variable ou um secret |
| 403 / permission denied no Terraform | Papéis da conta de serviço (`roles/compute.admin` e `storage.objectAdmin` no bucket) |
| Ansible não conecta por SSH | Regra temporária (`scripts/abrir-ssh-pipeline.sh`), chave em `SSH_PRIVATE_KEY`, usuário `ubuntu` |
| Health falha no fim do Ansible | `operations` → `logs` (contêineres `api` e `mongo`) |

Apresentação: qua 25/11. Entrega do PDF: 27/11.
