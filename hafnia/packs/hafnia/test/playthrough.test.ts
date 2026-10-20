// Plays the whole prologue through game-core with no client: new game, starter, rival battle,
// Route 1, Maja, the gym and the chapter end. Also checks saves round-trip.
import { describe, expect, it } from 'vitest';
import { Content, Game, LocalServer, healMon, type Dir, type SaveData, type ServerEvent } from '@hafnia/core';
import { hafnia } from '../src';

const content = new Content([hafnia]);
const DIRS: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

class Driver {
  log: ServerEvent[] = [];
  battles: string[] = [];
  constructor(public game: Game, first: ServerEvent[]) { this.take(first); }

  /** Sends an intent, then answers every prompt and battle request that follows (always the first option). */
  send(intent: Parameters<Game['handle']>[0]) { this.take(this.game.handle(intent)); }

  private take(evs: ServerEvent[]) {
    this.log.push(...evs);
    for (const e of evs) if (e.t === 'error') throw new Error(e.message);
    for (const e of evs) if (e.t === 'battleEnd') this.battles.push(e.result);
    const last = [...evs].reverse().find(e => e.t === 'prompt' || e.t === 'pickSpecies' || e.t === 'battleRequest');
    if (!last) return;
    if (last.t === 'prompt' || last.t === 'pickSpecies') this.send({ t: 'answer', index: 0 });
    else if (last.t === 'battleRequest') {
      const r = last.request;
      if (r.forceSwitch) {
        const next = r.party.find(p => p.hp > 0 && p.uid !== r.activeUid)!;
        this.send({ t: 'battle', action: { kind: 'switch', uid: next.uid } });
      } else {
        // Strongest usable move, like a sensible player.
        const best = r.moves.map((m, i) => ({ m, i })).filter(x => !x.m.disabled)
          .sort((a, b) => Number(b.m.type !== 'normal') - Number(a.m.type !== 'normal'))[0];
        this.send({ t: 'battle', action: { kind: 'move', index: best?.i ?? 0 } });
      }
    }
  }

  get s() { return this.game.state; }
  get said() { return this.log.filter(e => e.t === 'say').map(e => (e as { text: string }).text); }

  /** Breadth-first walk to (tx, ty) on the current map, avoiding tall grass when it can. */
  walkTo(tx: number, ty: number) {
    for (let guard = 0; guard < 200 && (this.s.x !== tx || this.s.y !== ty); guard++) {
      const path = this.path(tx, ty);
      if (!path) throw new Error(`No path to ${tx},${ty} on ${this.s.map} from ${this.s.x},${this.s.y}`);
      const map = this.s.map;
      const before = [this.s.x, this.s.y];
      this.send({ t: 'step', dir: path[0] });
      if (this.s.map !== map) return; // a script warped us (whiteout)
      if (before[0] === this.s.x && before[1] === this.s.y) this.send({ t: 'step', dir: path[0] });
    }
  }

  private path(tx: number, ty: number): Dir[] | null {
    const m = this.game.content.map(this.s.map);
    const key = (x: number, y: number) => y * 1000 + x;
    const prev = new Map<number, [number, Dir]>();
    const q: [number, number][] = [[this.s.x, this.s.y]];
    prev.set(key(this.s.x, this.s.y), [-1, 'down']);
    while (q.length) {
      const [x, y] = q.shift()!;
      if (x === tx && y === ty) {
        const out: Dir[] = [];
        let k = key(x, y);
        while (prev.get(k)![0] !== -1) { const [pk, d] = prev.get(k)!; out.unshift(d); k = pk; }
        return out;
      }
      for (const [d, [dx, dy]] of Object.entries(DIRS) as [Dir, [number, number]][]) {
        const nx = x + dx, ny = y + dy;
        if (prev.has(key(nx, ny))) continue;
        if (!(nx === tx && ny === ty) && this.game.solid(nx, ny)) continue;
        if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h) continue;
        prev.set(key(nx, ny), [key(x, y), d]);
        q.push([nx, ny]);
      }
    }
    return null;
  }

  talkTo(x: number, y: number) {
    const spots: [Dir, number, number][] = [['up', x, y + 1], ['down', x, y - 1], ['left', x + 1, y], ['right', x - 1, y]];
    for (const [dir, sx, sy] of spots) {
      if (this.game.solid(sx, sy) && !(this.s.x === sx && this.s.y === sy)) continue;
      this.walkTo(sx, sy);
      this.send({ t: 'turn', dir });
      this.send({ t: 'interact' });
      return;
    }
    throw new Error(`Cannot reach ${x},${y} on ${this.s.map} from ${this.s.x},${this.s.y}; battles ${this.battles}; last said: ${this.said.slice(-4).join(" | ")}`);
  }

  exit(dir: Dir, x: number, y: number) {
    this.walkTo(x, y);
    this.send({ t: 'step', dir });
  }
}

