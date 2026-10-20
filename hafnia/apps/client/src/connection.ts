// How the client reaches a game server. Solo play uses a Web Worker; if workers are
// unavailable the same server runs in the page. An online connection (WebSocket) will
// implement the same GameConnection interface.
import type { GameConnection, Intent, ServerEvent } from '@hafnia/core';

export async function connectSolo(): Promise<GameConnection & { mode: string }> {
  try {
    const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    let next = 1;
    const waiting = new Map<number, (evs: ServerEvent[]) => void>();
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('worker timeout')), 8000);
      worker.onerror = e => { clearTimeout(t); reject(e); };
      worker.onmessage = (e: MessageEvent<{ id: number; events: ServerEvent[] }>) => {
        if (e.data.id === 0) { clearTimeout(t); resolve(); return; }
        waiting.get(e.data.id)?.(e.data.events); waiting.delete(e.data.id);
      };
      worker.postMessage({ id: 0, intent: { t: 'title' } satisfies Intent });
    });
    worker.onerror = null;
    return {
      mode: 'worker',
      send(intent: Intent) {
        const id = next++;
        return new Promise(resolve => { waiting.set(id, resolve); worker.postMessage({ id, intent }); });
      }
    };
  } catch (e) {
    console.warn('Web Worker unavailable, running the game server in the page.', e);
    const { createLocalServer } = await import('./server-host');
    const server = createLocalServer();
    return { mode: 'page', send: intent => server.handle(intent) };
  }
}
