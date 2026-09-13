"""SatQuery AI – Captioning and Grounding specialists (new google.genai SDK)."""
from __future__ import annotations

import io
import logging
import os
import re
import numpy as np
from PIL import Image

log = logging.getLogger("satquery.ai.captioning")


def _img_to_part(path: str):
    """Load and resize image, return google.genai Part."""
    from google.genai import types as gtypes
    img = Image.open(path)
    if max(img.size) > 1024:
        img.thumbnail((1024, 1024))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return gtypes.Part.from_bytes(data=buf.getvalue(), mime_type="image/jpeg")


async def run_captioning(image_path: str, config: dict) -> dict:
    """Generate satellite scene caption using Gemini or fallback."""
    gemini_key = os.getenv("GEMINI_API_KEY", "")
    MODEL = "gemini-1.5-flash"

    if gemini_key:
        try:
            from google import genai
            from google.genai import types as gtypes
            client = genai.Client(api_key=gemini_key)
            prompt = gtypes.Part.from_text(
                "You are a remote sensing expert. Describe this satellite image in detail, covering: "
                "1) dominant land cover types and estimated percentages, "
                "2) visible infrastructure or features, "
                "3) apparent health of vegetation, "
                "4) any notable anomalies. Be specific and scientific."
            )
            response = client.models.generate_content(
                model=MODEL,
                contents=[prompt, _img_to_part(image_path)]
            )
            return {
                "answer": response.text.strip(),
                "confidence": 0.90,
                "key_objects": [],
                "detected_objects": [],
                "model_used": MODEL,
            }
        except Exception as e:
            log.warning("Gemini captioning failed: %s", e)

    return _deterministic_caption(image_path)


async def run_grounding(query: str, image_path: str, config: dict) -> dict:
    """Text-guided region grounding."""
    gemini_key = os.getenv("GEMINI_API_KEY", "")
    MODEL = "gemini-1.5-flash"
    bboxes = []
    answer = ""

    if gemini_key:
        try:
            from google import genai
            from google.genai import types as gtypes
            client = genai.Client(api_key=gemini_key)
            prompt = gtypes.Part.from_text(
                f"Locate this in the satellite image: '{query}'. "
                "Describe where it is and provide a bounding box as [x1, y1, x2, y2] in normalised 0-1 coordinates."
            )
            response = client.models.generate_content(
                model=MODEL,
                contents=[prompt, _img_to_part(image_path)]
            )
            answer = response.text.strip()
            for m in re.findall(r'\[?\s*(0?\.\d+)\s*,\s*(0?\.\d+)\s*,\s*(0?\.\d+)\s*,\s*(0?\.\d+)\s*\]?', answer)[:3]:
                try:
                    x1, y1, x2, y2 = [float(v) for v in m]
                    bboxes.append({"x1": x1, "y1": y1, "x2": x2, "y2": y2, "confidence": 0.80})
                except Exception:
                    pass
        except Exception as e:
            log.warning("Gemini grounding failed: %s", e)

    if not answer:
        answer = f"Grounding for '{query}': central region identified. Set GEMINI_API_KEY for precise bboxes."
        bboxes = [{"x1": 0.3, "y1": 0.3, "x2": 0.7, "y2": 0.7, "confidence": 0.5}]

    detected_objects = [
        {"class_name": query[:30], "confidence": b["confidence"],
         "bbox": {"x1": b["x1"], "y1": b["y1"], "x2": b["x2"], "y2": b["y2"]}}
        for b in bboxes
    ]
    return {"answer": answer, "confidence": 0.80 if bboxes else 0.5,
            "ground_boxes": bboxes, "detected_objects": detected_objects}


def _deterministic_caption(image_path: str) -> dict:
    try:
        img = np.array(Image.open(image_path).convert("RGB"))
        h, w = img.shape[:2]
        r, g, b = img.mean(axis=(0, 1))
        brightness = float(img.mean()) / 255.0
        desc = "The satellite scene shows "
        if g > r * 1.1:
            desc += "significant vegetation coverage with high green reflectance. "
        elif b > r:
            desc += "possible water bodies or urban areas with blue-dominant spectral signature. "
        else:
            desc += "mixed land cover with varied spectral signatures. "
        desc += f"Image dimensions: {w}x{h} pixels. Mean brightness: {brightness:.2f}."
        return {"answer": desc, "confidence": 0.60, "key_objects": [],
                "detected_objects": [], "model_used": "deterministic_fallback"}
    except Exception as e:
        return {"answer": f"Image loaded. ({e})", "confidence": 0.4, "detected_objects": []}
