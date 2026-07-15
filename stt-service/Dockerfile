FROM python:3.11-slim

# ffmpeg is needed by faster-whisper (via PyAV) to decode .m4a / .wav uploads.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Model size is a BUILD arg, not just a runtime env — the weights are baked into the
# image below, so changing the model means rebuilding:
#   docker build --build-arg WHISPER_MODEL=medium ./stt-service
# Setting WHISPER_MODEL only at runtime would silently re-download at boot, which is
# exactly what baking it in is meant to prevent.
ARG WHISPER_MODEL=small
ARG WHISPER_COMPUTE_TYPE=int8

ENV WHISPER_MODEL=${WHISPER_MODEL} \
    WHISPER_COMPUTE_TYPE=${WHISPER_COMPUTE_TYPE} \
    WHISPER_DEVICE=cpu \
    WHISPER_NUM_WORKERS=2 \
    HF_HOME=/opt/models

# Download the model AT BUILD TIME so the image is self-contained. Without this the
# container fetches ~500MB from HuggingFace on first boot — meaning a fresh server (or
# any deploy with an empty cache volume) depends on HF being reachable, and the service
# is simply broken if it isn't. Baking it in makes deploys deterministic and offline-safe.
RUN python -c "from faster_whisper import WhisperModel; WhisperModel('${WHISPER_MODEL}', device='cpu', compute_type='${WHISPER_COMPUTE_TYPE}')"

COPY . .

# Run unprivileged. /opt/models is read-only at runtime; the app only writes to /tmp.
RUN useradd --create-home --uid 10001 stt && chown -R stt:stt /opt/models
USER stt

EXPOSE 8000

# Coolify / compose use this to know the model has finished loading and the service is
# ready. start-period covers the model load; the endpoint is cheap and does not transcribe.
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4).status == 200 else 1)"

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
