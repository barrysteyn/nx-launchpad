output "id" {
  description = "Hyperdrive config id — referenced from wrangler.jsonc"
  value       = cloudflare_hyperdrive_config.this.id
}
