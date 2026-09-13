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
        formatted_messages = []
        for msg in req.messages:
            formatted_messages.append({
                "role": msg.role,
                "content": msg.content
            })
            
        chat_completion = client.chat.completions.create(
            messages=formatted_messages,
            model="llama3-8b-8192",
        )
        
        return {"response": chat_completion.choices[0].message.content}
    except Exception as e:
        log.exception("Chat Copilot error (Groq)")
        return {"response": f"Error: {str(e)}"}
