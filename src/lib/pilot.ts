import { isValidDate, type Photo } from './domain';

export const BINS = [0, 25, 50, 75, 100] as const;
export type Score = typeof BINS[number] | null;
export type Dish = { id: string; name: string };
export type Rating = { dishId: string; remainingPercent: Score; note?: string };
export type Review = { name: string; ratings: Rating[]; scoredAt: string };
export type ModelRun = { id: string; ratings: Rating[]; modelId: string; promptVersion: string; scoredAt: string; requestId: string; inputTokens: number; outputTokens: number };
export type PlatePair = {
  id: string; date: string; meal: 'breakfast' | 'lunch' | 'dinner'; dishes: Dish[];
  before: Photo; after: Photo; feedback: string; notes: string;
  reviews: { a?: Review; b?: Review }; runs: ModelRun[];
  attempts: number; createdAt: string; updatedAt: string;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max;
const stamp = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) && Number.isFinite(Date.parse(v));
export const scoreLabel = (score: Score | undefined) => score === undefined ? 'Not rated' : score === null ? 'Cannot assess' : `${score}%`;

export function validRatings(value: unknown, dishes: Dish[]): boolean {
  return Array.isArray(value) && value.length === dishes.length &&
    new Set(value.map(r => r?.dishId)).size === dishes.length && value.every(r =>
      object(r) && dishes.some(d => d.id === r.dishId) &&
      (r.remainingPercent === null || BINS.includes(r.remainingPercent as typeof BINS[number])) &&
      (r.note === undefined || text(r.note, 300)),
    );
}

export function validPair(value: unknown): string | null {
  if (!object(value) || typeof value.id !== 'string' || !UUID.test(value.id)) return 'The plate needs a valid ID.';
  if (!isValidDate(value.date) || !['breakfast', 'lunch', 'dinner'].includes(value.meal as string)) return 'Choose a valid date and meal.';
  if (!Array.isArray(value.dishes) || value.dishes.length < 1 || value.dishes.length > 8 || value.dishes.some(d =>
    !object(d) || typeof d.id !== 'string' || !UUID.test(d.id) || !text(d.name, 100) || !d.name.trim(),
  )) return 'Enter 1–8 dishes, each under 100 characters.';
  const dishes = value.dishes as Dish[];
  if (new Set(dishes.map(d => d.id)).size !== dishes.length || new Set(dishes.map(d => d.name.trim().toLowerCase())).size !== dishes.length) return 'Each dish must be unique.';
  for (const side of ['before', 'after']) {
    const photo = value[side];
    if (!object(photo) || typeof photo.id !== 'string' || !UUID.test(photo.id) || photo.kind !== 'plate' || !text(photo.name, 180) || !photo.name.trim() || !['image/jpeg', 'image/png', 'image/webp'].includes(photo.mimeType as string)) return 'Attach both plate photos as JPEG, PNG, or WebP.';
    if (photo.key !== undefined && !text(photo.key, 1000)) return 'A plate photo has an invalid storage key.';
  }
  if ((value.before as Photo).id === (value.after as Photo).id || ((value.before as Photo).key && (value.before as Photo).key === (value.after as Photo).key)) return 'Use separate before and after photos.';
  if (!text(value.feedback, 1000) || !text(value.notes, 1000)) return 'Keep feedback and notes under 1,000 characters.';
  if (!object(value.reviews)) return 'The human reviews are missing.';
  for (const slot of ['a', 'b']) {
    const review = value.reviews[slot];
    if (review !== undefined && (!object(review) || !text(review.name, 80) || !review.name.trim() || !stamp(review.scoredAt) || !validRatings(review.ratings, dishes))) return 'Rate every dish and identify the human reviewer.';
  }
  const reviews = value.reviews as PlatePair['reviews'];
  if (reviews.b && !reviews.a) return 'Save reviewer A before reviewer B.';
  if (reviews.a && reviews.b && reviews.a.name.trim().toLowerCase() === reviews.b.name.trim().toLowerCase()) return 'Use different names or aliases for the two reviewers.';
  if (!Array.isArray(value.runs) || value.runs.length > 2) return 'Keep at most two model runs per plate.';
  if (value.runs.length && (!reviews.a || !reviews.b)) return 'Save both human reviews before running the model.';
  for (const run of value.runs) {
    if (!object(run) || typeof run.id !== 'string' || !UUID.test(run.id) || !validRatings(run.ratings, dishes) || !stamp(run.scoredAt) || !text(run.modelId, 200) || !run.modelId || !text(run.promptVersion, 100) || !run.promptVersion || !text(run.requestId, 200) || !Number.isSafeInteger(run.inputTokens) || (run.inputTokens as number) < 0 || !Number.isSafeInteger(run.outputTokens) || (run.outputTokens as number) < 0) return 'A model run has invalid scores or provenance.';
  }
  if (!Number.isInteger(value.attempts) || (value.attempts as number) < value.runs.length || (value.attempts as number) > 4 || !stamp(value.createdAt) || !stamp(value.updatedAt)) return 'The pilot metadata is invalid.';
  return null;
}

