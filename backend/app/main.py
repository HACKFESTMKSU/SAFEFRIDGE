"""ColdGuard backend — FastAPI + PostgreSQL/SQLite + MQTT ingest."""

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import mqtt_client, rules
from .database import Base, SessionLocal, engine, ensure_schema_columns
from .routers import api_router
from .seed import seed

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("coldguard")

# Import all models so create_all sees them
from . import models  # noqa: F401,E402

OFFLINE_CHECK_SECONDS = 60


async def _offline_watcher() -> None:
    """Periodically flag silent devices and raise device_offline incidents."""
    while True:
        try:
            await asyncio.to_thread(_run_offline_check)
        except Exception as exc:
            logger.warning("Offline check failed: %s", exc)
        await asyncio.sleep(OFFLINE_CHECK_SECONDS)


def _run_offline_check() -> None:
    with SessionLocal() as db:
        rules.check_offline_devices(db)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    ensure_schema_columns()
    with SessionLocal() as db:
        seed(db)
    logger.info("Database ready (seeded if empty)")

    mqtt_client.start_mqtt()
    watcher = asyncio.create_task(_offline_watcher())
    yield
    watcher.cancel()


app = FastAPI(title="ColdGuard API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "coldguard-backend"}
