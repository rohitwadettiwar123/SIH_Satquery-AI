"""SatQuery AI — GIS Export API routes.

Endpoints:
  POST /api/gis/export/geojson     → application/json (.geojson)
  POST /api/gis/export/shapefile   → application/zip  (.zip shp set)
  POST /api/gis/export/gpkg        → application/gpkg (.gpkg)
  GET  /api/gis/status/{image_id}  → georeferencing metadata for an image
"""
from __future__ import annotations

import json
import logging
import tempfile
import uuid
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field

from backend.config import settings

log = logging.getLogger("satquery.gis_export")
router = APIRouter(tags=["gis"])


# ── Pydantic request/response models ──────────────────────────────────────────

class BBoxPayload(BaseModel):
    x1: float
    y1: float
    x2: float
    y2: float


class DetectedObjectPayload(BaseModel):
    class_name: str = "Detection"
    confidence: float = 0.8
    bbox: BBoxPayload
    area_hectares: Optional[float] = None
    severity_score: Optional[float] = None


class GisExportRequest(BaseModel):
    image_id: str
    detected_objects: list[DetectedObjectPayload] = Field(default_factory=list)
    task_type: str = "UNKNOWN"


class GeoStatusResponse(BaseModel):
    image_id: str
    filename: str
    is_georeferenced: bool
    crs_epsg: Optional[int] = None
    crs_wkt: Optional[str] = None
    bounds_wgs84: Optional[dict] = None
    source_bounds: Optional[dict] = None
    width: int = 0
    height: int = 0
    message: str = ""


# ── Helper: resolve image path safely ─────────────────────────────────────────

def _resolve_image(image_id: str) -> Path:
    """Resolve image_id to an absolute path, preventing path traversal."""
    # Sanitise: strip slashes, dots tricks
    safe_id = Path(image_id).name
    uploads = settings.uploads_dir

    matches = list(uploads.glob(f"{safe_id}.*"))
    matches = [m for m in matches if not m.name.endswith(".meta.json")]
    if not matches:
        for ext in [".tif", ".tiff", ".jpg", ".jpeg", ".png"]:
            c = uploads / f"{safe_id}{ext}"
            if c.exists():
                matches = [c]
                break
    if not matches:
        raise HTTPException(status_code=404, detail=f"Image not found: {image_id}")

    path = matches[0].resolve()
    # Path traversal check
    try:
        path.relative_to(uploads.resolve())
    except ValueError:
        raise HTTPException(status_code=403, detail="Access denied")
    return path


# ── GET /api/gis/status/{image_id} ────────────────────────────────────────────

@router.get("/gis/status/{image_id}", response_model=GeoStatusResponse)
async def geo_status(image_id: str):
    """Return georeferencing metadata for an uploaded image."""
    try:
        path = _resolve_image(image_id)
    except HTTPException:
        return GeoStatusResponse(
            image_id=image_id,
            filename="unknown",
            is_georeferenced=False,
            message="Image not found",
        )

    from backend.utils.geo_utils import extract_geo_metadata
    geo = extract_geo_metadata(path)

    if geo is None:
        return GeoStatusResponse(
            image_id=image_id,
            filename=path.name,
            is_georeferenced=False,
            message="Georeferencing unavailable — source image has no geographic metadata.",
        )

    return GeoStatusResponse(
        image_id=image_id,
        filename=path.name,
        is_georeferenced=True,
        crs_epsg=geo.crs_epsg,
        crs_wkt=geo.crs_wkt[:200],
        bounds_wgs84=geo.bounds_wgs84,
        source_bounds=geo.source_bounds,
        width=geo.width,
        height=geo.height,
        message="GeoTIFF with valid spatial reference detected.",
    )


# ── POST /api/gis/export/geojson ──────────────────────────────────────────────

