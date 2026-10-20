// The solo-play server. It wraps a Game with the title screen and saving, and speaks the
// same protocol the online server will. The client runs it in a Web Worker.
import type { Content } from './content';
import { Game, SaveError, type SaveData } from './game';
import type { Intent, ServerEvent } from './protocol';

export interface SaveStore {
  load(): Promise<SaveData | null>;
  save(data: SaveData): Promise<void>;
}

export class LocalServer {
  private game: Game | null = null;

  constructor(private content: Content, private store: SaveStore, private seed = () => (Math.random() * 2 ** 32) >>> 0) {}

  async handle(intent: Intent): Promise<ServerEvent[]> {
    switch (intent.t) {
      case 'title': {
        const save = await this.safeLoad();
        if (!save) return [{ t: 'title', hasSave: false }];
        try { return [{ t: 'title', hasSave: true, summary: Game.load(this.content, save).summary() }]; }
        catch (e) { return [{ t: 'title', hasSave: false }, { t: 'error', message: (e as Error).message }]; }
      }
      case 'newGame': {
        const { game, events } = Game.newGame(this.content, this.seed());
        this.game = game;
        return events;
      }
      case 'continue': {
        const save = await this.safeLoad();
        if (!save) return [{ t: 'error', message: 'No saved game found.' }];
        try { this.game = Game.load(this.content, save); }
        catch (e) { return [{ t: 'error', message: e instanceof SaveError ? e.message : 'The save could not be loaded.' }]; }
        return this.game.resumeEvents();
      }
      default: {
        if (!this.game) return [{ t: 'error', message: 'No game running.' }];
        const events = this.game.handle(intent);
        if (events.some(e => e.t === 'checkpoint') && this.game.state.party.length) {
          try { await this.store.save(this.game.toSave()); } catch { /* storage unavailable: keep playing */ }
        }
        return events;
      }
    }
  }

  private async safeLoad(): Promise<SaveData | null> {
    try { return await this.store.load(); } catch { return null; }
  }
}
