"""One-shot: delete fake telemetry, incidents, and notes from the DB."""

from sqlalchemy import delete, select

from app.database import SessionLocal
from app.models import Device, Incident, MaintenanceNote, Telemetry


def main() -> None:
    with SessionLocal() as db:
        n_tel = db.execute(delete(Telemetry)).rowcount or 0
        n_notes = db.execute(delete(MaintenanceNote)).rowcount or 0
        n_inc = db.execute(delete(Incident)).rowcount or 0
        for device in db.scalars(select(Device)).all():
            device.online = False
            device.last_seen = None
        db.commit()
        print(f"Cleared telemetry={n_tel} incidents={n_inc} notes={n_notes}")
        print("Devices marked offline until MQTT arrives.")


if __name__ == "__main__":
    main()
