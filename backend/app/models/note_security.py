"""Re-exports for note security models.

NoteAuditLog and NoteSensitivityLabel are canonically defined in notes.py.
This module exists for import compatibility with the security layer.
"""
from app.models.notes import NoteAuditLog, NoteSensitivityLabel

__all__ = ["NoteAuditLog", "NoteSensitivityLabel"]
