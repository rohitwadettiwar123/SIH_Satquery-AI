"""
pipeline/preprocess/coregistration.py
======================================
Image co-registration utilities for the SatQuery AI pipeline.

Supports ORB feature-matching + RANSAC homography (primary) with
ECC (Enhanced Correlation Coefficient) as fallback for cases where
ORB cannot find enough features (e.g. SAR images with few key-points).

Public API
----------
- detect_modality(image_path)      -> str
- coregister_images(img1, img2)    -> (aligned1, aligned2, metrics)
- compute_metadata(image_path)     -> dict
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Optional

import cv2
import numpy as np

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
_SAR_KEYWORDS = (
    "sar", "s1", "sentinel1", "sentinel-1", "ers", "palsar", "tsx",
    "grd", "slc", "sigma", "gamma",
)
_OPTICAL_KEYWORDS = (
    "s2", "sentinel2", "sentinel-2", "landsat", "l8", "l9", "modis",
    "rgb", "optical", "ms", "pan", "wv", "ge01", "ph", "planet",
)

_MAX_RMSE_PX: float = 2.0   # Raise ValueError above this threshold


# ---------------------------------------------------------------------------
# Public helpers
# ---------------------------------------------------------------------------

def detect_modality(image_path: str) -> str:
    """Detect whether an image is 'optical' or 'sar' based on filename/metadata.

    Detection strategy (in priority order):
    1. Filename keyword matching (case-insensitive).
    2. Rasterio metadata (band count & dtype heuristic) when available.
    3. Fallback: 'optical'.

    Parameters
    ----------
    image_path : str
        Absolute or relative path to the image file.

    Returns
    -------
    str
        ``'sar'`` or ``'optical'``.
    """
    name_lower = Path(image_path).stem.lower()

    for kw in _SAR_KEYWORDS:
        if kw in name_lower:
            logger.debug("Detected modality=SAR via keyword '%s' in %s", kw, image_path)
            return "sar"

    for kw in _OPTICAL_KEYWORDS:
        if kw in name_lower:
            logger.debug("Detected modality=optical via keyword '%s' in %s", kw, image_path)
            return "optical"

    # Try rasterio heuristic: single-band float32 often indicates SAR
    try:
        import rasterio  # type: ignore
        with rasterio.open(image_path) as src:
            if src.count == 1 and src.dtypes[0] in ("float32", "float64"):
                logger.debug("Detected modality=SAR via rasterio heuristic")
                return "sar"
    except Exception:
        pass

    logger.debug("Defaulting modality=optical for %s", image_path)
    return "optical"


def coregister_images(
    img1_path: str,
    img2_path: str,
) -> tuple[np.ndarray, np.ndarray, dict]:
    """Align img2 onto the coordinate frame of img1 using feature matching.

    Algorithm sequence
    ------------------
    1. **ORB + RANSAC homography** – fast, works well for optical images.
    2. **ECC warp** – gradient-based, better for textureless or SAR scenes.

    Parameters
    ----------
    img1_path : str
        Reference (fixed) image path.
    img2_path : str
        Moving image path to be aligned.

    Returns
    -------
    aligned_img1 : np.ndarray
        Reference image (unchanged, returned for symmetry).
    aligned_img2 : np.ndarray
        img2 warped to match img1's geometry.
    metrics : dict
        Keys: ``reprojection_error_px``, ``status``, ``algorithm``,
        ``num_inliers``.

    Raises
    ------
    ValueError
        If the final reprojection RMSE exceeds ``_MAX_RMSE_PX`` (2.0 px).
    FileNotFoundError
        If either image path does not exist.
    """
    for p in (img1_path, img2_path):
        if not os.path.isfile(p):
            raise FileNotFoundError(f"Image not found: {p}")

    img1_bgr = _load_as_bgr(img1_path)
    img2_bgr = _load_as_bgr(img2_path)

    gray1 = cv2.cvtColor(img1_bgr, cv2.COLOR_BGR2GRAY)
    gray2 = cv2.cvtColor(img2_bgr, cv2.COLOR_BGR2GRAY)

    aligned_bgr, metrics = _try_orb_ransac(gray1, gray2, img2_bgr)

    if aligned_bgr is None:
        logger.warning("ORB failed; falling back to ECC warp.")
        aligned_bgr, metrics = _try_ecc(gray1, gray2, img2_bgr)

    if aligned_bgr is None:
        # Identity fallback – coregistration could not be computed
        logger.error("Both ORB and ECC failed; returning identity-warped image.")
        aligned_bgr = img2_bgr.copy()
        metrics = {
            "reprojection_error_px": 999.0,
            "status": "failed",
            "algorithm": "identity",
            "num_inliers": 0,
        }

    rmse = metrics.get("reprojection_error_px", 999.0)
    if rmse > _MAX_RMSE_PX:
        raise ValueError(
            f"Co-registration RMSE {rmse:.3f} px exceeds maximum "
            f"threshold of {_MAX_RMSE_PX} px. Registration rejected."
        )

    return img1_bgr, aligned_bgr, metrics


def compute_metadata(image_path: str) -> dict:
    """Extract image metadata from a file.

    Uses **rasterio** (for GeoTIFF / multi-band) when available,
    falls back to **Pillow** for common raster formats.

    Parameters
    ----------
    image_path : str
        Path to the image file.

    Returns
    -------
    dict
        Keys: ``width``, ``height``, ``bands``, ``dtype``, ``crs``
        (``None`` when not a GeoTIFF or CRS is absent), ``path``.

    Raises
    ------
    FileNotFoundError
        If the file does not exist.
    RuntimeError
        If the file cannot be read by any available backend.
    """
    if not os.path.isfile(image_path):
        raise FileNotFoundError(f"Image not found: {image_path}")

    # ---- Rasterio path (preferred) ----------------------------------------
    try:
        import rasterio  # type: ignore
        with rasterio.open(image_path) as src:
            crs_str = src.crs.to_string() if src.crs else None
            return {
                "width": src.width,
                "height": src.height,
                "bands": src.count,
                "dtype": str(src.dtypes[0]),
                "crs": crs_str,
                "path": str(image_path),
                "backend": "rasterio",
            }
    except Exception as exc:
        logger.debug("rasterio failed for %s: %s", image_path, exc)

    # ---- Pillow fallback ---------------------------------------------------
    try:
        from PIL import Image  # type: ignore
        with Image.open(image_path) as img:
            mode_to_bands = {
                "L": 1, "P": 1, "RGB": 3, "RGBA": 4,
                "CMYK": 4, "YCbCr": 3, "LAB": 3, "HSV": 3,
                "I": 1, "F": 1, "LA": 2, "PA": 2, "RGBa": 4,
                "La": 2, "I;16": 1,
            }
            bands = mode_to_bands.get(img.mode, len(img.getbands()))
            return {
                "width": img.width,
                "height": img.height,
                "bands": bands,
                "dtype": _pil_mode_to_dtype(img.mode),
                "crs": None,
                "path": str(image_path),
                "backend": "pillow",
            }
    except Exception as exc:
        logger.debug("Pillow failed for %s: %s", image_path, exc)

    raise RuntimeError(f"Cannot read metadata from {image_path}. "
                       "Ensure rasterio or Pillow is installed.")


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _load_as_bgr(image_path: str) -> np.ndarray:
    """Load an image file as a uint8 BGR numpy array (3 channels)."""
    # Try rasterio first for GeoTIFFs
    try:
        import rasterio  # type: ignore
        with rasterio.open(image_path) as src:
            if src.count >= 3:
                r = src.read(1).astype(np.float32)
                g = src.read(2).astype(np.float32)
                b = src.read(3).astype(np.float32)
            else:
                band = src.read(1).astype(np.float32)
                r = g = b = band

            def _norm(a: np.ndarray) -> np.ndarray:
                mn, mx = a.min(), a.max()
                if mx - mn < 1e-8:
                    return np.zeros_like(a, dtype=np.uint8)
                return ((a - mn) / (mx - mn) * 255).astype(np.uint8)

            bgr = cv2.merge([_norm(b), _norm(g), _norm(r)])
            return bgr
    except Exception:
        pass

    # OpenCV fallback
    img = cv2.imread(image_path, cv2.IMREAD_COLOR)
    if img is not None:
        return img

    # Pillow last resort
    from PIL import Image  # type: ignore
    pil_img = Image.open(image_path).convert("RGB")
    arr = np.array(pil_img)
    return cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)


def _try_orb_ransac(
    gray1: np.ndarray,
    gray2: np.ndarray,
    img2_bgr: np.ndarray,
    min_inliers: int = 10,
) -> tuple[Optional[np.ndarray], dict]:
    """Attempt ORB + RANSAC homography alignment.

    Returns
    -------
    aligned : np.ndarray or None
    metrics : dict
    """
    try:
        orb = cv2.ORB_create(nfeatures=2000)
        kp1, des1 = orb.detectAndCompute(gray1, None)
        kp2, des2 = orb.detectAndCompute(gray2, None)

        if des1 is None or des2 is None or len(kp1) < min_inliers or len(kp2) < min_inliers:
            logger.debug("ORB: insufficient keypoints (kp1=%d, kp2=%d)", len(kp1), len(kp2))
            return None, {}

        bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)
        matches = bf.knnMatch(des1, des2, k=2)

        # Lowe ratio test
        good = [m for m, n in matches if m.distance < 0.75 * n.distance]

        if len(good) < min_inliers:
            logger.debug("ORB: too few good matches (%d)", len(good))
            return None, {}

        src_pts = np.float32([kp1[m.queryIdx].pt for m in good]).reshape(-1, 1, 2)
        dst_pts = np.float32([kp2[m.trainIdx].pt for m in good]).reshape(-1, 1, 2)

        H, mask = cv2.findHomography(dst_pts, src_pts, cv2.RANSAC, ransacReprojThreshold=3.0)
        if H is None:
            return None, {}

        inliers = int(mask.sum()) if mask is not None else 0
        if inliers < min_inliers:
            logger.debug("ORB: too few inliers (%d)", inliers)
            return None, {}

        h, w = gray1.shape
        aligned = cv2.warpPerspective(img2_bgr, H, (w, h))

        # Compute reprojection error on inlier correspondences
        inlier_mask = mask.ravel().astype(bool)
        src_in = src_pts[inlier_mask].reshape(-1, 2)
        dst_in = dst_pts[inlier_mask].reshape(-1, 2)
        dst_proj = cv2.perspectiveTransform(dst_in.reshape(-1, 1, 2), H).reshape(-1, 2)
        rmse = float(np.sqrt(np.mean(np.sum((src_in - dst_proj) ** 2, axis=1))))

        metrics = {
            "reprojection_error_px": rmse,
            "status": "success",
            "algorithm": "ORB+RANSAC",
            "num_inliers": inliers,
        }
        logger.info("ORB co-registration: RMSE=%.3f px, inliers=%d", rmse, inliers)
        return aligned, metrics

    except Exception as exc:
        logger.warning("ORB co-registration raised exception: %s", exc)
        return None, {}


def _try_ecc(
    gray1: np.ndarray,
    gray2: np.ndarray,
    img2_bgr: np.ndarray,
    max_iter: int = 100,
    eps: float = 1e-5,
) -> tuple[Optional[np.ndarray], dict]:
    """Attempt ECC (Enhanced Correlation Coefficient) alignment.

    Uses affine warp (6-DOF) suitable for small geometric distortions.

    Returns
    -------
    aligned : np.ndarray or None
    metrics : dict
    """
    try:
        warp_mode = cv2.MOTION_AFFINE
        warp_matrix = np.eye(2, 3, dtype=np.float32)
        criteria = (
            cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT,
            max_iter,
            eps,
        )

        g1 = gray1.astype(np.float32)
        g2 = gray2.astype(np.float32)

        ecc_val, warp_matrix = cv2.findTransformECC(g1, g2, warp_matrix, warp_mode, criteria)

        h, w = gray1.shape
        aligned = cv2.warpAffine(
            img2_bgr, warp_matrix, (w, h),
            flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP,
        )

        # ECC gives no explicit RMSE; approximate from normalized cross-correlation
        aligned_gray = cv2.cvtColor(aligned, cv2.COLOR_BGR2GRAY).astype(np.float32)
        diff = g1 - aligned_gray
        rmse = float(np.sqrt(np.mean(diff ** 2))) / 255.0  # normalised

        metrics = {
            "reprojection_error_px": rmse,
            "status": "success",
            "algorithm": "ECC",
            "num_inliers": -1,  # Not applicable
            "ecc_correlation": float(ecc_val),
        }
        logger.info("ECC co-registration: ECC=%.4f, approx_RMSE=%.4f px", ecc_val, rmse)
        return aligned, metrics

    except Exception as exc:
        logger.warning("ECC co-registration raised exception: %s", exc)
        return None, {}


def _pil_mode_to_dtype(mode: str) -> str:
    """Map PIL image mode to a numpy-friendly dtype string."""
    _map = {
        "L": "uint8", "P": "uint8", "RGB": "uint8", "RGBA": "uint8",
        "I": "int32", "F": "float32",
    }
    return _map.get(mode, "uint8")
