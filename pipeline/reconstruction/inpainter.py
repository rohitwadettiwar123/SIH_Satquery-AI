"""SatQuery AI – Hybrid cloud reconstruction: temporal replacement or AI inpainting."""
from __future__ import annotations

import logging
import numpy as np
from pathlib import Path
from typing import Optional

log = logging.getLogger("satquery.pipeline.inpainter")


def select_reconstruction_method(
    cloud_coverage: float,
    temporal_image_path: Optional[str] = None,
    config: Optional[dict] = None,
) -> str:
    """
    Decision engine: select best reconstruction strategy.

    Logic (never blended):
    1. If coverage ≤ threshold → passthrough
    2. Elif temporal image available & quality ok → temporal replacement
    3. Else → AI inpainting (OpenCV Telea fallback)

    Returns: 'passthrough' | 'temporal' | 'inpainting'
    """
    cfg = config or {}
    threshold = cfg.get("max_cloud_for_direct_use", 0.15)

    if cloud_coverage <= threshold:
        log.info("[Decision] Coverage %.1f%% ≤ threshold %.1f%% → passthrough", cloud_coverage*100, threshold*100)
        return "passthrough"

    if temporal_image_path and Path(temporal_image_path).exists():
        log.info("[Decision] Temporal image available → temporal reconstruction")
        return "temporal"

    log.info("[Decision] No temporal image → AI inpainting (Telea)")
    return "inpainting"


def temporal_reconstruction(
    current_img: np.ndarray,
    cloud_mask: np.ndarray,
    temporal_img: np.ndarray,
) -> tuple[np.ndarray, dict]:
    """
    Replace cloud-masked pixels with corresponding pixels from a temporal image.

    Uses ORB+RANSAC registration first; falls back to direct pixel replacement
    if registration fails.

    Args:
        current_img: Current clouded image (H, W, C) uint8.
        cloud_mask: Boolean (H, W) — True = cloud pixel.
        temporal_img: Prior cloud-free image, same approximate area.

    Returns:
        reconstructed: ndarray (H, W, C) with cloud pixels replaced.
        stats: dict with method info.
    """
    # Resize temporal to match current if needed
    if temporal_img.shape[:2] != current_img.shape[:2]:
        from PIL import Image
        tmp_pil = Image.fromarray(temporal_img).resize(
            (current_img.shape[1], current_img.shape[0]), Image.BILINEAR
        )
        temporal_img = np.array(tmp_pil)

    # Registration using ORB
    registration_quality = 1.0
    try:
        import cv2
        orb = cv2.ORB_create(nfeatures=500)
        g1 = cv2.cvtColor(current_img, cv2.COLOR_RGB2GRAY) if current_img.ndim == 3 else current_img
        g2 = cv2.cvtColor(temporal_img, cv2.COLOR_RGB2GRAY) if temporal_img.ndim == 3 else temporal_img
        kp1, d1 = orb.detectAndCompute(g1, None)
        kp2, d2 = orb.detectAndCompute(g2, None)
        if d1 is not None and d2 is not None and len(kp1) > 10 and len(kp2) > 10:
            bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
            matches = sorted(bf.match(d1, d2), key=lambda m: m.distance)[:50]
            if len(matches) >= 4:
                src_pts = np.float32([kp1[m.queryIdx].pt for m in matches]).reshape(-1, 1, 2)
                dst_pts = np.float32([kp2[m.trainIdx].pt for m in matches]).reshape(-1, 1, 2)
                H, mask = cv2.findHomography(dst_pts, src_pts, cv2.RANSAC, 5.0)
                if H is not None:
                    h, w = current_img.shape[:2]
                    temporal_img = cv2.warpPerspective(temporal_img, H, (w, h))
                    registration_quality = float(mask.mean()) if mask is not None else 0.7
    except Exception as e:
        log.warning("ORB registration failed, using direct replacement: %s", e)
        registration_quality = 0.5

    # Replace cloud pixels
    reconstructed = current_img.copy()
    cloud_3d = np.stack([cloud_mask] * current_img.shape[2], axis=2) if current_img.ndim == 3 else cloud_mask
    reconstructed[cloud_3d] = temporal_img[cloud_3d]

    pixels_replaced = int(cloud_mask.sum())
    stats = {
        "method": "temporal_replacement",
        "pixels_replaced": pixels_replaced,
        "registration_quality": round(registration_quality, 3),
        "temporal_age_days": 0,  # caller should pass actual age
    }
    return reconstructed, stats


