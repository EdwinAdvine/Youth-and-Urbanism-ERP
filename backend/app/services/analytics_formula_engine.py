"""
AnalyticsFormulaEngine — compiles DAX-like formula expressions to PostgreSQL SQL.
Supports 29 functions: SUM, COUNT, AVG, MIN, MAX, DIVIDE, IF, SWITCH, FORMAT,
YEAR, MONTH, DAY, NOW, TODAY, CONCATENATE, RANKX, TOPN, DISTINCTCOUNT, COUNTROWS,
DATEDIFF, COALESCE, CALCULATE, FILTER, RELATED, DATEADD, TOTALYTD,
SAMEPERIODLASTYEAR, ISBLANK, EOMONTH.

Uses a hand-written recursive descent parser — no third-party packages required.
"""
from __future__ import annotations

import re
import logging
from typing import Any

logger = logging.getLogger(__name__)

# ── Tokeniser ─────────────────────────────────────────────────────────────────
# Token types
_TT_FUNC   = "FUNC"    # identifier followed by '('
_TT_IDENT  = "IDENT"   # bare identifier (field name)
_TT_NUMBER = "NUMBER"  # numeric literal
_TT_STRING = "STRING"  # single- or double-quoted string literal
_TT_COMMA  = "COMMA"
_TT_LPAREN = "LPAREN"
_TT_RPAREN = "RPAREN"
_TT_OP     = "OP"      # operator: + - * / = < > <> <= >= AND OR NOT
_TT_EOF    = "EOF"

_TOKEN_RE = re.compile(
    r"""
      (?P<STRING>  '[^']*' | "[^"]*"  )       # quoted strings
    | (?P<NUMBER>  -?\d+(?:\.\d+)?            # numbers (optional leading minus)
                   (?:[eE][+-]?\d+)?          #  with optional exponent
      )
    | (?P<IDENT>   [A-Za-z_][A-Za-z0-9_]*    # identifiers / keywords
      )
    | (?P<OP>      <>|<=|>=|[+\-*/=<>]       # operators
                  |(?:AND|OR|NOT)\b
      )
    | (?P<COMMA>   ,)
    | (?P<LPAREN>  \()
    | (?P<RPAREN>  \))
    | (?P<SKIP>    \s+)                       # whitespace — skipped
    """,
    re.VERBOSE | re.IGNORECASE,
)

# Functions that are recognised by the engine (uppercase)
_KNOWN_FUNCTIONS = frozenset({
    "SUM", "COUNT", "AVG", "MIN", "MAX",
    "DIVIDE", "IF", "SWITCH", "FORMAT",
    "YEAR", "MONTH", "DAY", "NOW", "TODAY",
    "CONCATENATE", "RANKX", "TOPN",
    "DISTINCTCOUNT", "COUNTROWS",
    "DATEDIFF", "COALESCE",
    # Phase 2 — time-intelligence & context functions
    "CALCULATE", "FILTER", "RELATED",
    "DATEADD", "TOTALYTD", "SAMEPERIODLASTYEAR",
    "ISBLANK", "EOMONTH",
})


class _Token:
    __slots__ = ("type", "value")

    def __init__(self, type_: str, value: str) -> None:
        self.type = type_
        self.value = value

    def __repr__(self) -> str:
        return f"Token({self.type}, {self.value!r})"


def _tokenise(formula: str) -> list[_Token]:
    """Convert a formula string into a flat list of Tokens."""
    tokens: list[_Token] = []
    pos = 0
    length = len(formula)

    while pos < length:
        m = _TOKEN_RE.match(formula, pos)
        if not m:
            raise SyntaxError(
                f"Unexpected character {formula[pos]!r} at position {pos}"
            )
        pos = m.end()
        kind = m.lastgroup
        if kind == "SKIP":
            continue

        value = m.group()

        if kind == "IDENT":
            # Peek ahead: is the *next non-whitespace* char a '('?
            rest = formula[pos:].lstrip()
            if rest.startswith("(") and value.upper() in _KNOWN_FUNCTIONS:
                kind = "FUNC"
                value = value.upper()
            # else stays IDENT

        tokens.append(_Token(kind, value))  # type: ignore[arg-type]

    tokens.append(_Token(_TT_EOF, ""))
    return tokens


# ── Recursive-descent parser ──────────────────────────────────────────────────

