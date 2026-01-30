---
name: Backend Development (Python)
description: Best practices and guidelines for developing the backend API with FastAPI.
---

# Backend Development Skill (Python)

When working in the `backend/` directory, follow these guidelines.

## Tech Stack
- **Language**: Python 3.11+
- **Framework**: FastAPI
- **ORM**: SQLAlchemy (Async) + Alembic (Migrations)
- **Linter**: Ruff

## Rules

### 1. Project Structure
- `app/api/v1/endpoints/`: Define API routes here.
- `app/schemas/`: Pydantic models (DTOs) for request/response.
- `app/models/`: SQLAlchemy database models.
- `app/services/`: Business logic layer.

### 2. Coding Standards
- **Type Hints**: MANDATORY. Use `int`, `str`, `List[str]`, `Optional[int]`.
- **Async**: Use `async def` for route handlers and DB access.
- **Dependency Injection**: Use `Depends()` for service injection and DB sessions.

### 3. Error Handling
- Use `HTTPException` from FastAPI.
- Example: `raise HTTPException(status_code=404, detail="Item not found")`

### 4. Database
- Use **Alembic** for all schema changes.
- **Never** modify the DB schema manually without a migration script.
