import { validRecord, type Photo, type WasteRecord } from './domain';

const RECORDS_KEY = 'messwise.v1';
const DATABASE_NAME = 'messwise.v1.photos';
const PHOTO_STORE = 'photos';
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const objectUrls = new Map<string, string>();

function browserStorage(): Storage {
  if (typeof window === 'undefined') throw new Error('Local storage is only available in your browser.');
  return window.localStorage;
}

function readRecords(): WasteRecord[] {
  let raw: string | null;
  try {
    raw = browserStorage().getItem(RECORDS_KEY);
  } catch {
    throw new Error('Your browser blocked local storage. Allow storage for this site to save records.');
  }
  if (raw === null) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Saved records could not be read. Export or recover your browser data before resetting it.');
  }
  if (!Array.isArray(parsed)) throw new Error('Saved records have an unexpected format. They have not been overwritten.');
  const dates = new Set<string>();
  const ids = new Set<string>();
  for (const record of parsed) {
    const error = validRecord(record);
    if (error) throw new Error('A saved record is invalid: ' + error);
    if (dates.has(record.date) || ids.has(record.id)) throw new Error('Saved records contain duplicate dates or IDs.');
    dates.add(record.date);
    ids.add(record.id);
  }
  return parsed as WasteRecord[];
}

function writeRecords(records: WasteRecord[]): void {
  try {
    browserStorage().setItem(RECORDS_KEY, JSON.stringify(records));
  } catch {
    throw new Error('The record could not be saved. Your browser storage may be full or blocked.');
  }
}

function openPhotoDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Photo storage is unavailable in this browser.'));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(PHOTO_STORE)) {
        request.result.createObjectStore(PHOTO_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Photo storage could not be opened. Allow browser storage and try again.'));
    request.onblocked = () => reject(new Error('Photo storage is busy in another tab. Close other MessWise tabs and try again.'));
  });
}

async function photoTransaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openPhotoDatabase();
  return new Promise((resolve, reject) => {
    let transaction: IDBTransaction;
    let request: IDBRequest<T>;
    try {
      transaction = database.transaction(PHOTO_STORE, mode);
      request = operation(transaction.objectStore(PHOTO_STORE));
    } catch {
      database.close();
      reject(new Error('The photo could not be stored or read. Check your available browser storage.'));
      return;
    }
    transaction.oncomplete = () => {
      database.close();
      resolve(request.result);
    };
    transaction.onerror = () => {
      database.close();
      reject(new Error('The photo operation failed. Your browser storage may be full or blocked.'));
    };
    transaction.onabort = () => {
      database.close();
      reject(new Error('The photo operation was interrupted. Please try again.'));
    };
  });
}

function revokePhotoUrl(id: string): void {
  const url = objectUrls.get(id);
  if (url) URL.revokeObjectURL(url);
  objectUrls.delete(id);
}

export const localRepository = {
  async list(): Promise<WasteRecord[]> {
    return readRecords().sort((a, b) => b.date.localeCompare(a.date));
  },

  async save(record: WasteRecord): Promise<WasteRecord> {
    const error = validRecord(record);
    if (error) throw new Error(error);
    const records = readRecords();
    if (records.some(existing => existing.date === record.date && existing.id !== record.id)) {
      throw new Error('A record already exists for this date. Edit that day instead of adding it twice.');
    }
    const existingIndex = records.findIndex(existing => existing.id === record.id);
    const saved = structuredClone(record);
    if (existingIndex === -1) records.push(saved);
    else records[existingIndex] = saved;
    writeRecords(records);
    return saved;
  },

  async remove(id: string): Promise<void> {
    const records = readRecords();
    const removed = records.find(record => record.id === id);
    if (!removed) return;
    const remaining = records.filter(record => record.id !== id);
    writeRecords(remaining);
    const retainedPhotoIds = new Set(remaining.flatMap(record => record.photos.map(photo => photo.id)));
    for (const photo of removed.photos) {
      if (retainedPhotoIds.has(photo.id)) continue;
      try {
        await photoTransaction('readwrite', store => store.delete(photo.id));
        revokePhotoUrl(photo.id);
      } catch {
        throw new Error('The daily record was removed, but an attached photo could not be cleaned up. Your browser may still retain that attachment.');
      }
    }
  },

  async putPhoto(file: File, kind: Photo['kind']): Promise<Photo> {
    if (!(file instanceof Blob) || file.size === 0) throw new Error('Choose a non-empty photo.');
    if (file.size > MAX_PHOTO_BYTES) throw new Error('Each photo must be 5 MB or smaller.');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      throw new Error('Choose a JPEG, PNG or WebP image. Convert HEIC photos to JPEG first.');
    }
    if (kind !== 'board' && kind !== 'plate') throw new Error('Choose a board or plate photo type.');
    const photo: Photo = {
      id: crypto.randomUUID(),
      name: file.name.slice(0, 180) || 'photo',
      kind,
      mimeType: file.type,
    };
    await photoTransaction('readwrite', store => store.put(file, photo.id));
    return photo;
  },

  async getPhotoUrl(photo: Photo): Promise<string | null> {
    const blob = await photoTransaction<Blob | undefined>('readonly', store => store.get(photo.id));
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    return url;
  },

  async clear(): Promise<void> {
    await photoTransaction('readwrite', store => store.clear());
    try {
      browserStorage().removeItem(RECORDS_KEY);
    } catch {
      throw new Error('Photos were cleared, but daily records could not be removed. Your browser blocked local storage.');
    }
    for (const id of objectUrls.keys()) revokePhotoUrl(id);
  },
};
