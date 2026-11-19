import logging

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import settings

logger = logging.getLogger("coldguard.db")

connect_args = (
    {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}
)

engine = create_engine(settings.DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)
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
