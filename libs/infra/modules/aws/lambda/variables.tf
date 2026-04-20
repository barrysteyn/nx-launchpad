variable "project_name" {
  description = "Project name used to namespace resources — must be set by each fork of this template"
  type        = string
}

variable "app_name" {
  description = "Application name (e.g. example-node-cli)"
  type        = string
}

variable "environment" {
  description = "Deployment environment (e.g. staging, production)"
  type        = string
}

variable "runtime" {
  description = "Lambda runtime (e.g. python3.12, nodejs22.x)"
  type        = string
}

variable "handler" {
  description = "Lambda handler entrypoint (e.g. main.handler)"
  type        = string
}

variable "source_path" {
  description = "Path to the source to package and deploy. Accepts a string path or a list of objects with path, pip_requirements, and patterns keys."
  type        = any
}

variable "memory_size" {
  description = "Amount of memory in MB to allocate to the Lambda function"
  type        = number
  default     = 128
}

variable "timeout" {
  description = "Timeout in seconds for the Lambda function"
  type        = number
  default     = 30
}

variable "environment_variables" {
  description = "Environment variables to pass to the Lambda function"
  type        = map(string)
  default     = {}
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
