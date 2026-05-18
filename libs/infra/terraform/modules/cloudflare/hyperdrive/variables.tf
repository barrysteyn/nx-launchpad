variable "account_id" {
  description = "Cloudflare account ID"
  type        = string
}

variable "project_name" {
  description = "Project name used to namespace resources — must be set by each fork of this template"
  type        = string
}

variable "app_name" {
  description = "Application name (e.g. 'auth')"
  type        = string
}

variable "environment" {
  description = "Deployment environment (e.g. staging, production)"
  type        = string
}

variable "db_host" {
  description = "Origin database host (the Neon direct endpoint host)"
  type        = string
}

variable "db_database" {
  description = "Origin database name"
  type        = string
}

variable "db_user" {
  description = "Origin database user"
  type        = string
}

variable "db_password" {
  description = "Origin database password"
  type        = string
  sensitive   = true
}

variable "caching_disabled" {
  description = "Whether to disable Hyperdrive's SELECT result cache. Default true (safe for auth and other mutation-heavy workloads)."
  type        = bool
  default     = true
}

variable "db_port" {
  description = "Origin database port (5432 for Postgres, 3306 for MySQL)"
  type        = number
  default     = 5432
}
