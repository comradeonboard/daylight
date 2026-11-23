import { useEffect, useMemo, useRef, useState } from 'react';
import { generateAssistantReply, generateProactiveMessage } from './assistant';
import { useAppState } from './store';
import { deriveStatus, helpLabels } from './status';
import type { AppContext, AppState, HelpCategory, Mood, View } from './types';
import { dayKey, formatDay, formatTime, greeting, initials, relative, uid } from './utils';
import { sendEmergencyText } from './notify';

const helpOptions: Array<{ value: HelpCategory; label: string }> = [
  { value: 'unwell', label: 'I feel unwell' },
  { value: 'fallen', label: 'I have fallen' },
  { value: 'stuck', label: 'I am stuck or cannot get out' },
  { value: 'lonely', label: 'I feel lonely or worried' },
  { value: 'other', label: 'Something else' },
];
const eventFor = (kind: AppState['events'][number]['kind'], text: string) => ({ id: uid(), at: new Date().toISOString(), kind, text });
function speak(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1;
  u.pitch = 1;
  u.volume = 1;
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find((v) => /en-GB|en_GB|Google UK English Female|Samantha|Natural/i.test(`${v.name} ${v.lang}`)) || voices.find((v) => v.lang?.toLowerCase().startsWith('en'));
  if (preferred) u.voice = preferred;
  window.speechSynthesis.speak(u);
}

