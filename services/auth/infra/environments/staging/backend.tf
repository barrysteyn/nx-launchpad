terraform {
  backend "s3" {
    key = "auth/staging/terraform.tfstate"
  }
}
