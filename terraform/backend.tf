# O state fica num bucket GCS. O nome do bucket e o prefixo (um por ambiente)
# são passados pela pipeline no "terraform init -backend-config=...".
terraform {
  backend "gcs" {}
}
