# Guia de estudo · Pessoa B (configuração: Ansible, loja e operação)

Você apresenta: Ansible, a loja funcionando, Cenários do lado do Ansible e a validação da demanda (isolamento, backup, health).

## A ideia em uma frase

"O Ansible entra nas VMs por SSH e deixa cada uma no estado descrito: pacotes, Docker, banco e contêineres. Ele é idempotente: se já está tudo certo, não muda nada, e por isso o Cenário 3 mostra `changed=0`."

## Como o Ansible chega nas VMs

- `scripts/gerar-inventario.sh` monta o `inventory/hosts.ini` com os IPs que o Terraform devolveu.
- A VM da loja é acessada pelo IP externo; a VM do banco **não tem SSH aberto para a internet**, então o Ansible pula pela VM da loja (`ProxyCommand`) até o IP interno do banco.
- As senhas do Mongo chegam por variável de ambiente (Secrets) e as tarefas que as usam têm `no_log: true`, então não aparecem no log.

## `ansible/playbook.yml` (3 partes)

1. **Todas as VMs**: espera o SSH, roda as roles `os_updates` e `docker`.
2. **VM do banco**: roles `mongodb` e `backup`.
3. **VM da loja**: role `app`.

## Roles

| Role | O que faz | Parâmetro da pipeline |
|---|---|---|
| `os_updates` | `apt update`; se `update_os=true`, aplica as atualizações e reinicia se o sistema pedir; instala pacotes base e `extra_packages` | `update_os`, `extra_packages` |
| `docker` | Instala o Docker se não houver, configura rotação de logs, garante o serviço rodando | – |
| `mongodb` | Formata (só na primeira vez) e monta o disco de dados em `/data/mongo`; sobe o contêiner `mongo:8.0` com usuário e senha; garante o usuário `kubeshop` com acesso só ao banco da loja | senhas dos Secrets |
| `backup` | Instala `kubeshop-backup.sh` e `kubeshop-restore.sh` e agenda o backup diário às 03:00 (guarda 7 dias) | – |
| `app` | Cria a rede Docker, sobe a API e o frontend na versão `docker_tag`, e testa a loja de ponta a ponta (`/api/health` precisa responder com o banco ok e a versão certa) | `docker_image`, `docker_tag` |

### Como a troca de versão (Cenário 2) acontece

Com `docker_tag=1.0.1`, a imagem pedida é outra, então o módulo `docker_container` baixa a nova imagem e recria só os contêineres da loja. O banco não é tocado, por isso o pedido feito na 1.0.0 continua em "Meus pedidos" (e mostra "feito na versão 1.0.0"). A versão nova aparece no topo da loja.

### Por que `changed=0` no Cenário 3

Cada tarefa compara o estado atual com o pedido: pacote já instalado, contêiner já com a imagem e as variáveis certas, arquivo igual. Comandos de verificação têm `changed_when: false`.

## A loja (`app/`)

- **frontend**: React servido pelo Nginx. O Nginx manda `/api/...` para o contêiner `api`.
- **api**: Node.js/Express. `GET /api/products`, `POST /api/orders`, `GET /api/orders?email=...`, `GET /api/health`.
- **build-images.yml** constrói as duas imagens e publica no GitHub Container Registry com a tag escolhida.

## `operations.yml` (rotinas)

| action | Para mostrar |
|---|---|
| `health` | Loja → API → banco ok, versão, contêineres, disco, memória e lista de backups |
| `logs` | Diagnóstico pelos logs dos contêineres |
| `backup` | Backup gerado agora, com nome e tamanho |
| `restore` | Restaura o último backup e mostra o health depois |
| `destroy` | (Pessoa A) apaga o ambiente |

## Testes da validação

- **Isolamento (print 06)**: `nc -zv <db_external_ip> 27017` do seu computador deve dar timeout, enquanto a loja segue funcionando.
- **Backup/restauração (print 10)**: crie um pedido, rode `backup`, rode `restore` e confira "Meus pedidos".

## Perguntas prováveis

- **Por que contêineres?** O PM-04 pede Docker; a mesma imagem testada é a que roda na VM, e trocar de versão é trocar a tag.
- **Onde ficam os dados do banco?** Num disco separado montado em `/data/mongo`. Se a VM mudar de tamanho, o disco continua lá.
- **E se a senha vazar no log?** As tarefas com senha usam `no_log`; o GitHub também mascara Secrets.
- **Como o Ansible sabe os IPs?** O inventário é gerado a partir das saídas do Terraform em cada execução.
- **O Ansible pode quebrar algo rodando de novo?** Não: ele só muda o que está diferente do pedido (idempotência).
