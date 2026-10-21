// Solo saves live in IndexedDB, with localStorage as a fallback. Every call can fail
// (private windows, blocked storage); the game keeps running without saving then.
import type { SaveData, SaveSlot, SaveStore } from '@hafnia/core';

const DB = 'copper-current', STORE = 'saves';

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

const key = (slot: SaveSlot) => (slot === 'auto' ? 'auto' : `slot${slot}`); // "auto" is also where phase 1 saved
const lsKey = (slot: SaveSlot) => `${DB}:${key(slot)}`;

export function browserSaveStore(): SaveStore {
  return {
    async load(slot) {
      try { return (await tx<SaveData | undefined>('readonly', s => s.get(key(slot)))) ?? null; }
      catch { try { return JSON.parse(localStorage.getItem(lsKey(slot)) || 'null'); } catch { return null; } }
    },
    async save(slot, data) {
      try { await tx('readwrite', s => s.put(data, key(slot))); }
      catch { localStorage.setItem(lsKey(slot), JSON.stringify(data)); }
    }
  };
}
