output "function_name" {
  description = "Name of the Lambda function"
  value       = module.lambda.lambda_function_name
}

output "function_arn" {
  description = "ARN of the Lambda function"
  value       = module.lambda.lambda_function_arn
}

output "invoke_arn" {
  description = "Invoke ARN of the Lambda function (used by API Gateway)"
  value       = module.lambda.lambda_function_invoke_arn
}

output "role_arn" {
  description = "ARN of the IAM role created for the Lambda function"
  value       = module.lambda.lambda_role_arn
}
