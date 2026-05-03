output "jwks_kv_namespace_id" {
  description = "Cloudflare KV namespace ID for JWKS keys"
  value       = module.jwks_kv.id
}

output "jwks_kv_namespace_title" {
  description = "Cloudflare KV namespace title for JWKS keys"
  value       = module.jwks_kv.title
}

output "d1_database_id" {
  description = "D1 database ID"
  value       = module.db.id
}

output "d1_database_name" {
  description = "D1 database name"
  value       = module.db.name
}
