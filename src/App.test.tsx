// @vitest-environment jsdom
// @vitest-environment-options {"url":"http://127.0.0.1:5173"}
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

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
  // Node 25 exposes an incomplete native Storage inside this test environment.
  vi.stubGlobal('localStorage', memoryStorage());
  vi.stubGlobal('sessionStorage', memoryStorage());
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('MessWise workspace workflow', () => {
  it('keeps fictional samples out of the real workspace', async () => {
    const user = userEvent.setup(); render(<App />);
    expect(await screen.findByText(/viewing fictional sample data/)).toBeTruthy();
    expect(localStorage.getItem('messwise.v1')).toBeNull();
    await user.click(screen.getByRole('button', { name: /use my own data/i }));
    expect(await screen.findByText('Your first number tells a story')).toBeTruthy();
    expect(localStorage.getItem('messwise.v1')).toBeNull();
  });

  it('persists a real entry, edits its measured weight, and follows up an action', async () => {
    localStorage.setItem('messwise.mode.v1', 'local');
    const user = userEvent.setup(); const mounted = render(<App />);
    await screen.findByText('Your first number tells a story');
    await user.click(screen.getByRole('button', { name: 'Add daily entry' }));
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-10-08' } });
    await user.type(screen.getByLabelText(/Published waste weight/), '12.5');
    await user.selectOptions(screen.getByLabelText('What does it include?'), 'plate');
    await user.type(screen.getByLabelText('Lunch'), 'Rice, dal, bhindi');
    await user.type(screen.getByLabelText('Action agreed with the mess team'), 'Discuss offering seconds');
    await user.click(screen.getByRole('button', { name: 'Save daily entry' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    let saved = JSON.parse(localStorage.getItem('messwise.v1')!);
    expect(saved).toHaveLength(1); expect(saved[0].wasteKg).toBe(12.5); expect(saved[0].menu.lunch).toBe('Rice, dal, bhindi');
    expect(saved[0].attendance).toBeUndefined();
    mounted.unmount(); render(<App />);
    await screen.findByText('Rice, dal, bhindi');
    await user.click(screen.getByRole('button', { name: /Open entry for 8 Oct/ }));
    await user.clear(screen.getByLabelText(/Published waste weight/));
    await user.type(screen.getByLabelText(/Published waste weight/), '0');
    await user.click(screen.getByRole('button', { name: 'Save daily entry' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    saved = JSON.parse(localStorage.getItem('messwise.v1')!); expect(saved[0].wasteKg).toBe(0);
    await user.click(screen.getByRole('button', { name: /^Action plan/ }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Status of Discuss offering seconds' }), 'completed');
    await waitFor(() => expect(JSON.parse(localStorage.getItem('messwise.v1')!)[0].action.status).toBe('completed'));
  });

  it('rejects duplicate dates without losing the existing daily measurement', async () => {
    localStorage.setItem('messwise.mode.v1', 'local');
    const user = userEvent.setup(); render(<App />);
    await screen.findByText('Your first number tells a story');
    for (const weight of ['10', '20']) {
      await user.click(screen.getByRole('button', { name: 'Add daily entry' }));
      fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-10-08' } });
      await user.type(screen.getByLabelText(/Published waste weight/), weight);
      await user.click(screen.getByRole('button', { name: 'Save daily entry' }));
      if (weight === '10') await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      else expect(await screen.findByRole('alert')).toBeTruthy();
    }
    const saved = JSON.parse(localStorage.getItem('messwise.v1')!);
    expect(saved).toHaveLength(1); expect(saved[0].wasteKg).toBe(10);
  });
});
