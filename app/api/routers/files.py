from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from pathlib import Path
from typing import List
import mimetypes
from config.config import settings


router = APIRouter()

SUPPORTED_EXTENSIONS = {
    ".pdf",
    ".doc",
    ".docx",
    ".png",
    ".jpg",
    ".jpeg",
    ".bmp",
    ".tif",
    ".tiff",
    ".webp",
}


@router.get("/api/v1/files", response_model=List[str])
async def list_files():
    docs_dir = Path(settings.local_docs_dir)
    docs_dir.mkdir(parents=True, exist_ok=True)
    return sorted(
        [
            p.name
            for p in docs_dir.iterdir()
            if p.is_file() and p.suffix.lower() in SUPPORTED_EXTENSIONS
        ]
    )


@router.post("/api/v1/files/upload")
async def upload_file(file: UploadFile = File(...)):
    suffix = Path(file.filename).suffix.lower()
    if suffix not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported file type. Supported: " + ", ".join(sorted(SUPPORTED_EXTENSIONS))
            ),
        )
    docs_dir = Path(settings.local_docs_dir)
    docs_dir.mkdir(parents=True, exist_ok=True)
    dest = docs_dir / file.filename
    data = await file.read()
    dest.write_bytes(data)
    return {"filename": file.filename}


@router.get("/api/v1/files/{filename}")
async def download_file(filename: str):
    docs_dir = Path(settings.local_docs_dir)
    file_path = docs_dir / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    media_type, _ = mimetypes.guess_type(filename)
    return FileResponse(
        file_path,
        media_type=media_type or "application/octet-stream",
        filename=filename,
    )


@router.delete("/api/v1/files/{filename}")
async def delete_file(filename: str):
    """删除指定文件"""
    docs_dir = Path(settings.local_docs_dir)
    file_path = docs_dir / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    file_path.unlink()
    return {"message": "File deleted", "filename": filename}
