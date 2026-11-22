data "google_compute_image" "ubuntu" {
  family  = "ubuntu-2404-lts-amd64"
  project = "ubuntu-os-cloud"
}

# --- VM 1: aplicação (Nginx + React e API Node.js) -----------------------
resource "google_compute_instance" "app" {
  name         = "${local.prefix}-app"
  machine_type = var.app_instance_type
  zone         = var.zone
  tags         = ["${local.prefix}-app"]
  labels       = merge(local.labels, { role = "app" })

  # Permite trocar o tipo da máquina parando e religando a VM, sem recriá-la.
  allow_stopping_for_update = true

  boot_disk {
    initialize_params {
      image  = data.google_compute_image.ubuntu.self_link
      size   = 20
      type   = "pd-balanced"
      labels = local.labels
    }
  }

  network_interface {
    subnetwork = google_compute_subnetwork.private.id
    access_config {
      nat_ip = google_compute_address.app.address
    }
  }

  metadata = {
    ssh-keys               = local.ssh_keys
    block-project-ssh-keys = "true"
  }

  lifecycle {
    # A imagem "mais nova" do Ubuntu muda com o tempo; não recriar a VM por isso.
    ignore_changes = [boot_disk[0].initialize_params[0].image]
  }
}

# --- VM 2: banco de dados (MongoDB), exclusiva ---------------------------
# Disco separado para os dados: sobrevive a troca de tipo da VM.
resource "google_compute_disk" "db_data" {
  name   = "${local.prefix}-db-data"
  type   = "pd-balanced"
  zone   = var.zone
  size   = var.db_disk_size_gb
  labels = merge(local.labels, { role = "db-data" })
}

resource "google_compute_instance" "db" {
  name         = "${local.prefix}-db"
  machine_type = var.db_instance_type
  zone         = var.zone
  tags         = ["${local.prefix}-db"]
  labels       = merge(local.labels, { role = "db" })

  allow_stopping_for_update = true

  boot_disk {
    initialize_params {
      image  = data.google_compute_image.ubuntu.self_link
      size   = 20
      type   = "pd-balanced"
      labels = local.labels
    }
  }

  attached_disk {
    source      = google_compute_disk.db_data.id
    device_name = "mongo-data"
  }

  network_interface {
    subnetwork = google_compute_subnetwork.private.id
    network_ip = google_compute_address.db_internal.address
    # IP externo efêmero só para SAÍDA (baixar pacotes e imagens). Nenhuma regra
    # de firewall libera entrada da internet para esta VM.
    access_config {}
  }

  metadata = {
    ssh-keys               = local.ssh_keys
    block-project-ssh-keys = "true"
  }

  lifecycle {
    ignore_changes = [boot_disk[0].initialize_params[0].image]
  }
}
