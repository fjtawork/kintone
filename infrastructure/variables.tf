variable "aws_region" {
  description = "AWS region"
  type        = strin
  default     = "ap-northeast-1"
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "kintone-clone"
}

variable "db_password" {
  description = "Database password"
  type        = string
  sensitive   = true
}

variable "app_image" {
  description = "Docker image for the application (Backend)"
  type        = string
}

variable "frontend_image" {
  description = "Docker image for the frontend"
  type        = string
}
