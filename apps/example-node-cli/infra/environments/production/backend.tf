terraform {
  backend "s3" {
    key = "example-node-cli/production/terraform.tfstate"
  }
}
