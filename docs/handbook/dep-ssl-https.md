---
title: "Configuring SSL/HTTPS with Nginx"
slug: "configuring-ssl-https-nginx"
category: "deployment"
article_type: "guide"
tags: [deployment, ssl, https, nginx, production]
sort_order: 1
is_pinned: false
excerpt: "Put Urban Vibes Dynamics behind Nginx with Let's Encrypt SSL for production HTTPS access."
---

# Configuring SSL/HTTPS with Nginx

For production, always run Urban Vibes Dynamics behind Nginx with HTTPS. This prevents credentials and data from being transmitted in plaintext.

## Prerequisites

- Docker Compose stack running (see Docker Compose Setup guide)
- Domain name pointing to your server (A record → server IP)
- Ubuntu 22.04 (or equivalent)

## Step 1: Install Nginx and Certbot

```bash
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx -y
```

## Step 2: Create Nginx configuration

```bash
sudo nano /etc/nginx/sites-available/urban-vibes-dynamics
```

Paste this configuration (replace `erp.yourdomain.com`):

```nginx
server {
    listen 80;
    server_name erp.yourdomain.com;

    # Frontend
    location / {
        proxy_pass http://localhost:3010;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:8010;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket support (for AI chat, live chat, agent)
    location /api/v1/ai/ws/ {
        proxy_pass http://localhost:8010;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }

    location /api/v1/agent/ws/ {
        proxy_pass http://localhost:8010;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }

    location /api/v1/chat/ws {
        proxy_pass http://localhost:8010;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/urban-vibes-dynamics /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## Step 3: Obtain SSL Certificate

```bash
sudo certbot --nginx -d erp.yourdomain.com
```

Certbot automatically modifies the Nginx config to redirect HTTP → HTTPS and installs the certificate.

## Step 4: Update Environment Variables

In your `.env` file, update:

```env
CORS_ORIGINS=https://erp.yourdomain.com
VITE_API_URL=https://erp.yourdomain.com/api/v1
```

Restart the stack:
```bash
docker compose up -d
```

## Step 5: Auto-renewal

Certbot installs a cron job automatically. Verify:

```bash
sudo certbot renew --dry-run
```

## Firewall

Only expose ports 80 and 443 externally:

```bash
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

All other ports (3010, 8010, 5433, etc.) should only be accessible locally.
