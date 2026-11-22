variable "project_id" {
  description = "ID do projeto no GCP (variable GCP_PROJECT_ID)"
  type        = string
}

variable "region" {
  description = "Região do GCP"
  type        = string
  default     = "southamerica-east1"
}

variable "zone" {
  description = "Zona das VMs"
  type        = string
  default     = "southamerica-east1-a"
}

variable "environment" {
  description = "Ambiente: dev, homolog ou prod"
  type        = string
  default     = "dev"
  validation {
    condition     = contains(["dev", "homolog", "prod"], var.environment)
    error_message = "environment deve ser dev, homolog ou prod."
  }
}

variable "instance_name" {
  description = "Prefixo do nome das VMs e dos demais recursos"
  type        = string
  default     = "kubeshop"
  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{1,30}$", var.instance_name))
    error_message = "instance_name: letras minúsculas, números e hífen, começando com letra."
  }
}

variable "app_instance_type" {
  description = "Tipo da VM da aplicação (loja + API)"
  type        = string
  default     = "e2-small"
}

variable "db_instance_type" {
  description = "Tipo da VM do banco (MongoDB)"
  type        = string
  default     = "e2-small"
}

variable "db_disk_size_gb" {
  description = "Tamanho do disco separado onde ficam os dados do MongoDB"
  type        = number
  default     = 10
}

variable "ssh_user" {
  description = "Usuário Linux criado nas VMs com a chave pública"
  type        = string
  default     = "ubuntu"
}

variable "ssh_public_key" {
  description = "Chave pública SSH (SSH_PUBLIC_KEY) instalada nas VMs"
  type        = string
}

variable "admin_cidr" {
  description = "Faixa liberada para SSH na VM da aplicação (ex.: 200.1.2.3/32). Vazio = só a pipeline."
  type        = string
  default     = ""
}

variable "subnet_cidr" {
  description = "Faixa da sub-rede privada"
  type        = string
  default     = "10.10.0.0/24"
}
