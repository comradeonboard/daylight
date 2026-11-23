import type { AppState, HealthEntry, Mood } from './types';
import { dayKey, uid } from './utils';

const symptomWords = [
  'pain', 'ache', 'dizzy', 'tired', 'fatigue', 'breathless', 'short of breath',
  'nausea', 'sick', 'headache', 'cough', 'fever', 'shaky', 'weak', 'swollen',
  'anxious', 'sad', 'lonely', 'confused', 'sore', 'stiff',
];

const urgentPattern = /(chest pain|can't breathe|cannot breathe|stroke|unconscious|bleeding|suicide|kill myself|severe pain|heart attack)/i;

export function extractHealth(input: string): Partial<HealthEntry> | null {
  const text = input.toLowerCase();
  const symptoms = symptomWords.filter((word) => text.includes(word));
  let mood: Mood | undefined;
  if (/(great|good|fine|well|better|happy|okay|ok|alright)/.test(text)) mood = /(great|good|fine|well|better|happy)/.test(text) ? 'good' : 'okay';
  if (/(rough|bad|unwell|poor|terrible|awful|sad|lonely|pain|hurt|worse)/.test(text)) mood = 'rough';
  const painMatch = text.match(/\b([0-3])\s*\/\s*3\b/) || text.match(/pain\s*([0-3])\b/);
  const pain = painMatch ? (Number(painMatch[1]) as 0 | 1 | 2 | 3) : undefined;
  const healthSignal = /(feel|pain|ache|tired|dizzy|medic|pill|tablet|insulin|blood|sugar|pressure|breath|sleep|symptom|unwell|sick|better|worse|mood|anxious|sad)/.test(text);
  if (!healthSignal && symptoms.length === 0 && !mood && pain === undefined) return null;
  const summaryBits: string[] = [];
  if (mood) summaryBits.push(`feeling ${mood}`);
  if (symptoms.length) summaryBits.push(symptoms.slice(0, 3).join(', '));
  if (pain !== undefined) summaryBits.push(`pain ${pain}/3`);
  return { id: uid(), at: new Date().toISOString(), source: 'chat', summary: summaryBits.length ? summaryBits.join(' · ') : input.slice(0, 80), mood, symptoms: symptoms.length ? symptoms : undefined, pain, note: input.slice(0, 240) };
}

export function localAssistantReply(input: string, state: AppState): { text: string; health?: Partial<HealthEntry> } {
  const question = input.toLowerCase().trim();
  const emergency = state.settings.emergencyNumber || '999';
  const firstName = state.settings.displayName.split(' ')[0] || 'there';
  const health = extractHealth(input);

  if (urgentPattern.test(question)) {
    return { text: `This could be urgent. Please call ${emergency} now, or ask someone nearby to help. If you can, tap "I need help" so your circle is alerted. I can't provide emergency medical care.`, health: health ?? { id: uid(), at: new Date().toISOString(), source: 'chat', summary: 'Urgent concern reported', note: input.slice(0, 240) } };
  }
  if (/(help|fallen|emergency|urgent)/.test(question)) {
    return { text: `Tap the red "I need help" button and your circle will be told. If you're in immediate danger, call ${emergency}.`, health: health ?? undefined };
  }
  if (/(medic|pill|tablet|insulin|injection|dose|prescription)/.test(question)) {
    const summary = health?.summary ?? 'Medication mentioned';
    return { text: `I've noted that for you: ${summary}. I can't give medical advice or change doses - please follow your prescription or call your GP/pharmacist if you're unsure.`, health: { ...health, id: uid(), at: new Date().toISOString(), source: 'chat', summary, note: input.slice(0, 240) } };
  }
  if (health) {
    const conditions = state.settings.healthConditions.length ? ` I'll keep your ${state.settings.healthConditions.join(', ')} in mind when checking in.` : '';
    return { text: `Thanks for telling me, ${firstName}. I've recorded: ${health.summary}. If anything feels serious or gets worse, please call ${emergency} or your GP/111. I'm here to listen, not to diagnose.${conditions}`, health: { ...health, id: uid(), at: new Date().toISOString(), source: 'chat' } };
  }
  if (/(call|phone|number|contact|who)/.test(question)) {
    const names = state.contacts.filter((c) => c.notify).map((c) => c.name);
    return { text: names.length ? `Your circle: ${names.join(', ')}. You can call them from "Your people".` : 'No one has been added to your circle yet. You can add someone in Settings.' };
  }
  if (/(plan|today|routine|task)/.test(question)) {
    const pending = state.tasks.filter((t) => t.doneDate !== dayKey());
    return { text: pending.length ? `Today's little things: ${pending.map((t) => t.label.toLowerCase()).join(', ')}.` : "You have done everything on today's list. Nicely done." };
  }
  return { text: `I can listen and record how you're feeling, remind you of today's plan, help you check in, or help you reach your circle. You can type or use the microphone. I'm not a medical service.` };
}

function buildSystemPrompt(state: AppState) {
  const name = state.settings.displayName || 'the person';
  const conditions = state.settings.healthConditions.join(', ') || 'none reported';
  const recentHealth = state.healthEntries.slice(0, 5).map((e) => `- ${e.at}: ${e.summary}`).join('\n') || '- none yet';
  const lastCheckIn = state.checkIns[0]?.at || 'never';
  const openHelp = state.helpRequests.filter((r) => r.status !== 'resolved').map((r) => r.category).join(', ') || 'none';
  return `You are Daylight, a warm, calm, dignified AI companion for an adult who may be older or living with health conditions. 
Goals: have a natural conversation, ask gentle follow-up questions, notice wellbeing changes, and record health status the user reports.
Safety rules (must follow):
- You are NOT a doctor or emergency service. Never diagnose, prescribe, or change medication doses.
- If the user reports urgent symptoms (chest pain, trouble breathing, stroke signs, severe bleeding, suicidal thoughts, severe sudden pain), clearly tell them to call ${state.settings.emergencyNumber || '999'} now and use the I need help button.
- Be clear, short, respectful, and never patronising.
- Ask one question at a time. Prefer plain language.
User context:
- Name: ${name}
- Health conditions: ${conditions}
- Last check-in: ${lastCheckIn}
- Open help requests: ${openHelp}
- Recent health notes:\n${recentHealth}
When you learn health info, naturally reflect it back. Keep replies under 120 words.`;
}

async function callRemoteAI(state: AppState, prompt: string): Promise<string | null> {
  const envKey = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim() || '';
  const envModel = (import.meta.env.VITE_GEMINI_MODEL as string | undefined)?.trim() || 'gemini-1.5-flash';
  if (!state.settings.aiEnabled || !envKey) return null;

  const recent = state.messages.slice(-12).map((m) => ({
    role: m.role === 'assistant' || m.from === 'Daylight' ? 'model' : 'user',
    parts: [{ text: m.text }],
  }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(envModel)}:generateContent?key=${encodeURIComponent(envKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: buildSystemPrompt(state) }] },
      contents: [...recent, { role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 300 },
    }),
  });
  if (!res.ok) throw new Error(`AI ${res.status}`);
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('').trim() || null;
}