class _Parser:
    """Parse a token list and emit a PostgreSQL SQL expression string."""

    def __init__(self, tokens: list[_Token], alias: str) -> None:
        self._tokens = tokens
        self._pos = 0
        self._alias = alias

    # ── helpers ──

    def _peek(self) -> _Token:
        return self._tokens[self._pos]

    def _consume(self, expected_type: str | None = None) -> _Token:
        tok = self._tokens[self._pos]
        if expected_type and tok.type != expected_type:
            raise SyntaxError(
                f"Expected {expected_type}, got {tok.type}({tok.value!r})"
            )
        self._pos += 1
        return tok

    def _match(self, *types: str) -> bool:
        return self._peek().type in types

    # ── entry point ──

    def parse(self) -> str:
        sql = self._expr()
        if self._peek().type != _TT_EOF:
            raise SyntaxError(
                f"Unexpected token after expression: {self._peek()!r}"
            )
        return sql

    # ── expression (handles binary operators) ──

    def _expr(self) -> str:
        left = self._primary()
        while self._match(_TT_OP):
            op = self._consume(_TT_OP).value
            right = self._primary()
            # Map logical operators to SQL keywords
            op_upper = op.upper()
            if op_upper in ("AND", "OR", "NOT"):
                left = f"({left}) {op_upper} ({right})"
            else:
                left = f"({left}) {op} ({right})"
        return left

    # ── primary: function call, literal, or field reference ──

    def _primary(self) -> str:
        tok = self._peek()

        if tok.type == _TT_FUNC:
            return self._function_call()

        if tok.type == _TT_NUMBER:
            self._consume()
            return tok.value

        if tok.type == _TT_STRING:
            self._consume()
            return tok.value  # keep surrounding quotes as-is

        if tok.type == _TT_LPAREN:
            self._consume(_TT_LPAREN)
            inner = self._expr()
            self._consume(_TT_RPAREN)
            return f"({inner})"

        if tok.type == _TT_IDENT:
            self._consume()
            # Field reference — qualify with alias
            return f"{self._alias}.{tok.value}"

        raise SyntaxError(f"Unexpected token {tok!r}")

    # ── argument list ──

    def _args(self) -> list[str]:
        """Parse comma-separated argument expressions inside ( ... )."""
        self._consume(_TT_LPAREN)
        args: list[str] = []
        if not self._match(_TT_RPAREN):
            args.append(self._expr())
            while self._match(_TT_COMMA):
                self._consume(_TT_COMMA)
                args.append(self._expr())
        self._consume(_TT_RPAREN)
        return args

    # ── raw field name (used for functions that need unqualified field) ──

    def _raw_field(self) -> str:
        """Consume an IDENT token and return its raw value (no alias prefix)."""
        tok = self._peek()
        if tok.type == _TT_IDENT:
            self._consume()
            return tok.value
        # Could also be a function call — fall back to normal expr
        return self._expr()

    # ── function dispatcher ──

    def _function_call(self) -> str:  # noqa: PLR0911, PLR0912
        name = self._consume(_TT_FUNC).value  # already uppercased in tokeniser
        alias = self._alias

        # ── aggregate functions ──
        if name in ("SUM", "COUNT", "AVG", "MIN", "MAX"):
            args = self._args()
            if len(args) != 1:
                raise SyntaxError(f"{name}() requires exactly 1 argument")
            field_sql = args[0]
            return f"{name}({field_sql})"

        # ── DIVIDE(a, b) ──
        if name == "DIVIDE":
            args = self._args()
            if len(args) != 2:
                raise SyntaxError("DIVIDE() requires exactly 2 arguments")
            a_sql, b_sql = args
            return (
                f"CASE WHEN ({b_sql}) = 0 THEN NULL "
                f"ELSE ({a_sql}) / NULLIF(({b_sql}), 0) END"
            )

        # ── IF(cond, true_val, false_val) ──
        if name == "IF":
            args = self._args()
            if len(args) != 3:
                raise SyntaxError("IF() requires exactly 3 arguments")
            cond, true_val, false_val = args
            return (
                f"CASE WHEN ({cond}) THEN ({true_val}) ELSE ({false_val}) END"
            )

        # ── SWITCH(expr, val1, result1, ..., else) ──
        if name == "SWITCH":
            args = self._args()
            if len(args) < 3:
                raise SyntaxError(
                    "SWITCH() requires at least 3 arguments: expr, val1, result1 [, ..., else]"
                )
            expr_sql = args[0]
            rest = args[1:]
            # If even number of remaining args → last is the ELSE
            # Pairs: (val, result), ..., [else]
            has_else = (len(rest) % 2) == 1
            pairs = rest[:-1] if has_else else rest
            else_val = rest[-1] if has_else else "NULL"

            whens = " ".join(
                f"WHEN ({expr_sql}) = ({pairs[i]}) THEN ({pairs[i + 1]})"
                for i in range(0, len(pairs), 2)
            )
            return f"CASE {whens} ELSE ({else_val}) END"

        # ── date part extraction ──
        if name in ("YEAR", "MONTH", "DAY"):
            args = self._args()
            if len(args) != 1:
                raise SyntaxError(f"{name}() requires exactly 1 argument")
            return f"EXTRACT({name} FROM {args[0]})"

        # ── NOW() ──
        if name == "NOW":
            self._consume(_TT_LPAREN)
            self._consume(_TT_RPAREN)
            return "NOW()"

        # ── DATEDIFF(unit, start_field, end_field) ──
        if name == "DATEDIFF":
            args = self._args()
            if len(args) != 3:
                raise SyntaxError("DATEDIFF() requires exactly 3 arguments: unit, start, end")
            unit_sql, start_sql, end_sql = args
            # unit is likely a string literal like 'day' — strip surrounding quotes
            unit_clean = unit_sql.strip("'\"")
            return f"EXTRACT({unit_clean} FROM AGE({end_sql}, {start_sql}))"

        # ── CONCATENATE(a, b) ──
        if name == "CONCATENATE":
            args = self._args()
            if len(args) != 2:
                raise SyntaxError("CONCATENATE() requires exactly 2 arguments")
            return f"({args[0]}) || ({args[1]})"

        # ── COALESCE(a, b) ──
        if name == "COALESCE":
            args = self._args()
            if len(args) != 2:
                raise SyntaxError("COALESCE() requires exactly 2 arguments")
            return f"COALESCE({args[0]}, {args[1]})"

        # ── DISTINCTCOUNT(field) ──
        if name == "DISTINCTCOUNT":
            args = self._args()
            if len(args) != 1:
                raise SyntaxError("DISTINCTCOUNT() requires exactly 1 argument")
            return f"COUNT(DISTINCT {args[0]})"

        # ── COUNTROWS() ──
        if name == "COUNTROWS":
            self._consume(_TT_LPAREN)
            self._consume(_TT_RPAREN)
            return "COUNT(*)"

        # ── FORMAT(value, fmt) ──
        if name == "FORMAT":
            args = self._args()
            if len(args) != 2:
                raise SyntaxError("FORMAT() requires exactly 2 arguments")
            return f"TO_CHAR({args[0]}, {args[1]})"

        # ── TOPN(n, field) ──
        if name == "TOPN":
            args = self._args()
            if len(args) != 2:
                raise SyntaxError("TOPN() requires exactly 2 arguments: n, field")
            n_sql, field_sql = args
            return (
                f"{field_sql} "
                f"/* TOPN: use ORDER BY {field_sql} DESC LIMIT {n_sql} in outer query */"
            )

        # ── RANKX(field) ──
        if name == "RANKX":
            args = self._args()
            if len(args) != 1:
                raise SyntaxError("RANKX() requires exactly 1 argument")
            return f"RANK() OVER (ORDER BY {args[0]} DESC)"

        # ── TODAY() — current date (no time) ──
        if name == "TODAY":
            self._consume(_TT_LPAREN)
            self._consume(_TT_RPAREN)
            return "CURRENT_DATE"

        # ── ISBLANK(field) — equivalent to IS NULL check ──
        if name == "ISBLANK":
            args = self._args()
            if len(args) != 1:
                raise SyntaxError("ISBLANK() requires exactly 1 argument")
            return f"(({args[0]}) IS NULL)"

        # ── EOMONTH(date_field, months_offset) — end of month after N months ──
        # EOMONTH(date_col, 0)  → last day of current month
        # EOMONTH(date_col, -1) → last day of previous month
        if name == "EOMONTH":
            args = self._args()
            if len(args) != 2:
                raise SyntaxError("EOMONTH() requires exactly 2 arguments: date_field, months_offset")
            date_sql, offset_sql = args
            return (
                f"(DATE_TRUNC('month', ({date_sql}) + ({offset_sql}) * INTERVAL '1 month')"
                f" + INTERVAL '1 month - 1 day')::DATE"
            )

        # ── DATEADD(date_field, n_periods, period_unit) ──
        # period_unit: 'day' | 'month' | 'quarter' | 'year'
        if name == "DATEADD":
            args = self._args()
            if len(args) != 3:
                raise SyntaxError(
                    "DATEADD() requires exactly 3 arguments: date_field, n_periods, period_unit"
                )
            date_sql, n_sql, unit_sql = args
            unit_clean = unit_sql.strip("'\"").lower()
            valid_units = {"day", "week", "month", "quarter", "year"}
            if unit_clean not in valid_units:
                raise SyntaxError(
                    f"DATEADD() unit must be one of {valid_units}, got {unit_clean!r}"
                )
            return f"(({date_sql}) + ({n_sql}) * INTERVAL '1 {unit_clean}')"

        # ── TOTALYTD(measure_expr, date_field) ──
        # Computes the running sum of measure_expr from the start of the year
        # to the current row's date. Implemented as a window function.
        if name == "TOTALYTD":
            args = self._args()
            if len(args) != 2:
                raise SyntaxError("TOTALYTD() requires exactly 2 arguments: measure_expr, date_field")
            measure_sql, date_sql = args
            return (
                f"SUM({measure_sql}) OVER ("
                f"PARTITION BY EXTRACT(YEAR FROM {date_sql}) "
                f"ORDER BY {date_sql} "
                f"ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)"
            )

        # ── SAMEPERIODLASTYEAR(date_field) ──
        # Returns the date shifted back by exactly one year.
        # Use in comparison expressions like:
        #   SUM(revenue) / SUM(revenue) WHERE date = SAMEPERIODLASTYEAR(order_date)
        if name == "SAMEPERIODLASTYEAR":
            args = self._args()
            if len(args) != 1:
                raise SyntaxError("SAMEPERIODLASTYEAR() requires exactly 1 argument: date_field")
            return f"(({args[0]}) - INTERVAL '1 year')"

        # ── CALCULATE(measure_expr, filter_expr) ──
        # In Power BI / DAX, CALCULATE modifies the filter context. In our SQL
        # compilation, we approximate it as a CASE WHEN (filter_expr) THEN measure_expr
        # END, effectively zeroing out rows that don't match the filter.
        if name == "CALCULATE":
            args = self._args()
            if len(args) != 2:
                raise SyntaxError(
                    "CALCULATE() requires exactly 2 arguments: measure_expr, filter_expr"
                )
            measure_sql, filter_sql = args
            return (
                f"SUM(CASE WHEN ({filter_sql}) THEN ({measure_sql}) ELSE 0 END)"
            )

        # ── FILTER(field, condition) ──
        # In DAX, FILTER returns a filtered table. In SQL we approximate as
        # a CASE expression that returns the field value when condition is true.
        if name == "FILTER":
            args = self._args()
            if len(args) != 2:
                raise SyntaxError("FILTER() requires exactly 2 arguments: field, condition")
            field_sql, condition_sql = args
            return f"CASE WHEN ({condition_sql}) THEN ({field_sql}) ELSE NULL END"

        # ── RELATED(field) ──
        # In DAX, RELATED follows a relationship to another table. In our
        # single-alias SQL model we treat it as a transparent pass-through
        # (the caller's alias is already applied). This works when the query
        # already joins the related table.
        if name == "RELATED":
            args = self._args()
            if len(args) != 1:
                raise SyntaxError("RELATED() requires exactly 1 argument: field")
            return args[0]  # pass-through — relationship must be pre-joined

        raise SyntaxError(f"Unknown function: {name!r}")


