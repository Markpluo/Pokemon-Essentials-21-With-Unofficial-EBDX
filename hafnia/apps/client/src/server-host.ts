// Builds the solo server: every installed content pack plus browser storage.
// Imported only by the worker (or the in-page fallback), so the simulator never loads with the page itself.
import { Content, LocalServer } from '@hafnia/core';
import { hafnia } from '@hafnia/pack-hafnia';
import { browserSaveStore } from './store';

export const PACKS = [hafnia];

export function createLocalServer() {
  return new LocalServer(new Content(PACKS), browserSaveStore());
}
