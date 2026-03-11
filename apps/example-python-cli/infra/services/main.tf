module "api_gateway" {
  source = "../../../../libs/infra/modules/aws/api-gateway"

  name                 = "example-python-cli-${var.environment}"
  description          = "Example Python CLI - ${title(var.environment)}"
  lambda_invoke_arn    = module.lambda.invoke_arn
  lambda_function_name = module.lambda.function_name

  tags = {
    environment = var.environment
    app         = "example-python-cli"
    managed_by  = "terraform"
  }
}

module "lambda" {
  source = "../../../../libs/infra/modules/aws/lambda"

  function_name = "example-python-cli-${var.environment}"
  description   = "Example Python CLI - ${title(var.environment)}"
  runtime       = "python3.12"
  handler       = "example_python_cli.main.handler"

  source_path = [
    {
      path             = "${path.root}/../../../src"
      pip_requirements = "${path.root}/../../../requirements.txt"
      patterns         = ["!__pycache__/.*", "!.ruff_cache/.*"]
    }
  ]

  memory_size = var.memory_size
  timeout     = var.timeout

  environment_variables = {
    ENVIRONMENT = var.environment
  }

  tags = {
    environment = var.environment
    app         = "example-python-cli"
    managed_by  = "terraform"
  }
}
