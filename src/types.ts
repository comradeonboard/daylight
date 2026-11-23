export type Mood = 'good' | 'okay' | 'rough';
export type HelpCategory = 'unwell' | 'fallen' | 'stuck' | 'lonely' | 'other';
export type View = 'me' | 'circle' | 'settings';
export type EventKind = 'checkin' | 'help' | 'nudge' | 'contact' | 'resolve' | 'system' | 'health';

export interface HealthEntry {
  id: string;
  at: string;
  source: 'chat' | 'manual';
  summary: string;
  mood?: Mood;
  symptoms?: string[];
  pain?: 0 | 1 | 2 | 3;
  note?: string;
}

export interface CheckIn {
  id: string;
  at: string;
  mood?: Mood;
  note?: string;
}

export interface HelpRequest {
  id: string;
  at: string;
  category: HelpCategory;
  note?: string;
  status: 'open' | 'acknowledged' | 'resolved';
  updatedAt?: string;
}

export interface Contact {
  id: string;
  name: string;
  relationship: string;
  phone?: string;
  notify: boolean;
}

export interface Task {
  id: string;
  label: string;
  doneDate?: string;
}

export interface Message {
  id: string;
  at: string;
  from: string;
  role?: 'user' | 'assistant';
  text: string;
}

export interface EventItem {
  id: string;
  at: string;
  kind: EventKind;
  text: string;
}

export type TextScale = 'normal' | 'large' | 'xlarge';

export interface Account {
  email: string;
  name?: string;
  provider: 'email' | 'google';
  signedInAt: string;
}

export interface Settings {
  displayName: string;
  emergencyNumber: string;
  checkInDueHour: number;
  nudgeAfterHours: number;
  alertAfterHours: number;
  urgentAfterHours: number;
  shareWithCircle: boolean;
  consentGiven: boolean;
  consentAt?: string;
  textScale: TextScale;
  highContrast: boolean;
  simpleView: boolean;
  speakReplies: boolean;
  healthConditions: string[];
  aiEnabled: boolean;
  proactiveChat: boolean;
  lastProactiveAt?: string;
}

export interface AppState {
  version: 1;
  onboarded: boolean;
  account?: Account;
  settings: Settings;
  checkIns: CheckIn[];
  helpRequests: HelpRequest[];
  contacts: Contact[];
  tasks: Task[];
  messages: Message[];
  events: EventItem[];
  healthEntries: HealthEntry[];
}

export interface AppContext {
  state: AppState;
  update: (fn: (state: AppState) => AppState) => void;
  reset: () => void;
  toast: (message: string) => void;
  openHelp: () => void;
}
