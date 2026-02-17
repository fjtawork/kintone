from fastapi import APIRouter, File, UploadFile, HTTPException, Depends
from typing import Dict
import shutil
import os
import uuid
from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter()

UPLOAD_DIR = "uploads"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)

@router.post("", response_model=Dict[str, str])
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """
    Upload a file.
    Returns:
    {
        "fileKey": "{uuid}_{filename}",
        "originalName": "...",
        "contentType": "..."
    }
    """
    try:
        file_uuid = str(uuid.uuid4())
        # Sanitize filename if needed, but uuid prefix avoids collisions
        safe_filename = file.filename.replace("/", "_").replace("\\", "_")
        file_key = f"{file_uuid}_{safe_filename}"
        file_path = os.path.join(UPLOAD_DIR, file_key)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        return {
            "fileKey": file_key,
            "originalName": file.filename,
            "contentType": file.content_type
        }
    except Exception as e:
        print(f"Upload error: {e}")
        raise HTTPException(status_code=500, detail="File upload failed")
