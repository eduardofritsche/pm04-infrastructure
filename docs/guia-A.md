# Guia de estudo · Pessoa A (infraestrutura: Terraform e deploy.yml)

Você apresenta: abertura, arquitetura, Terraform, os Cenários do lado do Terraform e custos.

## A ideia em uma frase

"O Terraform descreve a infraestrutura em arquivos; a pipeline roda `plan` para mostrar o que vai mudar e `apply` para aplicar. O state, guardado num bucket do GCP, é a memória do que já existe, e é por isso que a segunda execução não recria nada."

## Arquivos da pasta `terraform/`

| Arquivo | O que faz | O que falar |
|---|---|---|
| `backend.tf` | Diz que o state fica num bucket GCS. O nome do bucket e o prefixo (`kubeshop/dev`, `kubeshop/prod`...) vêm da pipeline | "Cada ambiente tem o seu state, então dev e prod não se misturam." |
| `main.tf` | Versão do Terraform e do provider Google, projeto/região, e os `locals`: prefixo `kubeshop-dev` e rótulos (labels) | "Todos os recursos levam o nome do ambiente e rótulos, para achar e calcular custo." |
| `variables.tf` | Todas as entradas: projeto, região, ambiente, nome, tipos das VMs, chave SSH, `admin_cidr`. Tem validações (ex.: ambiente só dev/homolog/prod) | "Os parâmetros da pipeline viram estas variáveis." |
| `network.tf` | VPC própria, sub-rede `10.10.0.0/24`, IP externo fixo da loja, IP interno fixo do banco e 4 regras de firewall | Veja a tabela de firewall abaixo |
| `vms.tf` | Imagem Ubuntu 24.04, VM da loja, disco de dados do banco e VM do banco | "O disco do banco é separado: se a VM mudar de tamanho ou for recriada, os dados ficam." |
| `outputs.tf` | Mostra no fim: URL da loja, IPs, nome da rede | "O Ansible usa estas saídas para saber onde conectar." |

### Firewall (o que é liberado; o resto é bloqueado)

| Regra | De onde | Para | Porta |
|---|---|---|---|
| `allow-http` | internet | VM da loja | 80 |
| `allow-ssh-admin` | `ADMIN_CIDR` (seu IP) | VM da loja | 22 |
| `allow-mongo-from-app` | VM da loja (tag) | VM do banco | 27017 |
| `allow-ssh-db-from-app` | VM da loja (tag) | VM do banco | 22 |
| temporária `ci-ssh-<execução>` | IP do GitHub Actions | VM da loja | 22, criada e apagada pela pipeline |

"A VM do banco não tem nenhuma porta aberta para a internet. Ela tem IP externo só para baixar pacotes."

### Por que o Cenário 2 mostra "1 to change" e não recria a VM

`allow_stopping_for_update = true`: para mudar o tipo da máquina, o GCP precisa parar a VM. Com essa opção, o Terraform para, troca o tipo e religa a **mesma** VM. Sem ela, daria erro. E o `ignore_changes` na imagem evita recriar a VM quando sai uma imagem nova do Ubuntu.

### Por que o Cenário 3 mostra "No changes"

O state no bucket diz o que já existe. Os parâmetros são os mesmos, então nada difere. A regra de SSH da pipeline é criada fora do Terraform (pelo `gcloud`) justamente para não aparecer como mudança.

## `.github/workflows/deploy.yml`

1. **Conferir parâmetros e segredos**: para logo com mensagem clara se faltar algo.
2. **auth**: entra no GCP com o secret `GCP_SA_KEY`.
3. **init / fmt / validate / plan / apply**: o resumo do plan vai para a página da execução.
4. **Saídas** viram um arquivo que o job do Ansible baixa.
5. Job **Ansible** (parte da Pessoa B) só roda se o Terraform deu certo (`needs: terraform`).
6. `concurrency`: duas execuções no mesmo ambiente não rodam ao mesmo tempo (não corrompe o state).

## Perguntas prováveis

- **Por que GCP?** Teste grátis de US$ 300, região em São Paulo e Compute Engine simples para 2 VMs.
- **Por que não Kubernetes (GKE)?** O escopo pede VMs e o PM-04 pede Ansible configurando servidores; GKE esconderia essa parte e custa mais.
- **Onde fica o state e por quê?** Num bucket GCS com versionamento. Se ficasse no runner, sumiria a cada execução e o Terraform tentaria criar tudo de novo.
- **O que acontece se a pipeline falhar no meio?** Ela para (`set -e` e jobs dependentes). Rodando de novo, o Terraform continua de onde parou porque o state registra o que já foi criado.
- **Como a pipeline entra no GCP?** Conta de serviço só com Compute Admin e acesso ao bucket do state; a chave fica no Secret e é apagada após a apresentação.
