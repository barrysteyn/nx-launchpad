resource "terraform_data" "environment_check" {
  lifecycle {
    precondition {
      condition     = var.environment == "staging"
      error_message = "ENVIRONMENT must be 'staging' when deploying to staging. Got '${var.environment}'."
    }
  }
}

module "services" {
  source                  = "../../services"
  project_name            = var.project_name
  environment             = var.environment
  cloudflare_account_id   = var.cloudflare_account_id
  min_cu                  = 0.25
  max_cu                  = 0.25
  suspend_timeout_seconds = 0
}

output "hyperdrive_id" {
  description = "Cloudflare Hyperdrive config id (staging)"
  value       = module.services.hyperdrive_id
}

output "neon_project_id" {
  description = "Neon project id (staging)"
  value       = module.services.neon_project_id
}

output "connection_uri" {
  description = "Direct Postgres connection URI for the auth role (staging)"
  value       = module.services.connection_uri
  sensitive   = true
}
