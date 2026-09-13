"""SatQuery AI – Per-pixel 0-100 confidence estimation for reconstructed pixels."""
from __future__ import annotations

import numpy as np


def compute_local_consistency(
    image: np.ndarray,
    cloud_mask: np.ndarray,
    window_size: int = 11,
) -> np.ndarray:
    """
    Compute local reconstruction consistency for cloud-masked pixels.

    Uses windowed standard deviation to measure how well reconstructed pixels
    blend with their valid (non-cloud) surroundings.

    Returns:
        consistency_map: ndarray (H, W) with values 0.0–1.0 (higher = more consistent).
    """
    from scipy.ndimage import uniform_filter

    if image.ndim == 3:
        gray = image.mean(axis=2).astype(np.float32)
    else:
        gray = image.astype(np.float32)
    if gray.max() > 1.0:
        gray = gray / 255.0

    # Local mean and std
    local_mean = uniform_filter(gray, size=window_size)
    local_sq_mean = uniform_filter(gray ** 2, size=window_size)
    local_std = np.sqrt(np.maximum(local_sq_mean - local_mean ** 2, 0))

    # Valid-neighbour mean std (reference for comparison)
    valid_mask = (~cloud_mask).astype(np.float32)
    valid_std_mean = float(local_std[valid_mask > 0].mean()) if valid_mask.any() else 0.1

    # Consistency: low deviation in reconstructed area relative to surroundings
    consistency = 1.0 - np.clip(local_std / (valid_std_mean + 1e-6), 0, 1)
    return consistency.astype(np.float32)


def compute_reconstruction_confidence(
    cloud_mask: np.ndarray,
    method: str,
    temporal_age_days: int = 0,
    registration_quality: float = 1.0,
    model_confidence: float = 1.0,
    weights: dict | None = None,
) -> np.ndarray:
    """
    Compute a per-pixel 0-100 confidence score.

    Untouched pixels (not in cloud_mask) start near 95, discounted only for
    sub-threshold residual cloud probability.

    Reconstructed pixels are scored by weighted combination:
      - Inverse cloud probability
      - Temporal age penalty
      - Registration quality
      - Local consistency (computed separately if image available)
      - Model confidence

    Args:
        cloud_mask: Boolean (H, W) array — True = reconstructed pixel.
        method: Reconstruction method: 'passthrough' | 'temporal' | 'inpainting'.
        temporal_age_days: Age of the temporal image used (0 for inpainting).
        registration_quality: Co-registration quality 0.0–1.0.
        model_confidence: Underlying model confidence 0.0–1.0.
        weights: Override default confidence weights.

    Returns:
        confidence_map: ndarray (H, W) with values 0.0–100.0.
    """
    _weights = weights or {
        "cloud_prob": 0.30,
        "temporal_age": 0.25,
        "registration_quality": 0.20,
        "local_consistency": 0.15,
        "model_confidence": 0.10,
    }

    H, W = cloud_mask.shape
    confidence = np.full((H, W), 95.0, dtype=np.float32)

    if method == "passthrough":
        # All pixels untouched — minor discount for residual cloud near border
        near_cloud = _dilate_mask(cloud_mask, kernel_size=5)
        confidence[near_cloud] = np.maximum(confidence[near_cloud] - 8.0, 70.0)
        return confidence

    # For reconstructed pixels, compute weighted score
    reconstructed = cloud_mask.astype(bool)
    if not reconstructed.any():
        return confidence

    # Factor 1: inverse cloud probability (~50% base for detected cloud pixel)
    inv_cloud = 50.0  # assumed cloud prob = 0.90 → (1-0.90)*100 rescaled

    # Factor 2: temporal age penalty (older = less confident)
    max_days = 365.0
    age_score = max(0, 1.0 - temporal_age_days / max_days) * 100.0

    # Factor 3: registration quality
    reg_score = registration_quality * 100.0

    # Factor 4: local consistency (placeholder — set to 65 if method is inpainting)
    consistency_score = 80.0 if method == "temporal" else 60.0

    # Factor 5: model confidence
    model_score = model_confidence * 100.0

    reconstructed_conf = (
        _weights["cloud_prob"] * inv_cloud +
        _weights["temporal_age"] * age_score +
        _weights["registration_quality"] * reg_score +
        _weights["local_consistency"] * consistency_score +
        _weights["model_confidence"] * model_score
    )

    confidence[reconstructed] = np.clip(reconstructed_conf, 5.0, 92.0)

    return confidence


def _dilate_mask(mask: np.ndarray, kernel_size: int = 5) -> np.ndarray:
    """Binary dilation of mask for border handling."""
    try:
        import cv2
        kernel = np.ones((kernel_size, kernel_size), np.uint8)
        return cv2.dilate(mask.astype(np.uint8), kernel, iterations=1).astype(bool)
    except ImportError:
        from scipy.ndimage import binary_dilation
        return binary_dilation(mask, iterations=kernel_size // 2)
