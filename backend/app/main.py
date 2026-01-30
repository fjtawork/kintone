from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings

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

from app.api.endpoints import router as apps_router
from app.api.fields import router as fields_router
from app.api.records import router as records_router

app.include_router(apps_router, prefix="/api/v1/apps", tags=["apps"])
app.include_router(fields_router, prefix="/api/v1/fields", tags=["fields"])
app.include_router(records_router, prefix="/api/v1/records", tags=["records"])

@app.get("/")
def root():
    return {"message": "Welcome to kintone Clone API"}
