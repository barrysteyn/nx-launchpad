module "lambda" {
  source = "../../../../libs/infra/modules/aws/lambda"

  project_name = var.project_name
  app_name     = "example-node-cli"
  environment  = var.environment
  runtime      = "nodejs22.x"
  handler      = "main.handler"

  source_path = "${path.root}/../../../dist"

  memory_size = var.memory_size
  timeout     = var.timeout

  environment_variables = {
    APP_ENV = var.environment
  }

  tags = {
    environment = var.environment
    app         = "example-node-cli"
    managed_by  = "terraform"
  }
}

module "api_gateway" {
  source = "../../../../libs/infra/modules/aws/api-gateway"

  project_name         = var.project_name
  app_name             = "example-node-cli"
  environment          = var.environment
  lambda_invoke_arn    = module.lambda.invoke_arn
  lambda_function_name = module.lambda.function_name

  tags = {
    environment = var.environment
    app         = "example-node-cli"
    managed_by  = "terraform"
  }
}
