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

output "jwks_kv_namespace_id" {
  description = "Cloudflare KV namespace ID for JWKS keys (production)"
  value       = module.services.jwks_kv_namespace_id
}

output "d1_database_id" {
  description = "D1 database ID (production)"
  value       = module.services.d1_database_id
}

output "d1_database_name" {
  description = "D1 database name (production)"
  value       = module.services.d1_database_name
}
