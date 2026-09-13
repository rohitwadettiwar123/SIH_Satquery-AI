"""SatQuery AI – Cloud detection using classical spectral methods (CPU-only)."""
from __future__ import annotations

import logging
import numpy as np
from pathlib import Path

log = logging.getLogger("satquery.pipeline.cloud_detect")


def detect_clouds_classical(image: np.ndarray) -> tuple[np.ndarray, float]:
    """
    Detect clouds in an optical image using classical spectral thresholding.

    Uses a brightness-based heuristic: pixels where the mean reflectance
    across all visible bands is > 0.75 are classified as cloud.

    Args:
        image: ndarray of shape (H, W) or (H, W, C), dtype uint8 or float32.

    Returns:
        cloud_mask: Boolean ndarray (H, W), True = cloud.
        coverage_fraction: Float 0.0–1.0, fraction of clouded pixels.
    """
    arr = image.astype(np.float32)
    if arr.max() > 1.0:
        arr = arr / 255.0

    if arr.ndim == 2:
        # Grayscale — simple brightness threshold
        cloud_mask = arr > 0.75
    else:
        # Use first 3 bands only
        rgb = arr[:, :, :3]
        brightness = rgb.mean(axis=2)
        # Also check standard deviation: true clouds are nearly uniform
        band_std = rgb.std(axis=2)
        cloud_mask = (brightness > 0.75) & (band_std < 0.15)

    coverage = float(cloud_mask.mean())
    return cloud_mask, round(coverage, 4)


def estimate_cloud_coverage(image_path: str) -> dict:
    """
    Load an image file and estimate its cloud coverage.

    Args:
        image_path: Path to the image file.

    Returns:
        dict with: coverage_fraction, cloud_mask_array, method_used, coverage_pct.
    """
    from PIL import Image
    try:
        img = Image.open(image_path).convert("RGB")
        arr = np.array(img)
        cloud_mask, coverage = detect_clouds_classical(arr)
        return {
            "coverage_fraction": coverage,
            "coverage_pct": round(coverage * 100, 2),
            "cloud_mask_array": cloud_mask,
            "method_used": "classical_spectral_brightness",
            "image_shape": arr.shape,
        }
    except Exception as e:
        log.warning("Cloud detection failed for %s: %s", image_path, e)
        dummy = np.zeros((1, 1), dtype=bool)
        return {
            "coverage_fraction": 0.0,
            "coverage_pct": 0.0,
            "cloud_mask_array": dummy,
            "method_used": "failed",
            "error": str(e),
        }
