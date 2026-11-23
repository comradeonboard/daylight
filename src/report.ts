import type { AppState } from './types';
import { formatDay, formatTime } from './utils';
import { helpLabels } from './status';
import { auth } from './firebase';

export function buildHealthReport(state: AppState) {
  const now = new Date();
  const name = state.settings.displayName || 'Daylight user';
  const lines: string[] = [];
  lines.push(`Daylight Health Report`);
  lines.push(`Name: ${name}`);
  lines.push(`Generated: ${now.toLocaleString()}`);
  lines.push(`Emergency number: ${state.settings.emergencyNumber || '999'}`);
  if (state.settings.healthConditions.length) lines.push(`Health conditions: ${state.settings.healthConditions.join(', ')}`);
  lines.push('');
  lines.push('Recent check-ins:');
  if (state.checkIns.length === 0) lines.push('- No check-ins yet');
  for (const c of state.checkIns.slice(0, 10)) lines.push(`- ${formatDay(c.at, now)} ${formatTime(c.at)}${c.mood ? `, feeling ${c.mood}` : ''}${c.note ? `, note: ${c.note}` : ''}`);
  lines.push('');
  lines.push('Recent health notes:');
  if (state.healthEntries.length === 0) lines.push('- No health notes yet');
  for (const h of state.healthEntries.slice(0, 15)) lines.push(`- ${formatDay(h.at, now)} ${formatTime(h.at)}: ${h.summary}${h.note ? ` (${h.note})` : ''}`);
  lines.push('');
  lines.push('Help requests:');
  if (state.helpRequests.length === 0) lines.push('- No help requests');
  for (const r of state.helpRequests.slice(0, 10)) lines.push(`- ${formatDay(r.at, now)} ${formatTime(r.at)}: ${helpLabels[r.category]} - ${r.status}${r.note ? ` (${r.note})` : ''}`);
  lines.push('');
  lines.push('Important: This report is based on what was recorded in Daylight. It is not a medical diagnosis.');
  return lines.join('\n');
}

export async function emailHealthReport(state: AppState) {
  const report = buildHealthReport(state);
  const subject = `Daylight health report - ${state.settings.displayName || 'User'} - ${new Date().toLocaleDateString()}`;
  const to = state.account?.email || '';
  const endpoint = (import.meta.env.VITE_REPORT_EMAIL_ENDPOINT as string | undefined)?.trim();

  if (endpoint && to) {
    try {
      const token = auth?.currentUser ? await auth.currentUser.getIdToken() : undefined;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ to, subject, report, name: state.settings.displayName || 'Daylight user' }),
      });
      if (res.ok) return { ok: true, method: 'email' as const };
    } catch {
      // fall through to device share/mail
    }
  }

  const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(report)}`;
  if (typeof navigator !== 'undefined' && (navigator as any).share) {
    try {
      await (navigator as any).share({ title: subject, text: report });
      return { ok: true, method: 'share' as const };
    } catch {
      // fallback
    }
  }
  window.location.href = mailto;
  return { ok: true, method: 'mailto' as const };
}
