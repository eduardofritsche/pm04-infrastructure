# Integração com a aplicação e o CI/CD da Zibiska Korp

O escopo (seções 3, 5, 7 e 13) diz que a Zibiska Korp **fornece o código** do KubeShop e já tem o CI/CD da aplicação. O nosso trabalho é a infraestrutura e a **adaptação da implantação para servidores separados**, sem novas funcionalidades. Por isso este repositório **não tem código da loja**: ele usa a aplicação do cliente como ela é.

## De onde vem o código

| Item | Valor |
|---|---|
| Repositório da aplicação | [LaercioMLB/kube-shop-v2](https://github.com/LaercioMLB/kube-shop-v2) |
| Commit usado | `ee30950799494e789d586369fb194e815b238691` (fixo, para o build ser reproduzível) |
| Frontend | React (Vite) servido pelo Nginx 1.28, porta **8080**, usuário sem root (`apps/frontend/Dockerfile`) |
| API | Node.js 24 + Express 5, porta **3000**, usuário `node` (`apps/backend/Dockerfile`) |
| Banco | MongoDB 8.0.17 autenticado, banco/usuário/authSource `kubeshop` (`compose.yaml`, `docker/mongodb/init.js`) |

Nenhum arquivo da aplicação é alterado: os Dockerfiles, o `nginx.conf` e o código são construídos exatamente como estão no commit acima.

## Ponto de integração com o CI/CD: `build-images.yml`

A pipeline `build-images` faz o papel do CI/CD da aplicação e é o ponto de entrega entre o código do cliente e a nossa infraestrutura.

1. Baixa o repositório da aplicação no commit `app_ref` (parâmetros `app_repository` e `app_ref`).
2. Roda `npm ci` e `npm test` (testes da API e da interface, que vêm com a aplicação). Se falharem, nada é publicado.
3. Constrói as duas imagens com os Dockerfiles originais. O contexto é a **raiz** do repositório da aplicação, porque os Dockerfiles copiam o `package.json` e o `package-lock.json` da raiz (npm workspaces).
4. Publica no GitHub Container Registry:
   - `ghcr.io/<dono>/kubeshop-api:<tag>` (de `apps/backend/Dockerfile`)
   - `ghcr.io/<dono>/kubeshop-frontend:<tag>` (de `apps/frontend/Dockerfile`)
   - Rótulos OCI com a versão, o commit da aplicação e o repositório de origem.

| Parâmetro | Padrão | Para que serve |
|---|---|---|
| `tag` | 1.0.0 | Versão publicada (o deploy usa a mesma em `docker_tag`) |
| `app_repository` | LaercioMLB/kube-shop-v2 | Repositório do código |
| `app_ref` | `ee30950…` | Commit, tag ou branch a construir |
| `latest` | false | Também marcar como `latest` |

Credenciais: só o `GITHUB_TOKEN` automático da execução (permissão `packages: write`). Os pacotes ficam **públicos** para as VMs baixarem sem login. Se o cliente preferir o CI/CD dele, basta publicar imagens com esses dois nomes e rodar o `deploy` com `docker_image` e `docker_tag` apontando para elas.

**Versão da aplicação.** Na aplicação do cliente a versão é configuração de execução: a API devolve a variável `APP_VERSION` em `GET /api/info` (no `compose.yaml` ela vem do mesmo `APP_VERSION` que nomeia a imagem). O Ansible faz igual: `APP_VERSION = docker_tag`. Assim, 1.0.0 e 1.0.1 são o mesmo código com tags diferentes, e a troca de versão do Cenário 2 aparece em `/api/info`.

## Do `compose.yaml` para duas VMs

O `compose.yaml` do cliente sobe os três serviços numa máquina só. O Ansible reproduz cada serviço na VM certa:

| `compose.yaml` | Na nuvem | Onde está |
|---|---|---|
| serviço `frontend`, porta `${HTTP_PORT:-8080}:8080` | contêiner `frontend` na VM da loja, porta **80:8080** (o firewall libera a 80) | `ansible/roles/app` |
| serviço `api` | contêiner `api` na VM da loja, mesma rede Docker do frontend (o Nginx encaminha `/api` para `api:3000`) | `ansible/roles/app` |
| serviço `mongodb` | contêiner `mongo` na **VM exclusiva do banco**, dados no disco persistente `/data/mongo` | `ansible/roles/mongodb` |
| `MONGO_HOST: mongodb` | `MONGO_HOST = <IP privado do banco>` (10.10.0.10), porta 27017 | `db_internal_ip` (saída do Terraform) |
| rede `data` interna | sub-rede privada da VPC; a 27017 só aceita a VM da loja (firewall) | `terraform/network.tf` |
| `secrets: mongo_app_password` (arquivo) | arquivo `/opt/kubeshop/secrets/mongo-app-password` (0400, dono `node`) montado em `/run/secrets/mongo_app_password`; a API lê por `MONGO_PASSWORD_FILE` | `ansible/roles/app` |
| `mongo_root_password` e `init.js` | senhas vêm dos Secrets do GitHub; `mongo-init.js` cria o mesmo usuário `kubeshop` (readWrite em `kubeshop`) e roda a cada deploy (o `init.js` original só roda com o banco vazio) | `ansible/roles/mongodb` |
| `depends_on: condition: service_healthy` | ordem do playbook: banco primeiro (espera o ping autenticado), depois a API (espera o healthcheck `healthy`), depois o frontend | `ansible/playbook.yml`, `roles/app` |
| `read_only`, `tmpfs`, `cap_drop: ALL`, `no-new-privileges`, `init`, healthchecks | mantidos iguais nos contêineres da loja | `ansible/roles/app` |
| `logging: json-file 10m × 3` | rotação de logs configurada no Docker das VMs | `ansible/roles/docker` |

Variáveis da API (as mesmas do `compose.yaml`, lidas por `apps/backend/src/config.js`):

| Variável | Valor na VM |
|---|---|
| `NODE_ENV`, `HOST`, `PORT` | `production`, `0.0.0.0`, `3000` |
| `APP_VERSION` | `docker_tag` |
| `MONGO_HOST`, `MONGO_PORT` | IP privado do banco, `27017` |
| `MONGO_DATABASE`, `MONGO_AUTH_SOURCE`, `MONGO_USERNAME` | `kubeshop` |
| `MONGO_PASSWORD_FILE` | `/run/secrets/mongo_app_password` |

## Verificações que usam a própria aplicação

| Onde | O que confere |
|---|---|
| `deploy` (role `app`) | `GET /api/health/ready` = `ready: true, database: true`; `GET /api/info` = versão igual ao `docker_tag` (senão a pipeline falha); catálogo com produtos |
| `operations` → `health` | `/api/health/ready` e `/api/info`, contêineres, disco, memória e backups |
| `operations` → `smoke` | roda o teste funcional do cliente (`scripts/smoke.mjs`) dentro do contêiner `api`: página inicial, proxy, saúde, catálogo e criação/consulta de um **pedido fictício** (fica no histórico) |

## O que não foi alterado

Código, Dockerfiles, `nginx.conf`, catálogo e regras de pedido são do cliente. Não há novas funcionalidades. O que é nosso: a forma de rodar em duas VMs (Ansible), a rede e o firewall (Terraform), as senhas pelos Secrets, o backup e as pipelines.
