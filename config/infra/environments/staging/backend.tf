terraform {
  backend "s3" {
    key = "config/staging/terraform.tfstate"
  }
}
