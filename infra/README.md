# ColdGuard — Infrastructure

Local demo stack: **PostgreSQL 16** + **Mosquitto MQTT broker** + **FastAPI backend**.

## Services & ports

| Service    | Image / build            | Port  | Purpose                          |
| ---------- | ------------------------ | ----- | -------------------------------- |
| `db`       | `postgres:16-alpine`     | 5432  | Application database             |
| `mosquitto`| `eclipse-mosquitto:2`    | 1883  | MQTT broker (anonymous in demo)  |
| `backend`  | build `../backend`       | 8000  | FastAPI app (needs `backend/Dockerfile`) |

## Quickstart

```bash
cd infra

# Windows PowerShell:
copy .env.example .env
# Linux / macOS:
# cp .env.example .env

docker compose up -d --build
```

Until `backend/Dockerfile` exists (it is owned by the backend workstream), start the infra only:

```bash
docker compose up -d db mosquitto
```

Check status / logs:

```bash
docker compose ps
docker compose logs -f mosquitto
docker compose logs -f backend
```

## Connecting to Mosquitto

Demo mode allows anonymous publish/subscribe from anywhere on your LAN.

Watch all ColdGuard topics from the host:

```bash
docker exec -it coldgard-mosquitto mosquitto_sub -t 'coldguard/#' -v
```

Or from your machine directly (install `mosquitto-clients` / `mosquitto_sub`):

```bash
mosquitto_sub -h localhost -p 1883 -t 'coldguard/#' -v
```

Test publish:

```bash
docker exec -it coldgard-mosquitto mosquitto_pub -t 'coldguard/device/TEST/telemetry' -m '{"temperature_c":4.5}'
```

The backend subscribes to topics under `coldguard/device/{device_id}/telemetry` and `.../status` (see SRS §7).

## Enabling MQTT authentication (optional hardening)

The demo runs with `allow_anonymous true` in `mosquitto.conf`. To require passwords:

1. Edit `mosquitto.conf`: set `allow_anonymous false` and add
   `password_file /mosquitto/config/passwd` (an example block is commented out at the bottom of the file).
2. Create a user inside the running container (or before first start):

   ```bash
   docker exec -it coldgard-mosquitto mosquitto_passwd -c /mosquitto/config/passwd coldguard
   ```

   It prompts for a password and writes `/mosquitto/config/passwd` (which is a bind-mounted file — persists on the host).
3. Set `MQTT_USERNAME` and `MQTT_PASSWORD` in `.env` and uncomment the matching lines in the `backend` service env in `docker-compose.yml`.
4. Restart: `docker compose restart mosquitto backend`.

Note: `-c` creates the file; to **add** more users, drop `-c`.

TLS (port 8883) is also stubbed in `mosquitto.conf` — drop certs into `infra/mosquitto/certs/`, mount that folder, and uncomment the listener lines.

## Backend connection

The `backend` service gets these env vars (matching SRS §6 FastAPI stack):

| Var             | Value (inside compose)                        |
| --------------- | --------------------------------------------- |
| `DATABASE_URL`  | `postgresql://coldgard:<password>@db:5432/coldgard` |
| `MQTT_HOST`     | `mosquitto`                                   |
| `MQTT_PORT`     | `1883`                                        |
| `JWT_SECRET`    | from `.env` (dev default if unset)            |
| `MQTT_USERNAME` / `MQTT_PASSWORD` | optional, only with auth enabled |

The backend waits for `db` and `mosquitto` to be **healthy** before starting (`depends_on: service_healthy`).

From the host (e.g. running backend outside Docker):

```bash
DATABASE_URL=postgresql://coldgard:coldgard@localhost:5432/coldgard
MQTT_HOST=localhost
MQTT_PORT=1883
```

## Database inspection (optional)

Uncomment the `adminer` service in `docker-compose.yml`, then open <http://localhost:5050>.
Server: `db`, user: `coldgard`, password: from `.env`.

## Troubleshooting

| Symptom                              | Fix |
| ------------------------------------ | --- |
| `mosquitto` container exits / unhealthy | Run `docker compose logs mosquitto`. Common cause: a bad `mosquitto.conf` — check syntax (`listener` lines, no stray tabs). |
| Backend can't reach DB               | `docker compose ps` — `db` must show `healthy`. Check `POSTGRES_PASSWORD` in `.env` matches `DATABASE_URL`. |
| Backend can't reach MQTT             | `mosquitto` must be `healthy`; ensure port `1883` isn't taken by another local broker (`netstat -ano \| findstr 1883`). |
| `docker compose up` fails on backend build | Expected until `backend/Dockerfile` exists — run `docker compose up -d db mosquitto`. |
| ESP32 can't publish                  | Device must be on the same network; broker listens on all interfaces (`0.0.0.0:1883` published). Check firewall allows 1883. |
| DB data persists but you want a clean slate | `docker compose down -v` (deletes named volumes `pgdata`, `mosquitto-data`, `mosquitto-log`). |

## Layout

```text
infra/
  docker-compose.yml      # db + mosquitto + backend (+ optional adminer)
  .env.example            # POSTGRES_PASSWORD, JWT_SECRET, MQTT creds
  mosquitto/
    mosquitto.conf        # listener 1883, anonymous demo mode, TLS/auth stubs
  README.md               # this file
```

No `init-db` SQL is shipped: the backend creates its schema on startup (`create_all`). Add `infra/init-db/01-init.sql` and uncomment the volume in compose only if you need seed data before the app boots.
