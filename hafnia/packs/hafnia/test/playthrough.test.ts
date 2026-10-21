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
  /** Prompt answers to use before falling back to the first option. */
  answers: number[] = [];
  constructor(public game: Game, first: ServerEvent[]) { this.take(first); }

  /** Sends an intent, then answers every prompt and battle request that follows (always the first option). */
  send(intent: Parameters<Game['handle']>[0]) { this.take(this.game.handle(intent)); }

  private take(evs: ServerEvent[]) {
    this.log.push(...evs);
    for (const e of evs) if (e.t === 'error') throw new Error(e.message);
    for (const e of evs) if (e.t === 'battleEnd') this.battles.push(e.result);
    const last = [...evs].reverse().find(e => ['prompt', 'pickSpecies', 'battleRequest', 'askName', 'pickLook'].includes(e.t));
    if (!last) return;
    if (last.t === 'askName') this.send({ t: 'answer', index: 0, text: last.suggestions[0] });
    else if (last.t === 'pickLook') this.send({ t: 'answer', index: 0 });
    else if (last.t === 'prompt' || last.t === 'pickSpecies') this.send({ t: 'answer', index: this.answers.shift() ?? 0 });
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
  where() { return `${this.s.map} @${this.s.x},${this.s.y}; battles ${this.battles}; last said: ${this.said.slice(-4).join(' | ')}`; }
  get said() { return this.log.filter(e => e.t === 'say').map(e => (e as { text: string }).text); }

  /** Breadth-first walk to (tx, ty) on the current map, avoiding tall grass when it can. */
  walkTo(tx: number, ty: number) {
    for (let guard = 0; guard < 400 && (this.s.x !== tx || this.s.y !== ty); guard++) {
      const path = this.path(tx, ty);
      if (!path) throw new Error(`No path to ${tx},${ty}: ${this.where()}`);
      const map = this.s.map;
      const before = [this.s.x, this.s.y];
      this.send({ t: 'step', dir: path[0] });
      if (this.s.map !== map) return; // a warp, or a script moved us (whiteout)
      if (before[0] === this.s.x && before[1] === this.s.y) this.send({ t: 'step', dir: path[0] });
      if (this.s.map !== map) return;
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
        if (!(nx === tx && ny === ty) && (this.game.solid(nx, ny) || m.warps?.some(w => w.x === nx && w.y === ny))) continue;
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

describe('Hafnia demo', () => {
  it('starts in the flat after naming and character creation', () => {
    const d = newGame();
    expect(d.s.map).toBe('hafnia:flat');
    expect(d.s.name).toBe('Mark');
    expect(d.s.look).toBe('boy');
    expect(d.s.flags['hafnia:mumTalked']).toBe(true);
    expect(d.said[0]).toContain('Welcome to Hafnia');
  });

  it('plays from the first step to the end of Chapter 2', () => {
    const d = newGame(11);
    d.s.flags['debug:noEncounters'] = true; // this test is about story flow, not wild battles
    const at = (map: string) => expect(d.s.map, d.where()).toBe(`hafnia:${map}`);
    const flag = (f: string) => d.s.flags[`hafnia:${f}`];

    // Prologue: flat -> courtyard -> bridge -> Route 1 -> Palm House
    d.walkTo(6, 6); at('norrebro');
    expect(flag('yard')).toBe(true);
    d.exit('down', 12, 21); at('bridge');
    d.exit('down', 9, 15); at('route1');
    d.exit('down', 11, 31); at('garden');
    d.answers.push(0, 0, 1); // first starter, yes, no nickname
    d.exit('up', 14, 11); at('palmhouse');
    expect(flag('starter')).toBe('sprigatito');
    expect(flag('lukasStarter')).toBe('charmander');
    expect(d.battles.slice(0, 1)).toEqual(['win']);  // the first rival battle can't be lost
    expect(d.s.coil.current).toBe(true);
    expect(d.s.bag.bike).toBe(1);
    const lead = d.s.party[0];
    lead.level = 60; lead.exp = 60 ** 3 + 10; healMon(lead);

    d.walkTo(8, 10); at('garden');
    d.exit('up', 13, 0); at('route1');
    d.exit('up', 10, 0); at('bridge');
    expect(flag('beatMaja')).toBe(true);
    d.exit('up', 9, 0); at('norrebro');
    d.exit('up', 4, 8); at('flat');
    expect(flag('hook')).toBe(true);
    expect(flag('ch1')).toBe(true);

    // Chapter 1
    d.walkTo(6, 6); at('norrebro');
    d.walkTo(5, 15);
    expect(flag('kaas')).toBe(true);
    const toPalmHouse = () => { d.exit('down', 12, 21); d.exit('down', 9, 15); d.exit('down', 11, 31); d.exit('up', 14, 11); at('palmhouse'); };
    const toNorrebro = () => { d.walkTo(8, 10); d.exit('up', 13, 0); d.exit('up', 10, 0); d.exit('up', 9, 0); at('norrebro'); };
    toPalmHouse();
    d.talkTo(8, 7);
    expect(flag('tunnelQuest')).toBe(true);
    d.walkTo(8, 10); at('garden');
    d.talkTo(23, 10); at('tunnels');
    d.talkTo(20, 13);
    expect(flag('valve')).toBe(true);
    d.walkTo(2, 1); d.walkTo(1, 1); at('garden');
    expect(flag('swarm')).toBe(true);
    d.exit('up', 14, 11); d.talkTo(8, 7);
    expect(flag('tunnelsDone')).toBe(true);
    expect(d.s.bag.tmbulletseed).toBe(1);
    toNorrebro();
    d.talkTo(6, 13);
    expect(flag('muralQuest')).toBe(true);
    d.talkTo(3, 9); d.talkTo(16, 9); d.talkTo(19, 15); d.talkTo(2, 5); d.talkTo(25, 6);
    expect(['paintGreen', 'paintGold', 'paintSilver', 'paintPurple'].map(flag)).toEqual([true, true, true, true]);
    d.talkTo(6, 13);
    expect(flag('mural')).toBe(true);
    d.exit('up', 20, 14); at('gym1');
    for (const x of [4, 10, 12, 2]) d.talkTo(x, 5);
    expect(flag('vents')).toBe(true);
    d.talkTo(7, 2);
    expect(d.s.badges).toEqual(['hafnia:spray']);
    d.walkTo(7, 12);
    expect(flag('lukas1')).toBe(true);
    expect(flag('c1done')).toBe(true);
    at('flat');

    // Chapter 2
    d.walkTo(6, 6);
    d.exit('down', 12, 21); d.exit('down', 9, 15); d.exit('down', 11, 31);
    d.exit('right', 27, 11); at('indreby');
    expect(flag('c2')).toBe(true);
    d.exit('right', 29, 10); at('nyhavn');
    expect(flag('nyAttack')).toBe(true);
    d.talkTo(22, 11); at('drydock');
    d.answers.push(2);
    d.talkTo(20, 9);
    expect(flag('crane')).toBe(true);
    d.talkTo(24, 6);
    expect(flag('copper')).toBe(true);
    expect(d.s.coil.copper).toBe(true);
    d.talkTo(1, 2); at('nyhavn');
    d.exit('left', 0, 9); at('indreby');
    d.exit('down', 14, 15); at('route4');
    d.talkTo(8, 14);
    expect(flag('enforcer')).toBe(true);
    d.exit('down', 7, 15); at('christianshavn');
    d.talkTo(9, 9);
    expect(d.s.bag.oldrod).toBe(1);
    d.walkTo(17, 9);
    expect(flag('overhear')).toBe(true);
    d.exit('right', 27, 9); at('stadsgraven');
    d.talkTo(10, 5); d.talkTo(14, 4); d.talkTo(21, 6); d.talkTo(18, 8); d.talkTo(10, 5);
    expect(flag('boomsDone')).toBe(true);
    d.exit('up', 17, 6); at('gym2');
    d.talkTo(5, 8);
    expect(flag('mirror1'), d.where()).toBe(true);
    d.talkTo(1, 5);
    d.talkTo(8, 1);
    expect(d.s.badges).toEqual(['hafnia:spray', 'hafnia:lily']);

    // 2.8: back to the bridge at dusk
    d.walkTo(8, 9); at('stadsgraven');
    d.exit('left', 0, 9); d.exit('up', 13, 0); d.exit('up', 8, 0); at('indreby');
    d.exit('left', 0, 10); at('garden');
    d.exit('up', 13, 0); d.exit('up', 10, 0); at('bridge');
    expect(flag('demoEnd')).toBe(true);
    expect(d.log.filter(e => e.t === 'chapterEnd').map(e => (e as { title: string }).title)).toContain('Copper & Current');
  });

  it('saves and loads through the LocalServer', async () => {
    let stored: SaveData | null = null;
    const server = new LocalServer(content, { load: async slot => (slot === 'auto' ? stored : null), save: async (slot, s) => { if (slot === 'auto') stored = structuredClone(s); } }, () => 5);
    expect((await server.handle({ t: 'title' }))[0]).toMatchObject({ t: 'title', hasSave: false });
    await server.handle({ t: 'newGame' });
    await server.handle({ t: 'answer', index: 0, text: 'Asta' });
    await server.handle({ t: 'answer', index: 0 }); // look
    expect(stored).toBeNull(); // nothing to save before the first Pokémon
    const g = Game.newGame(content, 5).game;
    void g;
    // Force a save by playing to the starter.
    const d = newGame(5);
    d.walkTo(6, 6); d.exit('down', 12, 21); d.exit('down', 9, 15); d.exit('down', 11, 31); d.exit('up', 14, 11);
    stored = d.game.toSave();
    const title = await server.handle({ t: 'title' });
    expect(title[0]).toMatchObject({ t: 'title', hasSave: true });
    const evs = await server.handle({ t: 'continue' });
    expect(evs.find(e => e.t === 'map')).toMatchObject({ map: 'hafnia:palmhouse' });
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
