// @vitest-environment jsdom
// @vitest-environment-options {"url":"http://127.0.0.1:5173"}
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import App from '../App';
import type { WasteRecord } from '../lib/domain';
import { localRepository } from '../lib/localRepository';

const aws = vi.hoisted(() => ({ signedIn: false, list: vi.fn() }));

vi.mock('../lib/repository', async importOriginal => {
  const actual = await importOriginal<typeof import('../lib/repository')>();
  return {
    ...actual,
    cloudConfigured: true,
    isSignedIn: () => aws.signedIn,
    awsRepository: { ...actual.awsRepository, list: aws.list },
  };
});

const record: WasteRecord = {
  id: '11111111-1111-4111-8111-111111111111',
  date: '2026-10-08', wasteKg: 12.5, scope: 'plate', coverage: 'Lunch',
  menu: { breakfast: '', lunch: 'Original lunch', dinner: '' },
  notes: '', photos: [],
  createdAt: '2026-10-08T12:00:00.000Z', updatedAt: '2026-10-08T12:00:00.000Z',
};

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; },
    clear: () => data.clear(),
    getItem: key => data.get(key) ?? null,
    key: index => [...data.keys()][index] ?? null,
    removeItem: key => { data.delete(key); },
    setItem: (key, value) => { data.set(key, String(value)); },
  };
}

async function storageChanged(key: string | null) {
  await act(async () => {
    window.dispatchEvent(new StorageEvent('storage', { key }));
  });
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  vi.stubGlobal('sessionStorage', memoryStorage());
  vi.stubGlobal('fetch', vi.fn());
  aws.signedIn = false;
  aws.list.mockReset().mockResolvedValue([record]);
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('Workspace updates from other tabs', () => {
  it('keeps the AWS workspace stable when another tab changes its workspace or data', async () => {
    aws.signedIn = true;
    localStorage.setItem('messwise.mode.v1', 'aws');
    render(<App />);
    await screen.findByText(record.menu.lunch);
    const write = vi.spyOn(localStorage, 'setItem');

    // Another tab can use this device while this tab remains in the AWS workspace.
    localStorage.setItem('messwise.mode.v1', 'local');
    write.mockClear();
    for (const key of ['messwise.mode.v1', 'unrelated.setting', 'messwise.v1', null]) {
      await storageChanged(key);
    }

    expect(screen.getByText(record.menu.lunch)).toBeTruthy();
    expect(aws.list).toHaveBeenCalledTimes(1);
    expect(write).not.toHaveBeenCalled();
    expect(localStorage.getItem('messwise.mode.v1')).toBe('local');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('refreshes changed device records once without rewriting the workspace preference', async () => {
    localStorage.setItem('messwise.mode.v1', 'local');
    localStorage.setItem('messwise.v1', JSON.stringify([record]));
    const list = vi.spyOn(localRepository, 'list');
    render(<App />);
    await screen.findByText(record.menu.lunch);
    list.mockClear();
    const write = vi.spyOn(localStorage, 'setItem');

    const updated = { ...record, menu: { ...record.menu, lunch: 'Lunch changed in another tab' } };
    localStorage.setItem('messwise.v1', JSON.stringify([updated]));
    write.mockClear();
    await storageChanged('messwise.v1');

    expect(await screen.findByText(updated.menu.lunch)).toBeTruthy();
    expect(screen.queryByText(record.menu.lunch)).toBeNull();
    expect(list).toHaveBeenCalledTimes(1);
    expect(write).not.toHaveBeenCalled();
    expect(aws.list).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('ignores other workspace preferences and unrelated storage changes in the device workspace', async () => {
    localStorage.setItem('messwise.mode.v1', 'local');
    localStorage.setItem('messwise.v1', JSON.stringify([record]));
    const list = vi.spyOn(localRepository, 'list');
    render(<App />);
    await screen.findByText(record.menu.lunch);
    list.mockClear();
    const write = vi.spyOn(localStorage, 'setItem');

    await storageChanged('messwise.mode.v1');
    await storageChanged('unrelated.setting');

    expect(screen.getByText(record.menu.lunch)).toBeTruthy();
    expect(list).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
    expect(aws.list).not.toHaveBeenCalled();
  });

  it('refreshes the device workspace after another tab clears site storage', async () => {
    localStorage.setItem('messwise.mode.v1', 'local');
    localStorage.setItem('messwise.v1', JSON.stringify([record]));
    const list = vi.spyOn(localRepository, 'list');
    render(<App />);
    await screen.findByText(record.menu.lunch);
    list.mockClear();
    const write = vi.spyOn(localStorage, 'setItem');

    localStorage.clear();
    await storageChanged(null);

    expect(await screen.findByText('Your first number tells a story')).toBeTruthy();
    expect(screen.queryByText(record.menu.lunch)).toBeNull();
    expect(list).toHaveBeenCalledTimes(1);
    expect(write).not.toHaveBeenCalled();
    expect(aws.list).not.toHaveBeenCalled();
  });
});
