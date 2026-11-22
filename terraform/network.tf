# Rede VPC própria do ambiente, com uma sub-rede privada.
resource "google_compute_network" "vpc" {
  name                    = "${local.prefix}-vpc"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "private" {
  name          = "${local.prefix}-subnet"
  ip_cidr_range = var.subnet_cidr
  region        = var.region
  network       = google_compute_network.vpc.id
}

# IP externo fixo da loja (os usuários acessam por ele).
resource "google_compute_address" "app" {
  name   = "${local.prefix}-app-ip"
  region = var.region
}

# IP interno fixo do banco: a API sempre encontra o MongoDB no mesmo endereço.
resource "google_compute_address" "db_internal" {
  name         = "${local.prefix}-db-internal-ip"
  region       = var.region
  subnetwork   = google_compute_subnetwork.private.id
  address_type = "INTERNAL"
  address      = cidrhost(var.subnet_cidr, 10)
}

# --- Firewall -------------------------------------------------------------
# Regra geral da VPC no GCP: tudo que não for liberado aqui é bloqueado na entrada.

# HTTP da internet só para a VM da loja.
resource "google_compute_firewall" "app_http" {
  name          = "${local.prefix}-allow-http"
  network       = google_compute_network.vpc.name
  direction     = "INGRESS"
  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["${local.prefix}-app"]
  allow {
    protocol = "tcp"
    ports    = ["80"]
  }
}

# SSH na VM da loja só do IP do administrador. A pipeline libera o próprio IP
# com uma regra temporária enquanto roda (criada e apagada pelo deploy.yml).
resource "google_compute_firewall" "app_ssh_admin" {
  count         = var.admin_cidr == "" ? 0 : 1
  name          = "${local.prefix}-allow-ssh-admin"
  network       = google_compute_network.vpc.name
  direction     = "INGRESS"
  source_ranges = [var.admin_cidr]
  target_tags   = ["${local.prefix}-app"]
  allow {
    protocol = "tcp"
    ports    = ["22"]
  }
}

# MongoDB (27017) só a partir da VM da loja, pela rede privada.
resource "google_compute_firewall" "db_from_app" {
  name        = "${local.prefix}-allow-mongo-from-app"
  network     = google_compute_network.vpc.name
  direction   = "INGRESS"
  source_tags = ["${local.prefix}-app"]
  target_tags = ["${local.prefix}-db"]
  allow {
    protocol = "tcp"
    ports    = ["27017"]
  }
}

# SSH no banco só saindo da VM da loja (o Ansible usa a loja como "ponte").
resource "google_compute_firewall" "db_ssh_from_app" {
  name        = "${local.prefix}-allow-ssh-db-from-app"
  network     = google_compute_network.vpc.name
  direction   = "INGRESS"
  source_tags = ["${local.prefix}-app"]
  target_tags = ["${local.prefix}-db"]
  allow {
    protocol = "tcp"
    ports    = ["22"]
  }
}
