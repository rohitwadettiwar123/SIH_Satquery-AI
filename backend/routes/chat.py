from fastapi import APIRouter
from pydantic import BaseModel
from typing import List
from groq import Groq
from backend.config import settings
import logging

router = APIRouter(tags=["Copilot"])
log = logging.getLogger("satquery")

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    aoi: dict = None


@router.post("/chat")
async def chat_copilot(req: ChatRequest):
    if not settings.groq_api_key:
        return {"response": "SYSTEM: Assistant Copilot requires GROQ_API_KEY to be set in the .env file."}
    
    try:
        client = Groq(api_key=settings.groq_api_key)
        
        
        # Convert history to Groq format
        
        system_content = "You are an advanced geospatial AI analyst. Provide concise, highly accurate answers."
        if req.aoi:
            system_content = f"""You are an expert geospatial AI analyst.
USER QUESTION IS ABOUT THIS SPECIFIC GEOGRAPHIC REGION:
SELECTED AOI (GeoJSON): {req.aoi.get('geojson')}
CENTER: {req.aoi.get('centerLat')}, {req.aoi.get('centerLng')}
BOUNDS: {req.aoi.get('south')} to {req.aoi.get('north')} Lat, {req.aoi.get('west')} to {req.aoi.get('east')} Lng
AREA: {req.aoi.get('areaKm2')} km2
CRS: EPSG:4326

The AI must not invent satellite observations. If actual imagery/analysis is unavailable, explicitly state that the available data is insufficient instead of claiming that it detected something."""

        formatted_messages = [
            {
                "role": "system",
                "content": system_content
            }
        ]
        for msg in req.messages:
            if msg.role == 'assistant':
                role = 'assistant'
            else:
                role = 'user'
            formatted_messages.append({
                "role": role,
                "content": msg.content
            })
            
        chat_completion = client.chat.completions.create(
            messages=formatted_messages,
            model="qwen/qwen3.8-27b",
        )
        
        return {"response": chat_completion.choices[0].message.content}
    except Exception as e:
        log.exception("Chat Copilot error (Groq)")
        return {"response": f"Error: {str(e)}"}
