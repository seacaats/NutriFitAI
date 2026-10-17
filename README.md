# NutriFitAI

An Intelligent Food Recognition and Personalized Nutrition & Fitness Assistant.

Snap a photo of a meal and NutriFitAI recognises the foods (Filipino dishes included), estimates their calories and macros, and logs them. Alongside that it tracks workouts, steps, water and weight, and has an AI coach, Nori, that answers from the user's own data. It runs on Android, iOS and the web from one codebase, with a web-only admin panel.

## Features

- **Food scanner:** a custom YOLOv8n model detects 165 foods in a photo; adjust servings and log the meal.
- **Dashboard and progress:** calories, macros, steps, water, workouts and weight for today, a week, a month, 3 months or a year, plus a logging streak.
- **Workouts:** an exercise catalog (from wger), favorites, custom routines, a set and timer tracker, plans up to 7 days ahead with reminders.
- **Steps:** synced from Health Connect (Android) or HealthKit (iOS), with manual edits.
- **Water:** quick-add glasses, daily goal, editable history.
- **AI coach:** chat grounded in the user's logged data, with safety rules and a choice of tone.
- **Notifications:** reminders, goal and streak achievements, and account security notices, by push, inbox and email.
- **Accounts:** email sign-up with a verification code, Google sign-in, password reset, "Remember me" sessions, onboarding wizard, account deletion.
- **Admin panel (web):** analytics, user management (suspend, revoke, promote, demote, roles) and a tamper-evident audit log.
- **Offline-friendly:** screens show their last saved data when the server can't be reached.

## Repository

| Folder | What | Stack |
|---|---|---|
| [`frontend/`](frontend/README.md) | The app: Android, iOS and website | Expo SDK 57, React Native 0.86, Expo Router |
| [`backend/`](backend/README.md) | The REST API | Node.js, Express 4, MongoDB (Mongoose 9) |
| [`model/`](model/README.md) | Food-detection server | Python, FastAPI, ONNX Runtime (YOLOv8n) |

```
 App (phone / web) ──► Express API ──► MongoDB Atlas
                            ├────────► Cloudflare R2 (photos)
                            ├────────► Groq / Cerebras (AI coach)
                            ├────────► SMTP, Expo Push (notifications)
                            └────────► Model server (food detection)
```

## Quick start (local)

**You need:** Node.js 20+, Python 3.11, a MongoDB Atlas cluster (or local MongoDB), and `mongosh`.

```bash
# 1. Backend
cd backend
cp .env.example .env          # fill in MONGODB_URI, the secrets, Google, SMTP (see backend/README.md)
npm install
npm run dev                   # http://localhost:4000/ngrok tunnel if set

# 2. Model server
cd ../model
pip install -r requirements.txt
python -m uvicorn chosen_python_script:app --port 8000  # http://127.0.0.1:8000

# 3. App
cd ../frontend
npm install
npm run start:local (local)                # w = website, or open the dev client on a phone on the same Wi-Fi
npm run start:tunnel (with ngrok tunnel, change URL in package.json)
```

## Deployment

| Part | Where |
|---|---|
| Website | Vercel, `/api` forwarded to the backend |
| Backend | Render web service |
| Model server | Render web service |
| Phone apps | EAS Build (`preview` APK, `production` store builds) |