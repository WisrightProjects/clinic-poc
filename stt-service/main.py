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
    WHISPER_NUM_WORKERS    concurrent transcriptions (default: 2) — see below
"""

import os
import tempfile

from fastapi import FastAPI, File, Form, UploadFile
from faster_whisper import WhisperModel

MODEL_SIZE = os.getenv("WHISPER_MODEL", "small")
DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
# A single model instance serialises concurrent transcribe() calls. num_workers > 1
# lets two attenders' answers transcribe in parallel, at the cost of extra RAM per
# worker (small/int8 ≈ 1-2 GB each). Raise only if the box has the memory.
NUM_WORKERS = int(os.getenv("WHISPER_NUM_WORKERS", "2"))

app = FastAPI(title="ClinicAI STT", version="1.0.0")

# Loaded once at import. The model is baked into the image at build time (see
# Dockerfile), so this resolves from the local cache and never hits the network.
model = WhisperModel(
    MODEL_SIZE, device=DEVICE, compute_type=COMPUTE_TYPE, num_workers=NUM_WORKERS
)


@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL_SIZE}


@app.post("/transcribe")
def transcribe(file: UploadFile = File(...), language: str = Form(None)):
    """Transcribe an uploaded audio file. `language` is optional (None => auto-detect).

    Deliberately a sync `def`, not `async def`: model.transcribe() is blocking CPU work,
    and inside an async handler it would stall the whole event loop — serialising every
    request and starving /health while a transcription runs. FastAPI runs sync handlers
    in a threadpool, so the loop stays responsive and num_workers gives real parallelism.
    """
    suffix = os.path.splitext(file.filename or "")[1] or ".m4a"
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(file.file.read())
            tmp_path = tmp.name

        # vad_filter drops silent/near-silent regions before decoding. Without it,
        # Whisper (especially the "small" model) hallucinates training-data phrases on
        # silence — most infamously "Thank you for watching!". condition_on_previous_text
        # is disabled so one segment's guess can't bias the next into a repetition loop.
        segments, info = model.transcribe(
            tmp_path,
            language=language or None,
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=500),
            condition_on_previous_text=False,
        )
        text = " ".join(segment.text.strip() for segment in segments).strip()
        return {"transcript": text, "language": info.language}
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)
