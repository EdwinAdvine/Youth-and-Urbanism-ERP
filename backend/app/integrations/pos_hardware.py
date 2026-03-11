"""POS hardware driver integrations.

Provides abstract base classes and implementations for:
- Receipt printers (ESC/POS thermal, Star Micronics)
- Barcode scanners (HID / serial)
- Weigh scales (USB)

All drivers are designed to be graceful — errors are logged, never raised to
crash the POS terminal.  Hardware unavailability degrades to a logged warning
rather than an exception.
"""
from __future__ import annotations

import asyncio
import logging
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

logger = logging.getLogger(__name__)


# ── Abstract Base ─────────────────────────────────────────────────────────────

class HardwareDriver(ABC):
    """Base class for all POS hardware device drivers."""

    def __init__(self, config: dict[str, Any]) -> None:
        self.config = config
        self._connected = False

    @abstractmethod
    async def connect(self) -> bool:
        """Attempt to connect to the device.  Returns ``True`` on success."""

    @abstractmethod
    async def disconnect(self) -> None:
        """Gracefully close the device connection."""

    @abstractmethod
    async def status(self) -> dict[str, Any]:
        """Return current device status.

        Returns
        -------
        dict with at least: ``connected``, ``device_type``, ``info``.
        """


# ── Receipt Printer (abstract) ───────────────────────────────────────────────

class ReceiptPrinter(HardwareDriver):
    """Abstract receipt printer with common POS operations."""

    @abstractmethod
    async def print_receipt(self, receipt_data: dict[str, Any]) -> bool:
        """Format and print a receipt.  Returns ``True`` on success.

        Expected ``receipt_data`` keys::

            {
              "header": {"store_name": str, "address": str, "phone": str},
              "transaction_number": str,
              "cashier_name": str,
              "items": [
                {"name": str, "qty": int, "unit_price": str, "total": str}
              ],
              "subtotal": str,
              "discount": str | None,
              "tax": str,
              "total": str,
              "payments": [{"method": str, "amount": str}],
              "footer": {"message": str} | None,
              "barcode": str | None,
            }
        """

    @abstractmethod
    async def open_cash_drawer(self) -> bool:
        """Send a pulse to open the attached cash drawer.  Returns ``True`` on success."""

    @abstractmethod
    async def cut_paper(self) -> None:
        """Send a paper-cut command to the printer."""


# ── ESC/POS Printer ──────────────────────────────────────────────────────────

