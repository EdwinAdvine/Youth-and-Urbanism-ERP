from __future__ import annotations

import json
import logging
import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, datetime
from typing import Any

import httpx
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import decrypt_field, encrypt_field
from app.models.ai import AIAuditLog, AIConfig, AIChatHistory
from app.services.ai_tools import ADMIN_TOOL_DEFINITIONS, TOOL_DEFINITIONS, ToolExecutor

logger = logging.getLogger(__name__)


class AIService:
    """
    Unified AI service that routes requests to the configured provider.

    Provider priority:
      1. Active AIConfig record in the database (overrides env settings)
      2. env: AI_PROVIDER / OLLAMA_URL / OLLAMA_MODEL
    Falls back to Ollama if a cloud provider key fails.
    """

    def __init__(self, db: AsyncSession, user: Any | None = None) -> None:
        self.db = db
        self._user = user  # Full User ORM object; set for admin-tool support

    def _get_effective_tools(self) -> list[dict[str, Any]]:
        """Return tool definitions, including admin tools if the user is a super-admin."""
        tools = list(TOOL_DEFINITIONS)
        if self._user and getattr(self._user, "is_superadmin", False):
            tools.extend(ADMIN_TOOL_DEFINITIONS)
        return tools

    def _make_tool_executor(self, user_id: uuid.UUID) -> ToolExecutor:
        """Create a ToolExecutor with the current user context."""
        return ToolExecutor(self.db, user_id, user=self._user)

    # ── Config helpers ────────────────────────────────────────────────────────
    async def get_active_config(self) -> AIConfig | None:
        result = await self.db.execute(
            select(AIConfig).where(AIConfig.is_active.is_(True)).limit(1)
        )
        return result.scalar_one_or_none()

    async def update_config(
        self, payload_dict: dict[str, Any], updated_by: uuid.UUID
    ) -> AIConfig:
        config = await self.get_active_config()
        if config is None:
            config = AIConfig(
                provider=settings.AI_PROVIDER,
                model_name=settings.OLLAMA_MODEL,
                base_url=settings.OLLAMA_URL,
                is_active=True,
            )
            self.db.add(config)

        for key, value in payload_dict.items():
            if value is None:
                continue
            if key == "api_key":
                value = encrypt_field(value)
            setattr(config, key, value)

        config.updated_by = updated_by
        config.updated_at = datetime.now(UTC)
        self.db.add(config)
        await self.db.flush()
        await self.db.refresh(config)
        return config

    def _provider_from_config(self, config: AIConfig | None) -> tuple[str, str, str | None, str | None]:
        """Return (provider, model, api_key_plain, base_url)."""
        if config:
            api_key = None
            if config.api_key:
                try:
                    api_key = decrypt_field(config.api_key)
                except Exception:
                    api_key = config.api_key
            return config.provider, config.model_name, api_key, config.base_url
        return (
            settings.AI_PROVIDER,
            settings.OLLAMA_MODEL,
            settings.OPENAI_API_KEY or settings.GROK_API_KEY or settings.ANTHROPIC_API_KEY,
            settings.OLLAMA_URL,
        )

    # ── Audit ─────────────────────────────────────────────────────────────────
    async def _audit(
        self,
        user_id: uuid.UUID | None,
        action: str,
        module: str | None = None,
        details: dict[str, Any] | None = None,
    ) -> None:
        log = AIAuditLog(
            user_id=user_id,
            action=action,
            module=module,
            details=details,
            created_at=datetime.now(UTC),
        )
        self.db.add(log)
        await self.db.flush()

    # ── History ───────────────────────────────────────────────────────────────
    async def _save_message(
        self,
        user_id: uuid.UUID,
        session_id: str,
        role: str,
        content: str,
    ) -> None:
        msg = AIChatHistory(
            user_id=user_id,
            session_id=session_id,
            role=role,
            content=content,
            created_at=datetime.now(UTC),
        )
        self.db.add(msg)
        await self.db.flush()

    async def get_session_history(
        self, user_id: uuid.UUID, session_id: str
    ) -> list[AIChatHistory]:
        result = await self.db.execute(
            select(AIChatHistory)
            .where(
                AIChatHistory.user_id == user_id,
                AIChatHistory.session_id == session_id,
            )
            .order_by(AIChatHistory.created_at)
        )
        return list(result.scalars().all())

    # ── Chat (non-streaming) ──────────────────────────────────────────────────
    async def chat(
        self,
        messages: list[dict[str, str]],
        user_id: uuid.UUID,
        session_id: str,
        tools: bool = False,
    ) -> tuple[str, str, str]:
        """
        Send a chat request to the active provider.
        Returns (reply_text, provider_used, model_used).
        """
        config = await self.get_active_config()
        provider, model, api_key, base_url = self._provider_from_config(config)

        # Save user message
        user_msg = messages[-1]["content"] if messages else ""
        await self._save_message(user_id, session_id, "user", user_msg)

        try:
            if tools and provider in ("openai", "grok"):
                reply = await self._openai_chat_with_tools(
                    api_key, model, messages,
                    base_url if provider == "grok" else base_url,
                    user_id,
                )
            elif tools and provider == "anthropic":
                reply = await self._anthropic_chat_with_tools(
                    messages, self._get_effective_tools(), model, api_key, user_id,
                )
            elif tools and provider == "ollama":
                reply = await self._ollama_chat_with_tools(
                    base_url or settings.OLLAMA_URL, model, messages, user_id,
                )
            else:
                reply = await self._dispatch(provider, model, api_key, base_url, messages)
        except Exception as exc:
            # Fallback to Ollama
            if provider != "ollama":
                await self._audit(
                    user_id,
                    "ai_fallback",
                    details={"reason": str(exc), "original_provider": provider},
                )
                reply = await self._ollama_chat(settings.OLLAMA_URL, settings.OLLAMA_MODEL, messages)
                provider = "ollama"
                model = settings.OLLAMA_MODEL
            else:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail=f"AI service unavailable: {exc}",
                ) from exc

        await self._save_message(user_id, session_id, "assistant", reply)
        await self._audit(
            user_id,
            "ai_chat",
            details={"provider": provider, "model": model, "session_id": session_id, "tools": tools},
        )
        return reply, provider, model

    # ── Chat with tools (convenience wrapper) ────────────────────────────────
    async def chat_with_tools(
        self,
        message: str,
        session_id: str,
        context: dict[str, Any] | None,
        db: AsyncSession,
        user_id: uuid.UUID,
    ) -> tuple[str, str, str]:
        """Convenience wrapper: chat() with tools=True. Accepts a db session for ToolExecutor.

        Before building the message list, performs a RAG search to inject
        relevant document chunks as additional system context.
        """
        system_prompt = (
            "You are Urban Board AI, the intelligent assistant for Urban Vibes Dynamics. "
            "You can help users manage calendar events, send emails, create notes, "
            "search files, generate documents, summarize content, and manage project "
            "tasks using the available tools."
        )
        messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]

        # ── RAG: inject relevant document chunks ───────────────────────────
        try:
            from app.services.embedding import embedding_svc  # noqa: PLC0415

            rag_results = await embedding_svc.search(
                query_text=message, top_k=5, db=db
            )
            if rag_results:
                rag_context_parts: list[str] = []
                for r in rag_results:
                    if r["score"] > 0.3:  # Only include reasonably relevant chunks
                        rag_context_parts.append(
                            f"[{r['source_type']}] {r['chunk_text']}"
                        )
                if rag_context_parts:
                    rag_block = (
                        "The following are relevant excerpts from the user's "
                        "documents and data that may help answer the question:\n\n"
                        + "\n---\n".join(rag_context_parts)
                    )
                    messages.append({"role": "system", "content": rag_block})
        except Exception:
            # RAG is best-effort; do not block chat if embedding service is down
            logger.debug("RAG search failed; proceeding without context", exc_info=True)

        if context:
            messages.append({"role": "system", "content": f"Context: {json.dumps(context)}"})
        messages.append({"role": "user", "content": message})
        return await self.chat(messages, user_id, session_id, tools=True)

    async def _dispatch(
        self,
        provider: str,
        model: str,
        api_key: str | None,
        base_url: str | None,
        messages: list[dict[str, str]],
    ) -> str:
        if provider == "ollama":
            return await self._ollama_chat(base_url or settings.OLLAMA_URL, model, messages)
        if provider == "openai":
            return await self._openai_chat(api_key, model, messages, base_url)
        if provider == "grok":
            return await self._openai_chat(
                api_key,
                model,
                messages,
                base_url or "https://api.x.ai/v1",
            )
        if provider == "anthropic":
            return await self._anthropic_chat(api_key, model, messages)
        raise ValueError(f"Unknown provider: {provider}")

    # ── Streaming (for WebSocket) ─────────────────────────────────────────────
    async def stream_chat(
        self,
        messages: list[dict[str, str]],
        user_id: uuid.UUID,
        session_id: str,
        tools: bool = False,
    ) -> AsyncGenerator[str, None]:
        """Yield token chunks from the active provider."""
        config = await self.get_active_config()
        provider, model, api_key, base_url = self._provider_from_config(config)

        user_msg = messages[-1]["content"] if messages else ""
        await self._save_message(user_id, session_id, "user", user_msg)

        full_reply: list[str] = []

        # Tool-calling in streaming mode
        if tools and provider in ("openai", "grok"):
            async for chunk in self._openai_stream_with_tools(
                api_key, model, messages,
                base_url if provider == "grok" else base_url,
                user_id,
            ):
                full_reply.append(chunk)
                yield chunk
        elif tools and provider == "anthropic":
            # Anthropic tool-calling is non-streaming; yield the full result
            reply = await self._anthropic_chat_with_tools(
                messages, self._get_effective_tools(), model, api_key, user_id,
            )
            full_reply.append(reply)
            yield reply
        else:
            try:
                async for chunk in self._stream_dispatch(provider, model, api_key, base_url, messages):
                    full_reply.append(chunk)
                    yield chunk
            except Exception as exc:
                if provider != "ollama":
                    await self._audit(user_id, "ai_fallback", details={"reason": str(exc)})
                    async for chunk in self._ollama_stream(settings.OLLAMA_URL, settings.OLLAMA_MODEL, messages):
                        full_reply.append(chunk)
                        yield chunk
                else:
                    yield f"[ERROR] AI service unavailable: {exc}"

        reply_text = "".join(full_reply)
        await self._save_message(user_id, session_id, "assistant", reply_text)
        await self._audit(user_id, "ai_stream_chat", details={"session_id": session_id, "tools": tools})

    async def _openai_stream_with_tools(
        self,
        api_key: str | None,
        model: str,
        messages: list[dict[str, str]],
        base_url: str | None,
        user_id: uuid.UUID,
        max_rounds: int = 3,
    ) -> AsyncGenerator[str, None]:
        """Stream with tool-calling support. Buffer tool calls, execute, then re-stream."""
        try:
            from openai import AsyncOpenAI  # noqa: PLC0415
        except ImportError as exc:
            raise RuntimeError("openai package not installed") from exc

        client = AsyncOpenAI(api_key=api_key, base_url=base_url)
        tool_executor = self._make_tool_executor(user_id)
        conversation: list[dict[str, Any]] = list(messages)

        for _ in range(max_rounds):
            tool_calls_buffer: dict[int, dict[str, Any]] = {}
            content_chunks: list[str] = []
            has_tool_calls = False

            stream = await client.chat.completions.create(
                model=model,
                messages=conversation,  # type: ignore[arg-type]
                tools=self._get_effective_tools(),  # type: ignore[arg-type]
                stream=True,
            )

            async for chunk in stream:
                delta = chunk.choices[0].delta if chunk.choices else None
                if not delta:
                    continue

                # Buffer content
                if delta.content:
                    content_chunks.append(delta.content)
                    yield delta.content

                # Buffer tool calls
                if delta.tool_calls:
                    has_tool_calls = True
                    for tc in delta.tool_calls:
                        idx = tc.index
                        if idx not in tool_calls_buffer:
                            tool_calls_buffer[idx] = {
                                "id": tc.id or "",
                                "function": {"name": "", "arguments": ""},
                            }
                        if tc.id:
                            tool_calls_buffer[idx]["id"] = tc.id
                        if tc.function:
                            if tc.function.name:
                                tool_calls_buffer[idx]["function"]["name"] = tc.function.name
                            if tc.function.arguments:
                                tool_calls_buffer[idx]["function"]["arguments"] += tc.function.arguments

            if not has_tool_calls:
                return

            # Build assistant message with tool calls and append
            assistant_msg: dict[str, Any] = {
                "role": "assistant",
                "content": "".join(content_chunks) or None,
                "tool_calls": [
                    {
                        "id": tc["id"],
                        "type": "function",
                        "function": tc["function"],
                    }
                    for tc in tool_calls_buffer.values()
                ],
            }
            conversation.append(assistant_msg)

            # Execute tool calls and append results
            for tc in tool_calls_buffer.values():
                fn_name = tc["function"]["name"]
                fn_args = json.loads(tc["function"]["arguments"])
                logger.info("AI stream tool call: %s(%s)", fn_name, fn_args)
                result = await tool_executor.execute(fn_name, fn_args)
                conversation.append(
                    {
                        "role": "tool",
                        "tool_call_id": tc["id"],
                        "content": json.dumps(result),
                    }
                )

        # Final stream without tools after exhausting rounds
        stream = await client.chat.completions.create(
            model=model,
            messages=conversation,  # type: ignore[arg-type]
            stream=True,
        )
        async for chunk in stream:
            delta = chunk.choices[0].delta if chunk.choices else None
            if delta and delta.content:
                yield delta.content

    async def _stream_dispatch(
        self,
        provider: str,
        model: str,
        api_key: str | None,
        base_url: str | None,
        messages: list[dict[str, str]],
    ) -> AsyncGenerator[str, None]:
        if provider in ("ollama", "grok", "openai"):
            url = base_url if provider != "ollama" else (base_url or settings.OLLAMA_URL)
            async for chunk in self._ollama_stream(url, model, messages, api_key=api_key, provider=provider):
                yield chunk
        else:
            # Non-streaming fallback for anthropic in WebSocket context
            reply = await self._dispatch(provider, model, api_key, base_url, messages)
            yield reply

    # ── Tool-calling provider implementations ───────────────────────────────

    async def _openai_chat_with_tools(
        self,
        api_key: str | None,
        model: str,
        messages: list[dict[str, str]],
        base_url: str | None,
        user_id: uuid.UUID,
        max_rounds: int = 3,
    ) -> str:
        """OpenAI/Grok chat with function-calling loop (max N rounds)."""
        try:
            from openai import AsyncOpenAI  # noqa: PLC0415
        except ImportError as exc:
            raise RuntimeError("openai package not installed") from exc

        client = AsyncOpenAI(api_key=api_key, base_url=base_url)
        tool_executor = self._make_tool_executor(user_id)
        conversation: list[dict[str, Any]] = list(messages)

        for _ in range(max_rounds):
            response = await client.chat.completions.create(
                model=model,
                messages=conversation,  # type: ignore[arg-type]
                tools=self._get_effective_tools(),  # type: ignore[arg-type]
            )
            choice = response.choices[0]

            if choice.finish_reason != "tool_calls" or not choice.message.tool_calls:
                return choice.message.content or ""

            # Append assistant message with tool calls
            conversation.append(choice.message.model_dump())  # type: ignore[arg-type]

            # Execute each tool call and append results
            for tool_call in choice.message.tool_calls:
                fn_name = tool_call.function.name
                fn_args = json.loads(tool_call.function.arguments)
                logger.info("AI tool call: %s(%s)", fn_name, fn_args)
                result = await tool_executor.execute(fn_name, fn_args)
                conversation.append(
                    {
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "content": json.dumps(result),
                    }
                )

        # If we exhausted rounds, get a final response without tools
        response = await client.chat.completions.create(
            model=model,
            messages=conversation,  # type: ignore[arg-type]
        )
        return response.choices[0].message.content or ""

    async def _anthropic_chat_with_tools(
        self,
        messages: list[dict[str, str]],
        tools: list[dict[str, Any]],
        model: str,
        api_key: str | None = None,
        user_id: uuid.UUID | None = None,
        max_rounds: int = 3,
    ) -> str:
        """Anthropic Messages API with native tool-calling loop."""
        try:
            import anthropic  # noqa: PLC0415
        except ImportError as exc:
            raise RuntimeError("anthropic package not installed") from exc

        client = anthropic.AsyncAnthropic(api_key=api_key)
        tool_executor = self._make_tool_executor(user_id)

        # Convert OpenAI-format tool definitions to Anthropic format
        anthropic_tools: list[dict[str, Any]] = []
        for t in tools:
            fn = t.get("function", {})
            anthropic_tools.append({
                "name": fn["name"],
                "description": fn.get("description", ""),
                "input_schema": fn.get("parameters", {"type": "object", "properties": {}}),
            })

        # Separate system messages (Anthropic uses the `system=` parameter)
        system_parts: list[str] = []
        conversation: list[dict[str, Any]] = []
        for m in messages:
            if m["role"] == "system":
                system_parts.append(m["content"])
            else:
                conversation.append({"role": m["role"], "content": m["content"]})

        system_text = "\n\n".join(system_parts) if system_parts else None

        for _ in range(max_rounds):
            kwargs: dict[str, Any] = {
                "model": model,
                "max_tokens": 4096,
                "messages": conversation,
                "tools": anthropic_tools,
            }
            if system_text:
                kwargs["system"] = system_text

            response = await client.messages.create(**kwargs)

            # Collect text and tool_use blocks from the response
            text_parts: list[str] = []
            tool_use_blocks: list[Any] = []

            for block in response.content:
                if block.type == "text":
                    text_parts.append(block.text)
                elif block.type == "tool_use":
                    tool_use_blocks.append(block)

            # If no tool calls, return the text
            if response.stop_reason != "tool_use" or not tool_use_blocks:
                return "\n".join(text_parts) if text_parts else ""

            # Append the assistant response (with tool_use blocks) to the conversation
            conversation.append({"role": "assistant", "content": response.content})

            # Execute each tool call and build tool_result content blocks
            tool_results: list[dict[str, Any]] = []
            for block in tool_use_blocks:
                fn_name = block.name
                fn_args = block.input if isinstance(block.input, dict) else {}
                logger.info("AI tool call (anthropic): %s(%s)", fn_name, fn_args)
                result = await tool_executor.execute(fn_name, fn_args)
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": json.dumps(result),
                })

            # Append user message with tool results (Anthropic convention)
            conversation.append({"role": "user", "content": tool_results})

        # Final call without tools after exhausting rounds
        final_kwargs: dict[str, Any] = {
            "model": model,
            "max_tokens": 4096,
            "messages": conversation,
        }
        if system_text:
            final_kwargs["system"] = system_text

        response = await client.messages.create(**final_kwargs)
        return response.content[0].text if response.content else ""

    async def _ollama_chat_with_tools(
        self,
        base_url: str,
        model: str,
        messages: list[dict[str, str]],
        user_id: uuid.UUID,
        max_rounds: int = 3,
    ) -> str:
        """Ollama chat with tool-calling loop."""
        tool_executor = self._make_tool_executor(user_id)
        # Convert tool definitions to Ollama format
        effective_tools = self._get_effective_tools()
        ollama_tools = []
        for t in effective_tools:
            ollama_tools.append(
                {
                    "type": "function",
                    "function": t["function"],
                }
            )

        url = f"{base_url.rstrip('/')}/api/chat"
        conversation: list[dict[str, Any]] = list(messages)

        async with httpx.AsyncClient(timeout=120) as client:
            for _ in range(max_rounds):
                resp = await client.post(
                    url,
                    json={
                        "model": model,
                        "messages": conversation,
                        "stream": False,
                        "tools": ollama_tools,
                        "options": {"num_ctx": 2048},
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                msg = data.get("message", {})

                tool_calls = msg.get("tool_calls")
                if not tool_calls:
                    return msg.get("content", "")

                # Append assistant message
                conversation.append(msg)

                # Execute tool calls
                for tc in tool_calls:
                    fn = tc.get("function", {})
                    fn_name = fn.get("name", "")
                    fn_args = fn.get("arguments", {})
                    logger.info("AI tool call (ollama): %s(%s)", fn_name, fn_args)
                    result = await tool_executor.execute(fn_name, fn_args)
                    conversation.append(
                        {"role": "tool", "content": json.dumps(result)}
                    )

        # Final call without tools
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                url,
                json={"model": model, "messages": conversation, "stream": False, "options": {"num_ctx": 2048}},
            )
            resp.raise_for_status()
            return resp.json()["message"]["content"]

    # ── Provider implementations ──────────────────────────────────────────────
    async def _ollama_chat(
        self, base_url: str, model: str, messages: list[dict[str, str]]
    ) -> str:
        url = f"{base_url.rstrip('/')}/api/chat"
        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                url,
                json={"model": model, "messages": messages, "stream": False, "options": {"num_ctx": 2048}},
            )
            resp.raise_for_status()
            data = resp.json()
            return data["message"]["content"]

    async def _ollama_stream(
        self,
        base_url: str,
        model: str,
        messages: list[dict[str, str]],
        api_key: str | None = None,
        provider: str = "ollama",
    ) -> AsyncGenerator[str, None]:
        if provider == "ollama":
            url = f"{base_url.rstrip('/')}/api/chat"
            headers: dict[str, str] = {}
            body = {"model": model, "messages": messages, "stream": True, "options": {"num_ctx": 2048}}
        else:
            # OpenAI-compatible streaming (openai / grok)
            url = f"{base_url.rstrip('/')}/chat/completions"
            headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
            body = {"model": model, "messages": messages, "stream": True}

        async with httpx.AsyncClient(timeout=180) as client:
            async with client.stream("POST", url, json=body, headers=headers) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line:
                        continue
                    if provider != "ollama":
                        # SSE format: data: {...}
                        if line.startswith("data:"):
                            line = line[5:].strip()
                        if line == "[DONE]":
                            break
                        try:
                            data = json.loads(line)
                            delta = data["choices"][0]["delta"].get("content", "")
                            if delta:
                                yield delta
                        except (json.JSONDecodeError, KeyError):
                            continue
                    else:
                        try:
                            data = json.loads(line)
                            chunk = data.get("message", {}).get("content", "")
                            if chunk:
                                yield chunk
                            if data.get("done"):
                                break
                        except json.JSONDecodeError:
                            continue

    async def _openai_chat(
        self,
        api_key: str | None,
        model: str,
        messages: list[dict[str, str]],
        base_url: str | None = None,
    ) -> str:
        try:
            from openai import AsyncOpenAI  # noqa: PLC0415
        except ImportError as exc:
            raise RuntimeError("openai package not installed") from exc

        client = AsyncOpenAI(
            api_key=api_key,
            base_url=base_url,
        )
        response = await client.chat.completions.create(
            model=model,
            messages=messages,  # type: ignore[arg-type]
        )
        return response.choices[0].message.content or ""

    async def _anthropic_chat(
        self,
        api_key: str | None,
        model: str,
        messages: list[dict[str, str]],
    ) -> str:
        try:
            import anthropic  # noqa: PLC0415
        except ImportError as exc:
            raise RuntimeError("anthropic package not installed") from exc

        client = anthropic.AsyncAnthropic(api_key=api_key)
        # Anthropic expects system messages separate from human/assistant turns
        system_content = ""
        filtered: list[dict[str, str]] = []
        for m in messages:
            if m["role"] == "system":
                system_content = m["content"]
            else:
                filtered.append(m)

        kwargs: dict[str, Any] = {
            "model": model,
            "max_tokens": 4096,
            "messages": filtered,
        }
        if system_content:
            kwargs["system"] = system_content

        response = await client.messages.create(**kwargs)
        return response.content[0].text
