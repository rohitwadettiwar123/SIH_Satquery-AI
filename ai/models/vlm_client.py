import os
import io
import logging
from PIL import Image
import google.generativeai as genai

log = logging.getLogger("satquery.ai.vlm")

async def call_vlm(system_prompt: str, image_paths: list[str], max_tokens: int = 500) -> str:
    gemini_key = os.getenv("GEMINI_API_KEY", "")
    
    pil_images = []
    for path in image_paths:
        img = Image.open(path).convert("RGB")
        if max(img.size) > 512:
            img.thumbnail((512, 512))
        pil_images.append(img)
            
    if gemini_key:
        try:
            genai.configure(api_key=gemini_key)
            # Use gemini-1.5-flash as the standard fast vision model
            model = genai.GenerativeModel("gemini-1.5-flash")
            
            contents = [system_prompt]
            contents.extend(pil_images)
            
            resp = await model.generate_content_async(
                contents,
                generation_config=genai.types.GenerationConfig(max_output_tokens=max_tokens)
            )
            return resp.text.strip() if resp.text else "Analysis complete."
        except Exception as e:
            log.warning(f"Gemini Vision failed: {e}.")
            
    raise RuntimeError("No VLM API keys configured or all VLM calls failed.")
