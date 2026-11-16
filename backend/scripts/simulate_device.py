"""Simulate an ESP32 ColdGuard device over MQTT — no hardware needed.

Publishes SRS §7 telemetry + status heartbeats to a local broker
(`amqtt`, Mosquitto, or the infra compose stack).

Usage:
    python scripts/simulate_device.py                     # CG-001, normal temps
    python scripts/simulate_device.py --device CG-002     # another device
    python scripts/simulate_device.py --temp 12.5         # force temperature
    python scripts/simulate_device.py --interval 10       # seconds between reads
    python scripts/simulate_device.py --wet                # force water wet
    python scripts/simulate_device.py --offline 60        # stop publishing for N s (device goes offline)

Requires: pip install paho-mqtt
"""

import argparse
import json
import math
import random
import sys
import time
from datetime import datetime, timezone

try:
    import paho.mqtt.client as mqtt
except ImportError:
    sys.exit("paho-mqtt not installed: pip install paho-mqtt")

FIRMWARE_VERSION = "0.1.0"


def telemetry_payload(args, tick: int) -> dict:
    wave = math.sin(tick / 6.0) * 0.5
    temp = args.temp if args.temp is not None else round(4.2 + wave + random.uniform(-0.2, 0.2), 1)
    water_level = random.randint(60, 140)
    if args.wet:
        water_level = random.randint(650, 780)
    return {
        "device_id": args.device,
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "temperature_c": temp,
        "humidity_percent": round(55 + math.sin(tick / 8.0) * 5, 0),
        "current_a": round(1.1 + max(0.0, math.sin(tick / 5.0)) * 0.8, 2),
        "water_level": water_level,
        "water_wet": water_level > 500,
        "firmware_version": FIRMWARE_VERSION,
    }


def main() -> None:
    p = argparse.ArgumentParser(description="Simulate a ColdGuard ESP32 device")
    p.add_argument("--device", default="CG-001", help="device id (default CG-001)")
    p.add_argument("--host", default="localhost", help="MQTT broker host")
    p.add_argument("--port", type=int, default=1883, help="MQTT broker port")
    p.add_argument("--interval", type=float, default=15.0, help="seconds between telemetry reads")
    p.add_argument("--temp", type=float, default=None, help="force temperature_c")
    p.add_argument("--wet", action="store_true", help="force water sensor wet")
    p.add_argument("--offline", type=float, default=0.0, help="go silent for N seconds once, then resume")
    args = p.parse_args()

    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    client.connect(args.host, args.port, 60)
    client.loop_start()

    tele_topic = f"coldguard/device/{args.device}/telemetry"
    status_topic = f"coldguard/device/{args.device}/status"

    print(f"Simulating {args.device} -> {args.host}:{args.port}")
    print(f"  telemetry: {tele_topic}")
    print(f"  status:    {status_topic}")
    print("  Ctrl+C to stop\n")

    tick = 0
    went_offline = False
    try:
        while True:
            tick += 1
            payload = telemetry_payload(args, tick)
            client.publish(tele_topic, json.dumps(payload), qos=1)
            client.publish(
                status_topic,
                json.dumps({"online": True, "firmware_version": FIRMWARE_VERSION}),
                qos=1,
            )
            print(
                f"[{datetime.now().strftime('%H:%M:%S')}] "
                f"temp={payload['temperature_c']}°C hum={payload['humidity_percent']}% "
                f"water={'WET' if payload['water_wet'] else 'dry'} "
                f"current={payload['current_a']}A"
            )
            if args.offline and not went_offline:
                went_offline = True
                print(f"  ... going offline for {args.offline}s (device will look dead) ...")
                time.sleep(args.offline)
                # publish a final status so the broker LWT/state is clean
                client.publish(
                    status_topic,
                    json.dumps({"online": False, "firmware_version": FIRMWARE_VERSION}),
                    qos=1,
                )
            time.sleep(args.interval)
    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        client.loop_stop()
        client.disconnect()


if __name__ == "__main__":
    main()
