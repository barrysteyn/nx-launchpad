variable "project_name" {
  description = "Project name used to namespace resources — must be set by each fork of this template"
  type        = string
}

variable "environment" {
  description = "Deployment environment — must be 'staging' when running from this directory"
  type        = string
}

variable "aws_region" {
  description = "AWS region to deploy to"
  type        = string
  default     = "us-east-1"
}
