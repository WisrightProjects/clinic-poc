# ClinicAI

AI-powered patient intake for clinics. An attender records the patient's spoken answers on the
mobile app, the backend transcribes them (self-hosted Whisper) and writes an AI summary, and the
doctor reviews the summary and answers on a web dashboard before the consultation.

| Folder | What it is |
|---|---|
| `backend/` | API server (Express + PostgreSQL), port 4000 |
| `frontend/` | Doctor web dashboard (React + Vite), port 5173 |
| `mobile/` | Attender app (React Native + Expo) |
| `stt-service/` | Whisper speech-to-text service (Python), port 8000 |
| `db/` | Database migrations and demo seed data |
| `docs/stories/` | Feature specs (CLINIC-001 … 016) |

For architecture and conventions, read [`CLAUDE.md`](CLAUDE.md).

## 1. Access

- GitHub access to `WisrightProjects/clinic-poc`.
- You do **not** need production passwords, the Coolify login or the Kimi API key to start.

## 2. Software to install

| Software | Version | Why |
|---|---|---|
| Git | latest | Clone and push code |
| Node.js | **22 LTS** (24 also works) | Backend, doctor web, mobile app (Vite needs 20.19+) |
| PostgreSQL | 16 or newer | Local database |
| Python | 3.11 | Whisper speech-to-text service |
| ffmpeg | latest, on your PATH | Whisper needs it to read audio |
| VS Code | latest | Editor |
| Expo Go (Android phone) | Play Store | Run the mobile app over Wi-Fi |

Only for building APKs: Android Studio (Android SDK) + JDK 17, and at least 16 GB RAM.

## 3. First-time setup

```bash
git clone https://github.com/WisrightProjects/clinic-poc.git
cd clinic-poc
npm install                    # root: database scripts
```

Create an empty PostgreSQL database named `doctor_attender`.

**Backend** (terminal 1)

```bash
cd backend
npm install
copy .env.example .env         # then set DATABASE_URL with your own postgres password
npm run dev                    # port 4000; creates the tables automatically on start
```

**Demo data** (from the repo root, once the backend has started)

```bash
npm run seed
```

The seed also creates two demo logins in "Default Clinic" (local only, never production):
doctor `9000000001` / `demo1234`, attender `9000000002` / `demo1234`.

**Whisper speech-to-text** (terminal 2)

```bash
cd stt-service
pip install -r requirements.txt
uvicorn main:app --port 8000   # first run downloads the model (a few minutes)
```

**Doctor web** (terminal 3)

```bash
cd frontend
npm install
npm run dev                    # http://localhost:5173
```

**Mobile app** (terminal 4)

```bash
cd mobile
npm install
npm start                      # open the shown URL in Expo Go on your phone
```

## 4. Settings

**`backend/.env`**

- Keep `SUMMARY_PROVIDER=mock`. It returns a canned summary at no cost, and no patient data
  goes to a paid external AI. Use `kimi` only when you are testing summaries, with a key from
  your lead.

**`mobile/.env`**

- Set `EXPO_PUBLIC_API_URL=http://<your laptop IP>:4000/api`. Find the IP with `ipconfig`
  (Wi-Fi, IPv4 Address).
- Your phone and laptop must be on the same Wi-Fi.
- Windows Firewall must allow inbound ports **8081** (Expo) and **4000** (backend).

## 5. Team rules

- Work on a feature branch, open a PR to `master`, and get it reviewed before merging.
  Don't push directly to `master`.
- Never commit `.env` files or API keys.
- Database changes: add a **new** numbered file in `db/migrations/` (for example
  `006_add_clinics.sql`). Never edit a migration that is already merged. The backend runs new
  migrations on start, so merging and redeploying applies them to production automatically.
- Don't point your local app at the production API or database while developing.
- Read the matching story in `docs/stories/` before changing a feature.

## 6. Tests

```bash
npm test                       # repo root: shared logic tests
cd backend && npm test         # backend unit tests
cd frontend && npm run lint    # doctor web lint
```

## 7. Known issues on Windows

- If `npx` fails in Git Bash, run the command in PowerShell instead.
- The local APK build uses a lot of memory and can freeze the laptop. Close Chrome first.