class ESCPOSPrinter(ReceiptPrinter):
    """Driver for ESC/POS compatible thermal receipt printers.

    Supports USB and network connections.

    Config keys:
    - ``connection_type``: ``"network"`` or ``"usb"``
    - For network: ``host``, ``port`` (default 9100)
    - For USB: ``vendor_id``, ``product_id``
    - ``char_width`` (int, default 48): printable character width per line
    """

    # ── ESC/POS command constants ─────────────────────────────────────────

    ESC = b"\x1b"
    GS = b"\x1d"
    LF = b"\x0a"

    # Initialise printer
    CMD_INIT = ESC + b"\x40"
    # Text alignment
    CMD_ALIGN_LEFT = ESC + b"\x61\x00"
    CMD_ALIGN_CENTER = ESC + b"\x61\x01"
    CMD_ALIGN_RIGHT = ESC + b"\x61\x02"
    # Text emphasis
    CMD_BOLD_ON = ESC + b"\x45\x01"
    CMD_BOLD_OFF = ESC + b"\x45\x00"
    CMD_DOUBLE_HEIGHT_ON = ESC + b"\x21\x10"
    CMD_DOUBLE_HEIGHT_OFF = ESC + b"\x21\x00"
    # Paper cut
    CMD_CUT_FULL = GS + b"\x56\x00"
    CMD_CUT_PARTIAL = GS + b"\x56\x01"
    # Cash drawer pulse (pin 2)
    CMD_CASH_DRAWER = ESC + b"\x70\x00\x19\x78"
    # Barcode: CODE128
    CMD_BARCODE_HEIGHT = GS + b"\x68\x50"  # height 80 dots
    CMD_BARCODE_WIDTH = GS + b"\x77\x02"  # width multiplier 2
    CMD_BARCODE_CODE128 = GS + b"\x6b\x49"  # CODE128 type

    def __init__(self, config: dict[str, Any]) -> None:
        super().__init__(config)
        self._writer: asyncio.StreamWriter | None = None
        self._reader: asyncio.StreamReader | None = None
        self._char_width: int = config.get("char_width", 48)

    # ── connection ────────────────────────────────────────────────────────

    async def connect(self) -> bool:
        conn_type = self.config.get("connection_type", "network")
        try:
            if conn_type == "network":
                host = self.config.get("host", "127.0.0.1")
                port = int(self.config.get("port", 9100))
                self._reader, self._writer = await asyncio.wait_for(
                    asyncio.open_connection(host, port),
                    timeout=5.0,
                )
            elif conn_type == "usb":
                # USB connections would require python-escpos or pyusb.
                # We log a placeholder — real USB access needs platform-specific
                # setup (udev rules on Linux, etc.).
                logger.warning(
                    "ESC/POS USB connection requested (vendor=%s product=%s). "
                    "USB support requires python-escpos; using stub.",
                    self.config.get("vendor_id"),
                    self.config.get("product_id"),
                )
                self._connected = True
                return True
            else:
                logger.error("Unknown ESC/POS connection type: %s", conn_type)
                return False

            self._connected = True
            logger.info("ESC/POS printer connected (%s)", conn_type)
            return True
        except Exception as exc:
            logger.error("ESC/POS printer connection failed: %s", exc)
            self._connected = False
            return False

    async def disconnect(self) -> None:
        if self._writer:
            try:
                self._writer.close()
                await self._writer.wait_closed()
            except Exception as exc:
                logger.warning("Error disconnecting ESC/POS printer: %s", exc)
            finally:
                self._writer = None
                self._reader = None
        self._connected = False

    async def status(self) -> dict[str, Any]:
        return {
            "connected": self._connected,
            "device_type": "escpos_printer",
            "connection_type": self.config.get("connection_type", "network"),
            "info": {
                "host": self.config.get("host"),
                "port": self.config.get("port"),
                "char_width": self._char_width,
            },
        }

    # ── internal helpers ──────────────────────────────────────────────────

    async def _write(self, data: bytes) -> None:
        """Send raw bytes to the printer."""
        if self._writer:
            self._writer.write(data)
            await self._writer.drain()
        else:
            logger.debug("ESC/POS _write called but no writer (USB stub or disconnected)")

    def _line(self, left: str, right: str = "") -> bytes:
        """Format a two-column line padded to ``_char_width``."""
        if right:
            space = self._char_width - len(left) - len(right)
            if space < 1:
                space = 1
            return (left + " " * space + right + "\n").encode("cp437", errors="replace")
        return (left + "\n").encode("cp437", errors="replace")

    def _separator(self, char: str = "-") -> bytes:
        return (char * self._char_width + "\n").encode("cp437", errors="replace")

    # ── public API ────────────────────────────────────────────────────────

    async def print_receipt(self, receipt_data: dict[str, Any]) -> bool:
        if not self._connected:
            logger.warning("ESC/POS printer not connected — skipping print")
            return False

        try:
            buf = bytearray()
            buf.extend(self.CMD_INIT)

            # Header
            header = receipt_data.get("header", {})
            buf.extend(self.CMD_ALIGN_CENTER)
            buf.extend(self.CMD_BOLD_ON)
            buf.extend(self.CMD_DOUBLE_HEIGHT_ON)
            buf.extend((header.get("store_name", "Store") + "\n").encode("cp437", errors="replace"))
            buf.extend(self.CMD_DOUBLE_HEIGHT_OFF)
            buf.extend(self.CMD_BOLD_OFF)
            if header.get("address"):
                buf.extend((header["address"] + "\n").encode("cp437", errors="replace"))
            if header.get("phone"):
                buf.extend((header["phone"] + "\n").encode("cp437", errors="replace"))
            buf.extend(self.LF)

            # Transaction info
            buf.extend(self.CMD_ALIGN_LEFT)
            txn = receipt_data.get("transaction_number", "")
            now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M")
            buf.extend(self._line(f"Txn: {txn}", now))
            if receipt_data.get("cashier_name"):
                buf.extend(self._line(f"Cashier: {receipt_data['cashier_name']}"))
            buf.extend(self._separator())

            # Items
            for item in receipt_data.get("items", []):
                name = item.get("name", "")
                qty = item.get("qty", 1)
                unit_price = item.get("unit_price", "0.00")
                total = item.get("total", "0.00")
                buf.extend(self._line(f"{qty}x {name}", total))
                if qty > 1:
                    buf.extend(self._line(f"   @ {unit_price} each"))

            buf.extend(self._separator())

            # Totals
            buf.extend(self._line("Subtotal", receipt_data.get("subtotal", "0.00")))
            if receipt_data.get("discount"):
                buf.extend(self._line("Discount", f"-{receipt_data['discount']}"))
            buf.extend(self._line("Tax", receipt_data.get("tax", "0.00")))
            buf.extend(self._separator("="))
            buf.extend(self.CMD_BOLD_ON)
            buf.extend(self.CMD_DOUBLE_HEIGHT_ON)
            buf.extend(self._line("TOTAL", receipt_data.get("total", "0.00")))
            buf.extend(self.CMD_DOUBLE_HEIGHT_OFF)
            buf.extend(self.CMD_BOLD_OFF)
            buf.extend(self._separator())

            # Payments
            for pmt in receipt_data.get("payments", []):
                buf.extend(self._line(pmt.get("method", ""), pmt.get("amount", "")))
            buf.extend(self.LF)

            # Footer
            footer = receipt_data.get("footer", {})
            if footer and footer.get("message"):
                buf.extend(self.CMD_ALIGN_CENTER)
                buf.extend((footer["message"] + "\n").encode("cp437", errors="replace"))
                buf.extend(self.LF)

            # Barcode
            barcode_value = receipt_data.get("barcode")
            if barcode_value:
                buf.extend(self.CMD_ALIGN_CENTER)
                buf.extend(self.CMD_BARCODE_HEIGHT)
                buf.extend(self.CMD_BARCODE_WIDTH)
                barcode_bytes = barcode_value.encode("ascii", errors="ignore")
                buf.extend(self.CMD_BARCODE_CODE128)
                buf.extend(bytes([len(barcode_bytes)]))
                buf.extend(barcode_bytes)
                buf.extend(self.LF)

            # Feed and cut
            buf.extend(self.LF * 4)
            buf.extend(self.CMD_CUT_PARTIAL)

            await self._write(bytes(buf))
            logger.info("Receipt printed: %s", txn)
            return True
        except Exception as exc:
            logger.error("ESC/POS print_receipt failed: %s", exc)
            return False

    async def open_cash_drawer(self) -> bool:
        if not self._connected:
            logger.warning("ESC/POS printer not connected — cannot open cash drawer")
            return False
        try:
            await self._write(self.CMD_CASH_DRAWER)
            logger.info("Cash drawer opened via ESC/POS")
            return True
        except Exception as exc:
            logger.error("ESC/POS open_cash_drawer failed: %s", exc)
            return False

    async def cut_paper(self) -> None:
        if not self._connected:
            return
        try:
            await self._write(self.LF * 3 + self.CMD_CUT_PARTIAL)
        except Exception as exc:
            logger.error("ESC/POS cut_paper failed: %s", exc)


