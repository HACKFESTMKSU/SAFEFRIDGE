# ColdGuard Web (MVP)

React + Vite frontend for the ColdGuard cold-storage monitoring prototype.

## Run

```bash
cd web
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

## Demo logins

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@coldguard.local` | `admin123` |
| Operator | `operator@coldguard.local` | `operator123` |
| Technician | `tech@coldguard.local` | `tech123` |

## What’s included

- Login + role-gated navigation
- Dashboard with live metrics (mock ESP32 telemetry)
- Assets list/detail + 24h charts
- Incidents: acknowledge / resolve + recommended actions
- Admin: devices link, users, thresholds & SIM800L SMS recipients
- Technician: maintenance notes
- Profile edit

Data is in-memory mock (swap to FastAPI later). No backend required for UI demos.
