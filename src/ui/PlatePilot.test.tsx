// @vitest-environment jsdom
// @vitest-environment-options {"url":"http://127.0.0.1:5173"}
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlatePilot } from './PlatePilot';
import { localRepository } from '../lib/localRepository';
import { awsPilotRepository } from '../lib/pilotRepository';
import * as api from '../lib/repository';
import type { PlatePair } from '../lib/pilot';

beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value), removeItem: (key: string) => data.delete(key) });
  vi.spyOn(localRepository, 'putPhoto').mockImplementation(async (file, kind) => ({ id: crypto.randomUUID(), name: file.name, kind, mimeType: file.type }));
  vi.spyOn(localRepository, 'getPhotoUrl').mockResolvedValue(null);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('collects a pair and two blind reviews, persists the pilot, and keeps Bedrock unavailable locally', async () => {
  const user = userEvent.setup(); const mounted = render(<PlatePilot mode="local" photoRepo={localRepository} onStart={() => {}} />);
  await user.click(await screen.findByRole('button', { name: 'Add plate pair' }));
  await user.type(screen.getByLabelText(/Dishes on this plate/), 'Rice, Dal');
  await user.upload(screen.getByLabelText('Before eating photo'), new File(['test image'], 'before.png', { type: 'image/png' }));
  await user.upload(screen.getByLabelText('After eating photo'), new File(['test image'], 'after.png', { type: 'image/png' }));
  await user.type(screen.getByLabelText('Student feedback (optional)'), 'Portion felt large');
  expect((screen.getByLabelText('Before eating photo') as HTMLInputElement).files).toHaveLength(1);
  expect((screen.getByLabelText('After eating photo') as HTMLInputElement).files).toHaveLength(1);
  // jsdom's native validity does not recognize user-event's FileList. Exercise
  // the submit handler, which independently checks both files and their limits.
  fireEvent.submit(screen.getByRole('button', { name: 'Save plate pair' }).closest('form')!);
  await screen.findByRole('heading', { name: 'Independent reviewer A' });
  expect(screen.queryByText('Portion felt large')).toBeNull();
  await user.type(screen.getByLabelText('Reviewer name or alias'), 'Me');
  await user.selectOptions(screen.getByLabelText('Human score for Rice'), '0');
  await user.selectOptions(screen.getByLabelText('Human score for Dal'), 'unknown');
  await user.click(screen.getByRole('button', { name: 'Save reviewer A ratings' }));
  await screen.findByRole('heading', { name: 'Independent reviewer B' });
  expect(screen.queryByRole('columnheader', { name: 'A: Me' })).toBeNull();
  await user.type(screen.getByLabelText('Reviewer name or alias'), 'Friend');
  await user.selectOptions(screen.getByLabelText('Human score for Rice'), '25');
  await user.selectOptions(screen.getByLabelText('Human score for Dal'), '50');
  await user.click(screen.getByRole('button', { name: 'Save reviewer B ratings' }));
  await screen.findByText('Both human reviews saved before the model.');
  expect((screen.getByRole('button', { name: 'Run Bedrock scoring' }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText('Portion felt large')).toBeTruthy();
  const pair = JSON.parse(localStorage.getItem('messwise.pilot.v1')!)[0];
  expect(pair.runs).toEqual([]); expect(pair.reviews.a.ratings[0].remainingPercent).toBe(0);
  expect(pair.reviews.a.ratings[1].remainingPercent).toBeNull();
  const row = screen.getByText('Reviewer A vs reviewer B').closest('tr')!;
  expect(within(row).getByText('1/1 (100%)')).toBeTruthy(); expect(within(row).getByText('1/2')).toBeTruthy();
  mounted.unmount(); render(<PlatePilot mode="local" photoRepo={localRepository} onStart={() => {}} />);
  expect(await screen.findByText('Ready for Bedrock')).toBeTruthy();
});

it('shows two separate model results, abstentions, and repeatability in a simulated AWS flow', async () => {
  const stamp = new Date().toISOString(); const dishes = [{ id: crypto.randomUUID(), name: 'Rice' }, { id: crypto.randomUUID(), name: 'Dal' }];
  const photo = (name: string) => ({ id: crypto.randomUUID(), name, kind: 'plate' as const, mimeType: 'image/png' });
  const review = (name: string) => ({ name, scoredAt: stamp, ratings: dishes.map(d => ({ dishId: d.id, remainingPercent: 25 as const })) });
  let pair: PlatePair = { id: crypto.randomUUID(), date: '2026-10-08', meal: 'lunch', dishes, before: photo('before.png'), after: photo('after.png'), feedback: '', notes: '', reviews: { a: review('Me'), b: review('Friend') }, runs: [], attempts: 0, createdAt: stamp, updatedAt: stamp };
  vi.spyOn(api, 'request').mockResolvedValue({ pilot: { enabled: true, modelId: 'test-only-model', region: 'test-region' } });
  vi.spyOn(awsPilotRepository, 'list').mockImplementation(async () => [pair]);
  const scoring = vi.spyOn(awsPilotRepository, 'score').mockImplementation(async () => {
    pair = { ...pair, attempts: pair.attempts + 1, runs: [...pair.runs, { id: crypto.randomUUID(), ratings: [{ dishId: dishes[0].id, remainingPercent: pair.runs.length ? 25 : 50 }, { dishId: dishes[1].id, remainingPercent: null, note: 'Cannot separate mixed dal.' }], modelId: 'test-only-model', promptVersion: 'test-only', requestId: 'test-only', scoredAt: stamp, inputTokens: 1, outputTokens: 1 }] };
    return pair;
  });
  const user = userEvent.setup(); render(<PlatePilot mode="aws" photoRepo={localRepository} onStart={() => {}} />);
  await user.click(await screen.findByRole('button', { name: `Review plate ${pair.id.slice(0, 8)}` }));
  await user.click(screen.getByRole('button', { name: 'Run Bedrock scoring' }));
  await screen.findByText('Cannot separate mixed dal.');
  await user.click(screen.getByRole('button', { name: 'Run again for repeatability' }));
  await waitFor(() => expect((screen.getByRole('button', { name: 'Two runs complete' }) as HTMLButtonElement).disabled).toBe(true));
  expect(scoring).toHaveBeenCalledTimes(2);
  const row = screen.getByText('Repeatability: run 1 vs run 2').closest('tr')!;
  expect(within(row).getByText('0/1 (0%)')).toBeTruthy(); expect(within(row).getByText('1/1 (100%)')).toBeTruthy(); expect(within(row).getByText('1/2')).toBeTruthy();
});
