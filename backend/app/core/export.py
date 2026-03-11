"""CSV export utility for Urban ERP."""
from __future__ import annotations

import csv
import io
from collections.abc import Sequence
from typing import Any

from fastapi.responses import StreamingResponse


def rows_to_csv(rows: Sequence[dict[str, Any]], columns: list[str], filename: str = "export.csv") -> StreamingResponse:
    """Convert a list of dicts to a CSV StreamingResponse."""
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=columns, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(rows)
    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
