"""Video/image produce characterization via Ultralytics YOLOE-26 (open-vocab).

Falls back to YOLO-World, then to a plain preview frame (no boxes) if weights
cannot load. Always returns a JPEG preview when frames can be decoded so the
UI can show what was uploaded.
"""

from __future__ import annotations

import base64
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
PREVIEW_MAX_WIDTH = 960

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


# COCO class names that map into our produce catalog (standard YOLOv8, ~6MB).
_COCO_TO_PRODUCT = {
    "banana": "banana",
    "apple": "apple",
    "orange": "orange",
    "broccoli": "broccoli",
    "carrot": "carrot",
}


def ensure_model():
    """Load a detector.

    Default: standard YOLOv8n (~6MB, COCO). Good for demos on slow networks.
    Open-vocab YOLO-World / YOLOE need huge CLIP downloads — opt-in via VISION_MODEL.
    """
    global _model, _model_name, _load_error
    if _model is not None:
        return _model

    from .config import settings

    classes = vision_class_list()
    want = (settings.VISION_MODEL or "").strip().lower()

    def _load_yolov8():
        from ultralytics import YOLO

        weights = "yolov8n.pt"
        if want.endswith(".pt") and want.startswith("yolov8") and "world" not in want:
            weights = settings.VISION_MODEL
        model = YOLO(weights)
        return model, Path(weights).stem

    def _load_world():
        from ultralytics import YOLOWorld

        model = YOLOWorld("yolov8s-worldv2.pt")
        model.set_classes(classes)
        return model, "yolov8s-worldv2"

    def _load_yoloe():
        from ultralytics import YOLOE

        weights = settings.VISION_MODEL if want.startswith("yoloe") else "yoloe-26s-seg.pt"
        model = YOLOE(weights)
        model.set_classes(classes)
        return model, Path(weights).stem

    if want.startswith("yoloe"):
        loaders = [("YOLOE", _load_yoloe), ("YOLOv8", _load_yolov8)]
    elif "world" in want:
        loaders = [("YOLO-World", _load_world), ("YOLOv8", _load_yolov8)]
    else:
        # Fast path — no 200MB+ CLIP downloads
        loaders = [("YOLOv8", _load_yolov8)]

    errors: list[str] = []
    for label, loader in loaders:
        try:
            model, name = loader()
            _model = model
            _model_name = name
            _load_error = None
            logger.info("Loaded vision model %s", _model_name)
            return _model
        except Exception as exc:
            errors.append(f"{label}: {exc}")
            logger.warning("%s load failed (%s)", label, exc)

    _load_error = " | ".join(errors) if errors else "unknown"
    logger.warning("Vision model unavailable: %s", _load_error)
    return None


def _label_to_product(label: str) -> str | None:
    """Map a detector label to a ColdGuard produce key."""
    key = prompt_to_product_key(label)
    if key:
        return key
    return _COCO_TO_PRODUCT.get(label.strip().lower())


def _sample_frame_indices(total: int, want: int) -> list[int]:
    if total <= 0:
        return []
    if total <= want:
        return list(range(total))
    step = total / want
    return sorted({min(total - 1, int(i * step)) for i in range(want)})