# ── Star Micronics Printer ────────────────────────────────────────────────────

class StarPrinter(ReceiptPrinter):
    """Driver for Star Micronics receipt printers using Star Line Mode.

    Config keys:
    - ``host``, ``port`` (default 9100): network connection
    - ``char_width`` (int, default 48)
    """

    # Star Line Mode commands
    ESC = b"\x1b"
    CMD_INIT = ESC + b"\x40"
    CMD_ALIGN_LEFT = ESC + b"\x1d\x61\x00"
    CMD_ALIGN_CENTER = ESC + b"\x1d\x61\x01"
    CMD_BOLD_ON = ESC + b"\x45"
    CMD_BOLD_OFF = ESC + b"\x46"
    CMD_LARGE_ON = ESC + b"\x69\x01\x01"
    CMD_LARGE_OFF = ESC + b"\x69\x00\x00"
    CMD_CUT_PARTIAL = ESC + b"\x64\x02"
    CMD_CASH_DRAWER = b"\x07"  # BEL character — Star cash drawer kick

    def __init__(self, config: dict[str, Any]) -> None:
        super().__init__(config)
        self._writer: asyncio.StreamWriter | None = None
        self._reader: asyncio.StreamReader | None = None
        self._char_width: int = config.get("char_width", 48)

    async def connect(self) -> bool:
        host = self.config.get("host", "127.0.0.1")
        port = int(self.config.get("port", 9100))
        try:
            self._reader, self._writer = await asyncio.wait_for(
                asyncio.open_connection(host, port),
                timeout=5.0,
            )
            self._connected = True
            logger.info("Star printer connected at %s:%s", host, port)
            return True
        except Exception as exc:
            logger.error("Star printer connection failed: %s", exc)
            self._connected = False
            return False

    async def disconnect(self) -> None:
        if self._writer:
            try:
                self._writer.close()
                await self._writer.wait_closed()
            except Exception as exc:
                logger.warning("Error disconnecting Star printer: %s", exc)
            finally:
                self._writer = None
                self._reader = None
        self._connected = False

    async def status(self) -> dict[str, Any]:
        return {
            "connected": self._connected,
            "device_type": "star_printer",
            "info": {
                "host": self.config.get("host"),
                "port": self.config.get("port"),
                "char_width": self._char_width,
            },
        }

    async def _write(self, data: bytes) -> None:
        if self._writer:
            self._writer.write(data)
            await self._writer.drain()

    def _line(self, left: str, right: str = "") -> bytes:
        if right:
            space = self._char_width - len(left) - len(right)
            if space < 1:
                space = 1
            return (left + " " * space + right + "\n").encode("cp437", errors="replace")
        return (left + "\n").encode("cp437", errors="replace")

    def _separator(self, char: str = "-") -> bytes:
        return (char * self._char_width + "\n").encode("cp437", errors="replace")

    async def print_receipt(self, receipt_data: dict[str, Any]) -> bool:
        if not self._connected:
            logger.warning("Star printer not connected — skipping print")
            return False

        try:
            buf = bytearray()
            buf.extend(self.CMD_INIT)

            # Header
            header = receipt_data.get("header", {})
            buf.extend(self.CMD_ALIGN_CENTER)
            buf.extend(self.CMD_BOLD_ON)
            buf.extend(self.CMD_LARGE_ON)
            buf.extend((header.get("store_name", "Store") + "\n").encode("cp437", errors="replace"))
            buf.extend(self.CMD_LARGE_OFF)
            buf.extend(self.CMD_BOLD_OFF)
            if header.get("address"):
                buf.extend((header["address"] + "\n").encode("cp437", errors="replace"))
            if header.get("phone"):
                buf.extend((header["phone"] + "\n").encode("cp437", errors="replace"))
            buf.extend(b"\n")

            # Transaction info
            buf.extend(self.CMD_ALIGN_LEFT)
            txn = receipt_data.get("transaction_number", "")
            now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M")
            buf.extend(self._line(f"Txn: {txn}", now))
            if receipt_data.get("cashier_name"):
                buf.extend(self._line(f"Cashier: {receipt_data['cashier_name']}"))
            buf.extend(self._separator())

            # Items
            for item in receipt_data.get("items", []):
                name = item.get("name", "")
                qty = item.get("qty", 1)
                unit_price = item.get("unit_price", "0.00")
                total = item.get("total", "0.00")
                buf.extend(self._line(f"{qty}x {name}", total))
                if qty > 1:
                    buf.extend(self._line(f"   @ {unit_price} each"))

            buf.extend(self._separator())

            # Totals
            buf.extend(self._line("Subtotal", receipt_data.get("subtotal", "0.00")))
            if receipt_data.get("discount"):
                buf.extend(self._line("Discount", f"-{receipt_data['discount']}"))
            buf.extend(self._line("Tax", receipt_data.get("tax", "0.00")))
            buf.extend(self._separator("="))
            buf.extend(self.CMD_BOLD_ON)
            buf.extend(self.CMD_LARGE_ON)
            buf.extend(self._line("TOTAL", receipt_data.get("total", "0.00")))
            buf.extend(self.CMD_LARGE_OFF)
            buf.extend(self.CMD_BOLD_OFF)
            buf.extend(self._separator())

            # Payments
            for pmt in receipt_data.get("payments", []):
                buf.extend(self._line(pmt.get("method", ""), pmt.get("amount", "")))
            buf.extend(b"\n")

            # Footer
            footer = receipt_data.get("footer", {})
            if footer and footer.get("message"):
                buf.extend(self.CMD_ALIGN_CENTER)
                buf.extend((footer["message"] + "\n").encode("cp437", errors="replace"))
                buf.extend(b"\n")

            # Feed and cut
            buf.extend(b"\n" * 4)
            buf.extend(self.CMD_CUT_PARTIAL)

            await self._write(bytes(buf))
            logger.info("Star receipt printed: %s", txn)
            return True
        except Exception as exc:
            logger.error("Star print_receipt failed: %s", exc)
            return False

    async def open_cash_drawer(self) -> bool:
        if not self._connected:
            logger.warning("Star printer not connected — cannot open cash drawer")
            return False
        try:
            await self._write(self.CMD_CASH_DRAWER)
            logger.info("Cash drawer opened via Star printer")
            return True
        except Exception as exc:
            logger.error("Star open_cash_drawer failed: %s", exc)
            return False

    async def cut_paper(self) -> None:
        if not self._connected:
            return
        try:
            await self._write(b"\n" * 3 + self.CMD_CUT_PARTIAL)
        except Exception as exc:
            logger.error("Star cut_paper failed: %s", exc)


