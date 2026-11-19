# ColdGuard Web (MVP)

React + Vite frontend for ColdGuard — monitoring fridges, cold rooms, and agricultural storehouses / warehouses.

## Run

```bash
cd web
cp .env.example .env   # optional; defaults to http://localhost:8000/api
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

## Deploy (Vercel)

Root Directory: `web`. Set `VITE_API_URL` to your Render API URL including `/api`
(e.g. `https://coldguard-api.onrender.com/api`). SPA routing is handled by
`vercel.json`. Full steps: root [README](../README.md#deploy-vercel--render).

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
