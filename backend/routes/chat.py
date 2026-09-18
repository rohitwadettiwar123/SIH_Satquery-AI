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

@router.post("/chat")
async def chat_copilot(req: ChatRequest):
    if not settings.groq_api_key:
        return {"response": "SYSTEM: Assistant Copilot requires GROQ_API_KEY to be set in the .env file."}
    
    try:
        client = Groq(api_key=settings.groq_api_key)
        
        # Convert history to Groq format
        formatted_messages = [
            {
                "role": "system",
                "content": "You are Satquery Chatbot, a friendly and helpful AI expert in satellite imagery, remote sensing, Earth Engine (GEE), and GIS. If the user just says 'hi' or greets you, respond naturally, warmly, and concisely (e.g., 'Hello! How can I help you with your satellite data today?'). Do not give unprompted technical lectures. For technical questions, provide perfect, concise, and highly accurate answers, format code clearly, and prioritize scientific accuracy."
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
