"""SatQuery AI – NDVI computation, classification, and ΔNDVI change detection."""
from __future__ import annotations

import logging
import numpy as np
from pathlib import Path
from typing import Optional

log = logging.getLogger("satquery.pipeline.ndvi")

# Default NDVI class thresholds
_DEFAULT_THRESHOLDS = {
    "water": -0.1,
    "bare_soil": 0.1,
    "poor_vegetation": 0.2,
    "moderate_vegetation": 0.4,
    "healthy_vegetation": 1.0,
}


def compute_ndvi(image: np.ndarray, nir_band: int = 3, red_band: int = 2) -> np.ndarray:
    """
    Compute Normalised Difference Vegetation Index.

    NDVI = (NIR - RED) / (NIR + RED + ε)

    For RGB images (3 bands), uses Red=0 (index 0) and approximates NIR
    using a brightness estimate if band index is out of range.

    Returns:
        ndvi: ndarray (H, W), values clipped to [-1, 1].
    """
    arr = image.astype(np.float32)
    if arr.max() > 1.0:
        arr = arr / 255.0

    n_bands = arr.shape[2] if arr.ndim == 3 else 1

    if n_bands >= 4 and nir_band < n_bands:
        nir = arr[:, :, nir_band]
        red = arr[:, :, red_band]
    elif n_bands == 3:
        # RGB image — use Red channel and approximate NIR from brightness - red
        red = arr[:, :, 0]
        # Rough NIR proxy: avg of all channels biased to green (less red)
        nir = arr[:, :, 1] * 1.2  # green proxy
    else:
        # Grayscale
        red = arr if arr.ndim == 2 else arr[:, :, 0]
        nir = red  # degenerate case → NDVI ≈ 0

    ndvi = (nir - red) / (nir + red + 1e-8)
    return np.clip(ndvi, -1.0, 1.0).astype(np.float32)


def classify_ndvi(ndvi: np.ndarray, thresholds: Optional[dict] = None) -> np.ndarray:
    """
    Classify each pixel into one of 5 land-cover classes based on NDVI.

    Classes (int):
      0 = water (NDVI < -0.1)
      1 = bare_soil (-0.1 ≤ NDVI < 0.1)
      2 = poor_vegetation (0.1 ≤ NDVI < 0.2)
      3 = moderate_vegetation (0.2 ≤ NDVI < 0.4)
      4 = healthy_vegetation (NDVI ≥ 0.4)
    """
    t = thresholds or _DEFAULT_THRESHOLDS
    classes = np.zeros_like(ndvi, dtype=np.uint8)
    classes[ndvi >= t.get("bare_soil", 0.1)] = 1
    classes[ndvi >= t.get("poor_vegetation", 0.2)] = 2
    classes[ndvi >= t.get("moderate_vegetation", 0.4)] = 3
    classes[ndvi >= t.get("healthy_vegetation", 1.0)] = 4  # won't trigger unless = 1.0
    # Corrected: class 4 = NDVI ≥ 0.4
    classes[(ndvi >= 0.4)] = 4
    classes[(ndvi >= 0.2) & (ndvi < 0.4)] = 3
    classes[(ndvi >= 0.1) & (ndvi < 0.2)] = 2
    classes[(ndvi >= t.get("water", -0.1)) & (ndvi < 0.1)] = 1
    classes[ndvi < t.get("water", -0.1)] = 0
    return classes


def compute_ndvi_stats(
    ndvi: np.ndarray,
    confidence_map: Optional[np.ndarray] = None,
    confidence_threshold: int = 50,
    thresholds: Optional[dict] = None,
) -> dict:
    """
    Compute summary statistics for an NDVI array.

    If confidence_map is provided, only pixels above confidence_threshold are used.

    Returns:
        dict: mean, median, std, class_percentages (water/bare_soil/poor/moderate/healthy).
    """
    if confidence_map is not None:
        valid = confidence_map >= confidence_threshold
        if valid.any():
            ndvi_valid = ndvi[valid]
        else:
            ndvi_valid = ndvi.ravel()
    else:
        ndvi_valid = ndvi.ravel()

    classes = classify_ndvi(ndvi_valid.reshape(-1, 1).ravel(), thresholds)
    total = len(classes)
    class_names = ["water", "bare_soil", "poor_vegetation", "moderate_vegetation", "healthy_vegetation"]

    return {
        "mean": round(float(ndvi_valid.mean()), 4),
        "median": round(float(np.median(ndvi_valid)), 4),
        "std": round(float(ndvi_valid.std()), 4),
        "min": round(float(ndvi_valid.min()), 4),
        "max": round(float(ndvi_valid.max()), 4),
        "n_valid_pixels": total,
        "class_percentages": {
            name: round(float((classes == i).sum() / total * 100), 2)
            for i, name in enumerate(class_names)
        },
    }


