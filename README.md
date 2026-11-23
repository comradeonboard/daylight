# Daylight

**Live app:** https://comradeonboard.github.io/daylight/  
**Repository:** https://github.com/comradeonboard/daylight  
**Latest deploy:** https://github.com/comradeonboard/daylight/actions/runs/45287002842

A simple, dignified support companion for adults living independently, older adults, disabled people, and people with health conditions. It helps with daily check-ins, voice conversation, and reaching trusted people when needed.

> **Not a medical device or emergency service.** Daylight is a support companion, not a doctor. It does not diagnose, prescribe, or provide emergency care. In an emergency, call your local emergency number.

## What it does

- **I'm OK today** - one big check-in button with optional mood.
- **I need help / Emergency text** - records the request and prepares an SMS/share alert to trusted contacts with reason, message, and optional location (device-dependent).
- **Built-in voice companion** - users talk by text or microphone. Daylight replies with Gemini and speaks back at normal rate/pitch (`rate 1, pitch 1`). No AI setup shown to users.
- **Proactive check-ins** - if things stay quiet for around 20 minutes, Daylight checks in automatically while the app is open/running.
- **Action support** - companion can open help flow, trigger a call to a trusted contact, or prepare emergency SMS/share messages when needed.
- **Trusted circle dashboard** - green/amber/red status, help requests, recent health notes, activity.
- **Accessibility** - large/extra-large text, high contrast, simple view, big tap targets, screen-reader labels, voice input, spoken replies.
- **Real on-device data** - check-ins, messages, health notes, contacts, and settings stored in localStorage. Users can export or delete data in Settings.
- **Privacy/consent** - explicit sharing consent, no hidden tracking, no automatic emergency calls without user action.

## Current status

- **Mobile responsive**: improved for phone layouts.
- **Gemini configured for deployment**: uses `VITE_GEMINI_API_KEY` and `VITE_GEMINI_MODEL` (GitHub Actions secrets). Current model: `gemini-2.5-flash`.
- **Live**: deployed via GitHub Pages Actions workflow.

## Important limitations

- **Browser/PWA limitation**: cannot silently place calls or send SMS in the background. Device/OS may require user confirmation.
- **Background limitation**: proactive check-ins work while app is open/running. True 15-30 minute checks while closed require a native wrapper/push/background service.
- **Speech quality**: depends on device/browser TTS voices.
- **Frontend key exposure**: `VITE_*` keys are embedded in client builds. Not suitable for production health deployments.

## Security and safety notes

- **Rotate exposed keys** shared in chat immediately in Google AI Studio / Google Cloud.
- Do not put API keys in frontend for production; move Gemini calls behind a secure backend proxy.
- For reliable delivery, add backend SMS/call provider (Twilio etc.) with consent, audit logs, retries, and delivery status.
- Before real deployment: clinical/safeguarding review, GDPR/DPIA, accessibility audit (WCAG), authentication/encrypted backend, roles/permissions, and clear emergency escalation policy.

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

Workflow: `.github/workflows/deploy.yml`. In repo settings, set **Pages → Source: GitHub Actions**. Pushes to `main` deploy automatically.