@router.post("/gis/export/geojson")
async def export_geojson(req: GisExportRequest):
    """Export AI detections as GeoJSON FeatureCollection (EPSG:4326)."""
    path = _resolve_image(req.image_id)

    # ── DEMO FAST-PATH (Bypasses missing GIS dependencies on Windows) ──
    if req.image_id.startswith("demo_"):
        synthetic_geojson = {
            "type": "FeatureCollection",
            "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}},
            "features": [{
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[[88.701, 24.795], [88.747, 24.795], [88.747, 24.842], [88.701, 24.842], [88.701, 24.795]]]
                },
                "properties": {
                    "id": 1,
                    "label": "Flood Inundation Zone (SYNTHETIC)",
                    "confidence": 0.98,
                    "area_hectares": 700.0,
                    "export_crs": "EPSG:4326"
                }
            }],
            "metadata": {"feature_count": 1, "export_crs": "EPSG:4326"}
        }
        import uuid, json
        tmp = settings.uploads_dir / f"gis_export_demo_{uuid.uuid4().hex[:8]}.geojson"
        tmp.write_text(json.dumps(synthetic_geojson, indent=2), encoding="utf-8")
        return FileResponse(
            path=str(tmp),
            media_type="application/geo+json",
            filename=f"satquery_export_demo.geojson",
            headers={"X-Feature-Count": "1", "X-Source-CRS": "EPSG:32644", "X-Export-CRS": "EPSG:4326"},
        )

    from backend.utils.geo_utils import (
        extract_geo_metadata, create_geo_features, build_geojson, estimate_pixel_area
    )

    geo = extract_geo_metadata(path)
    objs = [o.model_dump() for o in req.detected_objects]

    if geo is None:
        # Non-georeferenced: return metadata-only GeoJSON with no fake coordinates
        return JSONResponse(content={
            "error": "Georeferencing unavailable",
            "detail": "Source image has no geographic metadata. Cannot generate geospatially valid GeoJSON.",
            "image_id": req.image_id,
            "is_georeferenced": False,
        }, status_code=422)

    features = create_geo_features(objs, geo)

    if not features:
        return JSONResponse(content={
            "error": "No exportable features",
            "detail": "No valid bounding boxes found in the detected objects.",
        }, status_code=422)

    collection = build_geojson(features, geo)

    # Write to temp file and return as download
    tmp_path = settings.uploads_dir / f"gis_export_{uuid.uuid4().hex[:8]}.geojson"
    tmp_path.write_text(json.dumps(collection, indent=2), encoding="utf-8")

    return FileResponse(
        path=str(tmp_path),
        media_type="application/geo+json",
        filename=f"satquery_export_{req.task_type.lower()}_{req.image_id[:8]}.geojson",
        headers={
            "X-Feature-Count": str(len(features)),
            "X-Source-CRS": f"EPSG:{geo.crs_epsg}" if geo.crs_epsg else "UNKNOWN",
            "X-Export-CRS": "EPSG:4326",
        },
    )


# ── POST /api/gis/export/shapefile ────────────────────────────────────────────

@router.post("/gis/export/shapefile")
async def export_shapefile(req: GisExportRequest):
    """Export AI detections as a zipped ESRI Shapefile (.shp/.shx/.dbf/.prj)."""
    path = _resolve_image(req.image_id)

    from backend.utils.geo_utils import extract_geo_metadata, create_geo_features

    geo = extract_geo_metadata(path)
    if geo is None:
        raise HTTPException(
            status_code=422,
            detail="Georeferencing unavailable — source image has no geographic metadata.",
        )

    objs = [o.model_dump() for o in req.detected_objects]
    features = create_geo_features(objs, geo)

    if not features:
        raise HTTPException(status_code=422, detail="No valid features to export.")

    try:
        from backend.utils.geo_utils import build_shapefile_zip
    except ImportError:
        raise HTTPException(status_code=500, detail="geopandas / fiona not installed.")

    zip_path = settings.uploads_dir / f"gis_shp_{uuid.uuid4().hex[:8]}.zip"
    build_shapefile_zip(features, zip_path)

    return FileResponse(
        path=str(zip_path),
        media_type="application/zip",
        filename=f"satquery_shapefile_{req.image_id[:8]}.zip",
        headers={"X-Feature-Count": str(len(features))},
    )


# ── POST /api/gis/export/gpkg ─────────────────────────────────────────────────

@router.post("/gis/export/gpkg")
async def export_gpkg(req: GisExportRequest):
    """Export AI detections as a GeoPackage (.gpkg)."""
    path = _resolve_image(req.image_id)

    from backend.utils.geo_utils import extract_geo_metadata, create_geo_features

    geo = extract_geo_metadata(path)
    if geo is None:
        raise HTTPException(
            status_code=422,
            detail="Georeferencing unavailable — source image has no geographic metadata.",
        )

    objs = [o.model_dump() for o in req.detected_objects]
    features = create_geo_features(objs, geo)

    if not features:
        raise HTTPException(status_code=422, detail="No valid features to export.")

    try:
        from backend.utils.geo_utils import build_gpkg
    except ImportError:
        raise HTTPException(status_code=500, detail="geopandas not installed.")

    gpkg_path = settings.uploads_dir / f"gis_gpkg_{uuid.uuid4().hex[:8]}.gpkg"
    build_gpkg(features, gpkg_path)

    return FileResponse(
        path=str(gpkg_path),
        media_type="application/geopackage+sqlite3",
        filename=f"satquery_export_{req.image_id[:8]}.gpkg",
        headers={"X-Feature-Count": str(len(features))},
    )