export default function App() {
  const { state, update, reset } = useAppState();
  const [view, setView] = useState<View>('me');
  const [helpOpen, setHelpOpen] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const proactiveRef = useRef(false);
  useEffect(() => { if (state.onboarded && !state.settings.consentGiven) setConsentOpen(true); }, [state.onboarded, state.settings.consentGiven]);
  useEffect(() => { if (!toast) return; const t = window.setTimeout(() => setToast(null), 2800); return () => window.clearTimeout(t); }, [toast]);
  useEffect(() => { document.documentElement.style.fontSize = state.settings.textScale === 'xlarge' ? '23px' : state.settings.textScale === 'large' ? '20px' : '17px'; document.body.classList.toggle('contrast', state.settings.highContrast); }, [state.settings.textScale, state.settings.highContrast]);

  useEffect(() => {
    if (!state.onboarded || !state.settings.aiEnabled || !state.settings.proactiveChat) return;
    const tick = async () => {
      if (proactiveRef.current) return;
      const now = Date.now();
      const lastMsg = state.messages[state.messages.length - 1];
      const lastAt = lastMsg ? new Date(lastMsg.at).getTime() : 0;
      const lastProactive = state.settings.lastProactiveAt ? new Date(state.settings.lastProactiveAt).getTime() : 0;
      const quietMs = 45 * 60 * 1000;
      const due = (!lastAt && now - lastProactive > quietMs) || (lastAt && now - Math.max(lastAt, lastProactive) > quietMs);
      const recentAssistant = lastMsg?.from === 'Daylight' && now - lastAt < quietMs;
      if (!due || recentAssistant) return;
      proactiveRef.current = true;
      try {
        const text = await generateProactiveMessage(state);
        const at = new Date().toISOString();
        update((c) => ({
          ...c,
          settings: { ...c.settings, lastProactiveAt: at },
          messages: [...c.messages, { id: uid(), at, from: 'Daylight', role: 'assistant' as const, text }].slice(-80),
          events: [eventFor('system', 'Daylight sent a proactive check-in'), ...c.events].slice(0, 200),
        }));
        if (state.settings.speakReplies) speak(text);
      } finally { proactiveRef.current = false; }
    };
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [state.onboarded, state.settings.aiEnabled, state.settings.proactiveChat, state.settings.lastProactiveAt, state.settings.speakReplies, state.messages, state.healthEntries, state.checkIns, state.settings.displayName, state.settings.healthConditions, state.settings.aiMode, state.settings.aiEndpoint, state.settings.aiApiKey, state.settings.aiModel]);

  const now = new Date();
  const status = useMemo(() => deriveStatus(state, now), [state, now]);
  const checkedInToday = state.checkIns.some((c) => dayKey(new Date(c.at)) === dayKey(now));
  const ctx: AppContext = { state, update, reset, toast: setToast, openHelp: () => setHelpOpen(true) };
  return (
    <div className="app">
      <a className="sr-only" href="#main">Skip to main content</a>
      <header className="topbar">
        <div className="brand" aria-label="Daylight"><svg className="brand-mark" viewBox="0 0 512 512" aria-hidden="true"><rect width="512" height="512" rx="112" fill="#176b62" /><circle cx="256" cy="252" r="84" fill="#f7f5ef" /><g stroke="#f7f5ef" strokeWidth="22" strokeLinecap="round"><path d="M256 104V72M256 432v-32M108 252H76M436 252h-32M149 145l-23-23M386 382l-23-23M363 145l23-23M126 382l23-23" /></g></svg><div><span className="brand-title">Daylight</span><span className="brand-sub">A quiet check-in, a caring circle</span></div></div>
        {state.onboarded && <nav className="segmented" aria-label="Views">{(['me', 'circle', 'settings'] as const).map((item) => <button key={item} aria-selected={view === item} onClick={() => setView(item)}>{item === 'me' ? 'My day' : item === 'circle' ? 'Circle' : 'Settings'}</button>)}</nav>}
      </header>
      <main id="main">
        {!state.onboarded ? <Onboarding state={state} update={update} onDone={() => setConsentOpen(true)} /> : view === 'me' ? <MeView ctx={ctx} status={status} checkedInToday={checkedInToday} /> : view === 'circle' ? <CircleView ctx={ctx} status={status} /> : <SettingsView ctx={ctx} />}
      </main>
      <footer className="footer">Daylight is a support tool, not a medical device or emergency service. In an emergency, call {state.settings.emergencyNumber || '999'}.</footer>
      {helpOpen && <HelpModal ctx={ctx} onClose={() => setHelpOpen(false)} />}
      {consentOpen && state.onboarded && <ConsentModal onAccept={() => { update((c) => ({ ...c, settings: { ...c.settings, consentGiven: true, consentAt: new Date().toISOString(), shareWithCircle: true }, events: [eventFor('system', 'Sharing with trusted circle enabled'), ...c.events] })); setConsentOpen(false); setToast('Sharing preferences saved.'); }} onDecline={() => { update((c) => ({ ...c, settings: { ...c.settings, shareWithCircle: false, consentGiven: true, consentAt: new Date().toISOString() }, events: [eventFor('system', 'Sharing with circle turned off'), ...c.events] })); setConsentOpen(false); setToast('You can turn sharing on later in Settings.'); }} />}
      {toast && <div className="toast" role="status" aria-live="polite">{toast}</div>}
    </div>
  );
}

function Onboarding({ state, update, onDone }: { state: AppState; update: (fn: (s: AppState) => AppState) => void; onDone: () => void }) {
  const [name, setName] = useState(state.settings.displayName);
  const [contactName, setContactName] = useState(state.contacts[0]?.name ?? '');
  const [contactPhone, setContactPhone] = useState(state.contacts[0]?.phone ?? '');
  const [conditions, setConditions] = useState(state.settings.healthConditions.join(', '));
  return <section className="page"><div className="page-head"><h1 className="page-title">Set up Daylight</h1><p className="page-sub">A simple daily check-in for adults living independently or with health conditions  -  and a trusted circle who notices if you go quiet.</p></div><div className="card"><h2 className="card-title">About you</h2><p className="card-note">Use the name you like to be called. Share only what you want.</p>
    <div className="field"><label htmlFor="setup-name">Your name</label><input id="setup-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></div>
    <div className="field"><label htmlFor="setup-conditions">Health conditions (optional)</label><input id="setup-conditions" value={conditions} onChange={(e) => setConditions(e.target.value)} placeholder="e.g. diabetes, arthritis" /><div className="field-hint">Helps the assistant ask relevant check-ins. Stored on this device unless you choose to share.</div></div>
    <div className="field"><label htmlFor="setup-contact">Someone in your trusted circle</label><input id="setup-contact" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="e.g. Sam" /></div>
    <div className="field"><label htmlFor="setup-phone">Their phone number (optional)</label><input id="setup-phone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} inputMode="tel" autoComplete="tel" /></div>
    <div className="actions"><button className="btn btn-primary" onClick={() => { const trimmed = name.trim() || 'Friend'; const contact = contactName.trim(); const healthConditions = conditions.split(',').map((c) => c.trim()).filter(Boolean); update((current) => ({ ...current, onboarded: true, settings: { ...current.settings, displayName: trimmed, healthConditions }, contacts: contact ? [{ id: current.contacts[0]?.id ?? uid(), name: contact, relationship: current.contacts[0]?.relationship ?? 'Trusted person', phone: contactPhone.trim() || undefined, notify: true }, ...current.contacts.slice(1)] : current.contacts, events: [eventFor('system', 'Daylight set up'), ...current.events] })); onDone(); }}>Continue</button></div>
  </div></section>;
}

function MeView({ ctx, status, checkedInToday }: { ctx: AppContext; status: ReturnType<typeof deriveStatus>; checkedInToday: boolean }) {
  const { state, update, toast, openHelp } = ctx; const now = new Date(); const today = dayKey(now); const firstName = state.settings.displayName.split(' ')[0] || 'there';
  const doneCount = state.tasks.filter((t) => t.doneDate === today).length; const [showMood, setShowMood] = useState(!checkedInToday);
  useEffect(() => { setShowMood(!checkedInToday); }, [checkedInToday]);
  const doCheckIn = (mood?: Mood) => { const at = new Date().toISOString(); update((c) => ({ ...c, checkIns: [{ id: uid(), at, mood }, ...c.checkIns].slice(0, 200), events: [eventFor('checkin', mood ? `Checked in  -  feeling ${mood}` : 'Checked in'), ...c.events] })); setShowMood(false); toast('Thanks for checking in. Your circle can see you are OK.'); };
  return <section className="page">
    <div className="page-head"><h1 className="page-title">{greeting(now)}, {firstName}</h1><p className="page-sub">One tap lets your people know you're alright.</p></div>
    <div className={`status-card card level-${status.level}`} aria-live="polite"><div className="status-row"><span className="dot" aria-hidden="true" /><p className="status-title">{status.title}</p></div><p className="status-detail">{status.detail}</p></div>
    <div className="card">{!checkedInToday || showMood ? <><button className="big-check" onClick={() => doCheckIn()}><svg className="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>I'm OK today</button><p className="card-note" style={{ marginTop: 14, marginBottom: 10, textAlign: 'center' }}>Optional: how are you feeling?</p><div className="mood-strip">{([['good', '🙂 Good'], ['okay', '😐 Okay'], ['rough', '😔 Rough']] as const).map(([mood, label]) => <button key={mood} className="mood-chip" onClick={() => doCheckIn(mood)}>{label}</button>)}</div></> : <div className="check-done"><strong>You've checked in today</strong><p className="card-note" style={{ marginBottom: 0 }}>Last check-in {relative(state.checkIns[0].at, now)}. You can check in again if you want.</p><div className="actions" style={{ justifyContent: 'center' }}><button className="btn" onClick={() => setShowMood(true)}>Check in again</button></div></div>}</div>
    <button className="help-button" onClick={openHelp}><span>I need help</span><span aria-hidden="true">›</span></button>
    <AssistantCard ctx={ctx} />
    {!state.settings.simpleView && <div className="card"><h2 className="card-title">Today's little things</h2><p className="card-note">Just gentle reminders  -  no pressure.</p><div className="list" role="list">{state.tasks.map((task) => { const done = task.doneDate === today; return <div key={task.id} className={`task-row ${done ? 'done' : ''}`} role="listitem"><span className="task-box" aria-hidden="true">{done ? '✓' : ''}</span><button className="task-label" aria-pressed={done} onClick={() => update((c) => ({ ...c, tasks: c.tasks.map((t) => t.id === task.id ? { ...t, doneDate: done ? undefined : today } : t) }))}>{task.label}</button></div>; })}</div><div className="progress" aria-hidden="true"><div className="progress-fill" style={{ width: `${state.tasks.length ? Math.round((doneCount / state.tasks.length) * 100) : 0}%` }} /></div><p className="card-note" style={{ margin: '10px 0 0' }}>{doneCount} of {state.tasks.length} done today.</p></div>}
    <div className="card"><h2 className="card-title">Your people</h2><p className="card-note">People who can be notified if you need help.</p><div className="list">{state.contacts.filter((c) => c.notify).map((contact) => <div key={contact.id} className="list-row"><div className="avatar" aria-hidden="true">{initials(contact.name)}</div><div className="list-main"><div className="list-name">{contact.name}</div><div className="list-sub">{contact.relationship}</div></div>{contact.phone && <a className="call-link" href={`tel:${contact.phone.replace(/\s+/g, '')}`}>Call</a>}</div>)}</div></div>
  </section>;
}

function AssistantCard({ ctx }: { ctx: AppContext }) {
  const { state, update } = ctx; const [draft, setDraft] = useState(''); const [listening, setListening] = useState(false); const [thinking, setThinking] = useState(false);
  const logRef = useRef<HTMLDivElement | null>(null); const recRef = useRef<any>(null);
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' }); }, [state.messages.length, thinking]);

  const send = async (text: string) => {
    const content = text.trim(); if (!content || thinking) return;
    const at = new Date().toISOString(); const userMsg = { id: uid(), at, from: 'You', role: 'user' as const, text: content };
    update((c) => ({ ...c, messages: [...c.messages, userMsg].slice(-80) }));
    setDraft(''); setThinking(true);
    try {
      const reply = await generateAssistantReply(content, state);
      const botMsg = { id: uid(), at: new Date().toISOString(), from: 'Daylight', role: 'assistant' as const, text: reply.text };
      update((c) => {
        const events = [...c.events]; const healthEntries = [...c.healthEntries];
        if (reply.health) { const entry = { id: uid(), at: new Date().toISOString(), source: 'chat' as const, summary: reply.health.summary || content.slice(0, 80), ...reply.health }; healthEntries.unshift(entry as any); events.unshift(eventFor('health', `Health note: ${entry.summary}`)); }
        return { ...c, messages: [...c.messages, botMsg].slice(-80), healthEntries: healthEntries.slice(0, 100), events: events.slice(0, 200) };
      });
      if (state.settings.speakReplies) speak(reply.text);
    } finally { setThinking(false); }
  };

  const toggleVoice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { ctx.toast('Voice input is not available in this browser. You can still type.'); return; }
    if (listening) { recRef.current?.stop(); setListening(false); return; }
    const rec = new SR(); rec.lang = 'en-GB'; rec.interimResults = true; rec.continuous = false;
    rec.onresult = (e: any) => { const transcript = Array.from(e.results).map((r: any) => r[0].transcript).join(' '); setDraft(transcript); if (e.results[0]?.isFinal) { setListening(false); send(transcript); } };
    rec.onerror = () => { setListening(false); ctx.toast('Could not hear that clearly. Please try again or type.'); };
    rec.onend = () => setListening(false); recRef.current = rec; rec.start(); setListening(true);
  };

  const quick = ['How am I doing today?', 'I feel a bit tired', 'I took my medication', 'Who can I call?'];
  return <div className="card"><h2 className="card-title">Chat with Daylight</h2><p className="card-note">Daylight can chat with you by text or voice, check in proactively, and record health notes you report. It is not a medical service.</p>
    <div className="assistant-log" ref={logRef} aria-live="polite">{state.messages.length === 0 && <div className="bubble bot">Hi {state.settings.displayName.split(' ')[0] || 'there'}. How are you feeling today?</div>}{state.messages.map((msg) => <div key={msg.id} className={`bubble ${msg.from === 'You' ? 'user' : 'bot'}`}>{msg.text}</div>)}{thinking && <div className="bubble bot">Daylight is thinking...</div>}</div>
    <div className="chips" aria-label="Suggested messages">{quick.map((q) => <button key={q} className="chip" onClick={() => send(q)}>{q}</button>)}</div>
    <div className="ask-row"><input className="ask-input" aria-label="Message Daylight" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send(draft); }} placeholder="Type or use voice..." /><button className="btn" onClick={toggleVoice} aria-pressed={listening}>{listening ? 'Listening…' : '🎤 Voice'}</button><button className="ask-send" onClick={() => send(draft)} disabled={thinking}>{thinking ? '...' : 'Send'}</button></div>
  </div>;
}

