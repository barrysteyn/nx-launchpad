terraform {
  backend "s3" {
    key = "example-node-cli/staging/terraform.tfstate"
  }
}
