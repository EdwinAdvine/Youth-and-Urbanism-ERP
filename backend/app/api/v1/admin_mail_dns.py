"""Admin Mail DNS Configuration — DNS record guidance and verification.

Provides endpoints for Super Admins to:
- View required DNS records (MX, SPF, DKIM, DMARC)
- Verify DNS records are properly configured
- Check TLS certificate status
"""
from __future__ import annotations

import asyncio
import logging
import socket
import ssl
from pathlib import Path
from typing import Any

from fastapi import APIRouter

from app.core.config import settings
from app.core.deps import SuperAdminUser

logger = logging.getLogger(__name__)
router = APIRouter()


def _get_dkim_public_key() -> str | None:
    """Read the DKIM private key and extract/derive public key info."""
    key_path = settings.DKIM_PRIVATE_KEY_PATH
    if not key_path:
        return None
    path = Path(key_path)
    if not path.exists():
        return None
    try:
        content = path.read_text()
        # If it is a PEM-encoded RSA key, extract the public key portion
        # In production you would derive the actual public key; for the config
        # guide we return a placeholder directing the admin to use openssl.
        if "PRIVATE KEY" in content:
            return (
                "Run: openssl rsa -in {key_path} -pubout -outform DER 2>/dev/null | "
                "openssl base64 -A  to get the p= value for your DKIM DNS record."
            )
        return content.strip()
    except Exception as exc:
        logger.warning("Failed to read DKIM key: %s", exc)
        return None


@router.get("/dns-config", summary="Get required DNS records for mail")
async def get_dns_config(current_user: SuperAdminUser) -> dict[str, Any]:
    """Return the DNS records that must be configured for the mail domain.

    Generates MX, SPF, DKIM, and DMARC records based on the current settings.
    """
    domain = settings.MAIL_DOMAIN
    smtp_host = settings.SMTP_HOST

    # MX record
    mx_record = {
        "type": "MX",
        "host": domain,
        "value": f"10 {smtp_host}.",
        "description": f"Points mail for @{domain} to your SMTP server.",
    }

    # SPF record
    spf_record = {
        "type": "TXT",
        "host": domain,
        "value": f"v=spf1 mx a:{smtp_host} ~all",
        "description": "Authorises your server to send mail for this domain.",
    }

    # DKIM record
    dkim_public_key = _get_dkim_public_key()
    dkim_record = {
        "type": "TXT",
        "host": f"urban._domainkey.{domain}",
        "value": f"v=DKIM1; k=rsa; p={dkim_public_key or '<YOUR_PUBLIC_KEY>'}",
        "description": (
            "DKIM signing record. Replace <YOUR_PUBLIC_KEY> with the base64-encoded "
            "RSA public key extracted from your DKIM private key."
        ),
        "key_configured": dkim_public_key is not None,
    }

    # DMARC record
    dmarc_record = {
        "type": "TXT",
        "host": f"_dmarc.{domain}",
        "value": f"v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@{domain}; pct=100",
        "description": "DMARC policy telling receivers to quarantine unauthenticated mail.",
    }

    # Reverse DNS (PTR) guidance
    ptr_record = {
        "type": "PTR",
        "host": "<your-server-ip>",
        "value": f"{smtp_host}.",
        "description": (
            "Reverse DNS for your server IP. Must be set by your hosting provider. "
            "Required for good deliverability."
        ),
    }

    return {
        "domain": domain,
        "smtp_host": smtp_host,
        "records": [mx_record, spf_record, dkim_record, dmarc_record, ptr_record],
        "notes": [
            "All TXT records must be added to your DNS provider's dashboard.",
            "MX record ensures inbound mail is routed to your server.",
            "SPF prevents spoofing by listing authorised senders.",
            "DKIM adds a cryptographic signature to outgoing mail.",
            "DMARC tells receivers what to do with unauthenticated mail.",
            "PTR (reverse DNS) must be configured at your hosting provider.",
            f"Configure DKIM_PRIVATE_KEY_PATH in .env to point to your RSA private key file.",
        ],
    }