/** Preserve pre-model human ratings and the exact input pair for repeatability. */
export function pairUpdateError(next: PlatePair, previous?: PlatePair): string | null {
  if (!previous) return next.runs.length || next.attempts || next.reviews.a || next.reviews.b ? 'Create a fresh pair before collecting reviews.' : null;
  for (const field of ['date', 'meal', 'dishes', 'before', 'after', 'feedback', 'notes', 'runs', 'attempts', 'createdAt'] as const) {
    if (JSON.stringify(next[field]) !== JSON.stringify(previous[field])) return 'Saved photos, dishes, and model results are fixed. Create another pair to correct the inputs.';
  }
  for (const slot of ['a', 'b'] as const) {
    if (previous.reviews[slot] && JSON.stringify(next.reviews[slot]) !== JSON.stringify(previous.reviews[slot])) return 'Saved human ratings are locked for an independent comparison.';
  }
  if (previous.runs.length && JSON.stringify(next.reviews) !== JSON.stringify(previous.reviews)) return 'Human ratings must be recorded before the model runs.';
  return null;
}

export type Agreement = { exact: number; withinStep: number; compared: number; excluded: number; eligible: number };
export function compareRatings(a: Rating[], b: Rating[], dishes: Dish[]): Agreement {
  const result: Agreement = { exact: 0, withinStep: 0, compared: 0, excluded: 0, eligible: dishes.length };
  for (const dish of dishes) {
    const x = a.find(r => r.dishId === dish.id)?.remainingPercent;
    const y = b.find(r => r.dishId === dish.id)?.remainingPercent;
    if (typeof x !== 'number' || typeof y !== 'number') { result.excluded++; continue; }
    result.compared++; if (x === y) result.exact++; if (Math.abs(x - y) <= 25) result.withinStep++;
  }
  return result;
}
export function evaluatePairs(pairs: PlatePair[]) {
  const rows: { label: string; plates: number; agreement: Agreement }[] = [
    { label: 'Model run 1 vs reviewer A', plates: 0, agreement: { exact: 0, withinStep: 0, compared: 0, excluded: 0, eligible: 0 } },
    { label: 'Model run 1 vs reviewer B', plates: 0, agreement: { exact: 0, withinStep: 0, compared: 0, excluded: 0, eligible: 0 } },
    { label: 'Reviewer A vs reviewer B', plates: 0, agreement: { exact: 0, withinStep: 0, compared: 0, excluded: 0, eligible: 0 } },
    { label: 'Repeatability: run 1 vs run 2', plates: 0, agreement: { exact: 0, withinStep: 0, compared: 0, excluded: 0, eligible: 0 } },
  ];
  for (const pair of pairs) {
    const sources = [[pair.runs[0]?.ratings, pair.reviews.a?.ratings], [pair.runs[0]?.ratings, pair.reviews.b?.ratings], [pair.reviews.a?.ratings, pair.reviews.b?.ratings], [pair.runs[0]?.ratings, pair.runs[1]?.ratings]];
    sources.forEach(([a, b], i) => {
      if (!a || !b) return;
      rows[i].plates++;
      const counts = compareRatings(a, b, pair.dishes);
      for (const key of Object.keys(counts) as (keyof Agreement)[]) rows[i].agreement[key] += counts[key];
    });
  }
  return { plateCount: pairs.length, dishCount: pairs.reduce((n, p) => n + p.dishes.length, 0), rows };
}
