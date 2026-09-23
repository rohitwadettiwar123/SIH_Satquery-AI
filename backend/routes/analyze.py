"""SatQuery AI – /api/analyze endpoint."""
from __future__ import annotations

import logging
import time
from fastapi import APIRouter, HTTPException
from backend.config import settings
from backend.models.schemas import AnalysisRequest, AnalysisResult

log = logging.getLogger("satquery.analyze")
router = APIRouter(tags=["analyze"])


@router.post("/analyze", response_model=AnalysisResult)
async def analyze(request: AnalysisRequest):
    """
    Main analysis endpoint.
    Accepts image IDs (from /upload) + natural language query.
    Runs the full agentic pipeline: validation → reconstruction → specialist → fusion → audit.
    """
    if not request.image_ids:
        raise HTTPException(status_code=400, detail="At least one image_id is required.")
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    # Resolve file paths
    image_paths = []
    for fid in request.image_ids:
        # Try UUID prefix glob first, then exact filename for demo presets
        matches = list(settings.uploads_dir.glob(f"{fid}.*"))
        matches = [m for m in matches if not m.name.endswith(".meta.json")]
        if not matches:
            for ext in ['.jpg', '.jpeg', '.png', '.tif', '.tiff']:
                candidate = settings.uploads_dir / f"{fid}{ext}"
                if candidate.exists():
                    matches = [candidate]
                    break
        if not matches:
            raise HTTPException(status_code=404, detail=f"Image not found: {fid}")
        image_paths.append(str(matches[0]))

    t0 = time.monotonic()

    try:
        from ai.orchestrator import orchestrate
        result = await orchestrate(
            query=request.query,
            image_ids=request.image_ids,
            image_paths=image_paths,
            image_metadata=[{}] * len(image_paths),
            config=settings.as_dict(),
            task_hint=request.task_hint,
            bbox=request.bbox,
        )
    except Exception as e:
        log.exception("Orchestration failed")
        raise HTTPException(status_code=500, detail=f"Analysis pipeline error: {e}")

    result["processing_time_ms"] = round((time.monotonic() - t0) * 1000, 1)

    # ── Attach georeferencing metadata (GeoTIFF only) ───────────────────────
    try:
        from backend.utils.geo_utils import extract_geo_metadata
        geo = extract_geo_metadata(image_paths[0])
        if geo is not None:
            result["geo_metadata"] = geo.to_dict()
        else:
            result["geo_metadata"] = {
                "is_georeferenced": False,
                "message": "Georeferencing unavailable — source image has no geographic metadata.",
            }
    except Exception as geo_err:
        log.warning("geo_metadata extraction failed: %s", geo_err)
        result.setdefault("geo_metadata", None)

    return AnalysisResult(**result)