def _is_image_name(filename: str) -> bool:
    return Path(filename).suffix.lower() in {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


def extract_frames(video_path: Path, max_frames: int = TARGET_FRAMES) -> list:
    import cv2

    if _is_image_name(video_path.name):
        frame = cv2.imread(str(video_path))
        if frame is None:
            raise ValueError("Could not open image")
        return [frame]

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


def _resize_for_preview(frame):
    import cv2

    h, w = frame.shape[:2]
    if w <= PREVIEW_MAX_WIDTH:
        return frame, 1.0
    scale = PREVIEW_MAX_WIDTH / float(w)
    out = cv2.resize(frame, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    return out, scale


def _encode_jpeg_b64(frame) -> str:
    import cv2

    ok, buf = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
    if not ok:
        raise ValueError("Could not encode preview JPEG")
    return base64.b64encode(buf.tobytes()).decode("ascii")


def _draw_boxes(frame, boxes: list[dict]):
    import cv2

    annotated = frame.copy()
    for box in boxes:
        x1, y1, x2, y2 = (int(box["x1"]), int(box["y1"]), int(box["x2"]), int(box["y2"]))
        label = f'{box.get("label", "?")} {box.get("confidence", 0):.0%}'
        cv2.rectangle(annotated, (x1, y1), (x2, y2), (46, 204, 113), 2)
        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 1)
        y_text = max(y1 - 6, th + 4)
        cv2.rectangle(annotated, (x1, y_text - th - 4), (x1 + tw + 6, y_text + 2), (46, 204, 113), -1)
        cv2.putText(
            annotated,
            label,
            (x1 + 3, y_text - 2),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            (10, 20, 15),
            1,
            cv2.LINE_AA,
        )
    return annotated


def characterize_video(video_bytes: bytes, filename: str = "clip.mp4") -> dict:
    """Run open-vocab detection on sampled frames; return scores + annotated preview."""
    if len(video_bytes) > MAX_VIDEO_BYTES:
        raise ValueError(f"Video exceeds {MAX_VIDEO_BYTES // (1024 * 1024)}MB limit")

    model = ensure_model()
    suffix = Path(filename).suffix or (".jpg" if _is_image_name(filename) else ".mp4")

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=True) as tmp:
        tmp.write(video_bytes)
        tmp.flush()
        # NamedTemporaryFile keeps a generic name; preserve extension for image path
        path = Path(tmp.name)
        frames = extract_frames(path)

        preview_frame, _ = _resize_for_preview(frames[len(frames) // 2])
        preview_boxes: list[dict] = []
        scores: dict[str, list[float]] = defaultdict(list)
        raw: list[dict] = []

        if model is None:
            preview_b64 = _encode_jpeg_b64(preview_frame)
            return {
                "detections": [],
                "boxes": [],
                "preview_image_base64": preview_b64,
                "top_product_key": None,
                "confidence": 0.0,
                "frames_sampled": len(frames),
                "model": None,
                "vision_ready": False,
                "message": (
                    "Vision model unavailable — install ultralytics "
                    "(see requirements-vision.txt) or pick produce manually. "
                    "Preview frame is shown without boxes."
                ),
            }

        # Detect on the preview-sized mid frame so boxes match the JPEG we return
        detect_frames = [preview_frame]
        # Also sample a couple other frames for ranking (resized)
        for i, frame in enumerate(frames):
            if i == len(frames) // 2:
                continue
            if len(detect_frames) >= min(4, len(frames)):
                break
            resized, _ = _resize_for_preview(frame)
            detect_frames.append(resized)

        for fi, frame in enumerate(detect_frames):
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
                    product_key = _label_to_product(label)
                    xyxy = box.xyxy[0].tolist()
                    entry = {
                        "label": label,
                        "product_key": product_key,
                        "confidence": round(conf, 3),
                        "x1": round(xyxy[0], 1),
                        "y1": round(xyxy[1], 1),
                        "x2": round(xyxy[2], 1),
                        "y2": round(xyxy[3], 1),
                    }
                    raw.append(entry)
                    if fi == 0:
                        preview_boxes.append(entry)
                    if product_key:
                        scores[product_key].append(conf)

        annotated = _draw_boxes(preview_frame, preview_boxes) if preview_boxes else preview_frame
        preview_b64 = _encode_jpeg_b64(annotated)

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
            "boxes": preview_boxes,
            "raw": raw[:40],
            "preview_image_base64": preview_b64,
            "top_product_key": top["product_key"] if top else None,
            "confidence": top["confidence"] if top else 0.0,
            "frames_sampled": len(frames),
            "model": _model_name,
            "vision_ready": True,
            "message": (
                f"Detected {top['product_key']}" if top else "No catalog produce detected"
            ),
        }
