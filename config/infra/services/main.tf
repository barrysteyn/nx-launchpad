module "dynamodb" {
  source       = "../../../libs/infra/terraform/modules/aws/dynamodb"
  project_name = var.project_name
  app_name     = "config"
  environment  = var.environment

  tags = {
    environment = var.environment
    managed_by  = "terraform"
  }
}

module "kv" {
  source       = "../../../libs/infra/terraform/modules/cloudflare/kv"
  account_id   = var.cloudflare_account_id
  project_name = var.project_name
  app_name     = "config"
  environment  = var.environment
}
