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

variable "region_id" {
  description = "Neon region id (e.g. aws-us-east-1)"
  type        = string
  default     = "aws-us-east-1"
}

variable "pg_version" {
  description = "Postgres major version"
  type        = number
  default     = 17
}

variable "min_cu" {
  description = "Autoscaling min compute units"
  type        = number
  default     = 0.25
}

variable "max_cu" {
  description = "Autoscaling max compute units"
  type        = number
  default     = 0.25
}

variable "suspend_timeout_seconds" {
  description = "Seconds before idle compute is suspended. 0 = use the global default."
  type        = number
  default     = 0
}
