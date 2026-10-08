import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { compareRatings, evaluatePairs, validPair, type PlatePair, type Review, type ModelRun } from './pilot';
import { localPilotRepository } from './pilotRepository';

const pair = (): PlatePair => {
  const stamp = new Date().toISOString();
  const photo = (name: string) => ({ id: crypto.randomUUID(), name, kind: 'plate' as const, mimeType: 'image/png' });
  return { id: crypto.randomUUID(), date: '2026-10-08', meal: 'lunch', dishes: [{ id: crypto.randomUUID(), name: 'Rice' }, { id: crypto.randomUUID(), name: 'Dal' }], before: photo('before.png'), after: photo('after.png'), feedback: '', notes: '', reviews: {}, runs: [], attempts: 0, createdAt: stamp, updatedAt: stamp };
};
const review = (p: PlatePair, name: string, values: (0 | 25 | 50 | 75 | 100 | null)[]): Review => ({ name, scoredAt: p.createdAt, ratings: p.dishes.map((d, i) => ({ dishId: d.id, remainingPercent: values[i] })) });
const run = (p: PlatePair, values: (0 | 25 | 50 | 75 | 100 | null)[]): ModelRun => ({ id: crypto.randomUUID(), ratings: review(p, '', values).ratings, modelId: 'test-only-model', promptVersion: 'test-only', requestId: 'test-only', scoredAt: p.createdAt, inputTokens: 1, outputTokens: 1 });
beforeEach(() => { const values = new Map<string, string>(); vi.stubGlobal('window', { localStorage: { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v) } }); });
afterEach(() => vi.unstubAllGlobals());

describe('pilot evidence and evaluation', () => {
  it('counts exact and within-step agreement on assessable ratings, keeping abstentions visible', () => {
    const p = pair();
    expect(compareRatings(review(p, 'A', [0, null]).ratings, review(p, 'B', [25, null]).ratings, p.dishes)).toEqual({ exact: 0, withinStep: 1, compared: 1, excluded: 1, eligible: 2 });
    expect(compareRatings(review(p, 'A', [0, 25]).ratings, review(p, 'B', [100, 25]).ratings, p.dishes)).toEqual({ exact: 1, withinStep: 1, compared: 2, excluded: 0, eligible: 2 });
  });
  it('keeps plate counts separate from dish counts and fixes model run 1 as the human comparison', () => {
    const p = pair(); p.reviews = { a: review(p, 'A', [0, 25]), b: review(p, 'B', [0, 50]) }; p.runs = [run(p, [100, null]), run(p, [0, 25])]; p.attempts = 2;
    const result = evaluatePairs([p, pair()]);
    expect(result.plateCount).toBe(2); expect(result.dishCount).toBe(4);
    expect(result.rows[0].plates).toBe(1); expect(result.rows[0].agreement.exact).toBe(0);
    expect(result.rows[0].agreement.excluded).toBe(1); expect(result.rows[2].agreement.withinStep).toBe(2);
    expect(result.rows[3].agreement.exact).toBe(0);
  });
  it('persists independent human reviews without copying daily measurements or fabricating model output', async () => {
    let p = await localPilotRepository.save(pair());
    p = await localPilotRepository.save({ ...p, reviews: { a: review(p, 'Me', [0, null]) } });
    p = await localPilotRepository.save({ ...p, reviews: { ...p.reviews, b: review(p, 'Friend', [25, 50]) } });
    expect((await localPilotRepository.list())[0]).toEqual(p);
    await expect(localPilotRepository.score(p.id)).rejects.toThrow(/AWS workspace/);
    expect(p.runs).toEqual([]);
  });
  it('locks human ratings and original photo inputs and rejects client-created model results', async () => {
    let p = await localPilotRepository.save(pair()); p = await localPilotRepository.save({ ...p, reviews: { a: review(p, 'Me', [0, null]) } });
    await expect(localPilotRepository.save({ ...p, reviews: { a: review(p, 'Me', [100, 100]) } })).rejects.toThrow(/locked/);
    await expect(localPilotRepository.save({ ...p, date: '2026-10-07' })).rejects.toThrow(/fixed/);
    const forged = pair(); forged.reviews = { a: review(forged, 'A', [0, 0]), b: review(forged, 'B', [0, 0]) }; forged.runs = [run(forged, [0, 0])]; forged.attempts = 1;
    await expect(localPilotRepository.save(forged)).rejects.toThrow(/fresh pair/);
  });
  it('rejects incomplete ratings, duplicate dishes, same photo, and reviewer aliases that match', () => {
    const p = pair();
    expect(validPair(p)).toBeNull();
    expect(validPair({ ...p, after: p.before })).toMatch(/separate/);
    expect(validPair({ ...p, dishes: [p.dishes[0], p.dishes[0]] })).toMatch(/unique/);
    expect(validPair({ ...p, reviews: { a: { ...review(p, 'A', [0, 0]), ratings: [] } } })).toMatch(/every dish/);
    expect(validPair({ ...p, reviews: { a: review(p, 'Me', [0, 0]), b: review(p, 'me', [0, 0]) } })).toMatch(/different names/);
  });
});
