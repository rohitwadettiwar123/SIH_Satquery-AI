"""SatQuery AI - Optical + SAR Fusion Specialist."""
from __future__ import annotations
import logging
import numpy as np
from PIL import Image

log = logging.getLogger("satquery.ai.fusion")

async def run_optical_sar_fusion(
    opt_path: str,
    sar_path: str,
    query: str,
    config: dict,
) -> dict:
    from ai.models.vlm_client import call_vlm
    from pipeline.change_detect.metrics import compute_ssim
    
    try:
        img1 = np.array(Image.open(opt_path).convert("RGB"))
        img2 = np.array(Image.open(sar_path).convert("RGB"))
        ssim_val = compute_ssim(img1, img2)
    except Exception:
        ssim_val = 0.0

    prompt = f"You are a remote sensing expert analysing an Optical and SAR image pair. Cross-modal structural similarity (SSIM) is {ssim_val:.2f}. Briefly describe the complementary information visible in the SAR image compared to the Optical image. Answer concisely.\n\nUser query: {query}"
    
    try:
        answer = await call_vlm(prompt, [opt_path, sar_path])
        return {
            "answer": answer,
            "confidence": 0.86,
            "detected_objects": [get_valid_bbox(image_path)],
            "change_metrics": {"ssim_score": ssim_val},
        }
    except Exception as e:
        return {
            "answer": f"Cross-modal structural similarity (SSIM): {ssim_val:.2f}. (AI description unavailable: {e})",
            "confidence": 0.70,
            "detected_objects": [get_valid_bbox(image_path)],
            "change_metrics": {"ssim_score": ssim_val},
        }

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
