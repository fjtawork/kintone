# Deployment Guide for kintone Clone

This guide provides instructions on how to deploy the kintone Clone application to AWS using Terraform.

## Prerequisites

1.  **AWS Account**: You need an active AWS account.
2.  **AWS CLI**: Installed and configured (`aws configure`) with credentials that have sufficient permissions (Admin or similar).
3.  **Terraform**: Installed (version >= 1.2.0).
4.  **Docker**: Installed (to build images).

## Architecture Overview

*   **VPC**: Defines the network environment.
*   **ECS Fargate**: Runs the Frontend and Backend containers serverlessly.
*   **Aurora PostgreSQL (Serverless v2)**: The database for the application.
*   **ALB (Application Load Balancer)**: Routes traffic to the Frontend (port 80) and Backend (port 8000).

## Step-by-Step Deployment

### 1. Build and Push Docker Images

You need to push your Docker images to a container registry (like AWS ECR).

**Backend:**
```bash
# Create specific repository if not exists
aws ecr create-repository --repository-name kintone-backend

# Login to ECR
aws ecr get-login-password --region <region> | docker login --username AWS --password-stdin <aws_account_id>.dkr.ecr.<region>.amazonaws.com

# Build and Push
docker build -t kintone-backend ./backend
docker tag kintone-backend:latest <aws_account_id>.dkr.ecr.<region>.amazonaws.com/kintone-backend:latest
docker push <aws_account_id>.dkr.ecr.<region>.amazonaws.com/kintone-backend:latest
```

**Frontend:**
```bash
# Create repository
aws ecr create-repository --repository-name kintone-frontend

# Build and Push (Make sure to set NEXT_PUBLIC_API_URL if baking in, or rely on runtime env)
# Note: Next.js SSG/SSR often needs build-time env vars. For robust setups, consider Next.js Runtime Config or rebuilding based on Env.
docker build -t kintone-frontend ./frontend
docker tag kintone-frontend:latest <aws_account_id>.dkr.ecr.<region>.amazonaws.com/kintone-frontend:latest
docker push <aws_account_id>.dkr.ecr.<region>.amazonaws.com/kintone-frontend:latest
```

### 2. Configure Terraform

Navigate to the `infrastructure` directory.

Create a `terraform.tfvars` file to set your variables (do not commit this file if it contains secrets):

```hcl
aws_region     = "ap-northeast-1"
project_name   = "kintone-prod"
db_password    = "YourStrongPasswordHere!"
app_image      = "<aws_account_id>.dkr.ecr.<region>.amazonaws.com/kintone-backend:latest"
frontend_image = "<aws_account_id>.dkr.ecr.<region>.amazonaws.com/kintone-frontend:latest"
```

### 3. Deploy

Initialize Terraform:
```bash
terraform init
```

Preview changes:
```bash
terraform plan
```

Apply changes:
```bash
terraform apply
```

### 4. Database Migration

After deployment, the database starts empty. You need to run migrations.
You can run a one-off task in ECS using the same backend image overriding the command:

```bash
# Example using AWS CLI to run One-off Task
aws ecs run-task \
  --cluster kintone-prod-cluster \
  --task-definition kintone-prod-task \
  --network-configuration "awsvpcConfiguration={subnets=[<subnet-id>],securityGroups=[<sg-id>],assignPublicIp=ENABLED}" \
  --overrides '{"containerOverrides": [{"name": "backend", "command": ["alembic", "upgrade", "head"]}]}'
```
(Replace `<subnet-id>` and `<sg-id>` with values from `terraform output`)

## Accessing the Application

Once deployed, Terraform will output the `alb_dns_name`.
Open this URL in your browser: `http://<alb_dns_name>`

## Teardown

To destroy the infrastructure:
```bash
terraform destroy
```

## Troubleshooting

*   **Logs**: Check CloudWatch Logs groups `/ecs/kintone-prod-backend` and `/ecs/kintone-prod-frontend` for application errors.
*   **Database**: Ensure the Aurora Security Group allows traffic from the ECS Security Group (handled by terraform).
