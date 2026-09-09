"""AI Chatbot API Router for MPLADS Sentinel.

Provides conversational intelligence powered by OpenRouter free tier models.
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.openrouter_service import ask_openrouter_assistant

router = APIRouter(prefix="/api/ai", tags=["AI Assistant"])
v1_router = APIRouter(prefix="/api/v1/ai", tags=["AI Assistant"])


class ChatMessage(BaseModel):
    role: str = Field(..., description="Role of the sender ('user' or 'assistant')")
    content: str = Field(..., description="Content of the message")


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(..., description="Conversation history")
    context: dict[str, Any] | None = Field(default=None, description="Current UI or user context")


class ChatResponse(BaseModel):
    ok: bool
    reply: str
    model_used: str
    error: str | None = None


async def _handle_chat(request: ChatRequest) -> ChatResponse:
    if not request.messages:
        raise HTTPException(status_code=400, detail="Messages cannot be empty")

    raw_msgs = [{"role": m.role, "content": m.content} for m in request.messages]
    result = await ask_openrouter_assistant(raw_msgs, context=request.context)
    return ChatResponse(
        ok=result["ok"],
        reply=result["reply"],
        model_used=result["model_used"],
        error=result.get("error"),
    )


@router.post("/chat", response_model=ChatResponse)
async def chat_with_assistant(request: ChatRequest):
    return await _handle_chat(request)


@v1_router.post("/chat", response_model=ChatResponse)
async def chat_with_assistant_v1(request: ChatRequest):
    return await _handle_chat(request)