# ── Barcode Scanner ───────────────────────────────────────────────────────────

class BarcodeScanner(HardwareDriver):
    """Placeholder driver for HID / serial barcode scanners.

    Most USB barcode scanners operate in HID keyboard-emulation mode and
    require no special driver (input goes straight to the focused text field).
    This class provides a structured interface for scanners that use a serial
    or proprietary protocol.

    Config keys:
    - ``connection_type``: ``"hid"`` (default, no-op) or ``"serial"``
    - For serial: ``port`` (e.g. ``"/dev/ttyUSB0"``), ``baud_rate`` (default 9600)
    """

    async def connect(self) -> bool:
        conn_type = self.config.get("connection_type", "hid")
        if conn_type == "hid":
            logger.info(
                "Barcode scanner in HID mode — no explicit connection needed. "
                "Input will arrive as keyboard events."
            )
            self._connected = True
            return True
        elif conn_type == "serial":
            port = self.config.get("port", "/dev/ttyUSB0")
            logger.info(
                "Barcode scanner serial mode requested (port=%s). "
                "Serial support requires pyserial; marking as connected stub.",
                port,
            )
            self._connected = True
            return True
        else:
            logger.error("Unknown barcode scanner connection type: %s", conn_type)
            return False

    async def disconnect(self) -> None:
        self._connected = False
        logger.info("Barcode scanner disconnected")

    async def status(self) -> dict[str, Any]:
        return {
            "connected": self._connected,
            "device_type": "barcode_scanner",
            "connection_type": self.config.get("connection_type", "hid"),
            "info": {
                "port": self.config.get("port"),
                "baud_rate": self.config.get("baud_rate", 9600),
            },
        }

    async def read_barcode(self) -> str | None:
        """Read a barcode value from the scanner.

        For HID-mode scanners this is a no-op (the OS delivers keystrokes
        directly).  For serial scanners this would read from the serial port.

        Returns
        -------
        The scanned barcode string, or ``None`` if no scan available.
        """
        if not self._connected:
            logger.warning("Barcode scanner not connected")
            return None

        conn_type = self.config.get("connection_type", "hid")
        if conn_type == "hid":
            # HID scanners deliver input via the OS keyboard buffer.
            # This method is intentionally a no-op for HID mode.
            logger.debug("Barcode read requested in HID mode — use keyboard input")
            return None
        elif conn_type == "serial":
            # Placeholder for pyserial read with timeout
            logger.debug("Barcode serial read — stub implementation")
            return None
        return None


