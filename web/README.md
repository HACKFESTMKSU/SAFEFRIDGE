# ColdGuard Web

React + Vite frontend for ColdGuard. Talks to the FastAPI backend (no mock telemetry).

## Run

Start infra/API first (`cd ../infra && docker compose up --build -d`), then:

```bash
npm install
npm run dev
```

Optional: set `VITE_API_URL` (default `http://localhost:8000/api`).

## Seed logins

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@coldguard.app` | `admin123` |
| Operator | `operator@coldguard.app` | `operator123` |
| Technician | `tech@coldguard.app` | `tech123` |

## What’s included

- Login against `/api/auth/login` (JWT)
- Dashboard + asset detail with live DHT11 temp/humidity (polled every 5s)
- Assets, devices, users, thresholds via API
- Incidents and maintenance notes (empty until rules/phase 3)
