// Solo mode: the game server runs here, off the main thread, and speaks the same
// protocol as the future online server.
import type { Intent } from '@hafnia/core';
import { createLocalServer } from './server-host';

const server = createLocalServer();
let queue = Promise.resolve();

self.onmessage = (e: MessageEvent<{ id: number; intent: Intent }>) => {
  const { id, intent } = e.data;
  // Handle intents strictly in order.
  queue = queue.then(async () => {
    try { postMessage({ id, events: await server.handle(intent) }); }
    catch (err) { postMessage({ id, events: [{ t: 'error', message: String(err) }] }); }
  });
};
