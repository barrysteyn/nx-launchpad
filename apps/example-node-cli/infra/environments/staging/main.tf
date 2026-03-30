module "services" {
  source      = "../../services"
  environment = "staging"
  memory_size = 128
}
