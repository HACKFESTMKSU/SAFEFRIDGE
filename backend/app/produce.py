"""Produce storage profiles for agri storehouses / cold rooms / warehouses.

Profiles are the source of truth for safe bands. The vision model picks a
product_key; the agent (or static fallback) applies these thresholds.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class ProduceProfile:
    product_key: str
    label: str
    temp_min_c: float
    temp_max_c: float
    temp_warning_c: float
    temp_critical_c: float
    humidity_max_percent: float
    notes: str
    # Open-vocab prompt phrases YOLOE / YOLO-World should look for
    vision_prompts: tuple[str, ...]


PROFILES: dict[str, ProduceProfile] = {
    p.product_key: p
    for p in (
        ProduceProfile(
            "mango",
            "Mango",
            10.0,
            13.0,
            14.0,
            16.0,
            90.0,
            "Post-harvest cool store; chill injury below ~10°C.",
            ("mango", "mangoes"),
        ),
        ProduceProfile(
            "potato",
            "Potato",
            4.0,
            10.0,
            12.0,
            15.0,
            95.0,
            "Storehouse / warehouse; keep dark and ventilated.",
            ("potato", "potatoes"),
        ),
        ProduceProfile(
            "tomato",
            "Tomato",
            10.0,
            15.0,
            16.0,
            18.0,
            90.0,
            "Aggregation / market cold room; avoid deep chill.",
            ("tomato", "tomatoes"),
        ),
        ProduceProfile(
            "banana",
            "Banana",
            13.0,
            15.0,
            16.0,
            18.0,
            90.0,
            "Ripening-sensitive; do not refrigerate too cold.",
            ("banana", "bananas"),
        ),
        ProduceProfile(
            "onion",
            "Onion",
            0.0,
            5.0,
            8.0,
            12.0,
            70.0,
            "Cool, relatively dry storage.",
            ("onion", "onions"),
        ),
        ProduceProfile(
            "leafy_greens",
            "Leafy greens",
            0.0,
            4.0,
            6.0,
            8.0,
            95.0,
            "High humidity, near-freezing for spinach/kale-type greens.",
            ("lettuce", "cabbage", "spinach", "leafy greens", "kale"),
        ),
        ProduceProfile(
            "avocado",
            "Avocado",
            5.0,
            12.0,
            13.0,
            15.0,
            85.0,
            "Cold-sensitive; moderate cool store.",
            ("avocado", "avocados"),
        ),
        ProduceProfile(
            "carrot",
            "Carrot",
            0.0,
            5.0,
            7.0,
            10.0,
            95.0,
            "Root crop; high humidity cool store.",
            ("carrot", "carrots"),
        ),
    )
}


def all_profiles() -> list[dict]:
    return [asdict(p) for p in PROFILES.values()]


def get_profile(product_key: str) -> ProduceProfile | None:
    return PROFILES.get(product_key)


def vision_class_list() -> list[str]:
    """Flatten unique vision prompts for YOLOE set_classes."""
    seen: set[str] = set()
    out: list[str] = []
    for p in PROFILES.values():
        for phrase in p.vision_prompts:
            key = phrase.lower()
            if key not in seen:
                seen.add(key)
                out.append(phrase)
    return out


def prompt_to_product_key(label: str) -> str | None:
    """Map a detector class string back to a catalog product_key."""
    needle = label.strip().lower()
    for key, profile in PROFILES.items():
        if needle == key or needle == profile.label.lower():
            return key
        for phrase in profile.vision_prompts:
            if needle == phrase.lower() or needle in phrase.lower() or phrase.lower() in needle:
                return key
    return None
