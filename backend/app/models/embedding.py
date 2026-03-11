"""DocumentEmbedding model for RAG (Retrieval-Augmented Generation)."""
from __future__ import annotations

import uuid

from sqlalchemy import Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column
from pgvector.sqlalchemy import Vector

from app.models.base import Base, UUIDPrimaryKeyMixin, TimestampMixin


class DocumentEmbedding(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Stores vector embeddings of document chunks for semantic search.

    Each row represents a single chunk of a source document (note, drive file,
    email, or calendar event) along with its embedding vector. The ``embedding``
    column uses pgvector's ``Vector(768)`` type to enable cosine-similarity
    searches directly in PostgreSQL.
    """

    __tablename__ = "document_embeddings"

    source_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
        comment="drive_file | note | email | calendar_event",
    )
    source_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        index=True,
    )
    chunk_index: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )
    chunk_text: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    embedding = mapped_column(
        Vector(768),
        nullable=False,
    )
    metadata_json: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
        default=dict,
    )

    def __repr__(self) -> str:
        return (
            f"<DocumentEmbedding id={self.id} source={self.source_type}:{self.source_id} "
            f"chunk={self.chunk_index}>"
        )
