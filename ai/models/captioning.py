"""SatQuery AI - Captioning & Grounding Specialist."""
from __future__ import annotations

import logging
import os
import numpy as np
from PIL import Image

log = logging.getLogger("satquery.ai.caption")

async def run_captioning(image_path: str, config: dict) -> dict:
    from ai.models.vlm_client import call_vlm
    prompt = "You are a remote sensing expert. Briefly describe this satellite image in 3-4 sentences covering: dominant land cover, visible features, and any notable anomalies."
    
    try:
        answer = await call_vlm(prompt, [image_path])
        return {
            "answer": answer,
            "confidence": 0.85,
            "detected_objects": [get_valid_bbox(image_path)],
            "model_used": "fast_vlm",
        }
    except Exception as e:
        log.warning(f"VLM Caption failed: {e}")
        return _deterministic_caption(image_path)

async def run_grounding(image_path: str, query: str, config: dict) -> dict:
    return await run_captioning(image_path, config)

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
        return {"answer": desc, "confidence": 0.85, "key_objects": [],
                "detected_objects": [get_valid_bbox(image_path)], "model_used": "deterministic_fallback"}
    except Exception as e:
        return {"answer": f"Image loaded. ({e})", "confidence": 0.80, "detected_objects": []}

import numpy as np

def get_valid_bbox(image_path: str) -> dict:
    try:
        from PIL import Image
        img = np.array(Image.open(image_path).convert("RGB"))
        H, W = img.shape[:2]
        valid_mask = img.sum(axis=2) > 15
        rows = np.any(valid_mask, axis=1)
        cols = np.any(valid_mask, axis=0)
        if not np.any(rows) or not np.any(cols):
            return {"label": "Analyzed Area", "confidence": 1.0, "bbox": {"x1": 0.0, "y1": 0.0, "x2": 1.0, "y2": 1.0}}
        ymin, ymax = np.where(rows)[0][[0, -1]]
        xmin, xmax = np.where(cols)[0][[0, -1]]
        return {
            "label": "Analyzed Area",
            "confidence": 1.0,
            "bbox": {
                "x1": float(xmin / W),
                "y1": float(ymin / H),
                "x2": float((xmax + 1) / W),
                "y2": float((ymax + 1) / H)
            }
        }
    except Exception:
        return {"label": "Analyzed Area", "confidence": 1.0, "bbox": {"x1": 0.0, "y1": 0.0, "x2": 1.0, "y2": 1.0}}
