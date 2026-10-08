import type { Photo, WasteRecord } from './domain';
import { localRepository } from './localRepository';

const base = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID ?? '';
const region = import.meta.env.VITE_AWS_REGION ?? '';
export const cloudConfigured = Boolean(base && clientId && region);
export const cloudDetails = { apiUrl: base, region };
const sessionKey = 'messwise.auth.v1';
type Session = { idToken: string; expiresAt: number };
type Challenge = { session: string; username: string };

function getSession(): Session | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(sessionKey) ?? 'null') as Session | null;
    return value && value.expiresAt > Date.now() ? value : null;
  } catch { return null; }
}
export function isSignedIn() { return Boolean(getSession()); }
export function signOut() { sessionStorage.removeItem(sessionKey); }

async function cognito(action: string, payload: object) {
  const response = await fetch(`https://cognito-idp.${region}.amazonaws.com/`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-amz-json-1.1', 'X-Amz-Target': `AWSCognitoIdentityProviderService.${action}` },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Could not sign in. Check your details and try again.');
  return data;
}
function rememberAuth(result: { AuthenticationResult?: { IdToken: string; ExpiresIn: number } }) {
  const auth = result.AuthenticationResult;
  if (!auth) throw new Error('This account requires an unsupported sign-in step. Contact your administrator.');
  sessionStorage.setItem(sessionKey, JSON.stringify({ idToken: auth.IdToken, expiresAt: Date.now() + auth.ExpiresIn * 1000 - 30000 }));
}
export async function signIn(username: string, password: string): Promise<Challenge | null> {
  const result = await cognito('InitiateAuth', { ClientId: clientId, AuthFlow: 'USER_PASSWORD_AUTH', AuthParameters: { USERNAME: username, PASSWORD: password } });
  if (result.ChallengeName === 'NEW_PASSWORD_REQUIRED') return { session: result.Session, username: result.ChallengeParameters?.USER_ID_FOR_SRP || username };
  rememberAuth(result); return null;
}
export async function completePassword(challenge: Challenge, password: string) {
  const result = await cognito('RespondToAuthChallenge', { ClientId: clientId, ChallengeName: 'NEW_PASSWORD_REQUIRED', Session: challenge.session, ChallengeResponses: { USERNAME: challenge.username, NEW_PASSWORD: password } });
  rememberAuth(result);
}

async function request<T>(route: string, options: RequestInit = {}): Promise<T> {
  const session = getSession();
  if (!session) throw new Error('Your AWS session has ended. Sign in again from Data & AWS.');
  const response = await fetch(base + route, { ...options, headers: { Authorization: `Bearer ${session.idToken}`, 'Content-Type': 'application/json', ...options.headers } });
  if (response.status === 401) { signOut(); throw new Error('Your AWS session has ended. Sign in again from Data & AWS.'); }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || body.error || `AWS request failed (${response.status}).`);
  }
  return response.status === 204 ? undefined as T : response.json();
}

export type Repository = typeof localRepository;
export const awsRepository: Repository = {
  list: async () => (await request<{ records: WasteRecord[] }>('/records')).records,
  save: async (record: WasteRecord) => (await request<{ record: WasteRecord }>(`/records/${record.id}`, { method: 'PUT', body: JSON.stringify(record) })).record,
  remove: async (id: string) => { await request(`/records/${id}`, { method: 'DELETE' }); },
  putPhoto: async (file: File, kind: Photo['kind']) => {
    const upload = await request<{ key: string; uploadUrl: string; fields: Record<string, string> }>('/uploads', { method: 'POST', body: JSON.stringify({ name: file.name, mimeType: file.type, sizeBytes: file.size }) });
    const form = new FormData();
    for (const [name, value] of Object.entries(upload.fields)) form.append(name, value);
    form.append('file', file);
    const response = await fetch(upload.uploadUrl, { method: 'POST', body: form });
    if (!response.ok) throw new Error('Photo upload failed. Your entry has not been saved.');
    return { id: crypto.randomUUID(), name: file.name.slice(0, 180), kind, key: upload.key, mimeType: file.type };
  },
  getPhotoUrl: async (photo: Photo) => photo.key ? (await request<{ url: string }>(`/photos?key=${encodeURIComponent(photo.key)}`)).url : null,
  clear: async () => { throw new Error('Bulk cloud deletion is disabled. Remove individual entries from the daily log.'); },
};
export const checkAws = () => request<{ mode: string; service: string; requestId: string }>('/health');

export function downloadRecords(records: WasteRecord[]) {
  const blob = new Blob([JSON.stringify({ application: 'MessWise', version: 1, exportedAt: new Date().toISOString(), records }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = `messwise-records-${new Date().toISOString().slice(0, 10)}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
