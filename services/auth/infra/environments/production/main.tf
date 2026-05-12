resource "terraform_data" "environment_check" {
  lifecycle {
    precondition {
      condition     = var.environment == "production"
      error_message = "ENVIRONMENT must be 'production' when deploying to production. Got '${var.environment}'."
    }
  }
}

module "services" {
  source                  = "../../services"
  project_name            = var.project_name
  environment             = var.environment
  cloudflare_account_id   = var.cloudflare_account_id
  min_cu                  = 0.5
  max_cu                  = 2.0
  suspend_timeout_seconds = 300
}

output "hyperdrive_id" {
  description = "Cloudflare Hyperdrive config id (production)"
  value       = module.services.hyperdrive_id
}

output "neon_project_id" {
  description = "Neon project id (production)"
  value       = module.services.neon_project_id
}

output "connection_uri" {
  description = "Direct Postgres connection URI for the auth role (production)"
  value       = module.services.connection_uri
  sensitive   = true
}
