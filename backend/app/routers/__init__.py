from fastapi import APIRouter

from . import assets, auth, dashboard, devices, incidents, telemetry, users

api_router = APIRouter(prefix="/api")
api_router.include_router(auth.router)
api_router.include_router(assets.router)
api_router.include_router(devices.router)
api_router.include_router(telemetry.router)
api_router.include_router(incidents.router)
api_router.include_router(users.router)
api_router.include_router(dashboard.router)
