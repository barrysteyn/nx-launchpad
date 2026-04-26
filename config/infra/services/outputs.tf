output "dynamodb_table_name" {
  description = "DynamoDB config table name"
  value       = aws_dynamodb_table.config.name
}

output "dynamodb_table_arn" {
  description = "DynamoDB config table ARN"
  value       = aws_dynamodb_table.config.arn
}

output "kv_namespace_id" {
  description = "Cloudflare KV namespace ID"
  value       = module.kv.id
}

output "kv_namespace_title" {
  description = "Cloudflare KV namespace title"
  value       = module.kv.title
}
