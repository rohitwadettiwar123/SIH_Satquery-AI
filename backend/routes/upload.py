"""SatQuery AI – /api/upload endpoint."""
from __future__ import annotations

import io
import logging
import uuid
from pathlib import Path
from typing import Optional

import numpy as np
from fastapi import APIRouter, File, HTTPException, UploadFile
from PIL import Image

from backend.config import settings
from backend.models.schemas import UploadResponse

log = logging.getLogger("satquery.upload")
router = APIRouter(tags=["upload"])

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".tif", ".tiff"}
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100 MB


def _detect_modality(filename: str) -> str:
    """Heuristically detect if image is SAR or optical from filename."""
    name_lower = filename.lower()
    sar_keywords = ["sar", "s1", "sentinel1", "risat", "grd", "slc", "_vv", "_vh", "backscatter"]
    if any(k in name_lower for k in sar_keywords):
        return "sar"
    return "optical"


def _estimate_cloud_coverage(img_array: np.ndarray) -> float:
    """
    Classical spectral cloud detection.
    Works on RGB uint8 arrays. Bright pixels (all channels high) ≈ cloud.
    Returns fraction 0.0-1.0.
    """
    if img_array.ndim < 3:
        return 0.0
    # Normalize to [0,1] if uint8
    arr = img_array.astype(np.float32)
    if arr.max() > 1.0:
        arr = arr / 255.0

    # Use first 3 bands (RGB or first 3 channels)
    rgb = arr[:, :, :3]

    # Cloud heuristic: mean reflectance > 0.8 across all visible bands
    mean_r = rgb.mean(axis=2)  # per-pixel mean across channels
    cloud_mask = mean_r > 0.75
    coverage = float(cloud_mask.mean())
    return round(coverage, 4)


def _get_image_info(img_array: np.ndarray) -> dict:
    """Extract basic image information."""
    h, w = img_array.shape[:2]
    bands = img_array.shape[2] if img_array.ndim == 3 else 1
    return {"width": w, "height": h, "bands": bands, "dtype": str(img_array.dtype)}


@router.post("/upload", response_model=UploadResponse)
async def upload_image(file: UploadFile = File(...)):
    """
    Upload a satellite/remote sensing image.
    Accepts GeoTIFF, TIFF, PNG, JPEG.
    Automatically detects modality (optical/SAR) and estimates cloud coverage.
    """
    # Validate extension
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{suffix}'. Supported: {ALLOWED_EXTENSIONS}",
        )

    # Read file content
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Maximum 100 MB.")

    # Generate unique ID and save
    file_id = str(uuid.uuid4())
    save_path = settings.uploads_dir / f"{file_id}{suffix}"
    settings.uploads_dir.mkdir(parents=True, exist_ok=True)
    save_path.write_bytes(content)
    log.info("Saved upload: %s → %s", file.filename, save_path.name)

    # Open image and extract metadata
    try:
        img = Image.open(io.BytesIO(content)).convert("RGB")
        # Downscale for analysis if too large
        max_px = settings.max_image_size_px
        if max(img.size) > max_px:
            img.thumbnail((max_px, max_px), Image.LANCZOS)
        img_array = np.array(img)

        cloud_pct = 0.0
        modality = _detect_modality(file.filename or "")
        if modality == "optical":
            cloud_pct = _estimate_cloud_coverage(img_array) * 100

        info = _get_image_info(img_array)
        metadata: dict = {
            **info,
            "original_filename": file.filename,
            "file_size_bytes": len(content),
        }
    except Exception as e:
        log.warning("Could not open image for analysis: %s", e)
        modality = _detect_modality(file.filename or "")
        cloud_pct = 0.0
        info = {"width": 0, "height": 0, "bands": 0}
        metadata = {"original_filename": file.filename, "file_size_bytes": len(content), "parse_error": str(e)}

    return UploadResponse(
        file_id=file_id,
        filename=file.filename or "",
        size_bytes=len(content),
        modality=modality,
        cloud_coverage_pct=round(cloud_pct, 2),
        width=info.get("width", 0),
        height=info.get("height", 0),
        bands=info.get("bands", 0),
        metadata=metadata,
        preview_url=f"/uploads/{file_id}{suffix}",
    )