# ── Weigh Scale ───────────────────────────────────────────────────────────────

class WeighScale(HardwareDriver):
    """Placeholder driver for USB weigh scales.

    Many POS weigh scales present as USB HID devices using a standard
    protocol.  This class provides a structured interface.

    Config keys:
    - ``vendor_id``, ``product_id``: USB device identifiers
    - ``unit``: default weight unit (``"kg"``, ``"lb"``, ``"g"``, default ``"kg"``)
    """

    UNIT_MAP: dict[int, str] = {
        2: "g",
        3: "kg",
        11: "oz",
        12: "lb",
    }

    async def connect(self) -> bool:
        vendor_id = self.config.get("vendor_id")
        product_id = self.config.get("product_id")
        logger.info(
            "Weigh scale connection requested (vendor=%s product=%s). "
            "USB HID scale support requires pyusb/hidapi; marking as connected stub.",
            vendor_id,
            product_id,
        )
        self._connected = True
        return True

    async def disconnect(self) -> None:
        self._connected = False
        logger.info("Weigh scale disconnected")

    async def status(self) -> dict[str, Any]:
        return {
            "connected": self._connected,
            "device_type": "weigh_scale",
            "info": {
                "vendor_id": self.config.get("vendor_id"),
                "product_id": self.config.get("product_id"),
                "unit": self.config.get("unit", "kg"),
            },
        }

    async def read_weight(self) -> dict[str, Any]:
        """Read the current weight from the scale.

        Returns
        -------
        dict with keys: ``value`` (Decimal or None), ``unit`` (str), ``stable``
        (bool — whether the reading is stable).

        In stub mode, returns zero weight.
        """
        if not self._connected:
            logger.warning("Weigh scale not connected")
            return {"value": None, "unit": self.config.get("unit", "kg"), "stable": False}

        # Placeholder: real implementation would read 6-byte HID report:
        #   byte 0 = report ID, byte 1 = status (stable=4, motion=5),
        #   byte 2 = unit, bytes 3-4 = scaling factor, bytes 4-5 = weight
        logger.debug("Weigh scale read — stub, returning zero")
        return {
            "value": Decimal("0.000"),
            "unit": self.config.get("unit", "kg"),
            "stable": True,
        }