# ── Public class ──────────────────────────────────────────────────────────────

class FormulaEngine:
    """Compile DAX-like formula expressions to PostgreSQL SQL strings.

    Usage:
        fe = FormulaEngine()
        sql = fe.compile("DIVIDE(SUM(revenue), COUNT(customers))", table_alias="s")
        # → "SUM(s.revenue) / NULLIF((COUNT(s.customers)), 0)"

        ok, err = fe.validate("SUM(amount)")
        # → (True, "")
    """

    def compile(self, formula: str, table_alias: str = "t") -> str:
        """Compile a formula expression to a PostgreSQL SQL expression string.

        Args:
            formula:     The formula string, e.g. "DIVIDE(SUM(revenue), COUNT(orders))".
            table_alias: The SQL alias to use when qualifying field references.

        Returns:
            A SQL expression string suitable for use in SELECT, WHERE, or HAVING.

        Raises:
            SyntaxError: If the formula cannot be parsed.
        """
        formula = formula.strip()
        if not formula:
            raise SyntaxError("Empty formula")

        tokens = _tokenise(formula)
        parser = _Parser(tokens, alias=table_alias)
        return parser.parse()

    def validate(self, formula: str, table_alias: str = "t") -> tuple[bool, str]:
        """Attempt to compile the formula and report whether it is valid.

        Returns:
            (True, "")            — formula compiled successfully.
            (False, error_message) — compilation raised an error.
        """
        try:
            self.compile(formula, table_alias)
            return True, ""
        except SyntaxError as exc:
            return False, f"SyntaxError: {exc}"
        except Exception as exc:  # noqa: BLE001
            return False, f"Error: {exc}"


# ── Module-level singleton ────────────────────────────────────────────────────
formula_engine = FormulaEngine()
