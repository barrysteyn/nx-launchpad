locals {
  # Postgres role identifiers must not contain unquoted hyphens.
  # project_name is conventionally hyphenated, so substitute at module level.
  role_name_safe_project = replace(var.project_name, "-", "_")
  role_name              = "${local.role_name_safe_project}_${var.environment}_${var.app_name}"
}

resource "neon_project" "this" {
  name       = "${var.project_name}-${var.environment}-${var.app_name}"
  region_id  = var.region_id
  pg_version = var.pg_version

  default_endpoint_settings {
    autoscaling_limit_min_cu = var.min_cu
    autoscaling_limit_max_cu = var.max_cu
    suspend_timeout_seconds  = var.suspend_timeout_seconds
  }

  lifecycle {
    prevent_destroy = true
  }
}

resource "neon_role" "this" {
  project_id = neon_project.this.id
  branch_id  = neon_project.this.default_branch_id
  name       = local.role_name
}

resource "neon_database" "this" {
  project_id = neon_project.this.id
  branch_id  = neon_project.this.default_branch_id
  name       = "auth"
  owner_name = neon_role.this.name
}
