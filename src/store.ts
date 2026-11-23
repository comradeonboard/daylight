import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppState } from './types';
import { uid } from './utils';

const KEY = 'daylight.state.v1';
const CHANNEL = 'daylight.sync.v1';

export function defaultState(): AppState {
  const lastCheckIn = new Date(Date.now() - 22 * 3_600_000).toISOString();
  return {
    version: 1,
    onboarded: false,
    settings: {
      displayName: 'Alex',
      emergencyNumber: '999',
      checkInDueHour: 10,
      nudgeAfterHours: 18,
      alertAfterHours: 30,
      urgentAfterHours: 48,
      shareWithCircle: true,
      consentGiven: false,
      textScale: 'large',
      highContrast: false,
      simpleView: false,
      speakReplies: false,
      healthConditions: [],
      aiEnabled: true,
      aiMode: 'local',
      aiEndpoint: 'https://api.openai.com/v1/chat/completions',
      aiApiKey: '',
      aiModel: 'gpt-4o-mini',
      proactiveChat: true,
    },
    checkIns: [{ id: uid(), at: lastCheckIn, mood: 'okay' }],
    helpRequests: [],
    healthEntries: [],
    contacts: [
      {
        id: uid(),
        name: 'Sam',
        relationship: 'Daughter',
        phone: '07700 900123',
        notify: true,
      },
      {
        id: uid(),
        name: 'Priya',
        relationship: 'Neighbour',
        phone: '07700 900456',
        notify: true,
      },
    ],
    tasks: [
      { id: uid(), label: 'Have a drink of water' },
      { id: uid(), label: 'Take my medication' },
      { id: uid(), label: 'Get moving for a few minutes' },
      { id: uid(), label: 'Eat something' },
    ],
    messages: [],
    events: [
      { id: uid(), at: lastCheckIn, kind: 'checkin', text: 'Checked in' },
    ],
  };
}

function load(): AppState {
  if (typeof localStorage === 'undefined') return defaultState();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const saved = JSON.parse(raw) as Partial<AppState>;
    const base = defaultState();
    return {
      version: 1,
      onboarded: saved.onboarded ?? base.onboarded,
      settings: { ...base.settings, ...(saved.settings ?? {}) },
      checkIns: Array.isArray(saved.checkIns) ? saved.checkIns : base.checkIns,
      helpRequests: Array.isArray(saved.helpRequests)
        ? saved.helpRequests
        : base.helpRequests,
      contacts: Array.isArray(saved.contacts) ? saved.contacts : base.contacts,
      tasks: Array.isArray(saved.tasks) ? saved.tasks : base.tasks,
      messages: Array.isArray(saved.messages) ? saved.messages : base.messages,
      events: Array.isArray(saved.events) ? saved.events : base.events,
      healthEntries: Array.isArray(saved.healthEntries) ? saved.healthEntries : base.healthEntries,
    };
  } catch {
    return defaultState();
  }
}

export function useAppState() {
  const [state, setState] = useState<AppState>(load);
  const stateRef = useRef(state);
  const channelRef = useRef<BroadcastChannel | null>(null);

  const adopt = useCallback((next: AppState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(CHANNEL);
      channel.onmessage = (event: MessageEvent) => {
        const data = event.data as { type?: string; state?: AppState } | null;
        if (data?.type === 'state' && data.state) adopt(data.state);
      };
      channelRef.current = channel;
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key !== KEY || !event.newValue) return;
      try {
        adopt(JSON.parse(event.newValue) as AppState);
      } catch {
        // Ignore malformed data from another tab.
      }
    };

    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
      channel?.close();
      channelRef.current = null;
    };
  }, [adopt]);

  const update = useCallback(
    (fn: (current: AppState) => AppState) => {
      const next = fn(stateRef.current);
      adopt(next);
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        // Private browsing can block storage; the app still works in memory.
      }
      channelRef.current?.postMessage({ type: 'state', state: next });
    },
    [adopt],
  );

  const reset = useCallback(() => {
    const fresh = defaultState();
    update(() => ({
      ...fresh,
      onboarded: true,
      settings: {
        ...fresh.settings,
        consentGiven: true,
        consentAt: new Date().toISOString(),
      },
    }));
  }, [update]);

  return { state, update, reset };
}
