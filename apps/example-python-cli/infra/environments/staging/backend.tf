terraform {
  backend "s3" {
    key = "example-python-cli/staging/terraform.tfstate"
  }
}
