"""CSV export utility for Urban Vibes Dynamics.

Provides a single helper function that converts a sequence of row dicts into
a downloadable CSV file served as a FastAPI ``StreamingResponse``.

Usage:
    from app.core.export import rows_to_csv

    @router.get("/invoices/export")
    async def export_invoices(db: AsyncSession = Depends(get_db)):
        rows = [{"id": inv.id, "total": inv.total} for inv in invoices]
        return rows_to_csv(rows, columns=["id", "total"], filename="invoices.csv")

Notes:
    - Extra keys in row dicts that are not in *columns* are silently ignored
      (``extrasaction="ignore"``).
    - The entire CSV is built in-memory, so this is best suited for exports
      of moderate size (< ~50 000 rows). For very large datasets, consider
      a true streaming approach with ``itertools`` or async generators.
"""
from __future__ import annotations

import csv
import io
from collections.abc import Sequence
from typing import Any

from fastapi.responses import StreamingResponse


def rows_to_csv(rows: Sequence[dict[str, Any]], columns: list[str], filename: str = "export.csv") -> StreamingResponse:
    """Convert a list of dicts to a CSV StreamingResponse.

    Args:
        rows: Sequence of dicts, each representing one CSV row. Keys that
            do not appear in *columns* are silently skipped.
        columns: Ordered list of column names used as the CSV header and
            to select values from each row dict.
        filename: Name suggested to the browser in the Content-Disposition
            header. Defaults to ``"export.csv"``.

    Returns:
        A FastAPI ``StreamingResponse`` with ``media_type="text/csv"`` and
        an ``attachment`` Content-Disposition header.
    """
    # Build the CSV content in a StringIO buffer
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=columns, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(rows)
    output.seek(0)  # Rewind so the response can read from the start

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
