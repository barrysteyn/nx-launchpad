resource "cloudflare_workers_kv_namespace" "this" {
  account_id = var.account_id
  title      = "${var.project_name}-${var.app_name}-${var.environment}"
}
