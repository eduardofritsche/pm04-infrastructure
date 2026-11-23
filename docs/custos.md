# Estimativa de custos do KubeShop no GCP

Estimativa mensal do ambiente criado pela pipeline `deploy`, com preços de tabela (sob demanda, sem descontos) do Google Cloud na região **southamerica-east1 (São Paulo)**, em dólar. Referência de preços: novembro de 2026.

## Premissas

| Premissa | Valor usado |
|---|---|
| Região / zona | `southamerica-east1` / `southamerica-east1-a` |
| Horas por mês | 730 (ambiente ligado 24 horas por dia) |
| VM da loja | `e2-small` (2 vCPU compartilhadas, 2 GB) |
| VM do banco | `e2-small` no Cenário 1, `e2-medium` (2 vCPU compartilhadas, 4 GB) a partir do Cenário 2 |
| Discos | 2 discos de boot de 20 GB + 1 disco de dados de 10 GB, todos `pd-balanced` (50 GB no total) |
| IPs externos | 2 em uso: o fixo da loja e o efêmero do banco (só de saída) |
| Tráfego de saída | cerca de 5 GB por mês (acessos à loja, que são poucos e leves) |
| Bucket do Terraform State | menos de 1 MB, custo desprezível |
| Imagens Docker | GitHub Container Registry público, sem custo; tráfego de entrada no GCP é gratuito |
| Tráfego entre as VMs | gratuito (mesma zona, IP interno) |
| Câmbio | US$ 1 = R$ 6,10 (o próprio GCP converteu os US$ 300 do teste grátis em R$ 1.831) |
| Descontos | nenhum. A família E2 não tem desconto por uso contínuo; desconto por compromisso (1 ou 3 anos) não foi considerado |

## Preços unitários (sob demanda, São Paulo)

| Item | Preço | Fonte |
|---|---|---|
| `e2-small` | US$ 0,0267 por hora | [Compute Engine: preços de VM (família E2)](https://cloud.google.com/compute/vm-instance-pricing#e2_machine-types) |
| `e2-medium` | US$ 0,0533 por hora | idem |
| Disco `pd-balanced` | US$ 0,15 por GB por mês | [Preços de disco e imagem](https://cloud.google.com/compute/disks-image-pricing) |
| IPv4 externo em uso (fixo ou efêmero) | US$ 0,005 por hora | [Preços de rede](https://cloud.google.com/vpc/network-pricing) |
| IP fixo reservado e **sem uso** | US$ 0,01 por hora | idem |
| Saída para a internet (destino América do Sul, nível Premium) | US$ 0,19 por GB | idem |
| Tráfego interno na mesma zona | grátis | idem |

> Os valores das VMs e do disco de São Paulo são os da tabela regional do Google (cerca de 1,6 vez o preço de `us-central1`). Antes da apresentação, vale conferir na [Calculadora de preços do Google Cloud](https://cloud.google.com/products/calculator) com as mesmas premissas; a diferença esperada é de centavos.

## Custo mensal (ambiente ligado o mês inteiro)

| Item | Cenário 1 (banco `e2-small`) | Cenário 2/3 (banco `e2-medium`) |
|---|---:|---:|
| VM da loja `e2-small` (730 h) | US$ 19,49 | US$ 19,49 |
| VM do banco (730 h) | US$ 19,49 | US$ 38,91 |
| Discos `pd-balanced` (50 GB) | US$ 7,50 | US$ 7,50 |
| 2 IPs externos em uso | US$ 7,30 | US$ 7,30 |
| Saída para a internet (5 GB) | US$ 0,95 | US$ 0,95 |
| Bucket do state | US$ 0,00 | US$ 0,00 |
| **Total por mês** | **US$ 54,73 (≈ R$ 334)** | **US$ 74,15 (≈ R$ 452)** |

As duas VMs respondem por cerca de 80% do custo. O resto é disco e IP, que são cobrados mesmo com a loja sem acessos.

## Quanto o projeto custou de verdade

O ambiente só fica ligado enquanto a equipe trabalha. Entre o primeiro deploy (22/11) e o `destroy` depois da apresentação (25/11), são no máximo 4 dias ligados, cerca de 96 horas:

| Item | Cálculo | Custo |
|---|---|---|
| 2 VMs (pior caso: loja e2-small + banco e2-medium o tempo todo) | 96 h × (0,0267 + 0,0533) | US$ 7,68 |
| Discos | 50 GB × 0,15 × 96/730 | US$ 0,99 |
| IPs | 2 × 0,005 × 96 | US$ 0,96 |
| **Total estimado** | | **≈ US$ 10 (≈ R$ 60)** |

Tudo isso sai dos US$ 300 (R$ 1.831) do teste grátis, que valem até 21/02/2027. Nenhum valor foi cobrado no cartão.

## Como o custo é controlado

- **`operations` → `destroy`** sempre que a equipe para de trabalhar. Sem VMs, disco e IP, o custo cai para quase zero (só o bucket do state, que custa menos de um centavo).
- **O tamanho das VMs é um parâmetro da pipeline.** Dá para começar pequeno e aumentar só se precisar, sem recriar a VM (Cenário 2).
- **Sem Cloud NAT.** O banco usa um IP externo efêmero só de saída (US$ 3,65 por mês), sem nenhuma porta aberta. Foi a opção mais simples: um recurso a menos no Terraform. O Cloud NAT custaria parecido (cerca de US$ 1 por mês por VM mais US$ 0,045 por GB processado) e é a melhoria indicada para produção, porque tira o IP público do banco.
- **Sem balanceador de carga e sem GKE.** A demanda pede 2 VMs; um balanceador custaria mais de US$ 18 por mês e o GKE cobra a taxa do cluster.

## Como baixar o custo em produção

| Opção | Economia aproximada | Contrapartida |
|---|---|---|
| Desconto por compromisso de 1 ano nas VMs | cerca de 37% nas VMs | Pagamento garantido por 1 ano |
| Rodar em `us-central1` | cerca de 35% nas VMs e nos discos |
| Cloud NAT no lugar do IP externo do banco | cerca de US$ 2 por mês | Mais um recurso no Terraform; em troca, o banco fica sem IP público | Mais latência para clientes no Brasil |
| VM da loja `e2-micro` | cerca de US$ 10 por mês | Só serve para pouco acesso |
| Desligar à noite (VMs paradas 12 h por dia) | cerca de metade das VMs | Loja fora do ar nesse horário; disco e IP fixo continuam cobrados |
