FROM python:3.11-slim

# ffmpeg is needed by faster-whisper (via PyAV) to decode .m4a / .wav uploads.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Model size baked at build/deploy time; override in Coolify / compose env.
# 'small' is a good CPU default; bump to 'medium'/'large-v3' on stronger hardware.
ENV WHISPER_MODEL=small \
    WHISPER_DEVICE=cpu \
    WHISPER_COMPUTE_TYPE=int8

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
