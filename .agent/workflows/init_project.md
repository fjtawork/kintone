---
description: Initialize the kintone clone project structure (Frontend, Backend, Infrastructure)
---

# Project Initialization Workflow

This workflow sets up the monorepo structure for the kintone clone.

## 1. Initialize Git and Directories
```bash
git init
mkdir -p frontend backend infrastructure
echo "# kintone Clone" > README.md
```

## 2. Setup Frontend (Next.js)
// turbo
```bash
# Initialize Next.js with TypeScript, ESLint, Tailwind
npx -y create-next-app@latest frontend --typescript --eslint --tailwind --no-src-dir --app --import-alias "@/*"
```

## 3. Setup Backend (Python/FastAPI)
// turbo
```bash
# Setup Python environment using Poetry (assuming python3 is installed)
# If poetry is not installed, install it or use pip venv
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install fastapi uvicorn[standard] sqlalchemy alembic pydantic python-jose[cryptography] passlib[bcrypt]
# Create basic structure
mkdir -p app/api app/core app/models app/schemas
touch app/main.py
```

## 4. Setup Infrastructure (Terraform)
```bash
cd ../infrastructure
touch main.tf variables.tf outputs.tf
echo "# Terraform Configuration" > README.md
```
