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
            
    payload = {
        "contents": [{"parts": parts}],
        "generationConfig": {"maxOutputTokens": max_tokens}
    }
    
    models_to_try = [
        "gemini-1.5-flash",
        "gemini-1.5-flash-latest",
        "gemini-1.5-pro",
        "gemini-1.5-pro-latest",
        "gemini-1.0-pro-vision-latest",
        "gemini-pro-vision"
    ]
    
    last_error = ""
    async with httpx.AsyncClient() as client:
        for model_name in models_to_try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={gemini_key}"
            try:
                resp = await client.post(url, json=payload, timeout=30.0)
                data = resp.json()
                
                if resp.status_code == 200:
                    try:
                        text = data["candidates"][0]["content"]["parts"][0]["text"]
                        return text.strip()
                    except (KeyError, IndexError):
                        return "Analysis complete."
                else:
                    err_msg = data.get("error", {}).get("message", str(data))
                    last_error = f"Gemini API Error ({model_name}): {err_msg}"
                    # If it's a 404, we continue to the next model. Otherwise, break and raise.
                    if resp.status_code != 404:
                        break
            except Exception as e:
                last_error = f"Gemini Request Failed ({model_name}): {e}"
                
    log.warning(f"All models failed. Last error: {last_error}")
    raise RuntimeError(last_error)
