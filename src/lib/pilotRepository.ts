import { request } from './repository';
import { pairUpdateError, validPair, type PlatePair } from './pilot';

const KEY = 'messwise.pilot.v1';
function read(): PlatePair[] {
  let data: unknown;
  try { data = JSON.parse(window.localStorage.getItem(KEY) ?? '[]'); }
  catch { throw new Error('Saved plate pairs could not be read. They have not been overwritten.'); }
  if (!Array.isArray(data) || data.some(p => validPair(p)) || new Set(data.map(p => p.id)).size !== data.length) throw new Error('Saved plate pairs contain invalid data. They have not been overwritten.');
  return data as PlatePair[];
}
export const localPilotRepository = {
  async list(): Promise<PlatePair[]> { return read().sort((a, b) => b.date.localeCompare(a.date)); },
  async save(pair: PlatePair): Promise<PlatePair> {
    const pairs = read(); const previous = pairs.find(p => p.id === pair.id);
    const error = validPair(pair) || pairUpdateError(pair, previous);
    if (error) throw new Error(error);
    const saved = structuredClone(pair);
    try { window.localStorage.setItem(KEY, JSON.stringify([...pairs.filter(p => p.id !== pair.id), saved])); }
    catch { throw new Error('The plate pair could not be saved. Browser storage may be full or blocked.'); }
    return saved;
  },
  async score(_id: string): Promise<PlatePair> { throw new Error('Bedrock scoring is available in the AWS workspace. Human reviews work on this device.'); },
  async remove(id: string): Promise<void> { window.localStorage.setItem(KEY, JSON.stringify(read().filter(p => p.id !== id))); },
};
export type PilotRepository = typeof localPilotRepository;
export const awsPilotRepository: PilotRepository = {
  list: async () => (await request<{ pairs: PlatePair[] }>('/plate-pairs')).pairs,
  save: async pair => (await request<{ pair: PlatePair }>(`/plate-pairs/${pair.id}`, { method: 'PUT', body: JSON.stringify(pair) })).pair,
  score: async id => (await request<{ pair: PlatePair }>(`/plate-pairs/${id}/score`, { method: 'POST', body: '{}' })).pair,
  remove: async id => { await request(`/plate-pairs/${id}`, { method: 'DELETE' }); },
};
export function exportPilot(pairs: PlatePair[]) {
  const data = { application: 'MessWise plate pilot', exportedAt: new Date().toISOString(), protocol: 'Two independent human ratings recorded before up to two model runs. Five bins; null means cannot assess. Plate count differs from dish-rating count. Photos stored separately.', pairs };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'messwise-plate-pilot.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
