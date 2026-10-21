// The solo-play server. It wraps a Game with the title screen and saving, and speaks the
// same protocol the online server will. The client runs it in a Web Worker.
// Saves: one autosave slot (map changes, after battles, Pokémon Centers, every 2 minutes and
// when the tab is hidden) plus three manual slots (systems.md §8).
import type { Content } from './content';
import { Game, SaveError, type SaveData } from './game';
import type { Intent, SaveSlot, ServerEvent, SlotInfo } from './protocol';

export interface SaveStore {
  load(slot: SaveSlot): Promise<SaveData | null>;
  save(slot: SaveSlot, data: SaveData): Promise<void>;
}

const SLOTS: SaveSlot[] = ['auto', 1, 2, 3];

export interface LocalServerOptions { seed?: () => number; debug?: boolean }

export class LocalServer {
  private game: Game | null = null;
  private seed: () => number;
  private debug: boolean;

  constructor(private content: Content, private store: SaveStore, opts: LocalServerOptions | (() => number) = {}) {
    const o = typeof opts === 'function' ? { seed: opts } : opts;
    this.seed = o.seed ?? (() => (Math.random() * 2 ** 32) >>> 0);
    this.debug = !!o.debug;
  }

  async handle(intent: Intent): Promise<ServerEvent[]> {
    switch (intent.t) {
      case 'title': {
        const slots = await this.slots();
        const latest = slots.find(s => s.summary);
        return [{ t: 'title', hasSave: !!latest, ...(latest ? { summary: latest.summary! } : {}), slots }];
      }
      case 'slots': return [{ t: 'slots', slots: await this.slots() }];
      case 'newGame': {
        const { game, events } = Game.newGame(this.content, this.seed());
        game.debug = this.debug;
        this.game = game;
        return events;
      }
      case 'continue': {
        const slot = intent.slot ?? (await this.slots()).find(s => s.summary)?.slot ?? 'auto';
        const save = await this.safeLoad(slot);
        if (!save) return [{ t: 'error', message: 'No saved game found.' }];
        try { this.game = Game.load(this.content, save); }
        catch (e) { return [{ t: 'error', message: e instanceof SaveError ? e.message : 'The save could not be loaded.' }]; }
        this.game.debug = this.debug;
        return this.game.resumeEvents();
      }
      case 'save': {
        const g = this.game;
        if (!g || !g.state.party.length) return [{ t: 'say', text: 'There is nothing to save yet.' }];
        if (g.busy) return [{ t: 'say', text: 'You can\'t save right now.' }];
        const slot = intent.slot ?? 'auto';
        const ok = await this.write(slot, g.toSave());
        return [{ t: 'sfx', name: ok ? 'select' : 'cursor' }, { t: 'say', text: ok ? `Saved to ${slot === 'auto' ? 'the autosave' : `slot ${slot}`}.` : 'Saving failed: this browser is blocking storage.' }];
      }
      case 'autosave': {
        const g = this.game;
        if (g && !g.busy && g.state.party.length) await this.write('auto', g.toSave());
        return [];
      }
      default: {
        if (!this.game) return [{ t: 'error', message: 'No game running.' }];
        const events = this.game.handle(intent);
        if (events.some(e => e.t === 'checkpoint') && this.game.state.party.length) await this.write('auto', this.game.toSave());
        return events;
      }
    }
  }

  private async write(slot: SaveSlot, data: SaveData) {
    try { await this.store.save(slot, data); return true; } catch { return false; } // storage unavailable: keep playing
  }

  private async slots(): Promise<SlotInfo[]> {
    const out: SlotInfo[] = [];
    for (const slot of SLOTS) {
      const save = await this.safeLoad(slot);
      let summary: string | null = null;
      if (save) { try { summary = Game.load(this.content, save).summary(); } catch { summary = null; } }
      out.push({ slot, summary });
    }
    return out;
  }

  private async safeLoad(slot: SaveSlot): Promise<SaveData | null> {
    try { return await this.store.load(slot); } catch { return null; }
  }
}
