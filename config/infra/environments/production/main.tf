resource "terraform_data" "environment_check" {
  lifecycle {
    precondition {
      condition     = var.environment == "production"
      error_message = "ENVIRONMENT must be 'production' when deploying to production. Got '${var.environment}'."
    }
  }
}

module "services" {
  source                = "../../services"
  project_name          = var.project_name
  environment           = var.environment
  cloudflare_account_id = var.cloudflare_account_id
}

output "kv_namespace_id" {
  description = "Cloudflare KV namespace ID for production config"
  value       = module.services.kv_namespace_id
}

output "dynamodb_table_name" {
  description = "DynamoDB config table name for production"
  value       = module.services.dynamodb_table_name
}
