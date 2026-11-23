# Daylight

**Live app:** https://comradeonboard.github.io/daylight/  
**Repository:** https://github.com/comradeonboard/daylight

A simple, dignified daily check-in for adults living independently or with health conditions - and a trusted circle who notices when something feels wrong.

> **Not a medical device or emergency service.** Daylight records what people report and helps them reach their circle. In an emergency, call your local emergency number.

## What it does

- **I'm OK today** - one big check-in button, optional mood.
- **I need help / Send emergency text** - records the request and prepares an SMS/share alert to trusted contacts with reason, message, and optional location (device-dependent).
- **Built-in companion (text + voice)** - Daylight chats by text or microphone, sends proactive check-ins, speaks replies aloud at a normal rate/pitch, and records health notes the user reports. No AI setup is shown to users.
- **Trusted circle dashboard** - green/amber/red status, help requests, recent health notes, activity.
- **Accessibility** - large/extra-large text, high contrast, simple view, big tap targets, screen-reader labels, voice input, optional spoken replies.
- **Real local data** - check-ins, messages, health notes, contacts, and settings are stored on-device in localStorage. Users can export or delete their data from Settings.
- **Privacy/consent** - explicit sharing consent, no hidden tracking, no automatic emergency calls without user action.

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

## Important safety / production notes

- Daylight **does not diagnose**, prescribe, or provide emergency care. It is a support companion, not an AI doctor.
- Emergency texting currently uses device capabilities (`sms:` / Web Share / clipboard fallback). For reliable delivery, add a backend SMS provider (Twilio, etc.) with consent, audit logs, and retries.
- **Gemini key security**: do not put API keys in the frontend for production. Configure `VITE_GEMINI_API_KEY` as a GitHub Actions secret for deployment builds, and preferably move AI calls behind a secure backend proxy. The value you shared should be treated as exposed and rotated.
- For real multi-person/shared-circle use, add authentication, encrypted backend storage, roles/permissions, and audit trails.
- Before real deployment: clinical/safeguarding review, GDPR/DPIA, accessibility audit (WCAG), and clear emergency escalation policy.
