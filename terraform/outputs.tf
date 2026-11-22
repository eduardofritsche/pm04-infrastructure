output "app_public_ip" {
  description = "IP fixo da loja"
  value       = google_compute_address.app.address
}

output "app_url" {
  description = "Endereço da loja"
  value       = "http://${google_compute_address.app.address}"
}

output "app_internal_ip" {
  value = google_compute_instance.app.network_interface[0].network_ip
}

output "db_internal_ip" {
  description = "IP interno do MongoDB (usado pela API)"
  value       = google_compute_address.db_internal.address
}

output "db_external_ip" {
  description = "IP externo do banco (só saída). Use no teste: nc -zv <ip> 27017 deve falhar."
  value       = google_compute_instance.db.network_interface[0].access_config[0].nat_ip
}

output "network_name" {
  value = google_compute_network.vpc.name
}

output "app_tag" {
  value = "${local.prefix}-app"
}

output "ssh_user" {
  value = var.ssh_user
}
