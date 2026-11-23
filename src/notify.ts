import type { AppState, HelpCategory } from './types';
import { helpLabels } from './status';

export async function getLocationLink(): Promise<string | null> {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return null;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        resolve(`https://maps.google.com/?q=${latitude},${longitude}`);
      },
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  });
}

export function buildEmergencyMessage(state: AppState, category?: HelpCategory, note?: string, location?: string | null) {
  const name = state.settings.displayName || 'Someone';
  const reason = category ? helpLabels[category] : 'Needs help';
  const parts = [`Daylight alert: ${name} may need help.`, `Reason: ${reason}.`];
  if (note?.trim()) parts.push(`Message: ${note.trim()}`);
  if (location) parts.push(`Location: ${location}`);
  parts.push(`If urgent, call ${state.settings.emergencyNumber || '999'}.`);
  return parts.join(' ');
}

export async function sendEmergencyText(state: AppState, category?: HelpCategory, note?: string) {
  const contacts = state.contacts.filter((c) => c.notify && c.phone?.trim());
  const location = await getLocationLink();
  const text = buildEmergencyMessage(state, category, note, location);
  const phones = contacts.map((c) => c.phone!.replace(/[^\d+]/g, '')).filter(Boolean);

  if (typeof navigator !== 'undefined' && (navigator as any).share) {
    try {
      await (navigator as any).share({ title: 'Daylight alert', text });
      return { ok: true, method: 'share' as const, text, contacts: contacts.length };
    } catch {
      // fall through to sms
    }
  }

  if (phones.length > 0) {
    const sep = /iPhone|iPad|iPod/i.test(navigator.userAgent) ? '&' : '?';
    const href = `sms:${phones.join(',')}${sep}body=${encodeURIComponent(text)}`;
    window.location.href = href;
    return { ok: true, method: 'sms' as const, text, contacts: contacts.length };
  }

  try {
    await navigator.clipboard.writeText(text);
    return { ok: true, method: 'clipboard' as const, text, contacts: 0 };
  } catch {
    return { ok: false, method: 'none' as const, text, contacts: 0 };
  }
}
