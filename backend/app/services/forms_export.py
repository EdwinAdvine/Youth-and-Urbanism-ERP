"""Forms export service — CSV and XLSX export of form responses."""
from __future__ import annotations

import csv
import io
from typing import Any, Sequence


def export_form_responses(
    fields: list[dict[str, Any]],
    responses: Sequence[dict[str, Any]],
    fmt: str = "csv",
) -> tuple[bytes, str, str]:
    """Export form responses to the requested format.

    Returns (file_bytes, media_type, file_extension).
    """
    # Build column mapping: field_id -> label
    sorted_fields = sorted(fields, key=lambda f: f.get("order", 0))
    col_ids = [f["id"] for f in sorted_fields]
    col_labels = [f["label"] for f in sorted_fields]

    if fmt == "xlsx":
        return _export_xlsx(col_ids, col_labels, responses)
    return _export_csv(col_ids, col_labels, responses)


def _export_csv(
    col_ids: list[str],
    col_labels: list[str],
    responses: Sequence[dict[str, Any]],
) -> tuple[bytes, str, str]:
    output = io.StringIO()
    writer = csv.writer(output)

    # Header: # + field labels + Submitted At
    writer.writerow(["#"] + col_labels + ["Submitted At"])

    for idx, resp in enumerate(responses, 1):
        answers = resp.get("answers", {})
        row = [idx]
        for fid in col_ids:
            val = answers.get(fid, "")
            if isinstance(val, list):
                val = ", ".join(str(v) for v in val)
            row.append(val)
        row.append(resp.get("submitted_at", ""))
        writer.writerow(row)

    return output.getvalue().encode("utf-8"), "text/csv", "csv"


def _export_xlsx(
    col_ids: list[str],
    col_labels: list[str],
    responses: Sequence[dict[str, Any]],
) -> tuple[bytes, str, str]:
    try:
        from openpyxl import Workbook
    except ImportError:
        # Fallback to CSV if openpyxl not installed
        return _export_csv(col_ids, col_labels, responses)

    wb = Workbook()
    ws = wb.active
    ws.title = "Responses"

    # Header row
    headers = ["#"] + col_labels + ["Submitted At"]
    ws.append(headers)

    # Style header
    from openpyxl.styles import Font
    for cell in ws[1]:
        cell.font = Font(bold=True)

    # Data rows
    for idx, resp in enumerate(responses, 1):
        answers = resp.get("answers", {})
        row = [idx]
        for fid in col_ids:
            val = answers.get(fid, "")
            if isinstance(val, list):
                val = ", ".join(str(v) for v in val)
            row.append(val)
        row.append(resp.get("submitted_at", ""))
        ws.append(row)

    # Auto-width columns
    for col in ws.columns:
        max_length = 0
        col_letter = col[0].column_letter
        for cell in col:
            try:
                if cell.value:
                    max_length = max(max_length, len(str(cell.value)))
            except Exception:
                pass
        ws.column_dimensions[col_letter].width = min(max_length + 2, 50)

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)

    return (
        buf.getvalue(),
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "xlsx",
    )
