import logging

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import settings

logger = logging.getLogger("coldguard.db")


def _engine_kwargs() -> dict:
    url = settings.DATABASE_URL
    if url.startswith("sqlite"):
        return {
            "connect_args": {"check_same_thread": False},
            "pool_pre_ping": True,
        }

    connect_args: dict = {}
    # Supabase transaction pooler (PgBouncer) rejects prepared statements.
    # psycopg3: prepare_threshold=None disables them for the connection.
    if settings.DATABASE_IS_POOLER:
        connect_args["prepare_threshold"] = None
        logger.info("Postgres pooler mode: prepared statements disabled")

    kwargs: dict = {
        "connect_args": connect_args,
        "pool_pre_ping": True,
    }
    # Keep app-side pools small — Supabase already pools on :6543
    if settings.DATABASE_IS_POOLER:
        kwargs.update(pool_size=5, max_overflow=5, pool_timeout=30)
    return kwargs


engine = create_engine(settings.DATABASE_URL, **_engine_kwargs())
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_schema_columns() -> None:
    """Add new Asset columns on existing SQLite/Postgres DBs (create_all won't alter)."""
    columns = {
        "product_key": "VARCHAR(40)",
        "detection_confidence": "FLOAT",
        "last_detection_at": "TIMESTAMP",
        "detection_source": "VARCHAR(40)",
        "agent_notes": "TEXT",
    }
    with engine.begin() as conn:
        if settings.DATABASE_URL.startswith("sqlite"):
            existing = {
                row[1]
                for row in conn.execute(text("PRAGMA table_info(assets)")).fetchall()
            }
            for name, coltype in columns.items():
                if name not in existing:
                    conn.execute(text(f"ALTER TABLE assets ADD COLUMN {name} {coltype}"))
                    logger.info("Added assets.%s", name)
        else:
            for name, coltype in columns.items():
                conn.execute(
                    text(
                        f"ALTER TABLE assets ADD COLUMN IF NOT EXISTS {name} {coltype}"
                    )
                )
