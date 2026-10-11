// @vitest-environment jsdom
// @vitest-environment-options {"url":"http://127.0.0.1:5173"}
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import type { WasteRecord } from '../lib/domain';

const aws = vi.hoisted(() => ({ signedIn: false, list: vi.fn(), signIn: vi.fn() }));

vi.mock('../lib/repository', async importOriginal => {
  const actual = await importOriginal<typeof import('../lib/repository')>();
  return {
    ...actual,
    cloudConfigured: true,
    cloudDetails: { apiUrl: 'https://workspace.example.invalid', region: 'test-region' },
    isSignedIn: () => aws.signedIn,
    signIn: aws.signIn,
    signOut: () => { aws.signedIn = false; },
    awsRepository: { ...actual.awsRepository, list: aws.list },
  };
});

const cloudRecord: WasteRecord = {
  id: '11111111-1111-4111-8111-111111111111',
  date: '2026-10-08', wasteKg: 12.5, scope: 'plate', coverage: 'Lunch',
  menu: { breakfast: '', lunch: 'AWS regression lunch', dinner: '' },
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

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  vi.stubGlobal('sessionStorage', memoryStorage());
  vi.stubGlobal('fetch', vi.fn());
  aws.signedIn = false;
  aws.list.mockReset().mockResolvedValue([cloudRecord]);
  aws.signIn.mockReset().mockImplementation(async () => { aws.signedIn = true; return null; });
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('AWS workspace navigation', () => {
  it('opens Overview from Data & AWS even when the AWS workspace is already selected', async () => {
    aws.signedIn = true;
    localStorage.setItem('messwise.mode.v1', 'aws');
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText(cloudRecord.menu.lunch);
    await user.click(screen.getByRole('button', { name: 'Data & AWS' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Data & AWS' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Open AWS workspace' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Every meal is a chance to do better.' })).toBeTruthy();
    expect(screen.getByText(cloudRecord.menu.lunch)).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 1, name: 'Data & AWS' })).toBeNull();
    expect(localStorage.getItem('messwise.mode.v1')).toBe('aws');
    expect(aws.list).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('opens Overview with cloud records after successful sign-in', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Data & AWS' }));
    await user.type(screen.getByLabelText('Email'), 'test@example.invalid');
    await user.type(screen.getByLabelText('Password'), 'test-only password');

    await user.click(screen.getByRole('button', { name: 'Sign in to AWS workspace' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Every meal is a chance to do better.' })).toBeTruthy();
    expect(await screen.findByText(cloudRecord.menu.lunch)).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 1, name: 'Data & AWS' })).toBeNull();
    expect(screen.queryByText(/viewing fictional sample data/)).toBeNull();
    expect(aws.signIn).toHaveBeenCalledWith('test@example.invalid', 'test-only password');
    expect(aws.list).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(localStorage.getItem('messwise.mode.v1')).toBe('aws'));
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps an expired AWS session in Data & AWS without loading cloud records', async () => {
    aws.signedIn = true;
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Data & AWS' }));
    const openWorkspace = screen.getByRole('button', { name: 'Open AWS workspace' });
    // Authentication can expire after the settings page has rendered.
    aws.signedIn = false;

    await user.click(openWorkspace);

    expect(screen.getByRole('heading', { level: 1, name: 'Data & AWS' })).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 1, name: 'Every meal is a chance to do better.' })).toBeNull();
    expect(aws.list).not.toHaveBeenCalled();
    expect(localStorage.getItem('messwise.mode.v1')).toBe('demo');
    expect(fetch).not.toHaveBeenCalled();
  });
});
