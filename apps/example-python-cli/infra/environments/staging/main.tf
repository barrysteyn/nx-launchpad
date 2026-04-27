resource "terraform_data" "environment_check" {
  lifecycle {
    precondition {
      condition     = var.environment == "staging"
      error_message = "ENVIRONMENT must be 'staging' when deploying to staging. Got '${var.environment}'."
    }
  }
}

module "services" {
  source       = "../../services"
  project_name = var.project_name
  environment  = var.environment
  memory_size  = 128
}
