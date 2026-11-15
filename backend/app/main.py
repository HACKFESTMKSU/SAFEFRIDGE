from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .db import Base, SessionLocal, engine
from .mqtt_worker import mqtt_worker
from .routers import assets, auth, devices, incidents, notes, telemetry, users
from .seed import seed_database

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s [%(name)s] %(message)s")
logger = logging.getLogger("coldguard")
settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)
    if settings.seed_on_startup:
        db = SessionLocal()
        try:
            seed_database(db)
        finally:
            db.close()
    mqtt_worker.start()
    logger.info("ColdGuard API ready")
    yield
    mqtt_worker.stop()


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(assets.router, prefix="/api")
app.include_router(devices.router, prefix="/api")
app.include_router(telemetry.router, prefix="/api")
app.include_router(incidents.router, prefix="/api")
app.include_router(notes.router, prefix="/api")
app.include_router(users.router, prefix="/api")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
