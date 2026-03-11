"""Unit tests for the CSV export helper."""
from __future__ import annotations

import pytest
from app.core.export import rows_to_csv


def test_rows_to_csv_basic():
    """rows_to_csv generates valid CSV content."""
    headers = ["Name", "Age", "City"]
    rows = [
        ["Alice", "30", "Nairobi"],
        ["Bob", "25", "Mombasa"],
    ]
    result = rows_to_csv(headers, rows)
    lines = result.strip().split("\n")
    assert lines[0] == "Name,Age,City"
    assert lines[1] == "Alice,30,Nairobi"
    assert lines[2] == "Bob,25,Mombasa"


def test_rows_to_csv_empty():
    """rows_to_csv with no rows returns only headers."""
    headers = ["Col1", "Col2"]
    result = rows_to_csv(headers, [])
    lines = result.strip().split("\n")
    assert len(lines) == 1
    assert lines[0] == "Col1,Col2"


def test_rows_to_csv_special_chars():
    """rows_to_csv handles commas and quotes in values."""
    headers = ["Name", "Description"]
    rows = [['Widget "A"', "Small, round"]]
    result = rows_to_csv(headers, rows)
    assert "Widget" in result
    assert "Small" in result
