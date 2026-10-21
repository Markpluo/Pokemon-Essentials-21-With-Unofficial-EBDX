// Seeded battles that check Copper & Current (mechanics/copper-and-current-spec.md §4.8) and the
// battle rules game-core adds around Showdown: Exp Share, move learning, catching and trainer AI.
import { describe, expect, it } from 'vitest';
import { BattleSession, type BattleHost } from '../src/battle';
import type { CoilUnlocks } from '../src/coil';
import { DEFAULT_RULES } from '../src/content';
import { makeMon, type Mon } from '../src/pokemon';
import type { BattleAction, BattleEvent, BattleRequest, ServerEvent } from '../src/protocol';
import { Rng } from '../src/rng';
import type { BattleOptions, FoeSpec } from '../src/script';

interface Setup { party: [string, number, string[]][]; foes: FoeSpec[]; opts?: Partial<BattleOptions>; coil?: CoilUnlocks; seed?: number }

function battle(s: Setup) {
  const rng = new Rng(s.seed ?? 1);
  const party: Mon[] = s.party.map(([sp, lv, moves]) => makeMon(sp, lv, rng, { moves }));
  const events: ServerEvent[] = [];
  const host: BattleHost = {
    rng, party, bag: { pokeball: 20, potion: 5 }, playerName: 'Tester', rules: DEFAULT_RULES, badges: 0,
    coil: s.coil ?? { current: true, copper: true },
    emit: e => events.push(e), whiteout: () => 0, addMon: m => { party.push(m); return 'party'; }, giveMoney: () => {}
  };
  const b = new BattleSession(host, { kind: 'trainer', trainer: { name: 'Foe', title: 'Youngster', sprite: '' }, foes: s.foes, ...s.opts });
  b.start();
  const sim = (b as any).sim;
  const lastRequest = (): BattleRequest | undefined => {
    for (let i = events.length - 1; i >= 0; i--) { const e = events[i]; if (e.t === 'battleRequest') return e.request; }
  };
  const act = (a: BattleAction) => b.act(a);
  const battleEvents = () => events.filter(e => e.t === 'battle').map(e => (e as { ev: BattleEvent }).ev);
  const texts = () => battleEvents().filter(e => e.b === 'text').map(e => (e as { text: string }).text);
  return { b, sim, party, events, lastRequest, act, battleEvents, texts, host };
}

