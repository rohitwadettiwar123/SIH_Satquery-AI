"""SatQuery AI – Pydantic v2 response/request schemas."""
from __future__ import annotations

from typing import Any, Optional
from pydantic import BaseModel, Field


class UploadResponse(BaseModel):
    file_id: str
    filename: str
    size_bytes: int
    modality: str = "optical"          # "optical" | "sar"
    cloud_coverage_pct: float = 0.0
    width: int = 0
    height: int = 0
    bands: int = 0
    metadata: dict[str, Any] = Field(default_factory=dict)
    preview_url: str = ""
    geo_metadata: Optional[dict[str, Any]] = None   # GeoTIFF spatial info


class AnalysisRequest(BaseModel):
    image_ids: list[str]
    query: str
    task_hint: Optional[str] = None    # Override auto-detected task type
    bbox: Optional[list[float]] = None # Custom Area Selection [x1, y1, x2, y2]


class BoundingBox(BaseModel):
    x1: float   # normalised 0-1
    y1: float
    x2: float
    y2: float


class DetectedObject(BaseModel):
    class_name: str
    confidence: float
    bbox: BoundingBox
    area_hectares: Optional[float] = None
    severity_score: Optional[float] = None


class ChangeMetrics(BaseModel):
    ssim_score: float = 0.0
    change_ratio_pct: float = 0.0
    affected_area_km2: float = 0.0
    mean_delta: float = 0.0
    confidence_interval_95: list[float] = Field(default_factory=list)


class NdviStats(BaseModel):
    mean: float = 0.0
    median: float = 0.0
    std: float = 0.0
    class_percentages: dict[str, float] = Field(default_factory=dict)
    delta_ndvi: Optional[dict[str, Any]] = None


class CloudReconstructionInfo(BaseModel):
    triggered: bool = False
    coverage_pct: float = 0.0
    method: str = ""       # "passthrough" | "temporal" | "inpainting"
    avg_confidence: float = 0.0
    disclosure_text: str = ""


class GeoMetadata(BaseModel):
    """Spatial metadata attached to analysis results from GeoTIFF inputs."""
    is_georeferenced: bool = False
    crs_epsg: Optional[int] = None
    crs_wkt: Optional[str] = None
    width: int = 0
    height: int = 0
    bounds_wgs84: Optional[dict[str, float]] = None    # {west, south, east, north}
    source_bounds: Optional[dict[str, float]] = None
    message: str = ""


class AnalysisResult(BaseModel):
    query_id: str
    task_type: str
    query: str
    answer: str
    confidence: float
    detected_objects: list[DetectedObject] = Field(default_factory=list)
    change_metrics: Optional[ChangeMetrics] = None
    ndvi_stats: Optional[NdviStats] = None
    land_cover_analysis: Optional[dict[str, Any]] = None
    geo_metadata: Optional[GeoMetadata] = None         # GIS georeferencing info
    cloud_reconstruction: CloudReconstructionInfo = Field(default_factory=CloudReconstructionInfo)
    execution_trace: list[str] = Field(default_factory=list)
    gate_verdicts: dict[str, str] = Field(default_factory=dict)
    audit_hash: str = ""
    requires_expert_escalation: bool = False
    escalation_reason: str = ""
    processing_time_ms: float = 0.0


class ReportRequest(BaseModel):
    query_id: str
    format: str = "json"   # "pdf" | "json"
