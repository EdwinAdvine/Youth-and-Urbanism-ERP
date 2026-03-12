"""Document AI Service — wraps AIService with document-specific prompts."""
from __future__ import annotations

import logging
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.ai import AIService

logger = logging.getLogger(__name__)

# System prompts per action
_SYSTEM_PROMPTS = {
    "generate": (
        "You are a professional document writer for Urban ERP. "
        "Generate well-structured, clear content based on the user's instructions. "
        "Use proper formatting with headings, bullet points, and paragraphs as appropriate."
    ),
    "summarize": (
        "You are a document summarization assistant. "
        "Produce concise, accurate summaries that capture key points and decisions. "
        "Preserve important facts, figures, and action items."
    ),
    "translate": (
        "You are a professional document translator. "
        "Translate accurately while preserving formatting, headers, structure, and tone. "
        "Return ONLY the translated text without explanations."
    ),
    "improve": (
        "You are a professional editor. "
        "Improve the text's grammar, clarity, and tone while preserving the original meaning. "
        "Fix awkward phrasing, passive voice, and redundancy. "
        "Return ONLY the improved text without explanations."
    ),
    "expand": (
        "You are a professional content writer. "
        "Expand the provided text with more detail, examples, and depth. "
        "Maintain the original tone and style. "
        "Return ONLY the expanded text without explanations."
    ),
    "simplify": (
        "You are a plain-language editor. "
        "Simplify the text to be easy to read at a general audience level. "
        "Use shorter sentences, common words, and clear structure. "
        "Return ONLY the simplified text without explanations."
    ),
}


class DocAIService:
    """Document-specific AI operations built on top of AIService."""

    def __init__(self, db: AsyncSession, user_id: uuid.UUID) -> None:
        self.db = db
        self.user_id = user_id
        self._ai = AIService(db)

    async def _call(
        self,
        action: str,
        user_prompt: str,
        *,
        doc_name: str = "",
    ) -> dict[str, str]:
        """Send a single prompt to the AI and return the result."""
        system_prompt = _SYSTEM_PROMPTS.get(action, _SYSTEM_PROMPTS["generate"])
        if doc_name:
            system_prompt += f" The document is named '{doc_name}'."

        session_id = f"doc-ai-{action}-{uuid.uuid4().hex[:8]}"
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        reply, provider, model = await self._ai.chat(
            messages=messages,
            user_id=self.user_id,
            session_id=session_id,
            tools=False,
        )

        return {"content": reply, "provider": provider, "model": model}

    # ── Public methods ────────────────────────────────────────────────────────

    async def generate(self, prompt: str, *, doc_name: str = "", doc_type: str = "doc") -> dict[str, str]:
        """Generate content from a prompt."""
        user_prompt = f"Generate professional content for a {doc_type} document.\n\n{prompt}"
        return await self._call("generate", user_prompt, doc_name=doc_name)

    async def summarize(self, text: str, *, doc_name: str = "", max_length: int = 500) -> dict[str, str]:
        """Summarize document text."""
        user_prompt = (
            f"Summarize the following text in at most {max_length} characters. "
            f"Provide a concise, professional summary.\n\n{text[:8000]}"
        )
        return await self._call("summarize", user_prompt, doc_name=doc_name)

    async def translate(self, text: str, target_language: str, *, doc_name: str = "") -> dict[str, str]:
        """Translate text to target language."""
        user_prompt = f"Translate to {target_language}:\n\n{text[:8000]}"
        return await self._call("translate", user_prompt, doc_name=doc_name)

    async def improve(self, text: str, *, doc_name: str = "", tone: str = "professional") -> dict[str, str]:
        """Improve grammar, clarity, and tone."""
        user_prompt = f"Improve this text (target tone: {tone}):\n\n{text[:8000]}"
        return await self._call("improve", user_prompt, doc_name=doc_name)

    async def expand(self, text: str, *, doc_name: str = "") -> dict[str, str]:
        """Expand text with more detail."""
        user_prompt = f"Expand the following text with more detail and depth:\n\n{text[:8000]}"
        return await self._call("expand", user_prompt, doc_name=doc_name)

    async def simplify(self, text: str, *, doc_name: str = "") -> dict[str, str]:
        """Simplify text for easier reading."""
        user_prompt = f"Simplify this text for a general audience:\n\n{text[:8000]}"
        return await self._call("simplify", user_prompt, doc_name=doc_name)
