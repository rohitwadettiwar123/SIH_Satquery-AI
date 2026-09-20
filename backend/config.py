"""SatQuery AI – Application Configuration Loader."""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import yaml
from dotenv import load_dotenv

# Load .env file from project root
_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(_ROOT / ".env", override=False)


def _load_yaml(path: Path) -> dict[str, Any]:
    """Load YAML config file; return empty dict if not found."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f) or {}
    except FileNotFoundError:
        return {}


class Settings:
    """Centralised settings object combining YAML config + env vars."""

    def __init__(self) -> None:
        cfg = _load_yaml(_ROOT / "config.yaml")

        # AI models
        self.gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
        self.groq_api_key: str = os.getenv("GROQ_API_KEY", "")
        self.gemini_model: str = cfg.get("gemini_model", "gemini-3.6-flash")
        self.ollama_url: str = os.getenv("OLLAMA_URL", cfg.get("ollama_url", "http://localhost:11434"))
        self.ollama_model: str = cfg.get("ollama_model", "llava")
        self.use_ollama_fallback: bool = cfg.get("use_ollama_fallback", True)

        # Cloud reconstruction
        self.cloud_threshold: float = cfg.get("cloud_threshold", 0.15)
        self.max_cloud_for_direct_use: float = cfg.get("max_cloud_for_direct_use", 0.15)
        self.min_quality_score: float = cfg.get("min_quality_score", 0.60)
        self.max_date_gap_days: int = cfg.get("max_date_gap_days", 365)

        # Confidence weights
        cw = cfg.get("confidence_weights", {})
        self.confidence_weights: dict = {
            "cloud_prob": cw.get("cloud_prob", 0.30),
            "temporal_age": cw.get("temporal_age", 0.25),
            "registration_quality": cw.get("registration_quality", 0.20),
            "local_consistency": cw.get("local_consistency", 0.15),
            "model_confidence": cw.get("model_confidence", 0.10),
        }

        # NDVI
        ndvi = cfg.get("ndvi_classes", {})
        self.ndvi_classes: dict = {
            "water": ndvi.get("water", -1.0),
            "bare_soil": ndvi.get("bare_soil", 0.10),
            "poor_vegetation": ndvi.get("poor_vegetation", 0.20),
            "moderate_vegetation": ndvi.get("moderate_vegetation", 0.40),
            "healthy_vegetation": ndvi.get("healthy_vegetation", 1.00),
        }
        self.ndvi_confidence_threshold: int = cfg.get("ndvi_confidence_threshold", 50)
        self.ndvi_change_deadband: float = cfg.get("ndvi_change_deadband", 0.05)

        # Validation gates
        self.g1_max_coregistration_rmse: float = cfg.get("g1_max_coregistration_rmse", 2.0)
        self.g2_nyquist_factor: float = cfg.get("g2_nyquist_factor", 2.0)
        self.g5_escalation_threshold: float = cfg.get("g5_escalation_threshold", 0.75)

        # Image processing
        self.max_image_size_px: int = cfg.get("max_image_size_px", 1024)
        self.default_gsd_meters: float = cfg.get("default_gsd_meters", 10.0)
        self.sar_lee_window: int = cfg.get("sar_lee_window", 5)

        # Paths
        self.uploads_dir: Path = _ROOT / cfg.get("uploads_dir", "backend/data/uploads")
        self.reports_dir: Path = _ROOT / cfg.get("reports_dir", "backend/data/reports")
        self.audit_log_path: Path = _ROOT / cfg.get("audit_log_path", "backend/data/audit_log.json")

        # App
        self.debug: bool = os.getenv("DEBUG", "false").lower() == "true"
        self.app_env: str = os.getenv("APP_ENV", "development")

    def as_dict(self) -> dict:
        """Return config as a plain dict (for passing to pipeline functions)."""
        return {
            "cloud_threshold": self.cloud_threshold,
            "max_cloud_for_direct_use": self.max_cloud_for_direct_use,
            "min_quality_score": self.min_quality_score,
            "max_date_gap_days": self.max_date_gap_days,
            "confidence_weights": self.confidence_weights,
            "ndvi_classes": self.ndvi_classes,
            "ndvi_confidence_threshold": self.ndvi_confidence_threshold,
            "ndvi_change_deadband": self.ndvi_change_deadband,
            "g1_max_coregistration_rmse": self.g1_max_coregistration_rmse,
            "g2_nyquist_factor": self.g2_nyquist_factor,
            "g5_escalation_threshold": self.g5_escalation_threshold,
            "max_image_size_px": self.max_image_size_px,
            "default_gsd_meters": self.default_gsd_meters,
            "sar_lee_window": self.sar_lee_window,
            "gemini_api_key": self.gemini_api_key,
            "gemini_model": self.gemini_model,
            "ollama_url": self.ollama_url,
            "ollama_model": self.ollama_model,
        }


# Singleton instance used across the application
settings = Settings()
