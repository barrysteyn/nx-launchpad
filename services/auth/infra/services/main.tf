module "db" {
  source       = "../../../../libs/infra/modules/cloudflare/d1"
  account_id   = var.cloudflare_account_id
  project_name = var.project_name
  app_name     = "auth"
  environment  = var.environment
}
