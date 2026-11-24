# Arquitetura do KubeShop no GCP

```
                 Usuários (navegador)
                        │ HTTP :80
                        ▼
 ┌──────────────── VPC kubeshop-<env>-vpc · sub-rede 10.10.0.0/24 ────────────────┐
 │                                                                                │
 │  VM 1 · kubeshop-<env>-app (IP externo fixo)      VM 2 · kubeshop-<env>-db      │
 │  ┌──────────────────────────────┐                 ┌───────────────────────────┐ │
 │  │ frontend (Nginx + React)     │                 │ contêiner mongo (8.0.17)  │ │
 │  │ 80→8080 ──/api──▶ api:3000   │  rede privada   │ usuário/senha             │ │
 │  │ api (Node 24 / Express)      │ ─────:27017───▶ │ dados em disco separado   │ │
 │  └──────────────────────────────┘   10.10.0.10    │ /data/mongo + backup cron │ │
 │                                                   └───────────────────────────┘ │
 └────────────────────────────────────────────────────────────────────────────────┘
        ▲ SSH :22 (ADMIN_CIDR + IP da pipeline, temporário)      ▲ SSH só a partir da VM 1
        │                                                       │ (Ansible usa a VM 1 como ponte)
   GitHub Actions ── Terraform (state no bucket GCS) ── Ansible ─┘
        │
   GitHub Container Registry: kubeshop-api / kubeshop-frontend (1.0.0, 1.0.1)
        ▲ build-images: código do cliente (LaercioMLB/kube-shop-v2), Dockerfiles originais
```

## Decisões

| Decisão | Por quê | Requisito |
|---|---|---|
| Aplicação do cliente sem alterações, construída do repositório dele num commit fixo | O escopo diz que a Zibiska fornece o código; o trabalho é infraestrutura e adaptação para servidores separados ([integracao-app.md](integracao-app.md)) | Escopo 5 e 13 |
| Mesma configuração do `compose.yaml` (variáveis, portas, senha em arquivo, contêineres somente leitura e sem root), trocando só o endereço do banco pelo IP privado | Fica igual ao que o cliente validou localmente | Escopo 5 |
| 2 VMs no Compute Engine (loja e banco) | O escopo pede o banco numa máquina exclusiva; VMs permitem Terraform + Ansible como o PM-04 exige | REQ-01 |
| MongoDB só na VM 2, sem nenhuma regra de entrada da internet | Banco isolado; a 27017 só aceita conexões vindas da tag da VM da loja | REQ-02 |
| API usa o IP interno fixo do banco (10.10.0.10) | Tráfego do banco fica na rede privada da VPC | REQ-03 |
| SSH só com chave, de `ADMIN_CIDR` e do IP da execução da pipeline (regra criada e apagada a cada execução) | Nada de senha de SSH; acesso mínimo | REQ-04 |
| Senhas e chave do GCP nos Secrets do GitHub; senhas chegam ao Ansible por variável de ambiente e com `no_log` | Nenhum segredo no código nem nos logs | REQ-04 |
| Disco persistente separado para os dados + backup diário (cron, 7 dias) e restauração pela pipeline | Dados sobrevivem a troca de tipo da VM e a falhas do contêiner | REQ-05 |
| `allow_stopping_for_update = true` nas VMs | Mudar o tipo da VM (Cenário 2) altera a VM existente em vez de recriá-la | PM-04 3.2 |
| State no bucket GCS com um prefixo por ambiente | State preservado e separado entre dev/homolog/prod | PM-04 3.2 |
| Região southamerica-east1 (São Paulo) | Menor latência para quem acessa a loja | – |
| IP externo efêmero na VM do banco, só para saída | Baixar pacotes e a imagem do Mongo sem pagar Cloud NAT; sem portas abertas | custo |
