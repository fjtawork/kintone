from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
# Ensure all models are imported (registered) before app starts
from app import models 


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Set all CORS enabled origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount uploads directory
import os
UPLOAD_DIR = "uploads"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)
app.mount("/static/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

from app.api.endpoints import router as apps_router
from app.api.fields import router as fields_router
from app.api.records import router as records_router
from app.api.auth import router as auth_router
from app.api.upload import router as upload_router
from app.api.organization import router as organization_router
from app.api.users import router as users_router
from app.api.notifications import router as notifications_router

app.include_router(auth_router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(apps_router, prefix="/api/v1/apps", tags=["apps"])
app.include_router(fields_router, prefix="/api/v1/fields", tags=["fields"])
app.include_router(records_router, prefix="/api/v1/records", tags=["records"])
app.include_router(upload_router, prefix="/api/v1/files", tags=["files"])
app.include_router(organization_router, prefix="/api/v1/organization", tags=["organization"])
app.include_router(users_router, prefix="/api/v1/users", tags=["users"])
app.include_router(notifications_router, prefix="/api/v1/notifications", tags=["notifications"])

@app.get("/")
def root():
    return {"message": "Welcome to kintone Clone API"}
