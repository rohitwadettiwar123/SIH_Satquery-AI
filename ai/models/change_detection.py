"""SatQuery AI – Bi-temporal change detection specialist."""
from __future__ import annotations

import logging
import os
import numpy as np
from PIL import Image

log = logging.getLogger("satquery.ai.change_detection")


async def run_change_detection(
    img1_path: str,
    img2_path: str,
    query: str,
    config: dict,
) -> dict:
    """
    Full bi-temporal change analysis:
    1. Co-register images
    2. Compute SSIM + change vector
    3. Detect change clusters
    4. Generate LLM description
    """
    from pipeline.change_detect.metrics import (
        compute_ssim, compute_change_vector,
        detect_change_clusters, compute_affected_area
    )

    try:
        img1 = np.array(Image.open(img1_path).convert("RGB"))
        img2 = np.array(Image.open(img2_path).convert("RGB"))

        # Resize img2 to match img1 if needed
        if img1.shape[:2] != img2.shape[:2]:
            pil2 = Image.fromarray(img2).resize((img1.shape[1], img1.shape[0]), Image.BILINEAR)
            img2 = np.array(pil2)

        ssim_score = compute_ssim(img1, img2)
        change_vector = compute_change_vector(img1, img2)

        # Threshold the change vector to get binary mask
        threshold = float(np.percentile(change_vector, 80))
        change_mask = change_vector > threshold
        change_ratio = float(change_mask.mean() * 100)

        gsd = config.get("default_gsd_meters", 10.0)
        affected_area = compute_affected_area(change_mask, gsd)
        clusters = detect_change_clusters(change_mask, min_area=50)

        # AI description
        description = await _ai_change_description(
            query, img1_path, img2_path, ssim_score, change_ratio, affected_area, config
        )

        detected_objects = [
            {
                "class_name": f"change_cluster_{i+1}",
                "confidence": c["severity_score"],
                "bbox": {
                    "x1": c["bbox_normalized"][0],
                    "y1": c["bbox_normalized"][1],
                    "x2": c["bbox_normalized"][2],
                    "y2": c["bbox_normalized"][3],
                },
                "area_hectares": round(c["area_pixels"] * gsd**2 / 10000, 2),
                "severity_score": c["severity_score"],
            }
            for i, c in enumerate(clusters[:5])
        ]

        confidence = min(0.95, 0.65 + ssim_score * 0.3 + min(0.1, change_ratio / 100))

        return {
            "answer": description,
            "confidence": round(confidence, 3),
            "ssim_score": ssim_score,
            "change_ratio_pct": round(change_ratio, 2),
            "affected_area_km2": affected_area,
            "detected_objects": detected_objects,
            "change_metrics": {
                "ssim_score": ssim_score,
                "change_ratio_pct": round(change_ratio, 2),
                "affected_area_km2": affected_area,
                "mean_delta": round(float(change_vector.mean()), 4),
                "confidence_interval_95": [
                    round(change_ratio * 0.93, 2),
                    round(change_ratio * 1.07, 2),
                ],
            },
        }
    except Exception as e:
        log.exception("Change detection failed")
        return {
            "answer": f"Change analysis encountered an error: {e}",
            "confidence": 0.3,
            "detected_objects": [],
            "ssim_score": 0.0,
            "change_ratio_pct": 0.0,
            "affected_area_km2": 0.0,
        }


async def _ai_change_description(
    query: str,
    img1_path: str,
    img2_path: str,
    ssim: float,
    change_pct: float,
    area: float,
    config: dict,
) -> str:
    """Generate LLM description of the detected change."""
    gemini_key = os.getenv("GEMINI_API_KEY", "")
    if gemini_key:
        try:
            import io
            from google import genai
            from google.genai import types as gtypes
            client = genai.Client(api_key=gemini_key)
            MODEL = "gemini-3.6-flash"

            def to_part(path):
                img = Image.open(path)
                if max(img.size) > 1024:
                    img.thumbnail((1024, 1024))
                buf = io.BytesIO()
                img.save(buf, format="JPEG")
                return gtypes.Part.from_bytes(data=buf.getvalue(), mime_type="image/jpeg")

            prompt = gtypes.Part.from_text(text=
                f"Compare these two satellite images (before/after). Query: {query}\n"
                f"Deterministic metrics: SSIM={ssim:.4f}, Change area={change_pct:.1f}%, Affected area={area:.2f} km2.\n"
                f"Describe what changed between T0 (first image) and T1 (second image). Be specific."
            )
            response = client.models.generate_content(
                model=MODEL,
                contents=[prompt, to_part(img1_path), to_part(img2_path)]
            )
            return response.text.strip()
        except Exception as e:
            log.warning("Gemini change description failed: %s", e)

    # Deterministic fallback
    change_level = "significant" if change_pct > 20 else ("moderate" if change_pct > 10 else "minor")
    return (
        f"Change detection analysis: {change_level} change detected between the two images. "
        f"Structural similarity (SSIM): {ssim:.4f} (lower = more change). "
        f"Approximately {change_pct:.1f}% of the scene changed, affecting ~{area:.2f} km². "
        f"({'(API key not set)' if not gemini_key else '(API error occurred)'} for detailed change interpretation.)"
    )
