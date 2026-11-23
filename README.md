# Daylight

**Live app:** https://comradeonboard.github.io/daylight/  
**Repository:** https://github.com/comradeonboard/daylight

A simple, dignified support companion for adults living independently, older adults, disabled people, and people with health conditions. It helps with daily check-ins, voice conversation, and reaching trusted people when needed.

> **Not a medical device or emergency service.** Daylight is a support companion, not a doctor. It does not diagnose, prescribe, or provide emergency care. In an emergency, call your local emergency number.

## What it does

- **I'm OK today**: one big check-in button with optional mood.
- **I need help / Emergency text**: records the request and prepares an SMS/share alert to trusted contacts with reason, message, and optional location (device-dependent).
- **Built-in voice companion**: users talk by text or microphone. Daylight replies with Gemini and speaks back at normal rate/pitch (`rate 1`, `pitch 1`). No AI setup shown to users.
- **Proactive check-ins**: if things stay quiet for around 20 minutes, Daylight checks in automatically while the app is open/running.
- **Action support**: companion can open help flow, trigger a call to a trusted contact, or prepare emergency SMS/share messages when needed.
- **Trusted circle dashboard**: green/amber/red status, help requests, recent health notes, and activity.
- **Account and health reports**: sign in with email or Google, keep account details in settings, and email or copy a health report when requested.
- **Accessibility**: large/extra-large text, high contrast, simple view, big tap targets, screen-reader labels, voice input, and spoken replies.
- **Real on-device data**: check-ins, messages, health notes, contacts, and settings are stored on device. Users can export or delete data in Settings.
- **Privacy/consent**: explicit sharing consent, no hidden tracking, no automatic emergency calls without user action.

## Current status

- **Mobile responsive**: improved for phone layouts.
- **Voice companion**: built in, with Gemini responses and normal speech output.
- **Authentication**: email/password and Google sign-in are implemented in the app using Firebase Auth. Cloud sync uses Firestore when Firebase is configured.
- **Health report delivery**: health report can be emailed through a configured report endpoint, with device share/mail fallback.
- **Deployment**: GitHub Pages workflow deploys on push to `main`.

## Configuration

Set these in GitHub Actions secrets for deployment (or `.env` for local development):

```bash
# Gemini
VITE_GEMINI_API_KEY=
VITE_GEMINI_MODEL=gemini-2.5-flash

# Firebase Auth + Firestore
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=

# Optional backend endpoint for sending health report emails
# POST { to, subject, report, name } with Authorization: Bearer <Firebase ID token>
VITE_REPORT_EMAIL_ENDPOINT=
```

## Important limitations

- **Browser/PWA limitation**: cannot silently place calls or send SMS in the background. Device/OS may require user confirmation.
- **Background limitation**: proactive check-ins work while the app is open/running. True 15 to 30 minute checks while closed require a native wrapper/push/background service.
- **Speech quality**: depends on device/browser TTS voices.
- **Frontend key exposure**: `VITE_*` keys are embedded in client builds. For production health deployments, move Gemini calls and sensitive operations behind a secure backend.
- **Email delivery**: automatic email delivery requires a configured backend endpoint; otherwise the app uses device share/mail fallback.

## Security and safety notes

- **Rotate exposed keys** immediately if they were shared in chat or logs.
- Do not put sensitive keys in frontend for production; use a secure backend proxy.
- For reliable delivery, add a backend SMS/call provider with consent, audit logs, retries, and delivery status.
- Before real deployment: clinical/safeguarding review, GDPR/DPIA, accessibility audit (WCAG), authentication hardening, encrypted backend, roles/permissions, and clear emergency escalation policy.

## Run locally

```bash
cd daylight
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## GitHub Pages

Workflow: `.github/workflows/deploy.yml`. In repo settings, set **Pages > Source: GitHub Actions**. Pushes to `main` deploy automatically.
