# Coral Club Meet

Self-hostable video calling for Coral Club — **React + Go + [LiveKit](https://livekit.io)**.

The heavy real-time media work (the SFU) is handled by LiveKit. This repo is the
two pieces we own:

- **`frontend/`** — React + TypeScript call app (custom UI built on `livekit-client`).
- **`backend/`** — small Go service that issues LiveKit access tokens. It is the
  "control plane" and never sits on the media path.

```
Browser (React)
   │  POST /api/token   ── Go backend ──> signs a LiveKit JWT
   │  ws + WebRTC media ─────────────────> LiveKit SFU
```

---

## Prerequisites

- **Docker + Docker Compose** (runs LiveKit and the Go backend)
- **Node.js 20+** (runs the frontend dev server)

Go is **not** required on the host — the backend builds inside Docker.

## Run it locally

```bash
# 1. Start the LiveKit SFU + token backend (Docker, detached)
make up

# 2. Start the frontend dev server (installs deps on first run)
make web
```

Then open **http://localhost:5173**. To test a real call, open it in **two
browser tabs** (or two devices on the same network — see below), enter a name in
each, keep the same room name, and join.

`make dev` does both steps. `make down` stops the Docker stack.

### Testing across two devices on your LAN

`make web` already binds the dev server to your LAN (`host: true`). On a second
device, open `http://<your-LAN-IP>:5173`. For the media to connect, the LiveKit
node must advertise the same LAN IP — start it with:

```bash
docker run --rm --network host livekit/livekit-server \
  --dev --node-ip <your-LAN-IP>
```

(For same-machine, two-tab testing, the default `make up` is enough.)

## Configuration

The backend reads environment variables (see `backend/.env.example`). Local
development uses LiveKit's well-known dev credentials (`devkey` / `secret`),
wired up in `docker-compose.yml`.

| Variable             | Default                  | Purpose                                  |
| -------------------- | ------------------------ | ---------------------------------------- |
| `PORT`               | `8080`                   | Backend HTTP port                        |
| `LIVEKIT_URL`        | `ws://localhost:7880`    | WS URL returned to the browser           |
| `LIVEKIT_DEV`        | `false`                  | If `true`, fall back to dev key/secret   |
| `LIVEKIT_API_KEY`    | _(required in prod)_     | Must match the LiveKit server            |
| `LIVEKIT_API_SECRET` | _(required in prod)_     | Must match the LiveKit server            |
| `ALLOWED_ORIGINS`    | `http://localhost:5173`  | CORS allow-list                          |

## What works today (prototype)

- Lobby with camera/mic preview and device toggles
- Multi-party calls: live video + audio
- **Speaker** and **Grid** views (toggle in the top bar)
- Mic / camera / screen-share toggles, raise hand
- Speaking highlight, mute indicator, initials avatars when the camera is off

## Known limitations (intentional for v1)

- **Authentication is stubbed.** `POST /api/token` trusts the request body.
  Before any real launch this must validate the user's existing Coral Club
  session and derive identity/role from it. See the note in
  `backend/internal/httpapi/handlers.go`.
- Chat, the people panel, and reactions are visual placeholders only.
- Recording is not wired up yet (LiveKit Egress).
- The LiveKit dev server is single-node and uses development credentials —
  **not** for production.

## Project layout

```
backend/
  cmd/server/            # entrypoint (graceful shutdown, slog)
  internal/config/       # env-based configuration
  internal/livekit/      # access-token issuing (roles: host/participant/viewer)
  internal/httpapi/      # router, handlers, CORS
frontend/
  src/lib/               # api client, LiveKit hooks, icons, types
  src/components/        # TopBar, ControlBar, tiles, grid/speaker views
  src/pages/             # Lobby, CallRoom
docker-compose.yml       # LiveKit (dev) + backend
Makefile                 # up / down / web / dev
```
