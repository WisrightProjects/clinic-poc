"""
ClinicAI STT sidecar
====================

A small HTTP service that wraps faster-whisper so the Node backend can transcribe
patient audio without bundling a Python ML stack. The backend POSTs an audio file
here exactly the way it would call a paid STT API.

The Whisper model is loaded once at startup and kept warm in memory.

Run:
    pip install -r requirements.txt
    uvicorn main:app --host 0.0.0.0 --port 8000

Config (env vars):
    WHISPER_MODEL          model size: tiny | base | small | medium | large-v3  (default: small)
    WHISPER_DEVICE         cpu | cuda                                           (default: cpu)
    WHISPER_COMPUTE_TYPE   int8 | int8_float16 | float16 | float32             (default: int8)
"""

import os
import tempfile

from fastapi import FastAPI, File, Form, UploadFile
from faster_whisper import WhisperModel

MODEL_SIZE = os.getenv("WHISPER_MODEL", "small")
DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")

app = FastAPI(title="ClinicAI STT", version="1.0.0")

# Loaded once; downloads the model on first run and caches it.
model = WhisperModel(MODEL_SIZE, device=DEVICE, compute_type=COMPUTE_TYPE)


@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL_SIZE}


@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...), language: str = Form(None)):
    """Transcribe an uploaded audio file. `language` is optional (None => auto-detect)."""
    suffix = os.path.splitext(file.filename or "")[1] or ".m4a"
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(await file.read())
            tmp_path = tmp.name

        segments, info = model.transcribe(tmp_path, language=language or None)
        text = " ".join(segment.text.strip() for segment in segments).strip()
        return {"transcript": text, "language": info.language}
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)
