module "postgres" {
  source                  = "../../../../libs/infra/terraform/modules/neon/postgres"
  project_name            = var.project_name
  app_name                = "auth"
  environment             = var.environment
  region_id               = var.neon_region_id
  min_cu                  = var.min_cu
  max_cu                  = var.max_cu
  suspend_timeout_seconds = var.suspend_timeout_seconds
}

module "hyperdrive" {
  source       = "../../../../libs/infra/terraform/modules/cloudflare/hyperdrive"
  account_id   = var.cloudflare_account_id
  project_name = var.project_name
  app_name     = "auth"
  environment  = var.environment
  db_host      = module.postgres.host
  db_database  = module.postgres.database_name
  db_user      = module.postgres.role_name
  db_password  = module.postgres.role_password
  # caching_disabled defaults to true — no override needed for auth
}
