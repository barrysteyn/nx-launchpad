variable "project_name" {
  description = "Project name used to namespace resources — must be set by each fork of this template"
  type        = string
}

variable "app_name" {
  description = "Application name (e.g. config)"
  type        = string
}

variable "environment" {
  description = "Deployment environment (e.g. staging, production)"
  type        = string
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
