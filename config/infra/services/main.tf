resource "aws_dynamodb_table" "config" {
  name         = "${var.project_name}-config-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"

  attribute {
    name = "pk"
    type = "S"
  }

  tags = {
    environment = var.environment
    managed_by  = "terraform"
  }
}

module "kv" {
  source       = "../../../libs/infra/modules/cloudflare/kv"
  account_id   = var.cloudflare_account_id
  project_name = var.project_name
  app_name     = "config"
  environment  = var.environment
}
