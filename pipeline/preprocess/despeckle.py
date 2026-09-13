"""
pipeline/preprocess/despeckle.py
==================================
SAR speckle reduction and optical contrast enhancement for SatQuery AI.

Public API
----------
- enhanced_lee_filter(image, window_size, k)  -> np.ndarray
- radiometric_calibrate_db(image)             -> np.ndarray
- clahe_enhance(image)                        -> np.ndarray
"""

from __future__ import annotations

import logging

import cv2
import numpy as np
from scipy.ndimage import uniform_filter  # type: ignore

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# SAR processing
# ---------------------------------------------------------------------------

def enhanced_lee_filter(
    image: np.ndarray,
    window_size: int = 5,
    k: float = 1.0,
) -> np.ndarray:
    """Apply the Enhanced Lee sigma filter for SAR speckle reduction.

    The Enhanced Lee filter adaptively blends a local mean estimate with
    the centre pixel based on the local coefficient of variation (CV).

    Algorithm
    ---------
    For each window W of size (window_size × window_size):

    - local_mean  = mean(W)
    - local_var   = var(W)
    - cv_local    = std(W) / (mean(W) + eps)
    - cv_image    = expected CV for the image (1 / sqrt(ENL)), estimated
                    globally as median(local_CV)
    - weight (b)  = exp(-k * (cv_local - cv_image) / (cv_image + eps))
    - filtered    = b * local_mean + (1 - b) * centre_pixel

    When cv_local ≤ cv_image (homogeneous region) → output = local_mean.
    When cv_local >> cv_image (edge/target)        → output ≈ centre_pixel.

    Parameters
    ----------
    image : np.ndarray
        2-D float or integer array (single-band SAR amplitude).
        Multi-band arrays are processed band-by-band.
    window_size : int
        Odd sliding window size (default 5).
    k : float
        Damping factor controlling the transition between mean and identity
        (default 1.0).

    Returns
    -------
    np.ndarray
        Speckle-filtered array with the same shape and dtype as *image*.

    Raises
    ------
    ValueError
        If *window_size* is even or < 3.
    """
    if window_size < 3 or window_size % 2 == 0:
        raise ValueError(f"window_size must be an odd integer >= 3, got {window_size}.")

    if image.ndim == 2:
        return _lee_single_band(image.astype(np.float64), window_size, k).astype(image.dtype)

    if image.ndim == 3:
        out = np.empty_like(image, dtype=image.dtype)
        for b in range(image.shape[2]):
            out[:, :, b] = _lee_single_band(
                image[:, :, b].astype(np.float64), window_size, k
            ).astype(image.dtype)
        return out

    raise ValueError(f"Expected 2-D or 3-D array, got shape {image.shape}.")


def _lee_single_band(
    arr: np.ndarray,
    window_size: int,
    k: float,
) -> np.ndarray:
    """Core Enhanced Lee filter for a single 2-D float64 band."""
    eps = 1e-10
    size = (window_size, window_size)

    local_mean = uniform_filter(arr, size=size)
    local_sq_mean = uniform_filter(arr ** 2, size=size)
    local_var = local_sq_mean - local_mean ** 2
    local_var = np.maximum(local_var, 0.0)  # guard numerical noise
    local_std = np.sqrt(local_var)

    cv_local = local_std / (local_mean + eps)

    # Global noise CV estimated as the median of local CVs in smooth regions
    cv_image = float(np.median(cv_local[cv_local < np.percentile(cv_local, 25)]) + eps)

    # Weighting coefficient
    weight = np.exp(-k * (cv_local - cv_image) / (cv_image + eps))
    weight = np.clip(weight, 0.0, 1.0)

    # Homogeneous region → mean; heterogeneous → identity
    homogeneous = cv_local <= cv_image
    filtered = np.where(
        homogeneous,
        local_mean,
        weight * local_mean + (1.0 - weight) * arr,
    )
    return filtered


# ---------------------------------------------------------------------------
# Radiometric calibration
# ---------------------------------------------------------------------------

def radiometric_calibrate_db(image: np.ndarray) -> np.ndarray:
    """Convert SAR amplitude image to decibel (dB) scale.

    Formula: ``dB = 20 * log10(amplitude + eps)``

    Negative or zero amplitudes are clipped to ``eps`` before the
    logarithm to avoid ``-inf`` / NaN values.

    Parameters
    ----------
    image : np.ndarray
        SAR amplitude array (any shape, any numeric dtype).

    Returns
    -------
    np.ndarray
        Float32 array in dB scale with the same spatial shape as *image*.
    """
    eps = 1e-10
    amp = np.asarray(image, dtype=np.float32)
    amp_clipped = np.clip(amp, eps, None)
    db = 20.0 * np.log10(amp_clipped)
    logger.debug(
        "radiometric_calibrate_db: input range [%.4g, %.4g] → dB range [%.2f, %.2f]",
        float(amp.min()), float(amp.max()),
        float(db.min()), float(db.max()),
    )
    return db


# ---------------------------------------------------------------------------
# Optical enhancement
# ---------------------------------------------------------------------------

def clahe_enhance(image: np.ndarray) -> np.ndarray:
    """Apply CLAHE (Contrast Limited Adaptive Histogram Equalization).

    Enhances local contrast in optical imagery without over-amplifying
    noise in homogeneous regions.

    Handles both grayscale (2-D) and multi-band (3-D, up to 4 bands)
    inputs. For multi-band images the enhancement is applied per-channel.

    Parameters
    ----------
    image : np.ndarray
        uint8 or uint16 array. If float, values are scaled to uint8 range
        before processing and rescaled back afterwards.

    Returns
    -------
    np.ndarray
        Contrast-enhanced array with the same shape and dtype as *image*.

    Raises
    ------
    ValueError
        If the input array has unsupported number of dimensions.
    """
    if image.ndim not in (2, 3):
        raise ValueError(f"Expected 2-D or 3-D array, got shape {image.shape}.")

    # Normalise to uint8 for CLAHE if needed
    orig_dtype = image.dtype
    is_float_input = np.issubdtype(orig_dtype, np.floating)

    if is_float_input:
        mn, mx = float(image.min()), float(image.max())
        if mx - mn < 1e-8:
            return image.copy()
        scaled = ((image - mn) / (mx - mn) * 255).astype(np.uint8)
    elif orig_dtype == np.uint16:
        scaled = (image >> 8).astype(np.uint8)
    else:
        scaled = image.astype(np.uint8)

    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))

    if scaled.ndim == 2:
        enhanced = clahe.apply(scaled)
    else:
        enhanced = np.empty_like(scaled)
        n_bands = scaled.shape[2]
        for b in range(n_bands):
            enhanced[:, :, b] = clahe.apply(scaled[:, :, b])

    # Restore original dtype/scale
    if is_float_input:
        result = (enhanced.astype(np.float32) / 255.0) * (mx - mn) + mn
        return result.astype(orig_dtype)
    elif orig_dtype == np.uint16:
        return (enhanced.astype(np.uint16) << 8)
    else:
        return enhanced