describe('Copper & Current: the Coil', () => {
  it('starts at 2 pips in wild battles and 0 in trainer battles', () => {
    const wild = battle({ party: [['pikachu', 20, ['growl']]], foes: [{ species: 'magikarp', level: 5, moves: ['splash'] }], opts: { kind: 'wild', trainer: undefined } });
    expect(wild.lastRequest()!.coil).toMatchObject({ pips: 2, ready: 3, max: 4 });
    const tr = battle({ party: [['pikachu', 20, ['growl']]], foes: [{ species: 'magikarp', level: 5, moves: ['splash'] }] });
    expect(tr.lastRequest()!.coil).toMatchObject({ pips: 0 });
  });

  it('gains a pip each turn, once per turn for a super-effective hit, and on a faint', () => {
    const t = battle({ party: [['magikarp', 30, ['splash']], ['magikarp', 30, ['splash']]], foes: [{ species: 'pikachu', level: 12, moves: ['thundershock'] }] });
    const pips = () => (t.b as any).coil.ally.pips as number;
    t.act({ kind: 'move', index: 0 }); // super-effective hit taken (+1), end of turn (+1)
    expect(pips()).toBe(2);
    t.party[0].hp = 1; t.sim.p1.active[0].hp = 1;
    t.act({ kind: 'move', index: 0 }); // super-effective (+1) and fainted (+1), capped at 4
    expect(pips()).toBe(4);
  });

  it('refuses Copper and Current below 3 pips, when locked, and after one use', () => {
    const t = battle({ party: [['pikachu', 20, ['growl', 'thundershock']]], foes: [{ species: 'magikarp', level: 60, moves: ['splash'] }], coil: { current: true } });
    const req = t.lastRequest()!;
    expect(req.coil!.current).toMatch(/isn't charged/);
    expect(req.coil!.copper).toMatch(/isn't unlocked/);
    t.act({ kind: 'move', index: 1, mode: 'current' });
    expect(t.texts().at(-1)).toMatch(/isn't charged/);
    for (let i = 0; i < 3; i++) t.act({ kind: 'move', index: 0 });
    expect(t.lastRequest()!.coil!.current).toBeNull();
    expect(t.lastRequest()!.coil!.pips).toBe(3);
    t.act({ kind: 'move', index: 0, mode: 'current' });
    expect(t.texts().at(-1)).toMatch(/Status moves can't carry Current/);
    t.act({ kind: 'move', index: 1, mode: 'current' });
    expect(t.battleEvents().some(e => e.b === 'current' && e.side === 'ally')).toBe(true);
    expect(t.lastRequest()!.coil!.current).toMatch(/already been used/);
  });

  it('Current never misses and breaks through Protect for reduced damage', () => {
    for (let seed = 1; seed <= 8; seed++) {
      const t = battle({ seed, party: [['pikachu', 30, ['growl', 'zapcannon']]], foes: [{ species: 'wingull', level: 30, moves: ['protect'] }], opts: { kind: 'wild', trainer: undefined } });
      (t.b as any).coil.ally.pips = 3; // so the foe's first Protect (which can't fail) meets the Current move
      const hp = t.sim.p2.active[0].hp;
      t.act({ kind: 'move', index: 1, mode: 'current' });
      expect(t.texts().some(x => /couldn't fully protect/.test(x)), `seed ${seed}`).toBe(true);
      expect(t.sim.p2.active[0].hp).toBeLessThan(hp);
    }
  });

  it('a Current knockout leaves Live Wire: +1 Speed for the next switch-in only', () => {
    const t = battle({
      party: [['pikachu', 50, ['growl', 'thunderbolt']], ['raichu', 50, ['growl']]],
      foes: [{ species: 'magikarp', level: 5, moves: ['splash'] }, { species: 'magikarp', level: 5, moves: ['splash'] }]
    });
    for (let i = 0; i < 3; i++) t.act({ kind: 'move', index: 0 });
    t.act({ kind: 'move', index: 1, mode: 'current' });
    expect(t.sim.p1.sideConditions.hafnialivewire).toBeTruthy();
    t.act({ kind: 'switch', uid: t.party[1].uid });
    expect(t.sim.p1.active[0].species.id).toBe('raichu');
    expect(t.sim.p1.active[0].boosts.spe).toBe(1);
    expect(t.sim.p1.sideConditions.hafnialivewire).toBeFalsy();
  });

  it('Copper: patina survives switching, blocks crits and foe Defense drops, and seals the held item', () => {
    const t = battle({
      party: [['snorlax', 50, ['growl']], ['snorlax', 50, ['growl']]],
      foes: [{ species: 'lapras', level: 30, moves: ['frostbreath', 'leer'] }], opts: { ai: 1 }
    });
    for (let i = 0; i < 3; i++) t.act({ kind: 'move', index: 0 });
    t.act({ kind: 'move', index: 0, mode: 'copper' });
    const lax = t.sim.p1.active[0];
    expect(lax.volatiles.hafniapatina).toBeTruthy();
    expect(lax.ignoringItem()).toBe(true);
    t.act({ kind: 'switch', uid: t.party[1].uid });
    t.act({ kind: 'switch', uid: t.party[0].uid });
    expect(t.sim.p1.active[0].volatiles.hafniapatina).toBeTruthy();
    const logFrom = t.sim.log.length;
    for (let i = 0; i < 6; i++) t.act({ kind: 'move', index: 0 });
    const log: string[] = t.sim.log.slice(logFrom);
    expect(log.some(l => l.startsWith('|move|p2a') && l.includes('Frost Breath'))).toBe(true);
    expect(log.some(l => l.startsWith('|-crit|p1a'))).toBe(false);
    expect(t.sim.p1.active[0].boosts.def).toBe(0);
  });

  it('Overcharge: the villain\'s Coil starts full, gives Copper and Current at once, and drains 1/8 HP a turn', () => {
    const t = battle({ party: [['snorlax', 50, ['growl']]], foes: [{ species: 'pikachu', level: 30, moves: ['thundershock'] }], opts: { overcharge: true } });
    t.act({ kind: 'move', index: 0 });
    expect(t.battleEvents().some(e => e.b === 'overcharge' && e.side === 'foe')).toBe(true);
    const foe = t.sim.p2.active[0];
    expect(foe.volatiles.hafniapatina).toBeTruthy();
    expect(foe.maxhp - foe.hp).toBe(Math.floor(foe.baseMaxhp / 8));
  });

  it('a plain battle has no Coil', () => {
    const t = battle({ party: [['pikachu', 20, ['growl']]], foes: [{ species: 'magikarp', level: 5, moves: ['splash'] }], opts: { coil: false } });
    expect(t.lastRequest()!.coil).toBeUndefined();
    t.act({ kind: 'move', index: 0, mode: 'current' });
    expect(t.texts().at(-1)).toMatch(/offline/);
  });

  it('replays the same log from the same seed and choices', () => {
    const run = () => {
      const t = battle({ seed: 42, party: [['pikachu', 30, ['thundershock', 'quickattack']]], foes: [{ species: 'pidgey', level: 28 }] });
      for (let i = 0; i < 4 && !t.b.result; i++) t.act({ kind: 'move', index: i % 2, ...(i === 3 ? { mode: 'current' as const } : {}) });
      return t.sim.log.join('\n');
    };
    expect(run()).toBe(run());
  });
});

describe('battle rules', () => {
  it('Exp Share: the whole healthy team gains EXP from a knockout', () => {
    const t = battle({ party: [['pikachu', 30, ['thunderbolt']], ['eevee', 10, ['tackle']]], foes: [{ species: 'magikarp', level: 20, moves: ['splash'] }] });
    const [a, b] = t.party.map(m => m.exp);
    t.act({ kind: 'move', index: 0 });
    expect(t.party[0].exp).toBeGreaterThan(a);
    expect(t.party[1].exp).toBeGreaterThan(b);
    expect(t.texts().some(x => /Exp. Share/.test(x))).toBe(true);
  });

  it('asks which move to forget when a full moveset learns a new one', () => {
    // Sprigatito learns Hone Claws at Lv. 10; one knockout of a Lv. 30 Magikarp is plenty of EXP.
    const t = battle({ party: [['sprigatito', 9, ['scratch', 'tailwhip', 'leafage', 'growl']]], foes: [{ species: 'magikarp', level: 30, moves: ['splash'] }] });
    t.sim.p2.active[0].hp = 1;
    t.act({ kind: 'move', index: 0 });
    expect(t.b.waitingForAnswer).toBe(true);
    const prompt = t.events.filter(e => e.t === 'prompt').at(-1) as Extract<ServerEvent, { t: 'prompt' }>;
    expect(prompt.options).toHaveLength(5);
    const learning = prompt.text.match(/room for (.+)\?/)![1];
    t.b.answer(1);
    expect(t.party[0].moves[1].id).not.toBe('tailwhip');
    expect(t.texts().some(x => x.includes(`learned ${learning}`))).toBe(true);
  });

  it('catching a Pokémon gives EXP and adds it to the team', () => {
    const t = battle({ party: [['pikachu', 20, ['growl']]], foes: [{ species: 'caterpie', level: 3, moves: ['stringshot'] }], opts: { kind: 'wild', trainer: undefined } });
    const exp = t.party[0].exp;
    for (let i = 0; i < 10 && !t.b.result; i++) t.act({ kind: 'ball', item: 'pokeball' });
    expect(t.b.result).toBe('caught');
    expect(t.party).toHaveLength(2);
    expect(t.party[0].exp).toBeGreaterThan(exp);
  });

  it('tier 1 trainers skip moves the target is immune to', () => {
    const t = battle({ party: [['gastly', 30, ['spite']]], foes: [{ species: 'rattata', level: 10, moves: ['tackle', 'bite'] }], opts: { ai: 1 } });
    for (let i = 0; i < 6 && !t.b.result; i++) t.act({ kind: 'move', index: 0 });
    const foeMoves = (t.sim.log as string[]).filter(l => l.startsWith('|move|p2a'));
    expect(foeMoves.length).toBeGreaterThan(3);
    expect(foeMoves.every(l => l.includes('Bite'))).toBe(true);
  });

  it('tier 2 trainers go for the knockout', () => {
    const t = battle({ party: [['sprigatito', 12, ['growl']]], foes: [{ species: 'charmander', level: 20, moves: ['growl', 'ember', 'scratch'] }], opts: { ai: 2 } });
    t.act({ kind: 'move', index: 0 });
    const first = (t.sim.log as string[]).find(l => l.startsWith('|move|p2a'))!;
    expect(first).toContain('Ember');
  });
});

describe('animation events', () => {
  it('tells the client which move was used, at whom, and what it did', () => {
    const t = battle({ party: [['pikachu', 30, ['thundershock', 'growl', 'sunnyday']]], foes: [{ species: 'snorlax', level: 50, moves: ['splash'] }] });
    t.act({ kind: 'move', index: 0 });
    t.act({ kind: 'move', index: 1 });
    t.act({ kind: 'move', index: 2 });
    const evs = t.battleEvents();
    expect(evs).toContainEqual(expect.objectContaining({ b: 'move', side: 'ally', id: 'thundershock', type: 'electric', category: 'Special', target: 'foe' }));
    expect(evs).toContainEqual(expect.objectContaining({ b: 'move', side: 'foe', id: 'splash', target: 'foe' }));
    expect(evs).toContainEqual({ b: 'boost', side: 'foe', up: false });
    expect(evs).toContainEqual({ b: 'weather', weather: 'sun' });
    // Field moves are logged as targeting the user, so they play as self-targeted animations.
    expect(evs).toContainEqual(expect.objectContaining({ b: 'move', id: 'sunnyday', target: 'ally' }));
  });
});

describe('Multi battles', () => {
  const multi = (seed = 1) => battle({
    seed, party: [['pikachu', 30, ['thundershock', 'growl']], ['eevee', 28, ['tackle']]],
    foes: [{ species: 'magikarp', level: 10, moves: ['splash'] }, { species: 'wingull', level: 10, moves: ['watergun'] }],
    opts: { multi: {
      partner: { name: 'Maja', sprite: '', foes: [{ species: 'popplio', level: 30, moves: ['watergun'] }] },
      second: { name: 'Bo', title: 'Deckhand', sprite: '', foes: [{ species: 'croagunk', level: 10, moves: ['poisonsting'] }] }
    } }
  });

  it('puts the partner and the second trainer in the second place and lets the player aim', () => {
    const t = multi();
    const start = t.events.find(e => e.t === 'battleStart') as Extract<ServerEvent, { t: 'battleStart' }>;
    expect(start.battle.multi).toMatchObject({ partner: { name: 'Maja' }, second: { name: 'Bo' }, foeCount2: 1 });
    const switches = t.battleEvents().filter(e => e.b === 'switch') as Extract<BattleEvent, { b: 'switch' }>[];
    expect(switches.map(e => [e.side, e.slot ?? 0])).toEqual(expect.arrayContaining([['ally', 0], ['ally', 1], ['foe', 0], ['foe', 1]]));
    expect(switches.map(e => e.text)).toContain('Maja sent out Popplio!');
    const req = t.lastRequest()!;
    expect(req.targets).toEqual([{ slot: 0, name: 'Magikarp' }, { slot: 1, name: 'Croagunk' }]);
    expect(req.moves[0].aim).toBe(true);
    expect(req.moves[1].aim).toBeUndefined(); // Growl hits both foes
    t.act({ kind: 'move', index: 0, target: 1 });
    const hit = t.battleEvents().find(e => e.b === 'move' && e.side === 'ally' && !e.slot) as Extract<BattleEvent, { b: 'move' }>;
    expect(hit).toMatchObject({ target: 'foe', targetSlot: 1 });
  });

  it('is won when both opposing trainers are out of Pokémon, and pays both prizes', () => {
    let money = 0;
    const t = multi(3);
    t.host.giveMoney = n => { money += n; };
    for (let i = 0; i < 30 && !t.b.result; i++) {
      const req = t.lastRequest()!;
      if (req.forceSwitch) t.act({ kind: 'switch', uid: req.party.find(m => m.hp > 0 && m.uid !== req.activeUid)!.uid });
      else t.act({ kind: 'move', index: 0, target: req.targets?.[0]?.slot ?? 0 });
    }
    expect(t.b.result).toBe('win');
    const base = (title: string) => DEFAULT_RULES.prizeBase[title] ?? DEFAULT_RULES.prizeDefault;
    expect(money).toBe(10 * base('Youngster') + 10 * base('Deckhand'));
    expect(t.texts().some(x => /You defeated Youngster Foe\nand Deckhand Bo!/.test(x))).toBe(true);
  });
});

describe('Tutorial battle (Lukas at the Palm House)', () => {
  it('the player\'s Pokémon holds on at 1 HP however long the battle runs', () => {
    const t = battle({ party: [['sprigatito', 5, ['growl']]], foes: [{ species: 'charmander', level: 9, moves: ['scratch', 'ember'] }],
      opts: { tutorial: true, soft: true }, seed: 4 });
    let low = Infinity;
    for (let i = 0; i < 40 && !(t.b as any).result; i++) { t.act({ kind: 'move', index: 0 }); low = Math.min(low, t.party[0].hp || (t.sim.p1.active[0].hp as number)); }
    expect(t.sim.p1.active[0].hp).toBeGreaterThanOrEqual(1);
    expect(t.sim.p1.active[0].fainted).toBe(false);
    expect(low).toBeGreaterThanOrEqual(1);
  });
});