@router.post("/verify-dns", summary="Verify DNS records are configured")
async def verify_dns(current_user: SuperAdminUser) -> dict[str, Any]:
    """Check whether the required DNS records exist and have correct values.

    Uses ``socket.getaddrinfo`` and ``dns.resolver`` (if available) for lookups.
    Falls back to basic socket lookups when the ``dnspython`` package is not installed.
    """
    import asyncio
    domain = settings.MAIL_DOMAIN
    results: dict[str, dict[str, Any]] = {}

    # Try to use dnspython for proper DNS lookups
    try:
        import dns.resolver  # type: ignore[import-untyped]
        resolver = dns.resolver.Resolver()
        resolver.timeout = 5
        resolver.lifetime = 10

        # MX check
        try:
            mx_answers = resolver.resolve(domain, "MX")
            mx_values = [str(r.exchange).rstrip(".") for r in mx_answers]
            results["MX"] = {
                "found": True,
                "values": mx_values,
                "expected_contains": settings.SMTP_HOST,
                "valid": any(settings.SMTP_HOST in v for v in mx_values),
            }
        except Exception as exc:
            results["MX"] = {"found": False, "error": str(exc), "valid": False}

        # SPF check (TXT on domain)
        try:
            txt_answers = resolver.resolve(domain, "TXT")
            txt_values = [str(r).strip('"') for r in txt_answers]
            spf_records = [v for v in txt_values if v.startswith("v=spf1")]
            results["SPF"] = {
                "found": bool(spf_records),
                "values": spf_records,
                "valid": any(settings.SMTP_HOST in v for v in spf_records),
            }
        except Exception as exc:
            results["SPF"] = {"found": False, "error": str(exc), "valid": False}

        # DKIM check
        dkim_host = f"urban._domainkey.{domain}"
        try:
            dkim_answers = resolver.resolve(dkim_host, "TXT")
            dkim_values = [str(r).strip('"') for r in dkim_answers]
            dkim_records = [v for v in dkim_values if "DKIM1" in v]
            results["DKIM"] = {
                "found": bool(dkim_records),
                "values": dkim_records,
                "valid": bool(dkim_records),
                "selector": "urban",
            }
        except Exception as exc:
            results["DKIM"] = {"found": False, "error": str(exc), "valid": False, "selector": "urban"}

        # DMARC check
        dmarc_host = f"_dmarc.{domain}"
        try:
            dmarc_answers = resolver.resolve(dmarc_host, "TXT")
            dmarc_values = [str(r).strip('"') for r in dmarc_answers]
            dmarc_records = [v for v in dmarc_values if v.startswith("v=DMARC1")]
            results["DMARC"] = {
                "found": bool(dmarc_records),
                "values": dmarc_records,
                "valid": bool(dmarc_records),
            }
        except Exception as exc:
            results["DMARC"] = {"found": False, "error": str(exc), "valid": False}

    except ImportError:
        # dnspython not installed — use basic socket lookups
        logger.info("dnspython not installed; using basic DNS checks")

        # MX via getaddrinfo (limited)
        try:
            loop = asyncio.get_running_loop()
            addrs = await loop.getaddrinfo(domain, 25, type=socket.SOCK_STREAM)
            results["MX"] = {
                "found": bool(addrs),
                "note": "Basic check only — install dnspython for full validation",
                "valid": bool(addrs),
            }
        except Exception as exc:
            results["MX"] = {"found": False, "error": str(exc), "valid": False}

        results["SPF"] = {"found": False, "note": "Install dnspython for SPF verification", "valid": False}
        results["DKIM"] = {"found": False, "note": "Install dnspython for DKIM verification", "valid": False}
        results["DMARC"] = {"found": False, "note": "Install dnspython for DMARC verification", "valid": False}

    all_valid = all(r.get("valid", False) for r in results.values())

    return {
        "domain": domain,
        "all_valid": all_valid,
        "checks": results,
    }


@router.get("/tls-status", summary="Check TLS certificate status")
async def tls_status(current_user: SuperAdminUser) -> dict[str, Any]:
    """Check the TLS certificate status for the SMTP server.

    Attempts an SSL handshake to the SMTP host on the configured port
    (or 465 for implicit TLS) and reports certificate details.
    """
    smtp_host = settings.SMTP_HOST
    # Use 465 for TLS check or the configured port
    tls_port = 465 if settings.SMTP_USE_TLS else settings.SMTP_PORT

    result: dict[str, Any] = {
        "host": smtp_host,
        "port": tls_port,
        "tls_enabled": False,
    }

    try:
        loop = asyncio.get_running_loop()

        def _check_tls() -> dict[str, Any]:
            ctx = ssl.create_default_context()
            try:
                with socket.create_connection((smtp_host, tls_port), timeout=10) as sock:
                    with ctx.wrap_socket(sock, server_hostname=smtp_host) as ssock:
                        cert = ssock.getpeercert()
                        return {
                            "tls_enabled": True,
                            "protocol": ssock.version(),
                            "cipher": ssock.cipher(),
                            "subject": dict(x[0] for x in cert.get("subject", [])) if cert else {},
                            "issuer": dict(x[0] for x in cert.get("issuer", [])) if cert else {},
                            "not_before": cert.get("notBefore") if cert else None,
                            "not_after": cert.get("notAfter") if cert else None,
                            "serial_number": cert.get("serialNumber") if cert else None,
                            "error": None,
                        }
            except ssl.SSLError as e:
                return {"tls_enabled": False, "error": f"SSL error: {e}"}
            except ConnectionRefusedError:
                return {"tls_enabled": False, "error": f"Connection refused on {smtp_host}:{tls_port}"}
            except socket.timeout:
                return {"tls_enabled": False, "error": "Connection timed out"}

        tls_info = await loop.run_in_executor(None, _check_tls)
        result.update(tls_info)

    except Exception as exc:
        result["error"] = str(exc)

    return result
