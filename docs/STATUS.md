# Daylight Status

**Live app:** https://comradeonboard.github.io/daylight/  
**Repository:** https://github.com/comradeonboard/daylight  
**Latest successful deploy:** https://github.com/comradeonboard/daylight/actions/runs/45287002842

## Current product direction

Daylight is a simple, dignified support companion for adults living independently, older adults, disabled people, and people with health conditions. It is **not a doctor or emergency service**.

## What is implemented

- **Mobile-responsive UI** for phone layouts.
- **Check-in flow**: "I'm OK today", mood, help request, trusted circle view.
- **Built-in voice companion**: users chat by text or microphone; no AI setup shown to users.
- **Gemini-powered replies**: uses `VITE_GEMINI_API_KEY` and `VITE_GEMINI_MODEL` from deployment environment/GitHub Actions secrets. Current configured model: `gemini-2.5-flash`.
- **Natural speech output**: browser speech synthesis at normal rate/pitch (`rate: 1`, `pitch: 1`, `volume: 1`).
- **Proactive check-ins**: when quiet for around 20 minutes, Daylight sends a spoken check-in (while app is open/running).
- **Action intents**: companion can trigger help flow, call a trusted contact (`tel:`), or prepare emergency SMS/share text to contacts.
- **Emergency text**: includes reason/message and optional location; uses device Web Share / SMS / clipboard fallback.
- **Real on-device data**: check-ins, messages, health notes, contacts, and settings stored in localStorage; export/delete data available in Settings.
- **Consent/privacy basics**: explicit sharing consent, no hidden tracking, no automatic emergency calls without user action.

## Important limitations

- **Browser/PWA limitation**: cannot silently place calls or send SMS in the background. Device/OS may require user confirmation.
- **Background limitation**: proactive checks work while the app is open/running. True 15-30 minute checks while closed require native wrapper/push/background service.
- **Speech quality**: depends on device/browser TTS voices.
- **Frontend key exposure**: `VITE_*` keys are embedded in client builds. Not suitable for production health deployments.

## Security actions required

- **Rotate exposed keys** shared in chat immediately in Google AI Studio / Google Cloud.
- Store keys only in secure secret managers / backend env vars.
- Move Gemini calls behind a **secure backend proxy** before real deployment.
- Add authentication, encrypted backend storage, audit logs, roles/permissions for shared circle.

## Safety/compliance required before real deployment

- Clinical/safeguarding review.
- GDPR/DPIA and privacy/legal review.
- Accessibility audit (WCAG).
- Clear emergency escalation policy.
- Reliable SMS/call delivery provider with consent, retries, and delivery status.

## Suggested next steps

1. Build backend proxy for Gemini + secure key handling.
2. Add authenticated backend for shared circle data and remote alerts.
3. Add reliable SMS/call provider integration (Twilio or equivalent) with audit logs.
4. Add native/mobile wrapper for true background check-ins and push notifications.
5. Conduct safety, privacy, and accessibility review.
