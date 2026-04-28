output "dynamodb_table_name" {
  description = "DynamoDB config table name"
  value       = module.dynamodb.table_name
}

output "dynamodb_table_arn" {
  description = "DynamoDB config table ARN"
  value       = module.dynamodb.table_arn
}

output "kv_namespace_id" {
  description = "Cloudflare KV namespace ID"
  value       = module.kv.id
}

output "kv_namespace_title" {
  description = "Cloudflare KV namespace title"
  value       = module.kv.title
}
