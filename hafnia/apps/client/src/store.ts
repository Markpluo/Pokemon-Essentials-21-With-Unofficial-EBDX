// Solo saves live in IndexedDB, with localStorage as a fallback. Every call can fail
// (private windows, blocked storage); the game keeps running without saving then.
import type { SaveData, SaveStore } from '@hafnia/core';

const DB = 'copper-current', STORE = 'saves', SLOT = 'auto';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(db => new Promise<T>((resolve, reject) => {
    const r = run(db.transaction(STORE, mode).objectStore(STORE));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  }));
}

const lsKey = `${DB}:${SLOT}`;

export function browserSaveStore(): SaveStore {
  return {
    async load() {
      try { return (await tx<SaveData | undefined>('readonly', s => s.get(SLOT))) ?? null; }
      catch { try { return JSON.parse(localStorage.getItem(lsKey) || 'null'); } catch { return null; } }
    },
    async save(data) {
      try { await tx('readwrite', s => s.put(data, SLOT)); }
      catch { try { localStorage.setItem(lsKey, JSON.stringify(data)); } catch { /* no storage */ } }
    }
  };
}
