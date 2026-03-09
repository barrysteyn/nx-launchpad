terraform {
  backend "s3" {
    key = "example-python-cli/production/terraform.tfstate"
  }
}
