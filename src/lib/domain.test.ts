import { afterEach, describe, expect, it, vi } from 'vitest';
import { calculateSummary, dailyWastePoints, DEMO_RECORDS, isValidDate, validRecord, type WasteRecord } from './domain';
import { localRepository } from './localRepository';
import 'fake-indexeddb/auto';

const base = (): WasteRecord => structuredClone(DEMO_RECORDS[0]);

afterEach(() => vi.unstubAllGlobals());

describe('record validation', () => {
  it('accepts zero measured waste with attendance left unknown', () => {
    const record = { ...base(), wasteKg: 0, attendance: undefined };
    expect(validRecord(record)).toBeNull();
  });

  it('rejects invalid calendar dates, missing coverage and invalid weights', () => {
    expect(isValidDate('2026-02-29')).toBe(false);
    expect(isValidDate('2028-02-29')).toBe(true);
    expect(validRecord({ ...base(), date: '2026-04-31' })).toMatch(/calendar date/);
    expect(validRecord({ ...base(), coverage: '  ' })).toMatch(/meals/);
    expect(validRecord({ ...base(), wasteKg: -1 })).toMatch(/zero or greater/);
    expect(validRecord({ ...base(), wasteKg: NaN })).toMatch(/zero or greater/);
    expect(validRecord({ ...base(), wasteKg: Infinity })).toMatch(/zero or greater/);
    expect(validRecord({ ...base(), wasteKg: '5' })).toMatch(/zero or greater/);
  });

  it('requires a known denominator to be a positive integer', () => {
    for (const attendance of [0, -1, 1.5, NaN, Infinity, null]) {
      expect(validRecord({ ...base(), attendance })).toMatch(/positive whole number/);
    }
    expect(validRecord({ ...base(), attendance: 1 })).toBeNull();
  });

  it('rejects repeated photo references and invalid action states', () => {
    const photo = { id: crypto.randomUUID(), name: 'plate.jpg', kind: 'plate' as const };
    expect(validRecord({ ...base(), photos: [photo, photo] })).toMatch(/twice/);
    expect(validRecord({ ...base(), action: { text: 'Ask the manager', status: 'done' } })).toMatch(/status/);
  });

  it('keeps all sample records valid and without fabricated photo evidence', () => {
    expect(DEMO_RECORDS).toHaveLength(7);
    for (const record of DEMO_RECORDS) {
      expect(validRecord(record)).toBeNull();
      expect(record.photos).toEqual([]);
      expect(record.notes).toContain('Illustrative sample data');
    }
  });
});

describe('measurement summaries', () => {
  it('handles an empty collection and a real zero without creating missing observations', () => {
    expect(calculateSummary([])).toEqual({ totalKg: 0, recordCount: 0, averageKg: 0, gramsPerMeal: null });
    expect(calculateSummary([{ ...base(), wasteKg: 0 }]).gramsPerMeal).toBe(0);
  });

  it('uses total waste divided by total meals, rather than averaging daily ratios', () => {
    const records = [
      { ...base(), wasteKg: 10, attendance: 100 },
      { ...base(), date: '2026-10-03', wasteKg: 10, attendance: 900 },
    ];
    expect(calculateSummary(records)).toEqual({ totalKg: 20, recordCount: 2, averageKg: 10, gramsPerMeal: 20 });
  });

  it('suppresses the normalized metric when any attendance is missing', () => {
    const records = [base(), { ...base(), attendance: undefined }];
    expect(calculateSummary(records).gramsPerMeal).toBeNull();
  });

  it('does not combine denominators for different waste scopes or meal coverage', () => {
    expect(calculateSummary([base(), { ...base(), scope: 'combined' }]).gramsPerMeal).toBeNull();
    expect(calculateSummary([base(), { ...base(), coverage: 'Lunch' }]).gramsPerMeal).toBeNull();
    expect(calculateSummary([base(), { ...base(), attendance: 0 }]).gramsPerMeal).toBeNull();
    expect(calculateSummary([{ ...base(), scope: 'unknown' }]).gramsPerMeal).toBeNull();
    expect(calculateSummary([{ ...base(), coverage: 'Not confirmed' }]).gramsPerMeal).toBeNull();
  });

  it('ignores harmless capitalization and whitespace in meal coverage', () => {
    const record = base();
    expect(calculateSummary([record, { ...record, coverage: ' BREAKFAST,  LUNCH AND DINNER ' }]).gramsPerMeal)
      .toBeCloseTo(record.wasteKg * 1000 / record.attendance!);
  });
});

describe('daily series', () => {
  it('sorts existing dates, combines same-day values and leaves missing days absent', () => {
    const records = [
      { ...base(), date: '2026-10-04', wasteKg: 2 },
      { ...base(), date: '2026-10-02', wasteKg: 0 },
      { ...base(), date: '2026-10-04', wasteKg: 3 },
    ];
    expect(dailyWastePoints(records)).toEqual([
      { date: '2026-10-02', wasteKg: 0, recordCount: 1 },
      { date: '2026-10-04', wasteKg: 5, recordCount: 2 },
    ]);
  });
});

describe('local daily record persistence', () => {
  function useMemoryStorage() {
    const values = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => { values.set(key, value); },
        removeItem: (key: string) => { values.delete(key); },
      },
    });
    return values;
  }

  it('persists edits and rejects a second record for the same calendar day', async () => {
    useMemoryStorage();
    const record = base();
    await localRepository.save(record);
    await expect(localRepository.save({ ...record, id: crypto.randomUUID() })).rejects.toThrow(/already exists/);
    await localRepository.save({ ...record, wasteKg: 0 });
    expect(await localRepository.list()).toEqual([{ ...record, wasteKg: 0 }]);
  });

  it('does not overwrite malformed stored data', async () => {
    const values = useMemoryStorage();
    values.set('messwise.v1', '{bad-json');
    await expect(localRepository.save(base())).rejects.toThrow(/could not be read/);
    expect(values.get('messwise.v1')).toBe('{bad-json');
  });

  it('surfaces blocked storage instead of reporting a successful save', async () => {
    vi.stubGlobal('window', { localStorage: {
      getItem: () => null,
      setItem: () => { throw new Error('Quota exceeded'); },
    } });
    await expect(localRepository.save(base())).rejects.toThrow(/could not be saved/);
  });

  it('retains photo bytes and creates usable URLs after an earlier view is closed', async () => {
    useMemoryStorage();
    const photo = await localRepository.putPhoto(new File(['pilot-image'], 'board.png', { type: 'image/png' }), 'board');
    await localRepository.save({ ...base(), photos: [photo] });
    const saved = (await localRepository.list())[0];
    const firstUrl = await localRepository.getPhotoUrl(saved.photos[0]);
    expect(await (await fetch(firstUrl!)).text()).toBe('pilot-image');
    URL.revokeObjectURL(firstUrl!);
    const secondUrl = await localRepository.getPhotoUrl(saved.photos[0]);
    expect(await (await fetch(secondUrl!)).text()).toBe('pilot-image');
    URL.revokeObjectURL(secondUrl!);
    await localRepository.remove(saved.id);
    expect(await localRepository.getPhotoUrl(photo)).toBeNull();
  });

  it('rejects unsupported or oversized photos before changing storage', async () => {
    await expect(localRepository.putPhoto(new File(['photo'], 'plate.heic', { type: 'image/heic' }), 'plate')).rejects.toThrow(/JPEG/);
    await expect(localRepository.putPhoto(new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'plate.jpg', { type: 'image/jpeg' }), 'plate')).rejects.toThrow(/5 MB/);
  });
});
