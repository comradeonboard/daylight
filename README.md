# Daylight

A simple, dignified daily check-in for adults living independently or with health conditions  -  and a trusted circle who notices when something feels wrong.

> **Not a medical device or emergency service.** Daylight records what people report and helps them reach their circle. In an emergency, call your local emergency number.

## What it does

- **I'm OK today**  -  one big check-in button, optional mood.
- **I need help**  -  sends a clear alert to a trusted circle (demo: in-app).
- **Chat with Daylight**  -  text or voice. The assistant listens, records health notes (mood, symptoms, pain, meds mentioned), and gives supportive non-medical responses.
- **Trusted circle dashboard**  -  green/amber/red status, recent health notes, activity, and help requests.
- **Accessibility**  -  large text, extra-large text, high contrast, simple view, big tap targets, screen-reader labels, voice input, optional spoken replies.
- **Privacy/consent**  -  explicit sharing consent, local-first storage, no hidden tracking.

## Run locally

```bash
cd daylight
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173). Open in two tabs to see the **My day** and **Circle** views stay in sync.

## Build

```bash
npm run build
npm run preview
```

## Deploy to GitHub Pages

This repo includes `.github/workflows/deploy.yml`.

1. Create a GitHub repo and push this folder.
2. In GitHub: **Settings → Pages → Source: GitHub Actions**.
3. Push to `main` (or run the workflow manually). The site will be published at the Pages URL shown in the workflow.

`vite.config.ts` uses `base: './'` so it works on GitHub Pages project URLs.

## What to change next

- **Real alerts**: wire help requests to SMS/email/push (Twilio, email, Firebase, etc.). Add delivery status and retries.
- **Real AI**: replace `src/assistant.ts` rule-based replies with an LLM API call. Keep the safety rules: no diagnosis, urgent-symptom escalation, clear "not medical advice".
- **Authentication & shared data**: move from localStorage to a backend so the circle can see status remotely. Add per-person permissions.
- **Health record structure**: add medication schedules, condition-specific prompts, export/share summaries, clinician-friendly PDF (with consent).
- **Passive signals (carefully)**: optional phone-activity or wearable signals, only with explicit consent and clear explanation.
- **Safety & compliance**: clinical safety review, GDPR/DPIA, accessibility audit (WCAG), safeguarding for vulnerable adults, emergency escalation policy.
- **Localization**: emergency numbers, language, date/time formats, culturally appropriate copy.

## Important safety notes

- Daylight **does not diagnose**, prescribe, or provide emergency care.
- Urgent symptoms in chat trigger an emergency prompt, but the app should never be the only safety net.
- Any real deployment needs consent flows, data protection review, and human escalation paths.
