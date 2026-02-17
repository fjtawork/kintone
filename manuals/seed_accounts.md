# Seeded Accounts (Development Only)

このファイルは `backend/seed_demo_data.py` で投入される開発用アカウント一覧です。  
ログインIDはメールアドレスを使用します。

## Login Credentials

| Role | Login ID (Email) | Password |
| --- | --- | --- |
| System Admin | `admin@example.com` | `password123` |
| Department Manager | `manager@example.com` | `password123` |
| General Staff | `staff@example.com` | `password123` |
| HR Staff | `hr_staff@example.com` | `password123` |
| Title-Only User | `title_only@example.com` | `password123` |

## Seed Command

```bash
cd backend
./.venv/bin/python seed_demo_data.py
```
