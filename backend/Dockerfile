FROM python:3.12-slim

WORKDIR /app

# System libs for OpenCV (headless) video decode
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt requirements-vision.txt ./
# Install matching CPU torch + torchvision together. Ultralytics NMS needs
# torchvision::nms; a PyPI torchvision wheel against CPU torch breaks inference
# with: "operator torchvision::nms does not exist".
RUN pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r requirements-vision.txt \
    && pip install --no-cache-dir --force-reinstall torchvision --index-url https://download.pytorch.org/whl/cpu \
    && python -c "import torch, torchvision; from torchvision.ops import nms; print(torch.__version__, torchvision.__version__, 'nms_ok')"

# Prefetch detector weights once at image build (Render deploy), not at runtime.
# Default matches VISION_MODEL. Override e.g.:
#   docker build --build-arg PREFETCH_MODELS="yolov8n.pt yolov8s-worldv2.pt" .
ARG PREFETCH_MODELS=yolov8n.pt
ENV YOLO_CONFIG_DIR=/app/.ultralytics \
    ULTRALYTICS_SETTINGS=/app/.ultralytics/settings.json \
    PREFETCH_MODELS=${PREFETCH_MODELS}
COPY scripts/prefetch_models.py /tmp/prefetch_models.py
RUN mkdir -p /app/.ultralytics \
    && python /tmp/prefetch_models.py \
    && rm /tmp/prefetch_models.py \
    && ls -lh /app/*.pt

COPY app ./app
COPY .env.example ./.env.example

ENV PORT=8000 \
    VISION_MODEL=yolov8n.pt
EXPOSE 8000

# Render injects $PORT; local/docker default to 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
