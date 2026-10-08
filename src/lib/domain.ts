export type WasteScope = 'plate' | 'kitchen' | 'combined' | 'unknown';

export type Photo = {
  id: string;
  name: string;
  kind: 'board' | 'plate';
  key?: string;
  mimeType?: string;
};

export type WasteAction = {
  text: string;
  status: 'planned' | 'in_progress' | 'completed';
  notes?: string;
};

export type WasteRecord = {
  id: string;
  date: string;
  wasteKg: number;
  scope: WasteScope;
  coverage: string;
  menu: { breakfast: string; lunch: string; dinner: string; snacks?: string };
  attendance?: number;
  notes: string;
  photos: Photo[];
  action?: WasteAction;
  createdAt: string;
  updatedAt: string;
};

export type WasteSummary = {
  totalKg: number;
  recordCount: number;
  averageKg: number;
  gramsPerMeal: number | null;
};

export type DailyWastePoint = {
  date: string;
  wasteKg: number;
  recordCount: number;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SCOPES: WasteScope[] = ['plate', 'kitchen', 'combined', 'unknown'];
const ACTION_STATUSES = ['planned', 'in_progress', 'completed'];

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isText(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length <= max;
}

export function isValidDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00.000Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Validate persisted and imported data as well as form submissions. */
export function validRecord(value: unknown): string | null {
  if (!isObject(value)) return 'The record must be an object.';
  if (typeof value.id !== 'string' || !UUID.test(value.id)) return 'The record needs a valid ID.';
  if (!isValidDate(value.date)) return 'Choose a valid calendar date.';
  if (typeof value.wasteKg !== 'number' || !Number.isFinite(value.wasteKg) || value.wasteKg < 0 || value.wasteKg > 100000) {
    return 'Waste must be a number of kilograms, zero or greater.';
  }
  if (!SCOPES.includes(value.scope as WasteScope)) return 'Choose what the waste measurement includes.';
  if (!isText(value.coverage, 100) || !value.coverage.trim()) return 'Describe which meals the weight covers.';
  if (!isObject(value.menu)) return 'The menu is missing.';
  for (const meal of ['breakfast', 'lunch', 'dinner']) {
    if (!isText(value.menu[meal], 1000)) return 'Each menu entry must be text under 1,000 characters.';
  }
  if (value.menu.snacks !== undefined && !isText(value.menu.snacks, 1000)) return 'The snack menu must be text under 1,000 characters.';
  if (value.attendance !== undefined && (
    typeof value.attendance !== 'number' ||
    !Number.isSafeInteger(value.attendance) ||
    value.attendance <= 0 || value.attendance > 1000000
  )) return 'Meals served must be a positive whole number, or left blank.';
  if (!isText(value.notes, 3000)) return 'Notes must be text under 3,000 characters.';
  if (!Array.isArray(value.photos) || value.photos.length > 6) return 'Use no more than 6 photos per day.';
  const photoIds = new Set<string>();
  for (const photo of value.photos) {
    if (!isObject(photo) || typeof photo.id !== 'string' || !UUID.test(photo.id)) return 'A photo has an invalid ID.';
    if (photoIds.has(photo.id)) return 'The same photo cannot be attached twice.';
    photoIds.add(photo.id);
    if (!isText(photo.name, 180) || !photo.name.trim()) return 'Each photo needs a filename under 180 characters.';
    if (photo.kind !== 'board' && photo.kind !== 'plate') return 'Choose a board or plate photo type.';
    if (photo.key !== undefined && !isText(photo.key, 1000)) return 'A photo has an invalid storage key.';
    if (photo.mimeType !== undefined && !isText(photo.mimeType, 100)) return 'A photo has an invalid file type.';
  }
  if (value.action !== undefined) {
    if (!isObject(value.action) || !isText(value.action.text, 1000) || !value.action.text.trim()) {
      return 'Describe the proposed action, or remove it.';
    }
    if (!ACTION_STATUSES.includes(value.action.status as string)) return 'Choose a valid action status.';
    if (value.action.notes !== undefined && !isText(value.action.notes, 2000)) return 'Action notes must be under 2,000 characters.';
  }
  for (const field of ['createdAt', 'updatedAt']) {
    const stamp = value[field];
    if (typeof stamp !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(stamp) || !Number.isFinite(Date.parse(stamp))) {
      return 'The record has an invalid timestamp.';
    }
  }
  return null;
}

function normalizeCoverage(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Ratios use a weighted denominator, never an average of daily ratios.
 * Missing attendance or a change in measurement coverage suppresses the ratio.
 */
export function calculateSummary(records: readonly WasteRecord[]): WasteSummary {
  const totalKg = records.reduce((sum, record) => sum + record.wasteKg, 0);
  const first = records[0];
  const comparable = !!first && first.scope !== 'unknown' && normalizeCoverage(first.coverage) !== 'not confirmed' && records.every(record =>
    typeof record.attendance === 'number' &&
    Number.isSafeInteger(record.attendance) &&
    record.attendance > 0 &&
    record.scope === first.scope &&
    normalizeCoverage(record.coverage) === normalizeCoverage(first.coverage),
  );
  const meals = comparable ? records.reduce((sum, record) => sum + (record.attendance ?? 0), 0) : 0;
  return {
    totalKg,
    recordCount: records.length,
    averageKg: records.length ? totalKg / records.length : 0,
    gramsPerMeal: meals > 0 ? totalKg * 1000 / meals : null,
  };
}

/** Preserve missing days as gaps; absence of a record never means zero waste. */
export function dailyWastePoints(records: readonly WasteRecord[]): DailyWastePoint[] {
  const points = new Map<string, DailyWastePoint>();
  for (const record of records) {
    const point = points.get(record.date);
    if (point) {
      point.wasteKg += record.wasteKg;
      point.recordCount += 1;
    } else {
      points.set(record.date, { date: record.date, wasteKg: record.wasteKg, recordCount: 1 });
    }
  }
  return [...points.values()].sort((a, b) => a.date.localeCompare(b.date));
}

// Illustrative sample data only. The application labels this scenario separately
// from users' measurements and does not attach fabricated source photos.
export const DEMO_RECORDS: WasteRecord[] = [
  ['2026-10-02', 42.5, 990, 'Poha, tea', 'Rice, dal, aloo gobi', 'Roti, paneer curry, rice'],
  ['2026-10-03', 38.2, 945, 'Idli, sambar', 'Rice, rajma, salad', 'Roti, mixed vegetables, dal'],
  ['2026-10-04', 46.8, 1010, 'Paratha, curd', 'Vegetable pulao, raita', 'Roti, chana masala, rice'],
  ['2026-10-05', 35.6, 970, 'Upma, banana', 'Rice, sambar, beans', 'Roti, dal tadka, vegetables'],
  ['2026-10-06', 40.1, 1025, 'Dosa, chutney', 'Rice, dal, bhindi', 'Roti, paneer curry, rice'],
  ['2026-10-07', 33.4, 960, 'Poha, boiled eggs', 'Rice, chole, salad', 'Roti, mixed vegetables, dal'],
  ['2026-10-08', 36.7, 995, 'Idli, sambar', 'Rice, rajma, salad', 'Roti, dal, seasonal vegetables'],
].map((row, index) => ({
  id: '8bf19f00-8016-4000-8000-' + String(index + 1).padStart(12, '0'),
  date: row[0] as string,
  wasteKg: row[1] as number,
  scope: 'plate',
  coverage: 'Breakfast, lunch and dinner',
  attendance: row[2] as number,
  menu: { breakfast: row[3] as string, lunch: row[4] as string, dinner: row[5] as string },
  notes: 'Illustrative sample data. Replace with the mess’s published measurement.',
  photos: [],
  ...(index === 5 ? {
    action: {
      text: 'Discuss offering a smaller first serving of rice, with seconds available.',
      status: 'planned' as const,
      notes: 'Example proposal awaiting manager review. No reduction is attributed to this action.',
    },
  } : {}),
  createdAt: row[0] + 'T16:30:00.000Z',
  updatedAt: row[0] + 'T16:30:00.000Z',
}));
