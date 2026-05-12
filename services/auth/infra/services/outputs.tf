output "hyperdrive_id" {
  description = "Cloudflare Hyperdrive config id — pasted into wrangler.jsonc"
  value       = module.hyperdrive.id
}

output "neon_project_id" {
  description = "Neon project id — surfaced for user reference"
  value       = module.postgres.project_id
}

output "connection_uri" {
  description = "Direct Postgres connection URI for the auth role — used by db-migrate"
  value       = module.postgres.connection_uri
  sensitive   = true
}