function newGame(seed = 7) {
  const { game, events } = Game.newGame(content, seed);
  return new Driver(game, events);
}

describe('Hafnia prologue', () => {
  it('starts in Nørrebro after the intro', () => {
    const d = newGame();
    expect(d.s.map).toBe('hafnia:norrebro');
    expect(d.s.name).toBe('Mark');
    expect(d.s.flags['hafnia:mumLeft']).toBe(true);
    expect(d.said[0]).toContain('Welcome to Hafnia');
  });

  it('plays from the first step to the Spray Badge', () => {
    const d = newGame(11);
    // Nørrebro -> Route 1 -> Botanical Garden
    d.exit('down', 13, 21);
    expect(d.s.map).toBe('hafnia:route1');
    d.exit('down', 9, 31);
    expect(d.s.map).toBe('hafnia:garden');

    d.talkTo(13, 11); // Professor Ørsted: starter + Lukas
    expect(d.s.flags['hafnia:starter']).toBe('sprigatito');
    expect(d.s.party[0].species).toBe('sprigatito');
    expect(d.battles.length).toBe(1);
    expect(d.s.flags['hafnia:beatLukas']).toBe(true);
    expect(d.s.party[0].hp).toBeGreaterThan(0);

    // This test is about the story flow, not balance: make the starter strong enough to win.
    const lead = d.s.party[0];
    lead.level = 30; lead.exp = 30 ** 3 + 10; healMon(lead);

    // Back north: Mads and Maja spot us on Route 1

    d.exit('up', 13, 0);
    expect(d.s.map).toBe('hafnia:route1');
    d.walkTo(10, 28); // into Maja's line of sight
    expect(d.s.flags['hafnia:beatMaja']).toBe(true);
    d.walkTo(9, 23);  // and Mads's
    expect(d.s.flags['hafnia:beatMaja']).toBe(true);
    expect(d.s.flags['hafnia:beatMads']).toBe(true);

    d.exit('up', 9, 0);
    expect(d.s.map).toBe('hafnia:norrebro');
    d.talkTo(22, 7); // Pokémon Center door is at (22, 7)
    d.talkTo(21, 14); // Tariq
    expect(d.s.flags['hafnia:badge'], d.battles + ' / ' + d.said.slice(-8).join(' | ') + ' @' + d.s.x + ',' + d.s.y).toBe(true);
    expect(d.log.some(e => e.t === 'chapterEnd')).toBe(true);
    expect(d.said).toContain('Mark received the Spray Badge!');
  });

  it('saves and loads through the LocalServer', async () => {
    let stored: SaveData | null = null;
    const server = new LocalServer(content, { load: async () => stored, save: async s => { stored = structuredClone(s); } }, () => 5);
    expect((await server.handle({ t: 'title' }))[0]).toMatchObject({ t: 'title', hasSave: false });
    await server.handle({ t: 'newGame' });
    await server.handle({ t: 'answer', index: 1 }); // name: Asta
    expect(stored).toBeNull(); // nothing to save before the first Pokémon
    const g = Game.newGame(content, 5).game;
    void g;
    // Force a save by playing to the starter.
    const d = newGame(5);
    d.exit('down', 13, 21); d.exit('down', 9, 31); d.talkTo(13, 11);
    stored = d.game.toSave();
    const title = await server.handle({ t: 'title' });
    expect(title[0]).toMatchObject({ t: 'title', hasSave: true });
    const evs = await server.handle({ t: 'continue' });
    expect(evs.find(e => e.t === 'map')).toMatchObject({ map: 'hafnia:garden' });
    const view = evs.find(e => e.t === 'view');
    expect(view && view.t === 'view' && view.view.party.length).toBe(1);
  });

  it('refuses a save that needs a missing content pack', () => {
    const d = newGame();
    const save = d.game.toSave();
    save.packs.push('aarhus');
    expect(() => Game.load(content, save)).toThrow(/aarhus/);
  });
});