function CircleView({ ctx, status }: { ctx: AppContext; status: ReturnType<typeof deriveStatus> }) {
  const { state, update, toast } = ctx; const now = new Date(); const openHelp = state.helpRequests.filter((r) => r.status !== 'resolved');
  return <section className="page">
    <div className="page-head"><h1 className="page-title">Trusted circle</h1><p className="page-sub">A simple view of how {state.settings.displayName} is doing. Only shared with consent.</p></div>
    <div className={`banner level-${status.level}`} role="status"><strong>{status.title}</strong><p>{status.detail}</p></div>
    {openHelp.length > 0 && <div className="card"><h2 className="card-title">Needs attention</h2>{openHelp.map((r) => <div key={r.id} className="alert-item"><strong>{helpLabels[r.category]}</strong><div className="list-sub">Requested {relative(r.at, now)}{r.note ? `  -  “${r.note}”` : ''}</div><div className="actions">{r.status === 'open' && <button className="btn btn-primary" onClick={() => { update((c) => ({ ...c, helpRequests: c.helpRequests.map((x) => x.id === r.id ? { ...x, status: 'acknowledged', updatedAt: new Date().toISOString() } : x), events: [eventFor('contact', `Circle acknowledged: ${helpLabels[r.category]}`), ...c.events] })); toast('Marked as being handled.'); }}>I'm on it</button>}<button className="btn" onClick={() => { update((c) => ({ ...c, helpRequests: c.helpRequests.map((x) => x.id === r.id ? { ...x, status: 'resolved', updatedAt: new Date().toISOString() } : x), events: [eventFor('resolve', `Resolved: ${helpLabels[r.category]}`), ...c.events] })); toast('Marked as resolved.'); }}>Mark resolved</button></div></div>)}</div>}
    <div className="card"><h2 className="card-title">Recent health notes</h2><p className="card-note">Recorded from check-ins and conversations. Not medical advice.</p>{state.healthEntries.length === 0 ? <p className="list-sub">No health notes yet.</p> : <div className="timeline">{state.healthEntries.slice(0, 6).map((entry) => <div key={entry.id} className="timeline-row"><span className="timeline-dot health" aria-hidden="true" /><div><div className="timeline-text">{entry.summary}</div><div className="timeline-time">{formatDay(entry.at, now)} at {formatTime(entry.at)}</div></div></div>)}</div>}</div>
    <div className="card"><h2 className="card-title">Recent activity</h2><div className="timeline">{state.events.slice(0, 12).map((event) => <div key={event.id} className="timeline-row"><span className={`timeline-dot ${event.kind}`} aria-hidden="true" /><div><div className="timeline-text">{event.text}</div><div className="timeline-time">{formatDay(event.at, now)} at {formatTime(event.at)}</div></div></div>)}</div></div>
    <div className="card"><h2 className="card-title">Trusted people</h2><div className="list">{state.contacts.map((contact) => <div key={contact.id} className="list-row"><div className="avatar" aria-hidden="true">{initials(contact.name)}</div><div className="list-main"><div className="list-name">{contact.name}</div><div className="list-sub">{contact.relationship}{contact.phone ? ` · ${contact.phone}` : ''}</div></div>{contact.phone && <a className="call-link" href={`tel:${contact.phone.replace(/\s+/g, '')}`}>Call</a>}</div>)}</div></div>
  </section>;
}

function SettingsView({ ctx }: { ctx: AppContext }) {
  const { state, update, toast } = ctx;
  const set = (patch: Partial<AppState['settings']>) => update((c) => ({ ...c, settings: { ...c.settings, ...patch } }));
  return <section className="page">
    <div className="page-head"><h1 className="page-title">Settings</h1><p className="page-sub">Make Daylight comfortable and clear for you.</p></div>
    <div className="card"><h2 className="card-title">Accessibility</h2><p className="card-note">Designed for older adults and people with disabilities or health conditions.</p>
      <div className="field"><label htmlFor="text-size">Text size</label><select id="text-size" className="ask-input" value={state.settings.textScale} onChange={(e) => set({ textScale: e.target.value as any })}><option value="normal">Normal</option><option value="large">Large</option><option value="xlarge">Extra large</option></select></div>
      <div className="toggle-row"><div><strong>High contrast</strong><small>Stronger colours and borders</small></div><button className="switch" role="switch" aria-checked={state.settings.highContrast} onClick={() => set({ highContrast: !state.settings.highContrast })}><span className="sr-only">Toggle high contrast</span></button></div>
      <div className="toggle-row"><div><strong>Simple view</strong><small>Hide extra cards on My day</small></div><button className="switch" role="switch" aria-checked={state.settings.simpleView} onClick={() => set({ simpleView: !state.settings.simpleView })}><span className="sr-only">Toggle simple view</span></button></div>
      <div className="toggle-row"><div><strong>Read replies aloud</strong><small>Speak assistant responses</small></div><button className="switch" role="switch" aria-checked={state.settings.speakReplies} onClick={() => set({ speakReplies: !state.settings.speakReplies })}><span className="sr-only">Toggle spoken replies</span></button></div>
    </div>
    <div className="card"><h2 className="card-title">Profile & health</h2>
      <div className="field"><label htmlFor="name">Name</label><input id="name" value={state.settings.displayName} onChange={(e) => set({ displayName: e.target.value })} /></div>
      <div className="field"><label htmlFor="conditions">Health conditions (comma separated)</label><input id="conditions" value={state.settings.healthConditions.join(', ')} onChange={(e) => set({ healthConditions: e.target.value.split(',').map((v) => v.trim()).filter(Boolean) })} /><div className="field-hint">Used to make check-ins more relevant. Not a diagnosis.</div></div>
      <div className="field"><label htmlFor="emergency">Emergency number</label><input id="emergency" value={state.settings.emergencyNumber} onChange={(e) => set({ emergencyNumber: e.target.value })} inputMode="tel" /></div>
    </div>
    <div className="card"><h2 className="card-title">AI companion</h2><p className="card-note">Daylight can talk automatically and check in. For real intelligent AI, use OpenAI-compatible mode and add your own API key (stored on this device only).</p>
      <div className="toggle-row"><div><strong>Enable AI companion</strong><small>Allow Daylight to respond and check in</small></div><button className="switch" role="switch" aria-checked={state.settings.aiEnabled} onClick={() => set({ aiEnabled: !state.settings.aiEnabled })}><span className="sr-only">Toggle AI</span></button></div>
      <div className="toggle-row"><div><strong>Automatic check-ins</strong><small>Daylight messages you if it has been quiet for a while</small></div><button className="switch" role="switch" aria-checked={state.settings.proactiveChat} onClick={() => set({ proactiveChat: !state.settings.proactiveChat })}><span className="sr-only">Toggle proactive chat</span></button></div>
      <div className="field"><label htmlFor="ai-mode">AI mode</label><select id="ai-mode" className="ask-input" value={state.settings.aiMode} onChange={(e) => { const mode = e.target.value as any; set({ aiMode: mode, aiModel: mode === 'gemini' ? 'gemini-1.5-flash' : mode === 'openai' ? 'gpt-4o-mini' : state.settings.aiModel }); }}><option value="local">Built-in on-device assistant (no key)</option><option value="gemini">Gemini API (recommended for natural chat)</option><option value="openai">OpenAI-compatible API</option></select></div>
      {state.settings.aiMode === 'gemini' && <>
        <div className="field"><label htmlFor="ai-model">Gemini model</label><input id="ai-model" value={state.settings.aiModel} onChange={(e) => set({ aiModel: e.target.value })} placeholder="gemini-1.5-flash" /></div>
        <div className="field"><label htmlFor="ai-key">Gemini API key</label><input id="ai-key" type="password" value={state.settings.aiApiKey} onChange={(e) => set({ aiApiKey: e.target.value })} placeholder="AIza..." /><div className="field-hint">Get a key from Google AI Studio. The key is stored only in this browser. For production, use a secure backend proxy.</div></div>
      </>}
      {state.settings.aiMode === 'openai' && <>
        <div className="field"><label htmlFor="ai-endpoint">API endpoint</label><input id="ai-endpoint" value={state.settings.aiEndpoint} onChange={(e) => set({ aiEndpoint: e.target.value })} placeholder="https://api.openai.com/v1/chat/completions" /></div>
        <div className="field"><label htmlFor="ai-model">Model</label><input id="ai-model" value={state.settings.aiModel} onChange={(e) => set({ aiModel: e.target.value })} placeholder="gpt-4o-mini" /></div>
        <div className="field"><label htmlFor="ai-key">API key</label><input id="ai-key" type="password" value={state.settings.aiApiKey} onChange={(e) => set({ aiApiKey: e.target.value })} placeholder="sk-..." /><div className="field-hint">Stored only in this browser. For production, use a secure backend proxy.</div></div>
      </>}
    </div>
    <div className="card"><h2 className="card-title">Trusted circle</h2><p className="card-note">People who can be notified. Emergency text uses your device's SMS/share with their phone numbers and optional location.</p>
      {state.contacts.map((contact, idx) => <div key={contact.id} className="editor-row"><div className="field" style={{ marginBottom: 0 }}><label>Name</label><input value={contact.name} onChange={(e) => update((c) => ({ ...c, contacts: c.contacts.map((x, i) => i === idx ? { ...x, name: e.target.value } : x) }))} /></div><div className="field" style={{ marginBottom: 0 }}><label>Phone</label><input value={contact.phone ?? ''} onChange={(e) => update((c) => ({ ...c, contacts: c.contacts.map((x, i) => i === idx ? { ...x, phone: e.target.value } : x) }))} /></div><button className="btn" onClick={() => update((c) => ({ ...c, contacts: c.contacts.filter((_, i) => i !== idx) }))}>Remove</button></div>)}
      <div className="actions" style={{ marginTop: 12 }}><button className="btn" onClick={() => update((c) => ({ ...c, contacts: [...c.contacts, { id: uid(), name: 'New person', relationship: 'Trusted person', notify: true }] }))}>Add person</button></div>
      <div className="toggle-row" style={{ marginTop: 14 }}><div><strong>Share with circle</strong><small>Allow your circle to see check-ins and health notes</small></div><button className="switch" role="switch" aria-checked={state.settings.shareWithCircle} onClick={() => set({ shareWithCircle: !state.settings.shareWithCircle })}><span className="sr-only">Toggle sharing</span></button></div>
    </div>
    <div className="card"><h2 className="card-title">Data & actions</h2><p className="card-note">Your check-ins, health notes, and messages are stored on this device. You can export them for your records or care team.</p><div className="demo-grid">
      <button className="btn" onClick={() => { const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `daylight-data-${dayKey()}.json`; a.click(); URL.revokeObjectURL(a.href); toast('Data exported.'); }}>Export my data</button>
      <button className="btn btn-danger" onClick={() => { if (confirm('Delete all Daylight data on this device? This cannot be undone.')) { localStorage.removeItem('daylight.state.v1'); location.reload(); } }}>Delete my data</button>
    </div></div>
  </section>;
}

function HelpModal({ ctx, onClose }: { ctx: AppContext; onClose: () => void }) {
  const { state, update, toast } = ctx; const [category, setCategory] = useState<HelpCategory>('unwell'); const [note, setNote] = useState(''); const [sending, setSending] = useState(false);
  const notified = state.contacts.filter((c) => c.notify && c.phone);
  return <div className="backdrop" role="dialog" aria-modal="true" aria-label="Request help"><div className="modal">
    <h2>I need help</h2><p className="modal-lead">Choose what’s going on. Daylight will record it and prepare an emergency text to your trusted circle. If it’s an emergency, call {state.settings.emergencyNumber || '999'}.</p>
    <div className="category-grid">{helpOptions.map((opt) => <button key={opt.value} className="category" aria-pressed={category === opt.value} onClick={() => setCategory(opt.value)}>{opt.label}</button>)}</div>
    <div className="field"><label htmlFor="help-note">Anything you want to add (optional)</label><textarea id="help-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. I feel dizzy" /></div>
    <p className="field-hint">Emergency text recipients: {notified.length ? notified.map((c) => c.name).join(', ') : 'no phone numbers yet - add them in Settings'}.</p>
    <div className="modal-actions">
      <button className="btn btn-danger" disabled={sending} onClick={async () => {
        setSending(true);
        const result = await sendEmergencyText(state, category, note);
        update((c) => ({ ...c, helpRequests: [{ id: uid(), at: new Date().toISOString(), category, note: note.trim() || undefined, status: 'open' }, ...c.helpRequests], events: [eventFor('help', `Help requested: ${helpLabels[category]}${result.method === 'sms' ? ' (emergency text prepared)' : result.method === 'share' ? ' (shared)' : ''}`), ...c.events] }));
        setSending(false); onClose();
        toast(result.method === 'sms' ? 'Emergency text prepared on your device.' : result.method === 'share' ? 'Alert shared.' : result.method === 'clipboard' ? 'Alert copied. Paste it to your contacts.' : 'Help recorded. Add contact phone numbers to send texts.');
      }}>{sending ? 'Preparing...' : 'Send emergency text'}</button>
      <a className="btn" href={`tel:${(state.settings.emergencyNumber || '999').replace(/\s+/g, '')}`}>Call {state.settings.emergencyNumber || '999'}</a>
      <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
    </div>
  </div></div>;
}

function ConsentModal({ onAccept, onDecline }: { onAccept: () => void; onDecline: () => void }) {
  return <div className="backdrop" role="dialog" aria-modal="true" aria-label="Sharing consent"><div className="modal">
    <h2>Before we share anything</h2><p className="modal-lead">Daylight works best when a trusted circle can see check-ins and health notes. You choose.</p>
    <div className="consent-block"><h3>What your circle can see</h3><ul><li>Check-ins and whether you asked for help</li><li>Health notes you record in chat (not medical advice)</li><li>Simple activity status (green / amber / red)</li></ul></div>
    <div className="consent-block"><h3>What we don't do</h3><ul><li>No hidden tracking or selling data</li><li>No automatic emergency calls without you tapping</li><li>No medical diagnosis  -  it records what you report</li></ul></div>
    <p className="field-hint">You can change this any time in Settings. In an emergency, call your local emergency number.</p>
    <div className="modal-actions"><button className="btn btn-primary" onClick={onAccept}>I agree  -  share with my circle</button><button className="btn" onClick={onDecline}>Not now</button></div>
  </div></div>;
}