def compute_delta_ndvi(
    ndvi1: np.ndarray,
    ndvi2: np.ndarray,
    deadband: float = 0.05,
) -> dict:
    """
    Compute ΔNDVI change between two dates and classify change pixels.

    Dead-band filtering removes sensor noise from the change classification.

    ΔNDVI = NDVI_current − NDVI_previous

    Returns:
        dict with: delta_map, class_percentages (increase/decrease/no_change),
                   mean_delta, significant_change_fraction.
    """
    delta = ndvi2 - ndvi1  # (H, W)

    increase_mask = delta > deadband
    decrease_mask = delta < -deadband
    nochange_mask = ~(increase_mask | decrease_mask)

    total = delta.size
    sig_threshold = float(np.percentile(np.abs(delta), 90))
    significant_mask = np.abs(delta) >= sig_threshold

    return {
        "delta_map": delta,
        "mean_delta": round(float(delta.mean()), 4),
        "std_delta": round(float(delta.std()), 4),
        "deadband_used": deadband,
        "class_percentages": {
            "increase": round(float(increase_mask.sum() / total * 100), 2),
            "no_change": round(float(nochange_mask.sum() / total * 100), 2),
            "decrease": round(float(decrease_mask.sum() / total * 100), 2),
        },
        "significant_change_fraction": round(float(significant_mask.sum() / total), 4),
        "significant_change_pct": round(float(significant_mask.sum() / total * 100), 2),
    }


def run_ndvi_analysis(
    image_path: str,
    confidence_map: Optional[np.ndarray] = None,
    config: Optional[dict] = None,
) -> dict:
    """
    Full NDVI analysis for a single image.

    Returns:
        dict with ndvi stats, classification, and metadata.
    """
    from PIL import Image
    cfg = config or {}
    img = np.array(Image.open(image_path).convert("RGB"))
    ndvi = compute_ndvi(img)
    stats = compute_ndvi_stats(
        ndvi,
        confidence_map=confidence_map,
        confidence_threshold=cfg.get("ndvi_confidence_threshold", 50),
        thresholds=cfg.get("ndvi_classes"),
    )
    return {
        "ndvi_array": ndvi,
        "stats": stats,
        "image_path": image_path,
        "analysis_type": "single_image_ndvi",
    }


def run_ndvi_change_analysis(
    image_path_t0: str,
    image_path_t1: str,
    confidence_map_t0: Optional[np.ndarray] = None,
    confidence_map_t1: Optional[np.ndarray] = None,
    config: Optional[dict] = None,
) -> dict:
    """
    NDVI change analysis between T0 (baseline) and T1 (current).

    Returns:
        dict with individual NDVI stats + ΔNDVI change stats.
    """
    from PIL import Image
    cfg = config or {}
    deadband = cfg.get("ndvi_change_deadband", 0.05)

    img_t0 = np.array(Image.open(image_path_t0).convert("RGB"))
    img_t1 = np.array(Image.open(image_path_t1).convert("RGB"))

    # Match sizes
    if img_t0.shape[:2] != img_t1.shape[:2]:
        pil_t1 = Image.fromarray(img_t1).resize((img_t0.shape[1], img_t0.shape[0]), Image.BILINEAR)
        img_t1 = np.array(pil_t1)

    ndvi_t0 = compute_ndvi(img_t0)
    ndvi_t1 = compute_ndvi(img_t1)

    stats_t0 = compute_ndvi_stats(ndvi_t0, confidence_map_t0, cfg.get("ndvi_confidence_threshold", 50))
    stats_t1 = compute_ndvi_stats(ndvi_t1, confidence_map_t1, cfg.get("ndvi_confidence_threshold", 50))
    delta = compute_delta_ndvi(ndvi_t0, ndvi_t1, deadband=deadband)

    return {
        "t0_ndvi_stats": stats_t0,
        "t1_ndvi_stats": stats_t1,
        "delta_ndvi": {k: v for k, v in delta.items() if k != "delta_map"},
        "analysis_type": "bitemporal_ndvi_change",
        "deadband": deadband,
    }
