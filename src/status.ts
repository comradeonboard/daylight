import type { AppState, HelpCategory } from './types';
import { formatDay, formatTime, hoursBetween, relative } from './utils';

export type StatusLevel = 'green' | 'amber' | 'red';

export interface StatusInfo {
  level: StatusLevel;
  title: string;
  detail: string;
  hoursSince: number | null;
  since: string | null;
}

export const helpLabels: Record<HelpCategory, string> = {
  unwell: 'Feeling unwell',
  fallen: 'Has fallen',
  stuck: 'Stuck or cannot get out',
  lonely: 'Feeling lonely',
  other: 'Needs help',
};

const wholeHours = (value: number) =>
  value < 1 ? 'less than an hour' : `${Math.floor(value)} hr${Math.floor(value) === 1 ? '' : 's'}`;

export function deriveStatus(state: AppState, now: Date = new Date()): StatusInfo {
  const open = state.helpRequests
    .filter((request) => request.status !== 'resolved')
    .sort((a, b) => b.at.localeCompare(a.at))[0];

  if (open) {
    const prefix = open.status === 'acknowledged' ? 'Help is being handled:' : 'Help requested:';
    return {
      level: 'red',
      title: helpLabels[open.category],
      detail: `${prefix} ${relative(open.at, now)}.`,
      hoursSince: null,
      since: open.at,
    };
  }

  const last = state.checkIns[0];
  if (!last) {
    return {
      level: 'amber',
      title: 'No check-ins yet',
      detail: 'Once they check in, it will appear here.',
      hoursSince: null,
      since: null,
    };
  }

  const hours = hoursBetween(last.at, now);
  const { nudgeAfterHours, alertAfterHours, urgentAfterHours } = state.settings;

  if (hours >= urgentAfterHours) {
    return {
      level: 'red',
      title: 'No check-in for a while',
      detail: `Last heard from ${formatDay(last.at, now)} at ${formatTime(last.at)}  -  ${wholeHours(hours)} ago. Consider calling them.`,
      hoursSince: hours,
      since: last.at,
    };
  }

  if (hours >= alertAfterHours) {
    return {
      level: 'amber',
      title: 'Check-in is overdue',
      detail: `Last check-in was ${formatDay(last.at, now)} at ${formatTime(last.at)}  -  ${wholeHours(hours)} ago.`,
      hoursSince: hours,
      since: last.at,
    };
  }

  if (hours >= nudgeAfterHours) {
    return {
      level: 'amber',
      title: 'A friendly nudge may help',
      detail: `Last check-in was ${formatDay(last.at, now)} at ${formatTime(last.at)}.`,
      hoursSince: hours,
      since: last.at,
    };
  }

  return {
    level: 'green',
    title: 'Checked in',
    detail: `Last check-in ${relative(last.at, now)}  -  ${formatTime(last.at)} ${formatDay(last.at, now)}.`,
    hoursSince: hours,
    since: last.at,
  };
}
