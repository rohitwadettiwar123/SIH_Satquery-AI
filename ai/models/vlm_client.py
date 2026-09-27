import os
import io
import base64
import logging
import httpx
from PIL import Image

log = logging.getLogger("satquery.ai.vlm")

async def call_vlm(system_prompt: str, image_paths: list[str], max_tokens: int = 500) -> str:
    gemini_key = os.getenv("GEMINI_API_KEY", "")
    if not gemini_key:
        raise RuntimeError("No VLM API keys configured in Render environment variables.")
    
    parts = [{"text": system_prompt}]
    
    for path in image_paths:
        img = Image.open(path).convert("RGB")
        if max(img.size) > 512:
            img.thumbnail((512, 512))
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=70)
        b64_data = base64.b64encode(buf.getvalue()).decode("utf-8")
        parts.append({
            "inline_data": {
                "mime_type": "image/jpeg",
                "data": b64_data
            }
        })
            
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_key}"
    payload = {
        "contents": [{"parts": parts}],
        "generationConfig": {"maxOutputTokens": max_tokens}
    }
    
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(url, json=payload, timeout=30.0)
            data = resp.json()
            if resp.status_code != 200:
                err_msg = data.get("error", {}).get("message", str(data))
                log.warning(f"Gemini API Error: {err_msg}")
                raise RuntimeError(f"Gemini API Error: {err_msg}")
            
            # Extract text from response
            try:
                text = data["candidates"][0]["content"]["parts"][0]["text"]
                return text.strip()
            except (KeyError, IndexError):
                return "Analysis complete."
        except Exception as e:
            if isinstance(e, RuntimeError):
                raise
            log.warning(f"Gemini API request failed: {e}")
            raise RuntimeError(f"Gemini API Error: {str(e)}")
