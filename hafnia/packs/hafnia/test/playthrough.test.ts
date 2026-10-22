// Plays the whole prologue through game-core with no client: new game, starter, rival battle,
// Route 1, Maja, the gym and the chapter end. Also checks saves round-trip.
import { describe, expect, it } from 'vitest';
import { Content, Game, LocalServer, OPPOSITE, TRICK_TILES, healMon, type Dir, type SaveData, type ServerEvent } from '@hafnia/core';
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
      const dir = TRICK_TILES.has(this.game.content.map(map).grid[this.s.y][this.s.x]) ? OPPOSITE[path[0]] : path[0]; // Trick Room floor
      this.send({ t: 'step', dir });
      if (this.s.map !== map) return; // a warp, or a script moved us (whiteout)
      if (before[0] === this.s.x && before[1] === this.s.y) this.send({ t: 'step', dir });
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

  /** Walks off the map edge on the `dir` side, at the first open tile it can reach. */
  leave(dir: Dir) {
    const m = this.game.content.map(this.s.map);
    const edge: [number, number][] = dir === 'up' || dir === 'down'
      ? Array.from({ length: m.w }, (_, x): [number, number] => [x, dir === 'up' ? 0 : m.h - 1])
      : Array.from({ length: m.h }, (_, y): [number, number] => [dir === 'left' ? 0 : m.w - 1, y]);
    const spot = edge.find(([x, y]) => !this.game.solid(x, y) && this.path(x, y));
    if (!spot) throw new Error(`No way off ${this.s.map} going ${dir}: ${this.where()}`);
    this.exit(dir, spot[0], spot[1]);
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

  it('sends the NPCs with each map, so people in a scene that starts on arrival are drawn', () => {
    const d = newGame();
    const map = d.log.find(e => e.t === 'map' && e.map === 'hafnia:flat') as Extract<ServerEvent, { t: 'map' }>;
    expect(map.npcs.map(n => n.id)).toContain('mum');
  });

  it('offers five starters, and Lukas and Maja pick by the table in trainers-and-encounters.md', () => {
    const table: [string, string, string][] = [
      ['sprigatito', 'charmander', 'popplio'], ['charmander', 'popplio', 'sprigatito'], ['popplio', 'sprigatito', 'charmander'],
      ['eevee', 'charmander', 'sprigatito'], ['pikachu', 'sprigatito', 'popplio']
    ];
    table.forEach(([mine, lukas, maja], i) => {
      const d = newGame(20 + i);
      d.s.flags['debug:noEncounters'] = true;
      d.walkTo(6, 6); d.exit('down', 12, 21); d.exit('down', 9, 15); d.exit('down', 11, 31);
      d.answers.push(i, 0, 1);
      d.exit('up', 14, 11);
      const offer = d.log.find(e => e.t === 'pickSpecies') as Extract<ServerEvent, { t: 'pickSpecies' }>;
      expect(offer.species.map(o => o.key ?? o)).toHaveLength(5);
      expect([d.s.flags['hafnia:starter'], d.s.flags['hafnia:lukasStarter'], d.s.flags['hafnia:majaStarter']]).toEqual([mine, lukas, maja]);
      expect(d.s.party[0].species).toBe(mine);
      expect(d.battles[0]).toBe('win'); // the tutorial battle can't be lost
    });
  });

  it('plays from the first step to the end of Chapter 6', () => {
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
    expect(d.log.filter(e => e.t === 'chapterEnd').map(e => (e as { title: string }).title)).toContain('Chapter 2 complete');

    // Chapter 3: Den Grønne Sti to Vesterbro, the Empty-Sea Dinner, Gym 3 and Maja on Cykelslangen
    const slide = (...dirs: Dir[]) => { for (const dir of dirs) d.send({ t: 'step', dir }); };
    d.answers.length = 0;                                      // every prompt from here: the first option
    d.exit('up', 9, 0); at('norrebro');
    d.exit('left', 0, 8); at('route2');
    expect(flag('ch3')).toBe(true);
    d.exit('down', 4, 15); at('vesterbro');
    expect(flag('vbArrive')).toBe(true);
    d.exit('up', 5, 8); at('cafevb');
    d.talkTo(5, 1);
    d.walkTo(5, 5); at('vesterbro');
    d.exit('down', 13, 19); at('kodbyen');
    d.exit('up', 5, 7); at('kitchen');
    d.talkTo(6, 1);
    expect(flag('dinnerQuest')).toBe(true);
    d.walkTo(6, 6); at('kodbyen');
    d.exit('up', 21, 8); at('kodbyen');                     // the gym is shut until dinner
    d.talkTo(7, 11);
    expect(d.s.bag.icesalt).toBe(1);
    d.exit('up', 13, 0); at('vesterbro');
    d.exit('right', 27, 9); at('route3');
    expect(flag('majaRace')).toBeFalsy();                     // not before the badge
    d.exit('right', 25, 4); at('islandsbrygge');
    d.talkTo(7, 3); d.talkTo(19, 17);
    expect([d.s.bag.mussels, d.s.bag.buckthorn]).toEqual([1, 1]);
    d.exit('left', 0, 8); d.exit('left', 0, 4); at('vesterbro');
    d.exit('down', 13, 19); d.exit('up', 5, 7); at('kitchen');
    d.talkTo(6, 1);
    expect(flag('dinnerDone')).toBe(true);
    expect(d.game.period).toBe('night');
    d.walkTo(6, 6); at('kodbyen');
    const before = d.battles.length;
    d.talkTo(18, 11);                                          // Neon Nights: three tag battles with Signe
    expect(d.battles.slice(before), d.where()).toEqual(['win', 'win', 'win']);
    expect(flag('neonDone')).toBe(true);
    d.exit('up', 21, 8); at('gym3');
    // Sea ice: slide to the valves in menu order (forret, hovedret, dessert), then up through the melted gap.
    slide('up', 'right', 'down', 'left', 'up', 'right');
    expect([d.s.x, d.s.y], d.where()).toEqual([13, 7]);
    d.send({ t: 'turn', dir: 'right' }); d.send({ t: 'interact' });
    slide('left', 'up', 'left', 'up', 'left', 'down');
    expect([d.s.x, d.s.y], d.where()).toEqual([1, 7]);
    d.send({ t: 'turn', dir: 'left' }); d.send({ t: 'interact' });
    slide('up', 'right', 'down', 'right', 'up', 'right');
    expect([d.s.x, d.s.y], d.where()).toEqual([13, 4]);
    d.send({ t: 'turn', dir: 'right' }); d.send({ t: 'interact' });
    expect(flag('steam'), d.where()).toBe(true);
    slide('left', 'down', 'left', 'up', 'left', 'up', 'right', 'up');
    expect([d.s.x, d.s.y], d.where()).toEqual([7, 3]);
    d.talkTo(7, 1);
    expect(d.s.badges).toEqual(['hafnia:spray', 'hafnia:lily', 'hafnia:frost']);
    expect([d.s.bag.bikelamp, d.s.bag.hydrofoils, d.s.bag.tmicywind]).toEqual([1, 1, 1]);
    slide('down', 'down', 'left', 'down', 'right', 'down', 'right');
    d.walkTo(7, 11); at('kodbyen');
    d.exit('up', 13, 0); d.exit('right', 27, 9); at('route3');
    expect(flag('ch3done')).toBe(true);
    expect(d.log.filter(e => e.t === 'chapterEnd').map(e => (e as { title: string }).title)).toContain('Chapter 3 complete');

    // Chapter 4: home to Nørrebro, Assistens, the storm drain, the Lantern Walk
    d.exit('left', 0, 4); at('vesterbro');
    d.exit('up', 13, 0); at('route2');
    d.exit('right', 29, 3); at('norrebro');
    expect(flag('ch4')).toBe(true);
    expect(d.game.period).toBe('evening');
    d.exit('up', 15, 0); at('assistens');
    expect(flag('metSoren')).toBe(true);
    d.talkTo(24, 20); at('stormdrain');
    d.walkTo(19, 6);
    slide('left', 'left', 'down', 'left', 'down');             // the frozen sump
    expect([d.s.x, d.s.y], d.where()).toEqual([10, 13]);
    d.talkTo(12, 15);                                          // the frightened Lampent
    expect(flag('litwickBack'), d.where()).toBe(true);
    d.talkTo(15, 15); at('assistens');
    expect(flag('lanternsLit')).toBe(true);
    expect(d.game.period).toBe('night');
    d.s.party[0].moves = [{ id: 'crunch', pp: 15 }, { id: 'shadowball', pp: 15 }];   // a player brings answers to Ghosts
    d.exit('up', 15, 0); at('gym4');
    d.walkTo(7, 13); d.send({ t: 'step', dir: 'up' });         // the middle gap is false: the wind blows you back
    expect([d.s.x, d.s.y], d.where()).toEqual([7, 18]);
    d.walkTo(2, 13); d.walkTo(2, 11);                          // west...
    d.walkTo(12, 9); d.walkTo(12, 7);                          // ...east...
    d.walkTo(7, 5); d.walkTo(7, 3);                            // ...straight on
    d.talkTo(7, 2);
    expect(d.s.badges, d.where()).toEqual(['hafnia:spray', 'hafnia:lily', 'hafnia:frost', 'hafnia:lantern']);
    expect([d.s.bag.tmhex, d.s.bag.firstverse]).toEqual([1, 1]);
    expect(flag('ch4done')).toBe(true);
    expect(d.log.filter(e => e.t === 'chapterEnd').map(e => (e as { title: string }).title)).toContain('Chapter 4 complete');

    // Assistens Ghost Stories: five graves at night, then Søren
    d.exit('down', 7, 19); at('assistens');
    for (const [x, y] of [[6, 7], [10, 17], [21, 7], [4, 17], [12, 5]]) d.talkTo(x, y);
    expect(['gs1', 'gs2', 'gs3', 'gs4', 'gs5'].every(f => flag(f)), d.where()).toBe(true);
    d.talkTo(19, 11);
    expect([d.s.bag.duskstone, d.s.bag.reapercloth, d.s.bag.poembook]).toEqual([1, 1, 1]);

    // Kanelsnegl Morning: six letterboxes before breakfast
    d.exit('down', 15, 23); at('norrebro');
    d.exit('left', 0, 8); d.exit('down', 4, 15); at('vesterbro');
    d.exit('up', 18, 15); at('bakery');
    d.talkTo(5, 1);                                            // yes, and wait until dawn
    expect(d.game.period).toBe('morning');
    expect(d.s.bag.kanelsnegl).toBe(6);
    d.walkTo(5, 5); at('vesterbro');
    d.talkTo(10, 8); d.talkTo(21, 8);
    d.exit('down', 13, 19); at('kodbyen');
    d.talkTo(11, 5); d.talkTo(24, 8);
    d.exit('up', 13, 0); d.exit('up', 13, 0); d.exit('right', 29, 3); at('norrebro');
    d.talkTo(8, 7); d.talkTo(19, 7);
    expect(d.s.bag.kanelsnegl ?? 0).toBe(0);
    d.exit('left', 0, 8); d.exit('down', 4, 15); d.exit('up', 18, 15); at('bakery');
    const eggs = d.s.party.filter(m => m.egg).length + d.s.box.filter(m => m.egg).length;
    d.talkTo(5, 1);
    expect(flag('kanelDone')).toBe(true);
    expect(d.s.party.filter(m => m.egg).length + d.s.box.filter(m => m.egg).length).toBe(eggs + 1);
    expect(d.s.bag.expcandym).toBe(1);

    // Chapter 5: Frederiksberg, the Cisterns, the Sunken Archive and Lukas
    expect(flag('ch5')).toBe(true);
    d.walkTo(5, 5); at('vesterbro');
    d.exit('up', 13, 0); at('route2');
    d.exit('up', 22, 0); at('frederiksberg');
    expect(flag('ch5met')).toBe(true);
    d.exit('up', 21, 15); at('cisterns');
    expect(flag('cisArrive')).toBe(true);
    d.talkTo(6, 5);                                            // the mirror pool, and the Sableye behind the false wall
    expect(flag('cisMirror'), d.where()).toBe(true);
    d.talkTo(13, 1);                                           // first sluice wheel: the gallery causeway
    expect(flag('cisLevel')).toBe(1);
    d.talkTo(28, 1);                                           // second wheel: the causeway south
    expect(flag('cisLevel')).toBe(2);
    d.walkTo(21, 12);
    d.walkTo(13, 16);                                          // Brix's drone swarm, with Maja
    expect(flag('swarmDone'), d.where()).toBe(true);
    d.walkTo(11, 16);                                          // the Sunken Archive
    expect(flag('archiveDone')).toBe(true);
    expect(d.s.bag.ledgercopy).toBe(1);
    d.talkTo(1, 20); at('frederiksberg');
    expect(flag('lukas5'), d.where()).toBe(true);
    expect(flag('ch5done')).toBe(true);
    expect(d.log.filter(e => e.t === 'chapterEnd').map(e => (e as { title: string }).title)).toContain('Chapter 5 complete');

    // The Zoo Night Shift: three escapees after dark
    const eggs5 = d.s.party.filter(m => m.egg).length + d.s.box.filter(m => m.egg).length;
    d.talkTo(11, 16);                                          // yes, and wait until dark
    expect(d.game.period).toBe('night');
    for (const [x, y] of [[24, 20], [5, 4], [19, 12]]) d.talkTo(x, y);
    expect(['zoo1', 'zoo2', 'zoo3'].every(f => flag(f)), d.where()).toBe(true);
    d.talkTo(11, 16);
    expect(flag('zooDone')).toBe(true);
    expect(d.s.party.filter(m => m.egg).length + d.s.box.filter(m => m.egg).length).toBe(eggs5 + 1);
    expect(d.s.bag.ultraball).toBeGreaterThanOrEqual(3);

    // Chapter 6: Rundetårn, the two lenses, the Trick Room ramp, the brass rings and Tycho
    d.leave('down'); at('route2');
    expect(flag('ch6'), d.where()).toBe(true);
    d.leave('right'); at('norrebro');
    d.exit('down', 12, 21); d.exit('down', 9, 15); d.exit('down', 11, 31); at('garden');
    d.leave('right'); at('indreby');
    d.exit('up', 21, 5); at('towerin');
    expect(flag('ch6met')).toBe(true);
    d.walkTo(6, 2); at('rundetarn');
    d.walkTo(0, 11); at('bibliotek');                          // the library hall, past Psychic Ida
    expect(flag('tr.rtPsy1'), d.where()).toBe(true);
    d.talkTo(1, 6);                                            // the Bronzor and the objective lens
    expect(d.s.bag.lensobjective, d.where()).toBe(1);
    d.walkTo(13, 4); at('rundetarn');
    d.walkTo(22, 11); at('trinitatis');                        // across the Trick Room floor to the church loft
    d.talkTo(12, 1);                                           // the Murkrow's nest
    expect(d.s.bag.lenseyepiece, d.where()).toBe(1);
    d.walkTo(0, 4); at('rundetarn');
    d.answers.push(2); d.talkTo(8, 11);                        // west: the Lion
    d.answers.push(0); d.talkTo(12, 8);                        // north: the Great Bear
    expect(flag('ringsDone')).toBeFalsy();
    d.answers.push(1); d.talkTo(14, 11);                       // east: the Swan
    expect(flag('ringsDone'), d.where()).toBe(true);
    d.talkTo(11, 11);                                          // Tycho
    expect(d.s.badges.at(-1), d.where()).toBe('hafnia:orrery');
    expect([d.s.bag.gyro, d.s.bag.tmpsyshock, d.s.bag.lensobjective ?? 0]).toEqual([1, 1, 0]);
    expect(flag('ch6done')).toBe(true);
    expect(d.log.filter(e => e.t === 'chapterEnd').map(e => (e as { title: string }).title)).toContain('Chapter 6 complete');
    d.answers.push(0); d.talkTo(12, 10);                       // the orrery: morning
    expect(d.game.period).toBe('morning');
    d.talkTo(10, 10); at('towerin');                           // the staff stairs
  });

  it('a wrong steam valve closes them all again', () => {
    const d = newGame(3);
    Object.assign(d.s, { map: 'hafnia:gym3', x: 13, y: 7, dir: 'right' as Dir });
    d.send({ t: 'interact' });                                 // forret: right
    expect(d.s.flags['hafnia:vforret']).toBe(true);
    Object.assign(d.s, { x: 13, y: 4, dir: 'right' as Dir });
    d.send({ t: 'interact' });                                 // dessert before hovedret: wrong
    expect(d.s.flags['hafnia:vforret']).toBe(false);
    expect(d.said.at(-1)).toMatch(/Wrong course/);
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