# ── Factory ───────────────────────────────────────────────────────────────────

_DRIVER_REGISTRY: dict[str, type[HardwareDriver]] = {
    "escpos_printer": ESCPOSPrinter,
    "escpos": ESCPOSPrinter,
    "thermal_printer": ESCPOSPrinter,
    "star_printer": StarPrinter,
    "star": StarPrinter,
    "barcode_scanner": BarcodeScanner,
    "scanner": BarcodeScanner,
    "weigh_scale": WeighScale,
    "scale": WeighScale,
}


def get_hardware_driver(
    device_type: str, config: dict[str, Any]
) -> HardwareDriver:
    """Instantiate and return the correct hardware driver for *device_type*.

    Parameters
    ----------
    device_type:
        One of ``"escpos_printer"``, ``"escpos"``, ``"thermal_printer"``,
        ``"star_printer"``, ``"star"``, ``"barcode_scanner"``, ``"scanner"``,
        ``"weigh_scale"``, ``"scale"``.
    config:
        Device-specific configuration dict (host, port, vendor IDs, etc.).

    Raises
    ------
    ValueError
        If *device_type* is not recognised.
    """
    cls = _DRIVER_REGISTRY.get(device_type.lower())
    if cls is None:
        supported = ", ".join(sorted(_DRIVER_REGISTRY.keys()))
        raise ValueError(
            f"Unknown hardware device type '{device_type}'. "
            f"Supported: {supported}"
        )
    return cls(config)
