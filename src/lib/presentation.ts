import type { WasteScope } from './domain';
export type View = 'overview' | 'log' | 'photos' | 'actions' | 'settings';
export type Mode = 'demo' | 'local' | 'aws';
export const scopeLabels: Record<WasteScope, string> = { plate: 'Plate waste', kitchen: 'Kitchen waste', combined: 'Combined waste', unknown: 'Scope unconfirmed' };
export const statuses = { planned: 'Planned', in_progress: 'In progress', completed: 'Completed' };
export const number = (value: number, digits = 1) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: digits }).format(value);
export const prettyDate = (value: string, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) => new Date(`${value}T12:00:00`).toLocaleDateString('en-IN', options);
export const today = () => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = (name: string) => parts.find(p => p.type === name)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
};
