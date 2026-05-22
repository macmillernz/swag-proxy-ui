# SWAG Proxy UI

A lightweight web UI for managing [LinuxServer SWAG](https://github.com/linuxserver/docker-swag) reverse proxy configurations.

Reads and writes nginx `.conf` files directly in SWAG's `proxy-confs/` directory via a shared Docker volume — no SWAG modifications required.

## Quickstart

```yaml
services:
  swag-proxy-ui:
    image: ghcr.io/macmillernz/swag-proxy-ui:latest
    restart: unless-stopped
    ports:
      - "9000:8000"
    volumes:
      - /opt/appdata/swag/nginx/proxy-confs:/config/nginx/proxy-confs:rw
```

```bash
docker compose pull && docker compose up -d
```

Open `http://your-server:9000`.

## Configuration

| Variable | Default | Description |
|---|---|---|
| `PROXY_CONF_DIR` | `/config/nginx/proxy-confs` | Path to SWAG's `proxy-confs` directory |

## Applying changes

SWAG Proxy UI writes `.conf` files but does not reload nginx automatically. After any change, the UI shows the reload command:

```
docker exec swag nginx -s reload
```

## How it works

- **Managed files** — conf files created via the UI include a `## SWAG-UI: {...}` metadata header and can be fully edited.
- **Unmanaged files** — pre-existing SWAG template confs appear in the list as read-only; they can be enabled/disabled or deleted but not edited through the UI.

## Development

```bash
# Backend (set PROXY_CONF_DIR to any local directory for testing)
cd backend
pip install -r requirements.txt
PROXY_CONF_DIR=/tmp/proxy-confs uvicorn main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev   # http://localhost:5174, /api proxied to :8000
```

## Building locally

```bash
docker build -t swag-proxy-ui .
```
