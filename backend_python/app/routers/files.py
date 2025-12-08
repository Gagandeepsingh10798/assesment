"""
File Router
Handles file upload and management operations
"""

import os
import shutil
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, HTTPException, UploadFile, File

from app.services import genai_service
from app.config import settings

router = APIRouter(prefix="/files", tags=["Files"])

# Uploads directory
UPLOADS_DIR = Path(__file__).parent.parent.parent / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)


@router.get("")
async def list_files():
    """
    List files in file search store
    GET /api/files
    """
    result = await genai_service.list_files()
    return result


@router.post("")
async def upload_file(file: UploadFile = File(...)):
    """
    Upload file to file search store
    POST /api/files
    """
    if not file:
        raise HTTPException(status_code=400, detail="No file uploaded")
    
    # Save file temporarily
    file_path = UPLOADS_DIR / f"{file.filename}"
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        result = await genai_service.upload_file(str(file_path), file.filename)
        
        # Delete local file after successful upload
        try:
            os.unlink(file_path)
        except Exception as delete_error:
            print(f"Could not delete local file: {delete_error}")
        
        return result
    except Exception as error:
        # Clean up local file on error
        try:
            if file_path.exists():
                os.unlink(file_path)
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=str(error))


@router.delete("/{document_name:path}")
async def delete_file(document_name: str):
    """
    Delete file from file search store
    DELETE /api/files/:documentName
    """
    if not document_name:
        raise HTTPException(status_code=400, detail="Document name is required")
    
    try:
        result = await genai_service.delete_file(document_name)
        return result
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))


# Legacy upload route
upload_router = APIRouter(prefix="/upload", tags=["Files"])


@upload_router.post("")
async def upload_file_legacy(file: UploadFile = File(...)):
    """
    Upload file (legacy route)
    POST /api/upload
    """
    return await upload_file(file)

