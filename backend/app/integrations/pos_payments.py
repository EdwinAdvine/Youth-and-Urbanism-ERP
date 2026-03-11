"""POS payment processor integrations.

Provides an abstract base class and concrete implementations for:
- Manual payments (cash / manual card swipe)
- M-Pesa STK Push (Safaricom Daraja API)
- Stripe Terminal (in-person card payments)

All external HTTP calls use ``httpx.AsyncClient``.
"""
from __future__ import annotations

import base64
import logging
import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

import httpx

logger = logging.getLogger(__name__)


# ── Abstract Base ─────────────────────────────────────────────────────────────

class POSPaymentProcessor(ABC):
    """Base class for all POS payment gateway integrations."""

    def __init__(self, config: dict[str, Any]) -> None:
        self.config = config

    @abstractmethod
    async def initiate_payment(
        self,
        amount: Decimal,
        currency: str,
        reference: str,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """Start a payment and return a result dict.

        Returns
        -------
        dict with at least: ``payment_id``, ``status``, ``gateway``.
        """

    @abstractmethod
    async def check_status(self, payment_id: str) -> dict[str, Any]:
        """Query the current status of a payment.

        Returns
        -------
        dict with at least: ``payment_id``, ``status``.
        """

    @abstractmethod
    async def process_webhook(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Parse an inbound webhook/callback from the payment provider.

        Returns
        -------
        dict with at least: ``payment_id``, ``status``, ``raw``.
        """

    @abstractmethod
    async def refund(self, payment_id: str, amount: Decimal) -> dict[str, Any]:
        """Initiate a (partial or full) refund.

        Returns
        -------
        dict with at least: ``refund_id``, ``status``.
        """


# ── Manual / Cash Processor ──────────────────────────────────────────────────

class ManualProcessor(POSPaymentProcessor):
    """Instant completion processor for cash and manual-card payments."""

    async def initiate_payment(
        self,
        amount: Decimal,
        currency: str,
        reference: str,
        **kwargs: Any,
    ) -> dict[str, Any]:
        payment_id = str(uuid.uuid4())
        logger.info("Manual payment %s completed: %s %s", payment_id, currency, amount)
        return {
            "payment_id": payment_id,
            "status": "completed",
            "gateway": "manual",
            "amount": str(amount),
            "currency": currency,
            "reference": reference,
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }

    async def check_status(self, payment_id: str) -> dict[str, Any]:
        return {"payment_id": payment_id, "status": "completed", "gateway": "manual"}

    async def process_webhook(self, payload: dict[str, Any]) -> dict[str, Any]:
        # Manual payments have no webhooks
        return {"payment_id": None, "status": "completed", "raw": payload}

    async def refund(self, payment_id: str, amount: Decimal) -> dict[str, Any]:
        refund_id = str(uuid.uuid4())
        logger.info("Manual refund %s for payment %s: %s", refund_id, payment_id, amount)
        return {
            "refund_id": refund_id,
            "payment_id": payment_id,
            "status": "completed",
            "amount": str(amount),
            "gateway": "manual",
        }


# ── M-Pesa (Safaricom Daraja) ────────────────────────────────────────────────

class MpesaProcessor(POSPaymentProcessor):
    """Safaricom M-Pesa STK Push integration via the Daraja API.

    Required config keys:
    - ``consumer_key``
    - ``consumer_secret``
    - ``shortcode``
    - ``passkey``
    - ``callback_url``
    - ``environment`` (``"sandbox"`` or ``"production"``, default ``"sandbox"``)
    """

    SANDBOX_BASE = "https://sandbox.safaricom.co.ke"
    PRODUCTION_BASE = "https://api.safaricom.co.ke"

    # ── helpers ───────────────────────────────────────────────────────────

    @property
    def _base_url(self) -> str:
        env = self.config.get("environment", "sandbox")
        return self.PRODUCTION_BASE if env == "production" else self.SANDBOX_BASE

    async def _get_access_token(self, client: httpx.AsyncClient) -> str:
        """Fetch OAuth access token from Daraja."""
        consumer_key = self.config["consumer_key"]
        consumer_secret = self.config["consumer_secret"]
        credentials = base64.b64encode(
            f"{consumer_key}:{consumer_secret}".encode()
        ).decode()

        resp = await client.get(
            f"{self._base_url}/oauth/v1/generate?grant_type=client_credentials",
            headers={"Authorization": f"Basic {credentials}"},
            timeout=30.0,
        )
        resp.raise_for_status()
        return resp.json()["access_token"]

    def _generate_password(self, timestamp: str) -> str:
        """Generate the Daraja API password (Base64 of shortcode+passkey+timestamp)."""
        shortcode = self.config["shortcode"]
        passkey = self.config["passkey"]
        raw = f"{shortcode}{passkey}{timestamp}"
        return base64.b64encode(raw.encode()).decode()

    # ── interface implementation ──────────────────────────────────────────

    async def initiate_payment(
        self,
        amount: Decimal,
        currency: str,
        reference: str,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """Send an STK Push request to M-Pesa.

        Extra kwargs:
        - ``phone_number`` (str, required): subscriber MSISDN in 2547XXXXXXXX format.
        - ``description`` (str, optional): transaction description.
        """
        phone_number = kwargs.get("phone_number")
        if not phone_number:
            raise ValueError("phone_number is required for M-Pesa payments")

        description = kwargs.get("description", "POS Payment")
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        shortcode = self.config["shortcode"]
        password = self._generate_password(timestamp)
        callback_url = self.config["callback_url"]

        try:
            async with httpx.AsyncClient() as client:
                token = await self._get_access_token(client)
                payload = {
                    "BusinessShortCode": shortcode,
                    "Password": password,
                    "Timestamp": timestamp,
                    "TransactionType": "CustomerPayBillOnline",
                    "Amount": int(amount),
                    "PartyA": phone_number,
                    "PartyB": shortcode,
                    "PhoneNumber": phone_number,
                    "CallBackURL": callback_url,
                    "AccountReference": reference,
                    "TransactionDesc": description,
                }

                resp = await client.post(
                    f"{self._base_url}/mpesa/stkpush/v1/processrequest",
                    json=payload,
                    headers={"Authorization": f"Bearer {token}"},
                    timeout=30.0,
                )
                resp.raise_for_status()
                data = resp.json()

                logger.info("M-Pesa STK push initiated: %s", data.get("CheckoutRequestID"))
                return {
                    "payment_id": data.get("CheckoutRequestID", ""),
                    "merchant_request_id": data.get("MerchantRequestID", ""),
                    "status": "pending",
                    "gateway": "mpesa",
                    "response_code": data.get("ResponseCode", ""),
                    "response_description": data.get("ResponseDescription", ""),
                    "amount": str(amount),
                    "currency": currency,
                    "reference": reference,
                }
        except httpx.HTTPError as exc:
            logger.error("M-Pesa STK push failed: %s", exc)
            return {
                "payment_id": None,
                "status": "failed",
                "gateway": "mpesa",
                "error": str(exc),
            }

    async def check_status(self, payment_id: str) -> dict[str, Any]:
        """Query the status of an STK Push transaction."""
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        shortcode = self.config["shortcode"]
        password = self._generate_password(timestamp)

        try:
            async with httpx.AsyncClient() as client:
                token = await self._get_access_token(client)
                payload = {
                    "BusinessShortCode": shortcode,
                    "Password": password,
                    "Timestamp": timestamp,
                    "CheckoutRequestID": payment_id,
                }

                resp = await client.post(
                    f"{self._base_url}/mpesa/stkpushquery/v1/query",
                    json=payload,
                    headers={"Authorization": f"Bearer {token}"},
                    timeout=30.0,
                )
                resp.raise_for_status()
                data = resp.json()

                result_code = data.get("ResultCode")
                status = "completed" if result_code == "0" else "failed" if result_code else "pending"

                return {
                    "payment_id": payment_id,
                    "status": status,
                    "gateway": "mpesa",
                    "result_code": result_code,
                    "result_description": data.get("ResultDesc", ""),
                }
        except httpx.HTTPError as exc:
            logger.error("M-Pesa status query failed for %s: %s", payment_id, exc)
            return {
                "payment_id": payment_id,
                "status": "unknown",
                "gateway": "mpesa",
                "error": str(exc),
            }

    async def process_webhook(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Parse an M-Pesa STK Push callback.

        Expected structure::

            {
              "Body": {
                "stkCallback": {
                  "MerchantRequestID": "...",
                  "CheckoutRequestID": "...",
                  "ResultCode": 0,
                  "ResultDesc": "...",
                  "CallbackMetadata": { "Item": [...] }
                }
              }
            }
        """
        try:
            callback = payload.get("Body", {}).get("stkCallback", {})
            checkout_id = callback.get("CheckoutRequestID", "")
            result_code = callback.get("ResultCode")
            status = "completed" if result_code == 0 else "failed"

            metadata: dict[str, Any] = {}
            for item in (
                callback.get("CallbackMetadata", {}).get("Item", [])
            ):
                metadata[item.get("Name", "")] = item.get("Value")

            logger.info(
                "M-Pesa callback received: %s — %s", checkout_id, status
            )
            return {
                "payment_id": checkout_id,
                "merchant_request_id": callback.get("MerchantRequestID", ""),
                "status": status,
                "result_code": result_code,
                "result_description": callback.get("ResultDesc", ""),
                "mpesa_receipt": metadata.get("MpesaReceiptNumber"),
                "amount": metadata.get("Amount"),
                "phone_number": metadata.get("PhoneNumber"),
                "raw": payload,
            }
        except Exception as exc:
            logger.error("Failed to parse M-Pesa callback: %s", exc)
            return {
                "payment_id": None,
                "status": "error",
                "gateway": "mpesa",
                "error": str(exc),
                "raw": payload,
            }

    async def refund(self, payment_id: str, amount: Decimal) -> dict[str, Any]:
        """Initiate an M-Pesa transaction reversal."""
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        shortcode = self.config["shortcode"]

        try:
            async with httpx.AsyncClient() as client:
                token = await self._get_access_token(client)
                payload = {
                    "Initiator": self.config.get("initiator_name", "api"),
                    "SecurityCredential": self.config.get("security_credential", ""),
                    "CommandID": "TransactionReversal",
                    "TransactionID": payment_id,
                    "Amount": int(amount),
                    "ReceiverParty": shortcode,
                    "RecieverIdentifierType": "11",
                    "ResultURL": self.config.get(
                        "reversal_result_url",
                        self.config["callback_url"],
                    ),
                    "QueueTimeOutURL": self.config.get(
                        "reversal_timeout_url",
                        self.config["callback_url"],
                    ),
                    "Remarks": f"POS Refund for {payment_id}",
                    "Occasion": "POS Refund",
                }

                resp = await client.post(
                    f"{self._base_url}/mpesa/reversal/v1/request",
                    json=payload,
                    headers={"Authorization": f"Bearer {token}"},
                    timeout=30.0,
                )
                resp.raise_for_status()
                data = resp.json()

                logger.info("M-Pesa reversal initiated for %s", payment_id)
                return {
                    "refund_id": data.get("ConversationID", ""),
                    "payment_id": payment_id,
                    "status": "pending",
                    "gateway": "mpesa",
                    "response_code": data.get("ResponseCode", ""),
                    "response_description": data.get("ResponseDescription", ""),
                    "amount": str(amount),
                }
        except httpx.HTTPError as exc:
            logger.error("M-Pesa reversal failed for %s: %s", payment_id, exc)
            return {
                "refund_id": None,
                "payment_id": payment_id,
                "status": "failed",
                "gateway": "mpesa",
                "error": str(exc),
            }


# ── Stripe Terminal ───────────────────────────────────────────────────────────

class StripeTerminalProcessor(POSPaymentProcessor):
    """Stripe Terminal integration for in-person card payments.

    Required config keys:
    - ``api_key`` (Stripe secret key)
    - ``location_id`` (Stripe Terminal location, optional)
    - ``webhook_secret`` (for verifying Stripe webhook signatures, optional)
    """

    BASE_URL = "https://api.stripe.com/v1"

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.config['api_key']}",
            "Content-Type": "application/x-www-form-urlencoded",
        }

    async def initiate_payment(
        self,
        amount: Decimal,
        currency: str,
        reference: str,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """Create a Stripe PaymentIntent for Terminal use.

        Extra kwargs:
        - ``capture_method`` (str): ``"automatic"`` (default) or ``"manual"``.
        """
        capture_method = kwargs.get("capture_method", "automatic")
        # Stripe expects amounts in the smallest currency unit (cents)
        amount_cents = int(amount * 100)

        form_data = {
            "amount": str(amount_cents),
            "currency": currency.lower(),
            "payment_method_types[]": "card_present",
            "capture_method": capture_method,
            "metadata[reference]": reference,
            "metadata[source]": "urban_erp_pos",
        }

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    f"{self.BASE_URL}/payment_intents",
                    data=form_data,
                    headers=self._headers(),
                    timeout=30.0,
                )
                resp.raise_for_status()
                data = resp.json()

                logger.info("Stripe PaymentIntent created: %s", data.get("id"))
                return {
                    "payment_id": data["id"],
                    "client_secret": data.get("client_secret", ""),
                    "status": data.get("status", "requires_payment_method"),
                    "gateway": "stripe_terminal",
                    "amount": str(amount),
                    "currency": currency,
                    "reference": reference,
                }
        except httpx.HTTPError as exc:
            logger.error("Stripe PaymentIntent creation failed: %s", exc)
            return {
                "payment_id": None,
                "status": "failed",
                "gateway": "stripe_terminal",
                "error": str(exc),
            }

    async def check_status(self, payment_id: str) -> dict[str, Any]:
        """Retrieve the current status of a PaymentIntent."""
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    f"{self.BASE_URL}/payment_intents/{payment_id}",
                    headers=self._headers(),
                    timeout=30.0,
                )
                resp.raise_for_status()
                data = resp.json()

                # Map Stripe statuses to our status vocabulary
                stripe_status = data.get("status", "unknown")
                status_map = {
                    "succeeded": "completed",
                    "requires_payment_method": "pending",
                    "requires_confirmation": "pending",
                    "requires_action": "pending",
                    "processing": "processing",
                    "canceled": "cancelled",
                    "requires_capture": "authorized",
                }
                status = status_map.get(stripe_status, stripe_status)

                return {
                    "payment_id": payment_id,
                    "status": status,
                    "gateway": "stripe_terminal",
                    "stripe_status": stripe_status,
                    "amount": data.get("amount"),
                    "currency": data.get("currency"),
                }
        except httpx.HTTPError as exc:
            logger.error("Stripe status check failed for %s: %s", payment_id, exc)
            return {
                "payment_id": payment_id,
                "status": "unknown",
                "gateway": "stripe_terminal",
                "error": str(exc),
            }

    async def process_webhook(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Parse a Stripe webhook event payload.

        Expected structure::

            {
              "type": "payment_intent.succeeded",
              "data": {
                "object": { "id": "pi_...", "status": "succeeded", ... }
              }
            }
        """
        try:
            event_type = payload.get("type", "")
            obj = payload.get("data", {}).get("object", {})
            payment_id = obj.get("id", "")
            stripe_status = obj.get("status", "")

            status_map = {
                "payment_intent.succeeded": "completed",
                "payment_intent.payment_failed": "failed",
                "payment_intent.canceled": "cancelled",
                "payment_intent.requires_action": "pending",
            }
            status = status_map.get(event_type, stripe_status)

            logger.info("Stripe webhook received: %s — %s", event_type, payment_id)
            return {
                "payment_id": payment_id,
                "status": status,
                "event_type": event_type,
                "gateway": "stripe_terminal",
                "amount": obj.get("amount"),
                "currency": obj.get("currency"),
                "raw": payload,
            }
        except Exception as exc:
            logger.error("Failed to parse Stripe webhook: %s", exc)
            return {
                "payment_id": None,
                "status": "error",
                "gateway": "stripe_terminal",
                "error": str(exc),
                "raw": payload,
            }

    async def refund(self, payment_id: str, amount: Decimal) -> dict[str, Any]:
        """Create a Stripe refund for a PaymentIntent."""
        amount_cents = int(amount * 100)

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    f"{self.BASE_URL}/refunds",
                    data={
                        "payment_intent": payment_id,
                        "amount": str(amount_cents),
                        "metadata[source]": "urban_erp_pos",
                    },
                    headers=self._headers(),
                    timeout=30.0,
                )
                resp.raise_for_status()
                data = resp.json()

                logger.info("Stripe refund created: %s for %s", data.get("id"), payment_id)
                return {
                    "refund_id": data["id"],
                    "payment_id": payment_id,
                    "status": data.get("status", "pending"),
                    "gateway": "stripe_terminal",
                    "amount": str(amount),
                }
        except httpx.HTTPError as exc:
            logger.error("Stripe refund failed for %s: %s", payment_id, exc)
            return {
                "refund_id": None,
                "payment_id": payment_id,
                "status": "failed",
                "gateway": "stripe_terminal",
                "error": str(exc),
            }


# ── Factory ───────────────────────────────────────────────────────────────────

_PROCESSOR_REGISTRY: dict[str, type[POSPaymentProcessor]] = {
    "manual": ManualProcessor,
    "cash": ManualProcessor,
    "card_manual": ManualProcessor,
    "mpesa": MpesaProcessor,
    "m-pesa": MpesaProcessor,
    "mobile_money": MpesaProcessor,
    "stripe_terminal": StripeTerminalProcessor,
    "stripe": StripeTerminalProcessor,
}


def get_payment_processor(
    gateway_type: str, config: dict[str, Any]
) -> POSPaymentProcessor:
    """Instantiate and return the correct payment processor for *gateway_type*.

    Parameters
    ----------
    gateway_type:
        One of ``"manual"``, ``"cash"``, ``"card_manual"``, ``"mpesa"``,
        ``"m-pesa"``, ``"mobile_money"``, ``"stripe_terminal"``, ``"stripe"``.
    config:
        Gateway-specific configuration dict (API keys, secrets, etc.).

    Raises
    ------
    ValueError
        If *gateway_type* is not recognised.
    """
    cls = _PROCESSOR_REGISTRY.get(gateway_type.lower())
    if cls is None:
        supported = ", ".join(sorted(_PROCESSOR_REGISTRY.keys()))
        raise ValueError(
            f"Unknown payment gateway type '{gateway_type}'. "
            f"Supported: {supported}"
        )
    return cls(config)
