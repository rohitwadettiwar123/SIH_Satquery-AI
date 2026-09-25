import os
import io
import base64
import logging
from PIL import Image
import httpx
from google import genai
from google.genai import types as gtypes

log = logging.getLogger("satquery.ai.vlm")

async def call_vlm(system_prompt: str, image_paths: list[str], max_tokens: int = 50) -> str:
    gemini_key = os.getenv("GEMINI_API_KEY", "")
    
    gemini_bytes = []
    for path in image_paths:
        img = Image.open(path).convert("RGB")
        if max(img.size) > 256:
            img.thumbnail((256, 256))
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=70)
        gemini_bytes.append(buf.getvalue())
            
    if gemini_key:
        try:
            client = genai.Client(api_key=gemini_key)
            parts = [gtypes.Part.from_text(text=system_prompt)]
            for b in gemini_bytes:
                parts.append(gtypes.Part.from_bytes(data=b, mime_type="image/jpeg"))
                
            resp = await client.aio.models.generate_content(
                model="gemini-3.6-flash",
                contents=parts,
                config=gtypes.GenerateContentConfig(max_output_tokens=max_tokens)
            )
            return resp.text.strip() if resp.text else "Analysis complete."
        except Exception as e:
            log.warning(f"Gemini Vision failed: {e}.")
            
    raise RuntimeError("No VLM API keys configured or all VLM calls failed.")
