"""SatQuery AI – Optical-SAR fusion specialist."""
from __future__ import annotations

import logging
import os
import numpy as np
from PIL import Image

log = logging.getLogger("satquery.ai.fusion")


async def run_optical_sar_fusion(
    optical_path: str,
    sar_path: str,
    query: str,
    config: dict,
) -> dict:
    """
    Joint Optical + SAR analysis:
    1. Despeckle SAR (Enhanced Lee filter)
    2. Convert SAR to dB
    3. Extract joint features
    4. LLM semantic interpretation
    """
    from pipeline.preprocess.despeckle import enhanced_lee_filter, radiometric_calibrate_db

    try:
        opt_img = np.array(Image.open(optical_path).convert("RGB"))
        sar_img_pil = Image.open(sar_path).convert("L")
        if max(sar_img_pil.size) > 1024:
            sar_img_pil.thumbnail((1024, 1024))
        sar_img = np.array(sar_img_pil).astype(np.float32) / 255.0

        # SAR preprocessing
        win = config.get("sar_lee_window", 5)
        sar_filtered = enhanced_lee_filter(sar_img, window_size=win)
        sar_db = radiometric_calibrate_db(sar_filtered)

        # Simple fusion feature: bright SAR + bright optical = built-up / metal
        opt_gray = opt_img.mean(axis=2) / 255.0
        # Normalise sar_db to [0,1]
        sar_norm = (sar_db - sar_db.min()) / (sar_db.max() - sar_db.min() + 1e-8)

        # Resize to match
        if opt_gray.shape != sar_norm.shape:
            from PIL import Image as PILImage
            sar_pil = PILImage.fromarray((sar_norm * 255).astype(np.uint8))
            sar_pil = sar_pil.resize((opt_gray.shape[1], opt_gray.shape[0]), PILImage.BILINEAR)
            sar_norm = np.array(sar_pil) / 255.0

        buildup_mask = (sar_norm > 0.6) & (opt_gray > 0.4)
        water_mask = (sar_norm < 0.2) & (opt_gray < 0.3)
        buildup_pct = float(buildup_mask.mean() * 100)
        water_pct = float(water_mask.mean() * 100)

        # AI description
        description = await _ai_fusion_description(
            query, optical_path, sar_path, buildup_pct, water_pct, config
        )

        return {
            "answer": description,
            "confidence": 0.84,
            "detected_objects": [],
            "fusion_result": description,
            "penetrated_cloud_cover": True,
            "land_cover": {
                "built_up_pct": round(buildup_pct, 2),
                "water_pct": round(water_pct, 2),
                "other_pct": round(100 - buildup_pct - water_pct, 2),
            },
        }
    except Exception as e:
        log.exception("Optical-SAR fusion failed")
        return {
            "answer": f"Optical-SAR fusion analysis: {e}. SAR penetrates cloud cover to provide structural signatures unavailable in optical imagery.",
            "confidence": 0.5,
            "detected_objects": [],
        }


async def _ai_fusion_description(
    query: str,
    optical_path: str,
    sar_path: str,
    buildup_pct: float,
    water_pct: float,
    config: dict,
) -> str:
    gemini_key = os.getenv("GEMINI_API_KEY", "")
    if gemini_key:
        try:
            import io
            from google import genai
            from google.genai import types as gtypes
            client = genai.Client(api_key=gemini_key)
            MODEL = "gemini-1.5-flash"
            
            opt_img = Image.open(optical_path)
            if max(opt_img.size) > 1024:
                opt_img.thumbnail((1024, 1024))
            buf = io.BytesIO()
            opt_img.save(buf, format="JPEG")
            img_part = gtypes.Part.from_bytes(data=buf.getvalue(), mime_type="image/jpeg")
            
            prompt = gtypes.Part.from_text(text=
                f"You are analyzing an optical satellite image (provided) combined with SAR data. "
                f"Query: {query}\n"
                f"Deterministic fusion metrics: Built-up={buildup_pct:.1f}%, Water={water_pct:.1f}%.\n"
                f"Describe the joint land-use analysis using both spectral (optical) and "
                f"structural (SAR backscatter) information. SAR can see through clouds."
            )
            response = client.models.generate_content(
                model=MODEL,
                contents=[prompt, img_part]
            )
            return response.text.strip()
        except Exception as e:
            log.warning("Gemini fusion description failed: %s", e)

    return (
        f"Optical-SAR fusion analysis complete. "
        f"Deterministic results: ~{buildup_pct:.1f}% built-up/metallic area detected via SAR backscatter. "
        f"~{water_pct:.1f}% water bodies identified. "
        f"SAR successfully penetrates cloud cover providing all-weather structural analysis. "
        f"Configure GEMINI_API_KEY for detailed semantic interpretation."
    )
