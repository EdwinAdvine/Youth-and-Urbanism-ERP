#!/usr/bin/env bash
set -euo pipefail

# Urban Vibes Dynamics — Initial SSL certificate generation via Certbot (webroot challenge)

DOMAIN="${1:-}"

if [ -z "$DOMAIN" ]; then
  echo "Usage: $0 <domain>"
  echo "Example: $0 erp.example.com"
  exit 1
fi

WEBROOT="/var/www/certbot"
EMAIL="${CERTBOT_EMAIL:-admin@${DOMAIN}}"

echo "==> Requesting SSL certificate for ${DOMAIN}"
echo "    Webroot: ${WEBROOT}"
echo "    Email:   ${EMAIL}"

# Ensure webroot directory exists
mkdir -p "${WEBROOT}"

# Request certificate
certbot certonly \
  --webroot \
  --webroot-path "${WEBROOT}" \
  --domain "${DOMAIN}" \
  --email "${EMAIL}" \
  --agree-tos \
  --non-interactive \
  --no-eff-email

echo "==> Certificate obtained successfully."
echo "    Certificate: /etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
echo "    Private key: /etc/letsencrypt/live/${DOMAIN}/privkey.pem"
echo ""
echo "Add to your nginx server block:"
echo "    ssl_certificate     /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;"
echo "    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;"
