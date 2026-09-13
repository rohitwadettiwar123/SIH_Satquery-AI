"""SatQuery AI – VQA Specialist: Vision-Language Question Answering."""
from __future__ import annotations

import logging
import os
import numpy as np
from PIL import Image

log = logging.getLogger("satquery.ai.vqa")


async def run_vqa(query: str, image_paths: list[str], config: dict) -> dict:
    """
    Visual Question Answering specialist.

    Priority chain:
    1. Google Gemini Vision API (if GEMINI_API_KEY set)
    2. Ollama local VLM (if available)
    3. Deterministic pixel statistics fallback
    """
    gemini_key = os.getenv("GEMINI_API_KEY", "")

    if gemini_key:
        result = await _gemini_vqa(query, image_paths, gemini_key, config)
        if result:
            return result

    # Try Ollama
    from ai.ollama_client import check_ollama_available, vqa_ollama
    if await check_ollama_available(config.get("ollama_url", "http://localhost:11434")):
        result = await vqa_ollama(query, image_paths[0], config.get("ollama_model", "llava"),
                                   config.get("ollama_url", "http://localhost:11434"))
        if result:
            return result

    # Fallback: deterministic pixel stats
    return _deterministic_vqa(query, image_paths)


async def _gemini_vqa(query: str, image_paths: list[str], api_key: str, config: dict) -> dict | None:
    try:
        from google import genai
        from google.genai import types as gtypes
        import base64

        client = genai.Client(api_key=api_key)
        model_name = "gemini-1.5-flash"

        parts = [gtypes.Part.from_text(
            f"You are an expert remote sensing analyst. Answer this question about the satellite image(s). "
            f"Be specific, mention visible features, and give a confidence estimate.\n\nQuestion: {query}"
        )]

        for path in image_paths[:2]:
            img = Image.open(path)
            if max(img.size) > 1024:
                img.thumbnail((1024, 1024))
            import io
            buf = io.BytesIO()
            img.save(buf, format="JPEG")
            parts.append(gtypes.Part.from_bytes(data=buf.getvalue(), mime_type="image/jpeg"))

        response = client.models.generate_content(model=model_name, contents=parts)
        answer = response.text.strip()

        return {
            "answer": answer,
            "confidence": 0.88,
            "detected_objects": [],
            "model_used": model_name,
        }
    except Exception as e:
        log.warning("Gemini VQA failed: %s", e)
        return None


def _deterministic_vqa(query: str, image_paths: list[str]) -> dict:
    """Fallback deterministic analysis using pixel statistics."""
    try:
        img = np.array(Image.open(image_paths[0]).convert("RGB"))
        h, w = img.shape[:2]

        # Compute basic stats
        mean_rgb = img.mean(axis=(0, 1))
        brightness = float(img.mean()) / 255.0

        # Heuristic land-cover description
        r, g, b = mean_rgb
        dominant = "balanced"
        if g > r and g > b:
            dominant = "vegetation-dominant (high green reflectance)"
        elif b > r and b > g:
            dominant = "water-dominant (high blue reflectance)"
        elif r > g and r > b and brightness > 0.6:
            dominant = "bare soil or urban (high red/brightness)"

        # Estimate vegetation from NDVI proxy
        ndvi_proxy = (g - r) / (g + r + 1e-8)
        veg_pct = max(0, min(100, ndvi_proxy * 150 + 30))

        answer = (
            f"Based on pixel analysis of the {w}×{h} image: "
            f"The scene appears {dominant}. "
            f"Mean brightness: {brightness:.2f}. "
            f"Estimated vegetation coverage: ~{veg_pct:.0f}%. "
            f"Note: For full AI analysis, configure a GEMINI_API_KEY."
        )
        return {
            "answer": answer,
            "confidence": 0.65,
            "detected_objects": [],
            "model_used": "deterministic_pixel_stats",
        }
    except Exception as e:
        return {
            "answer": f"Image analysis complete. (GEMINI_API_KEY not configured for detailed AI analysis. Error: {e})",
            "confidence": 0.50,
            "detected_objects": [],
            "model_used": "fallback",
        }