export async function generateAssistantReply(input: string, state: AppState): Promise<{ text: string; health?: Partial<HealthEntry> }> {
  const health = extractHealth(input);
  if (urgentPattern.test(input)) return localAssistantReply(input, state);
  try {
    const text = await callRemoteAI(state, input);
    if (text) return { text, health: health ?? undefined };
  } catch {
    // fall back to local
  }
  const local = localAssistantReply(input, state);
  return { text: local.text, health: local.health ?? health ?? undefined };
}

export async function generateProactiveMessage(state: AppState): Promise<string> {
  const name = state.settings.displayName.split(' ')[0] || 'there';
  const last = state.messages[state.messages.length - 1];
  const recentHealth = state.healthEntries[0]?.summary;
  const localFallback = () => {
    if (!state.checkIns.some((c) => dayKey(new Date(c.at)) === dayKey())) return `Hi ${name}, just checking in. How are you feeling today? You can tap "I'm OK today" or tell me here.`;
    if (recentHealth) return `Hi ${name}, thanks for talking with me earlier. How are you feeling now after ${recentHealth}?`;
    return `Hi ${name}, I'm here with you. How are you feeling right now?`;
  };
  try {
    const prompt = `Start a gentle proactive check-in with ${name}. ${recentHealth ? `Recent note: ${recentHealth}.` : ''} ${last ? `Last message was: "${last.text.slice(0, 120)}"` : 'No recent conversation.'} Ask one warm question.`;
    const text = await callRemoteAI(state, prompt);
    return text || localFallback();
  } catch {
    return localFallback();
  }
}