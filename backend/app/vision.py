"""Video produce characterization via Ultralytics YOLOE-26 (open-vocab).

Falls back to YOLO-World, then to empty detections if weights cannot load.
"""

from __future__ import annotations

import logging
import tempfile
from collections import defaultdict
from pathlib import Path

from .produce import prompt_to_product_key, vision_class_list

logger = logging.getLogger("coldguard.vision")

MAX_VIDEO_BYTES = 25 * 1024 * 1024
MAX_DURATION_S = 30.0
TARGET_FRAMES = 8
CONF_THRESHOLD = 0.15

_model = None
_model_name: str | None = None
_load_error: str | None = None


def vision_status() -> dict:
    ensure_model()
    return {
        "ready": _model is not None,
        "model": _model_name,
        "error": _load_error,
    }


def ensure_model():
    """Lazy-load YOLOE-26, then YOLO-World fallback."""
    global _model, _model_name, _load_error
    if _model is not None:
        return _model

    classes = vision_class_list()
    try:
        from ultralytics import YOLOE

        model = YOLOE("yoloe-26s-seg.pt")
        model.set_classes(classes)
        _model = model
        _model_name = "yoloe-26s-seg"
        _load_error = None
        logger.info("Loaded vision model %s with %d class prompts", _model_name, len(classes))
        return _model
    except Exception as exc:
        logger.warning("YOLOE-26 load failed (%s); trying YOLO-World", exc)

    try:
        from ultralytics import YOLOWorld

        model = YOLOWorld("yolov8s-worldv2.pt")
        model.set_classes(classes)
        _model = model
        _model_name = "yolov8s-worldv2"
        _load_error = None
        logger.info("Loaded vision model %s with %d class prompts", _model_name, len(classes))
        return _model
    except Exception as exc:
        _load_error = str(exc)
        logger.warning("Vision model unavailable: %s", exc)
        return None


def _sample_frame_indices(total: int, want: int) -> list[int]:
    if total <= 0:
        return []
    if total <= want:
        return list(range(total))
    step = total / want
    return sorted({min(total - 1, int(i * step)) for i in range(want)})


def extract_frames(video_path: Path, max_frames: int = TARGET_FRAMES) -> list:
    import cv2

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise ValueError("Could not open video")

    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    duration = frame_count / fps if fps > 0 else 0.0
    if duration > MAX_DURATION_S and frame_count > 0:
        # Cap sampling to first MAX_DURATION_S of the clip
        frame_count = int(MAX_DURATION_S * fps)

    indices = set(_sample_frame_indices(frame_count, max_frames))
    frames = []
    idx = 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        if idx in indices:
            frames.append(frame)
        idx += 1
        if frame_count and idx >= frame_count:
            break
    cap.release()

    if not frames:
        raise ValueError("No frames could be sampled from the video")
    return frames


def characterize_video(video_bytes: bytes, filename: str = "clip.mp4") -> dict:
    """Run open-vocab detection on sampled frames; aggregate to product scores."""
    if len(video_bytes) > MAX_VIDEO_BYTES:
        raise ValueError(f"Video exceeds {MAX_VIDEO_BYTES // (1024 * 1024)}MB limit")

    model = ensure_model()
    if model is None:
        return {
            "detections": [],
            "top_product_key": None,
            "confidence": 0.0,
            "frames_sampled": 0,
            "model": None,
            "vision_ready": False,
            "message": "Vision model unavailable — install ultralytics or pick produce manually.",
        }

    suffix = Path(filename).suffix or ".mp4"

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=True) as tmp:
        tmp.write(video_bytes)
        tmp.flush()
        frames = extract_frames(Path(tmp.name))

        scores: dict[str, list[float]] = defaultdict(list)
        raw: list[dict] = []

        for frame in frames:
            results = model.predict(frame, conf=CONF_THRESHOLD, verbose=False)
            for result in results:
                names = result.names or {}
                boxes = result.boxes
                if boxes is None:
                    continue
                for box in boxes:
                    cls_id = int(box.cls.item())
                    conf = float(box.conf.item())
                    label = str(names.get(cls_id, cls_id))
                    product_key = prompt_to_product_key(label)
                    raw.append(
                        {
                            "label": label,
                            "product_key": product_key,
                            "confidence": round(conf, 3),
                        }
                    )
                    if product_key:
                        scores[product_key].append(conf)

        ranked = sorted(
            (
                {
                    "product_key": key,
                    "confidence": round(sum(vals) / len(vals), 3),
                    "hits": len(vals),
                }
                for key, vals in scores.items()
            ),
            key=lambda r: (r["hits"], r["confidence"]),
            reverse=True,
        )

        top = ranked[0] if ranked else None
        return {
            "detections": ranked,
            "raw": raw[:40],
            "top_product_key": top["product_key"] if top else None,
            "confidence": top["confidence"] if top else 0.0,
            "frames_sampled": len(frames),
            "model": _model_name,
            "vision_ready": True,
            "message": (
                f"Detected {top['product_key']}" if top else "No catalog produce detected"
            ),
        }
