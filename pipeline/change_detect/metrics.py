"""SatQuery AI – Change detection metrics: SSIM, CVA, cluster analysis."""
from __future__ import annotations

import logging
import numpy as np
from typing import Optional

log = logging.getLogger("satquery.pipeline.change_detect")


def _to_gray_float(img: np.ndarray) -> np.ndarray:
    arr = img.astype(np.float32)
    if arr.max() > 1.0:
        arr /= 255.0
    if arr.ndim == 3:
        arr = arr.mean(axis=2)
    return arr


def compute_ssim(img1: np.ndarray, img2: np.ndarray) -> float:
    """Structural Similarity Index between two images."""
    try:
        from skimage.metrics import structural_similarity as ssim
        # Convert to grayscale float
        g1 = _to_gray_float(img1)
        g2 = _to_gray_float(img2)
        # Resize to same shape if needed
        if g1.shape != g2.shape:
            from PIL import Image
            pil = Image.fromarray((g2 * 255).astype(np.uint8)).resize((g1.shape[1], g1.shape[0]))
            g2 = np.array(pil) / 255.0
        score, _ = ssim(g1, g2, full=True, data_range=1.0)
        return round(float(score), 4)
    except Exception as e:
        log.warning("SSIM computation failed: %s", e)
        return 0.0


def compute_change_vector(img1: np.ndarray, img2: np.ndarray) -> np.ndarray:
    """
    Z-score standardised Change Vector Analysis (CVA).

    Measures per-pixel spectral change magnitude between two co-registered images.
    Returns a normalised change magnitude map (H, W) in [0, 1].
    """
    a1 = img1.astype(np.float32)
    a2 = img2.astype(np.float32)
    if a1.max() > 1.0: a1 /= 255.0
    if a2.max() > 1.0: a2 /= 255.0

    # Resize a2 to match a1 if needed
    if a1.shape != a2.shape:
        from PIL import Image
        pil = Image.fromarray((a2 * 255).astype(np.uint8)).resize((a1.shape[1], a1.shape[0]))
        a2 = np.array(pil) / 255.0

    delta = a2 - a1  # per-band change
    if delta.ndim == 3:
        magnitude = np.linalg.norm(delta, axis=2)  # L2 magnitude
    else:
        magnitude = np.abs(delta)

    # Z-score normalise
    mu, sigma = magnitude.mean(), magnitude.std() + 1e-8
    z = (magnitude - mu) / sigma
    # Map to [0, 1]
    return np.clip((z + 3) / 6, 0, 1).astype(np.float32)


def detect_change_clusters(
    change_mask: np.ndarray,
    min_area: int = 100,
) -> list[dict]:
    """
    Find connected components (clusters) in a binary change mask.

    Returns list of {bbox_normalized, area_pixels, severity_score}.
    """
    try:
        from scipy.ndimage import label, find_objects
    except ImportError:
        return []

    labeled, n_features = label(change_mask)
    H, W = change_mask.shape
    clusters = []
    
    if n_features == 0:
        return []

    slices = find_objects(labeled)
    
    for i, slc in enumerate(slices):
        if slc is None:
            continue
            
        y_slice, x_slice = slc
        
        # Sub-array for this bounding box
        sub_labeled = labeled[y_slice, x_slice]
        area = int((sub_labeled == (i + 1)).sum())
        
        if area < min_area:
            continue
            
        y1, y2 = y_slice.start / H, y_slice.stop / H
        x1, x2 = x_slice.start / W, x_slice.stop / W
        
        severity = min(1.0, area / (H * W * 0.05))
        clusters.append({
            "bbox_normalized": [round(x1, 3), round(y1, 3), round(x2, 3), round(y2, 3)],
            "area_pixels": area,
            "severity_score": round(severity, 3),
        })

    return sorted(clusters, key=lambda c: c["area_pixels"], reverse=True)[:10]


def compute_affected_area(change_mask: np.ndarray, gsd_meters: float = 10.0) -> float:
    """Compute affected area in km² from a change mask and Ground Sampling Distance."""
    pixel_area_m2 = gsd_meters ** 2
    n_changed = int(change_mask.sum())
    area_m2 = n_changed * pixel_area_m2
    return round(area_m2 / 1_000_000, 4)  # convert to km²
