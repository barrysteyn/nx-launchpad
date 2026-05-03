terraform {
  backend "s3" {
    key = "auth/production/terraform.tfstate"
  }
}
