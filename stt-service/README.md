# ClinicAI STT sidecar (faster-whisper)

A small HTTP service that transcribes patient audio with the open-source
[faster-whisper](https://github.com/SYSTRAN/faster-whisper) model. The Node backend
(`backend/`) calls this instead of the paid Sarvam API when `STT_PROVIDER=whisper`
(the default). The backend POSTs the recorded audio file here and gets text back —
the same shape as a hosted STT API, so the two providers are interchangeable.

Supports Tamil, Hindi, English, and code-mixed speech (Whisper auto-detects the
language, or the backend can force one via `STT_LANGUAGE`).

## Run locally (no Docker)

Requires Python 3.9+ and `ffmpeg` on your PATH.

```bash
cd stt-service
pip install -r requirements.txt
uvicorn main:app --port 8000          # first run downloads the model (~cached afterwards)
```

Check it:

```bash
curl http://localhost:8000/health                       # {"status":"ok","model":"small"}
curl -F file=@sample.m4a http://localhost:8000/transcribe
```

## Run with Docker

From the repo root:

```bash
docker compose -f docker-compose.stt.yml up --build
```

## Configuration (env vars)

| Var | Default | Notes |
|---|---|---|
| `WHISPER_MODEL` | `small` | `tiny`/`base`/`small`/`medium`/`large-v3`. Bigger = more accurate (esp. Tamil/Hindi) but slower and more RAM. |
| `WHISPER_DEVICE` | `cpu` | set `cuda` only on a machine with an NVIDIA GPU. |
| `WHISPER_COMPUTE_TYPE` | `int8` | `int8` is the fast CPU choice; use `float16` on GPU. |

**Model size vs RAM (rough):** `small` ≈ 1–2 GB, `medium` ≈ 2–3 GB, `large-v3` ≈ 4–5 GB.
On a CPU-only laptop/VPS, `small` (default) is responsive; `medium` is a good accuracy/speed
balance if you have the RAM and can tolerate slower transcription.

## API

`POST /transcribe` — multipart form:
- `file` (required) — the audio file.
- `language` (optional) — e.g. `ta`, `hi`, `en`. Omit for auto-detect.

Returns: `{ "transcript": "...", "language": "ta" }`
