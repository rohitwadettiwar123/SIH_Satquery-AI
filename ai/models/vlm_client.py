import os
import io
import base64
import asyncio
import logging
import re
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
        "gemini-3.6-flash",
        "gemini-3.7-flash",
        "gemini-3.5-flash",
        "gemini-2.5-flash",
        "gemini-flash-latest",
        "gemini-3.8-flash"
    ]
    
    last_error = ""
    async with httpx.AsyncClient() as client:
        for model_name in models_to_try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={gemini_key}"
            try:
                resp = await client.post(url, json=payload, timeout=60.0)
                data = resp.json()
                
                if resp.status_code == 200:
                    try:
                        text = data["candidates"][0]["content"]["parts"][0]["text"]
                        return text.strip()
                    except (KeyError, IndexError):
                        return "Analysis complete."
                
                err_msg = data.get("error", {}).get("message", str(data))
                last_error = f"Gemini API Error ({model_name}): {err_msg}"
                
                if resp.status_code == 429:
                    # Rate limited - extract retry delay and wait, then try next model
                    retry_match = re.search(r"retry in ([\d.]+)s", err_msg)
                    wait_secs = float(retry_match.group(1)) if retry_match else 5.0
                    wait_secs = min(wait_secs, 15.0)  # cap wait at 15s
                    log.warning(f"Rate limited on {model_name}, waiting {wait_secs:.1f}s then trying next model...")
                    await asyncio.sleep(wait_secs)
                    continue  # try next model
                elif resp.status_code == 404:
                    continue  # model not found, try next
                else:
                    break  # other error, stop trying
                    
            except Exception as e:
                last_error = f"Gemini Request Failed ({model_name}): {e}"
                continue
                
    log.warning(f"All models failed. Last error: {last_error}")
    raise RuntimeError(last_error)
