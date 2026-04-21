module "lambda" {
  source  = "terraform-aws-modules/lambda/aws"
  version = "~> 7.0"

  function_name = "${var.project_name}-${var.app_name}-${var.environment}"
  description   = "${var.app_name} - ${title(var.environment)}"
  runtime       = var.runtime
  handler       = var.handler

  source_path = var.source_path

  memory_size = var.memory_size
  timeout     = var.timeout

  environment_variables = merge(var.environment_variables, {
    APP_ENV      = var.environment
    PROJECT_NAME = var.project_name
  })

  tags = var.tags
}
