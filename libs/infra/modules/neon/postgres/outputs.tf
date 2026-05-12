output "project_id" {
  description = "Neon project id"
  value       = neon_project.this.id
}

output "host" {
  description = "Direct (non-pooler) endpoint host"
  value       = neon_project.this.database_host
}

output "database_name" {
  description = "Logical database name"
  value       = neon_database.this.name
}

output "role_name" {
  description = "Auth role name"
  value       = neon_role.this.name
}

output "role_password" {
  description = "Auth role password"
  value       = neon_role.this.password
  sensitive   = true
}

output "connection_uri" {
  description = "Full Postgres connection URI for the auth role and database (direct endpoint)"
  value       = "postgresql://${neon_role.this.name}:${neon_role.this.password}@${neon_project.this.database_host}/${neon_database.this.name}?sslmode=require"
  sensitive   = true
}
