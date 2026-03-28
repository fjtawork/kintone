# Deployment Guide for kintone Clone

> **注意**: 本プロダクトは PHP + MySQL + Apache（共有ホスティング / レンタルサーバー）での運用を第一に設計しています。WordPressが動くサーバー環境であれば動作します。以下のAWSデプロイ手順は旧Python/FastAPIバックエンド向けの参考資料です。

## 推奨デプロイ方法（PHP版 / 共有ホスティング）

### サーバー要件

- PHP 8.0以上（推奨 8.3）
- MySQL 5.7以上（または MariaDB 10.3以上）
- Apache + mod_rewrite（.htaccess使用可能）

### 手順

1. `php-app/` 配下のファイルをサーバーのドキュメントルートにアップロード
2. `frontend/` で `npm run build` を実行し、生成された `out/` の中身をサーバーに配置
3. ブラウザから `http://your-domain/install.php` にアクセスしてGUIインストーラーを実行
   - DB接続情報の入力
   - 管理者アカウントの作成
4. インストール完了後、`install.php` は自動的にアクセス不可になる

### ディレクトリ構成（サーバー上）

```
/public_html/          (ドキュメントルート)
  .htaccess            API + SPAルーティング
  index.php            PHPエントリポイント
  install.php          GUIインストーラー
  app/                 PHPアプリケーション
  custom/              カスタマイズファイル（functions.php, global.js, apps/）
  storage/             ログ・アップロード
  *.html, _next/       Next.js静的ビルド出力
```

---

## 参考: AWSデプロイ（旧Python/FastAPIバックエンド向け）

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
