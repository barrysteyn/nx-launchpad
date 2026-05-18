resource "cloudflare_d1_database" "this" {
  account_id = var.account_id
  name       = "${var.project_name}-${var.environment}-${var.app_name}"

  read_replication = {
    mode = var.read_replication_mode
  }

  lifecycle {
    prevent_destroy = true
  }
}
