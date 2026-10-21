const axios = require('axios');
const config = require('../config');

// Google Gemini (paid, Google AI Studio key) — one model used for both speech-to-text and the
// AI summary, through the native generateContent API (it takes audio inline). Real patients
// need a key from a project with billing on: on the free tier Google may use the requests.
// No temperature/thinking overrides: Google advises keeping Gemini 3 at its defaults (a low
// temperature can make it loop), and a 'low' thinking level wrote our Tamil test in Telugu.

const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

// Audio types Gemini accepts, by the recording's file extension. Unknown → audio/mp4 (what the
// app records). .m4a must go as audio/mp4: labelled audio/m4a, Gemini read Tamil as Telugu.
const AUDIO_MIME = { '.m4a': 'audio/mp4', '.mp4': 'audio/mp4', '.aac': 'audio/aac', '.mp3': 'audio/mp3', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.flac': 'audio/flac' };
const audioMimeType = ext => AUDIO_MIME[String(ext).toLowerCase()] || 'audio/mp4';

// A file sent inside the request (audio for STT, report photos for the summary), base64.
const inlinePart = (mimeType, data) => ({ inline_data: { mime_type: mimeType, data } });

// The reply text, or an error message when the reply can't be trusted: no candidate (blocked),
// or one that stopped for any reason but finishing (cut off at MAX_TOKENS, SAFETY, …) — a
// half transcript or summary must not be saved as if complete.
function readReply(data) {
  const candidate = data?.candidates?.[0];
  if (!candidate) return { error: `no reply (${data?.promptFeedback?.blockReason || 'empty'})` };
  if (candidate.finishReason && candidate.finishReason !== 'STOP') {
    return { error: `reply stopped early (${candidate.finishReason})` };
  }
  return { text: (candidate.content?.parts || []).map(p => p.text || '').join('').trim() };
}

// Gemini's quota (429) and server (5xx) errors are usually brief: retry twice before giving up,
// so a burst of answers recorded back to back isn't marked failed. Without a response, only errors
// where the request never reached Google are retried (DNS, refused): after a timeout or a dropped
// connection Google may already have processed — and billed — it.
const RETRY_DELAYS_MS = [2000, 5000];
const NOT_SENT = new Set(['EAI_AGAIN', 'ENOTFOUND', 'ECONNREFUSED']);
const isRetryable = err => (err.response ? err.response.status === 429 || err.response.status >= 500 : NOT_SENT.has(err.code));
// All attempts together stay under this, so the summary (awaited inside the submit request)
// answers before the app's 120 s submit timeout gives up and the attender sends again.
const DEADLINE_MS = 90000;
const MIN_ATTEMPT_MS = 10000;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Send `parts` (text and/or inline audio) and return the reply text. `task` names the stage
// in errors ("Gemini STT error: …"). `deadline` (a Date.now() time) lets several calls that
// serve one request share one time limit (CLINIC-018: photo checks + summary).
async function generate(task, parts, deadline = Date.now() + DEADLINE_MS) {
  if (!config.geminiApiKey) throw new Error('GEMINI_API_KEY is not configured');
  for (let attempt = 0; ; attempt++) {
    const timeLeft = deadline - Date.now();
    // axios treats a timeout of 0 as "no timeout", so never start without time left.
    if (timeLeft <= 0) throw new Error(`Gemini ${task} error: out of time`);
    let data;
    try {
      ({ data } = await axios.post(
        `${API_URL}/${encodeURIComponent(config.geminiModel)}:generateContent`,
        { contents: [{ parts }] },
        { headers: { 'x-goog-api-key': config.geminiApiKey, 'Content-Type': 'application/json' },
          timeout: Math.min(60000, timeLeft) }
      ));
    } catch (err) {
      const delay = RETRY_DELAYS_MS[attempt];
      if (delay !== undefined && isRetryable(err) && deadline - Date.now() - delay >= MIN_ATTEMPT_MS) {
        await sleep(delay);
        continue;
      }
      throw new Error(`Gemini ${task} error: ${err.response?.data?.error?.message || err.message}`);
    }
    const reply = readReply(data);
    if (reply.error) throw new Error(`Gemini ${task} error: ${reply.error}`);
    return reply.text;
  }
}

module.exports = { generate, audioMimeType, inlinePart, readReply, DEADLINE_MS };
