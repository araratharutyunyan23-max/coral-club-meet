# Deploy

Production is fully self-hosted (own LiveKit SFU — like Meet/Telemost) as a Docker
Compose stack (`docker-compose.prod.yml`), all on **host networking**:

- **redis** — LiveKit coordination store.
- **livekit** — the SFU. Media flows browser ↔ this box's public IP over **UDP
  50000–50100** (+ **TCP 7881** fallback); signaling (`/rtc`, port 7880) is local,
  fronted by Caddy over `wss`.
- **backend** — Go: issues LiveKit tokens + host moderation (talks to LiveKit on
  `localhost:7880`).
- **caddy** — edge: **auto-HTTPS via Let's Encrypt**, serves `frontend/dist`, and
  proxies `/api` → backend and `/rtc` → LiveKit.

The repo's root `docker-compose.yml` is the local-dev stack — not used in prod.

## Server

- Hetzner CAX11 (ARM64, Ubuntu 24.04), Docker + Compose + Node 20 preinstalled.
- Repo at `/opt/coral-club-meet`. Public host: `178-105-146-99.sslip.io` (sslip.io
  resolves it to the box IP `178.105.146.99`). Swap the hostname in `infra/Caddyfile`
  + `.env` `LIVEKIT_URL` when a real domain is pointed here.

## First-time setup

```bash
ssh root@178.105.146.99
mkdir -p /opt/coral-club-meet            # copy the repo here

# firewall: LiveKit media (signaling 7880 + API 8080 stay local, not opened)
ufw allow 50000:50100/udp
ufw allow 7881/tcp

cd /opt/coral-club-meet
cat > .env <<'EOF'                       # secrets — never commit; chmod 600
LIVEKIT_URL=wss://meet-coralclub.com
LIVEKIT_API_KEY=<apikey>
LIVEKIT_API_SECRET=<long-random-secret>
ALLOWED_ORIGINS=*
EOF
chmod 600 .env

cd frontend && npm ci && npm run build && cd ..
docker compose -f docker-compose.prod.yml up -d --build --remove-orphans
```

Caddy provisions the TLS cert on first start (port 80 must be reachable). Open
**https://meet-coralclub.com**.

## Redeploy

Push to `main` → GitHub Actions auto-deploys (`.github/workflows/deploy.yml`):
rsync repo → `npm run build` → `docker compose -f docker-compose.prod.yml up -d
--build --remove-orphans`. `.env`, `node_modules`, `dist` and `recordings` are
preserved on the box.

## Notes

- CAX11 is small (2 vCPU / 3.7 GB) — fine for small groups; size up for many
  simultaneous video participants.
- No TURN yet: clients use direct UDP or the TCP 7881 fallback. Add a TURN server
  if users on locked-down (443-only) networks can't connect.
- Recording (Egress) is not deployed; the Record button is disabled in the UI.
