variable "project_name" {
  description = "Project name used to namespace resources — must be set by each fork of this template"
  type        = string
}

variable "environment" {
  description = "Deployment environment (e.g. staging, production)"
  type        = string
}

variable "cloudflare_account_id" {
  description = "Cloudflare account ID"
  type        = string
}

variable "neon_region_id" {
  description = "Neon region id"
  type        = string
  default     = "aws-us-east-1"
}

variable "min_cu" {
  description = "Autoscaling min compute units for the Neon project"
  type        = number
}

variable "max_cu" {
  description = "Autoscaling max compute units for the Neon project"
  type        = number
}

variable "suspend_timeout_seconds" {
  description = "Seconds before idle Neon compute is suspended. 0 = scale-to-zero immediately."
  type        = number
}
