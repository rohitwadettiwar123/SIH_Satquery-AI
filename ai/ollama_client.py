"""SatQuery AI – Ollama local VLM client."""
from __future__ import annotations

import logging
import httpx

log = logging.getLogger("satquery.ai.ollama")


async def check_ollama_available(base_url: str = "http://localhost:11434") -> bool:
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            resp = await client.get(f"{base_url}/api/tags")
            return resp.status_code == 200
    except Exception:
        return False


async def vqa_ollama(
    query: str,
    image_path: str,
    model: str = "llava",
    base_url: str = "http://localhost:11434",
) -> dict | None:
    """Send image + query to Ollama VLM (llava or similar)."""
    try:
        import base64
        with open(image_path, "rb") as f:
            img_b64 = base64.b64encode(f.read()).decode("utf-8")

        payload = {
            "model": model,
            "prompt": f"You are a remote sensing expert. {query}",
            "images": [img_b64],
            "stream": False,
        }
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(f"{base_url}/api/generate", json=payload)
            if resp.status_code == 200:
                data = resp.json()
                return {
                    "answer": data.get("response", "").strip(),
                    "confidence": 0.80,
                    "detected_objects": [],
                    "model_used": f"ollama/{model}",
                }
    except Exception as e:
        log.warning("Ollama VQA failed: %s", e)
    return None
