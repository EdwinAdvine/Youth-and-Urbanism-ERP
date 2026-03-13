#!/usr/bin/env bash
# generate-certs.sh — Generate self-signed TLS certificates for PostgreSQL + PgBouncer.
#
# Produces:
#   ca.key / ca.crt          — Certificate Authority (root)
#   server.key / server.crt  — PostgreSQL server cert (SANs: patroni1, patroni2, patroni3)
#   pgbouncer.key / pgbouncer.crt — PgBouncer client cert
#   client.key / client.crt  — Application client cert
#
# In production, replace these with certs issued by your internal CA or
# Let's Encrypt. Self-signed certs are ONLY suitable for dev/staging.
#
# Usage:
#   cd postgres/ssl/
#   chmod +x generate-certs.sh
#   ./generate-certs.sh

set -euo pipefail

DAYS=3650      # 10-year validity for internal certs
BITS=4096
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "[1/5] Generating Certificate Authority (CA)..."
openssl genrsa -out "${DIR}/ca.key" "${BITS}"
openssl req -new -x509 -days "${DAYS}" -key "${DIR}/ca.key" \
    -subj "/C=KE/O=Urban Vibes Dynamics/CN=Urban Vibes Dynamics Internal CA" \
    -out "${DIR}/ca.crt"

echo "[2/5] Generating PostgreSQL server certificate..."
openssl genrsa -out "${DIR}/server.key" "${BITS}"
chmod 600 "${DIR}/server.key"

# SAN extension: covers all Patroni node hostnames + localhost
cat > "${DIR}/server-ext.cnf" << 'SAN'
[req]
req_extensions = v3_req
distinguished_name = req_distinguished_name

[req_distinguished_name]

[v3_req]
subjectAltName = @alt_names

[alt_names]
DNS.1 = urban-vibes-dynamics-patroni1
DNS.2 = urban-vibes-dynamics-patroni2
DNS.3 = urban-vibes-dynamics-patroni3
DNS.4 = urban-vibes-dynamics-postgres
DNS.5 = localhost
IP.1 = 127.0.0.1
SAN

openssl req -new -key "${DIR}/server.key" \
    -subj "/C=KE/O=Urban Vibes Dynamics/CN=urban-vibes-dynamics-postgres" \
    -out "${DIR}/server.csr" \
    -config "${DIR}/server-ext.cnf"

openssl x509 -req -days "${DAYS}" \
    -in "${DIR}/server.csr" \
    -CA "${DIR}/ca.crt" -CAkey "${DIR}/ca.key" -CAcreateserial \
    -extensions v3_req -extfile "${DIR}/server-ext.cnf" \
    -out "${DIR}/server.crt"

echo "[3/5] Generating PgBouncer certificate..."
openssl genrsa -out "${DIR}/pgbouncer.key" "${BITS}"
chmod 600 "${DIR}/pgbouncer.key"
openssl req -new -key "${DIR}/pgbouncer.key" \
    -subj "/C=KE/O=Urban Vibes Dynamics/CN=urban-vibes-dynamics-pgbouncer" \
    -out "${DIR}/pgbouncer.csr"
openssl x509 -req -days "${DAYS}" \
    -in "${DIR}/pgbouncer.csr" \
    -CA "${DIR}/ca.crt" -CAkey "${DIR}/ca.key" -CAcreateserial \
    -out "${DIR}/pgbouncer.crt"

echo "[4/5] Generating application client certificate..."
openssl genrsa -out "${DIR}/client.key" "${BITS}"
chmod 600 "${DIR}/client.key"
openssl req -new -key "${DIR}/client.key" \
    -subj "/C=KE/O=Urban Vibes Dynamics/CN=urban-vibes-dynamics-app" \
    -out "${DIR}/client.csr"
openssl x509 -req -days "${DAYS}" \
    -in "${DIR}/client.csr" \
    -CA "${DIR}/ca.crt" -CAkey "${DIR}/ca.key" -CAcreateserial \
    -out "${DIR}/client.crt"

echo "[5/5] Cleaning up CSR and extension files..."
rm -f "${DIR}"/*.csr "${DIR}/server-ext.cnf" "${DIR}"/*.srl

echo ""
echo "====================================================================="
echo " TLS certificates generated in ${DIR}/"
ls -la "${DIR}"/*.{key,crt} 2>/dev/null
echo ""
echo " Next steps (Phase 4 TLS hardening):"
echo "   1. Copy server.key + server.crt + ca.crt into each Patroni container."
echo "   2. Enable in patroni.yml: ssl=on, ssl_cert_file, ssl_key_file, ssl_ca_file"
echo "   3. Enable in pgbouncer.ini: client_tls_sslmode=require (uncomment lines)"
echo "   4. Update DATABASE_URL: add ?sslmode=verify-full&sslrootcert=..."
echo "====================================================================="
