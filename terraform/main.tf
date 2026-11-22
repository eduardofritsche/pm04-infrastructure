terraform {
  required_version = ">= 1.6"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}

locals {
  prefix = "${var.instance_name}-${var.environment}"
  labels = {
    project     = "pm04"
    app         = "kubeshop"
    environment = var.environment
    managed_by  = "terraform"
  }
  ssh_keys = "${var.ssh_user}:${trimspace(var.ssh_public_key)}"
}
