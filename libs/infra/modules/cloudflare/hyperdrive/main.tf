resource "cloudflare_hyperdrive_config" "this" {
  account_id = var.account_id
  name       = "${var.project_name}-${var.environment}-${var.app_name}"

  origin = {
    scheme   = "postgres"
    host     = var.db_host
    port     = 5432
    database = var.db_database
    user     = var.db_user
    password = var.db_password
  }

  caching = {
    disabled = var.caching_disabled
  }
}