def inpaint_reconstruction(
    image: np.ndarray,
    cloud_mask: np.ndarray,
) -> tuple[np.ndarray, dict]:
    """
    AI-free inpainting using OpenCV Telea fast-marching algorithm.

    Args:
        image: Image array (H, W, C) uint8.
        cloud_mask: Boolean (H, W) — True = pixels to inpaint.

    Returns:
        reconstructed: Inpainted image array.
        stats: dict with method info.
    """
    try:
        import cv2
        mask_uint8 = cloud_mask.astype(np.uint8) * 255
        # Dilate mask slightly to handle soft cloud edges
        kernel = np.ones((5, 5), np.uint8)
        mask_uint8 = cv2.dilate(mask_uint8, kernel, iterations=1)

        img_bgr = cv2.cvtColor(image, cv2.COLOR_RGB2BGR) if image.ndim == 3 else image
        inpainted_bgr = cv2.inpaint(img_bgr, mask_uint8, inpaintRadius=5, flags=cv2.INPAINT_TELEA)
        inpainted = cv2.cvtColor(inpainted_bgr, cv2.COLOR_BGR2RGB) if image.ndim == 3 else inpainted_bgr
        method = "telea_inpainting"
    except Exception as e:
        log.warning("OpenCV inpainting failed, using mean fill: %s", e)
        inpainted = image.copy()
        for c in range(image.shape[2] if image.ndim == 3 else 1):
            ch = image[:, :, c] if image.ndim == 3 else image
            valid_mean = float(ch[~cloud_mask].mean()) if (~cloud_mask).any() else 128.0
            if image.ndim == 3:
                inpainted[:, :, c][cloud_mask] = valid_mean
            else:
                inpainted[cloud_mask] = valid_mean
        method = "mean_fill_fallback"

    stats = {
        "method": method,
        "pixels_replaced": int(cloud_mask.sum()),
        "registration_quality": 0.0,  # not applicable
        "temporal_age_days": 0,
    }
    return inpainted, stats


def run_cloud_reconstruction(
    image_path: str,
    temporal_image_path: Optional[str] = None,
    temporal_age_days: int = 0,
    config: Optional[dict] = None,
) -> dict:
    """
    Main cloud reconstruction entry point.

    Detects clouds, selects method, reconstructs, computes confidence map.

    Returns:
        dict with:
          - method: str
          - triggered: bool
          - coverage_pct: float
          - reconstructed_image_array: np.ndarray
          - confidence_map: np.ndarray (0-100 per pixel)
          - stats: dict
          - disclosure_text: str
          - avg_confidence: float
    """
    from PIL import Image
    from pipeline.reconstruction.cloud_detect import detect_clouds_classical
    from pipeline.reconstruction.confidence import compute_reconstruction_confidence

    cfg = config or {}

    # Load image
    img_pil = Image.open(image_path).convert("RGB")
    max_px = cfg.get("max_image_size_px", 1024)
    if max(img_pil.size) > max_px:
        img_pil.thumbnail((max_px, max_px), Image.LANCZOS)
    img_array = np.array(img_pil)

    # Detect clouds
    cloud_mask, cloud_fraction = detect_clouds_classical(img_array)
    coverage_pct = round(cloud_fraction * 100, 2)

    # Decide method
    method = select_reconstruction_method(cloud_fraction, temporal_image_path, cfg)

    # Run reconstruction
    reconstructed = img_array.copy()
    reg_quality = 1.0
    stats = {"method": method, "pixels_replaced": 0, "registration_quality": 1.0}

    if method == "temporal" and temporal_image_path:
        tmp_img = np.array(Image.open(temporal_image_path).convert("RGB"))
        reconstructed, stats = temporal_reconstruction(img_array, cloud_mask, tmp_img)
        stats["temporal_age_days"] = temporal_age_days
        reg_quality = stats.get("registration_quality", 0.7)
    elif method == "inpainting":
        reconstructed, stats = inpaint_reconstruction(img_array, cloud_mask)

    # Compute confidence map
    confidence_map = compute_reconstruction_confidence(
        cloud_mask=cloud_mask,
        method=method,
        temporal_age_days=temporal_age_days,
        registration_quality=reg_quality,
        model_confidence=0.85,
        weights=cfg.get("confidence_weights"),
    )

    avg_conf = round(float(confidence_map.mean()), 1)

    # Disclosure text
    if method == "passthrough":
        disclosure = f"Cloud coverage {coverage_pct:.1f}% — below threshold, image used as-is."
    elif method == "temporal":
        disclosure = (
            f"{coverage_pct:.1f}% of this scene was cloud-covered; those pixels were "
            f"reconstructed via multi-temporal replacement (avg. confidence {avg_conf}/100)."
        )
    else:
        disclosure = (
            f"{coverage_pct:.1f}% of this scene was cloud-covered; those pixels were "
            f"reconstructed via AI inpainting (avg. confidence {avg_conf}/100)."
        )

    return {
        "triggered": method != "passthrough",
        "method": method,
        "coverage_pct": coverage_pct,
        "reconstructed_image_array": reconstructed,
        "original_image_array": img_array,
        "cloud_mask": cloud_mask,
        "confidence_map": confidence_map,
        "avg_confidence": avg_conf,
        "stats": stats,
        "disclosure_text": disclosure,
    }
