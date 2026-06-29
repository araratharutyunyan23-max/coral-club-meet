# Deploy

Production runs as a small Docker Compose stack (`docker-compose.prod.yml`):

- **backend** — Go token service, talks to **LiveKit Cloud** (media is browser ↔ cloud, no self-hosted SFU).
- **web** — nginx serving `frontend/dist` and proxying `/api` → `backend`.
- **tunnel** — Cloudflare quick-tunnel giving a public HTTPS URL (until a real domain is wired).

The repo's root `docker-compose.yml` is the **local-dev** stack (self-hosted LiveKit + redis + egress, dev keys) — not used in production.

## Server

- Hetzner CAX11 (ARM64, Ubuntu 24.04), Docker + Compose preinstalled.
- Repo lives at `/opt/coral-club-meet`.

## First-time setup

```bash
ssh root@<server-ip>
mkdir -p /opt/coral-club-meet           # then copy the repo here (git clone or rsync/tar)

cd /opt/coral-club-meet
cat > .env <<'EOF'                       # secrets — never commit; chmod 600
LIVEKIT_URL=wss://<your>.livekit.cloud
LIVEKIT_API_KEY=<key>
LIVEKIT_API_SECRET=<secret>
ALLOWED_ORIGINS=*
EOF
chmod 600 .env

# build the frontend (Node 20+)
cd frontend && npm ci && npm run build && cd ..

# build + start the stack
docker compose -f docker-compose.prod.yml up -d --build

# the public HTTPS URL (Cloudflare quick-tunnel):
docker compose -f docker-compose.prod.yml logs tunnel | grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' | tail -1
```

The site is also reachable on the box's `http://<server-ip>` (port 80) for when a
real domain + TLS is added later.

## Redeploy after code changes

```bash
cd /opt/coral-club-meet
git pull                                 # or copy changed files
cd frontend && npm run build && cd ..    # frontend
docker compose -f docker-compose.prod.yml up -d --build backend web   # backend if Go changed
```

`web` serves `frontend/dist` live (read-only mount), so a frontend rebuild is
visible immediately; no container rebuild needed for frontend-only changes.
