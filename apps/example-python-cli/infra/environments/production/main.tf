module "lambda" {
  source = "../../../../../libs/infra/modules/aws/lambda"

  function_name = "example-python-cli-production"
  description   = "Example Python CLI - Production"
  runtime       = "python3.12"
  handler       = "example_python_cli.main.handler"

  source_path = [
    {
      path             = "${path.root}/../../../src"
      pip_requirements = "${path.root}/../../../requirements.txt"
      patterns         = ["!__pycache__/.*", "!.ruff_cache/.*"]
    }
  ]

  memory_size = 256
  timeout     = 30

  environment_variables = {
    ENVIRONMENT = "production"
  }

  tags = {
    environment = "production"
    app         = "example-python-cli"
    managed_by  = "terraform"
  }
}
