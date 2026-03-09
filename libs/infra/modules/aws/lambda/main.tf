module "lambda" {
  source  = "terraform-aws-modules/lambda/aws"
  version = "~> 7.0"

  function_name = var.function_name
  description   = var.description
  runtime       = var.runtime
  handler       = var.handler

  source_path = var.source_path

  memory_size = var.memory_size
  timeout     = var.timeout

  environment_variables = var.environment_variables

  tags = var.tags
}
