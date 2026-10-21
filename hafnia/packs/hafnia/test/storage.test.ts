// The Pokédex (seen and caught) and PC storage at a Pokémon Center.
import { describe, expect, it } from 'vitest';
import { Content, Game, Rng, dexOrder, makeMon, migrate, type Dir, type SaveData, type ServerEvent } from '@hafnia/core';
import { hafnia } from '../src';

const content = new Content([hafnia]);

/** A game standing in front of the Nørrebro Pokémon Center's PC with three Pokémon. */
function atPc() {
  const { game } = Game.newGame(content, 7);
  game.handle({ t: 'answer', index: 0, text: 'Mark' });
  game.handle({ t: 'answer', index: 0 });
  const s = game.state;
  s.party = ['sprigatito', 'pidgey', 'psyduck'].map((sp, i) => makeMon(sp, 10, new Rng(i + 1), { ot: 'Mark' }));
  Object.assign(s, { map: 'hafnia:pcnorrebro', x: 6, y: 2, dir: 'up' as Dir });
  return game;
}
const pcBox = (evs: ServerEvent[]) => { const e = evs.find(e => e.t === 'pc'); return e && e.t === 'pc' ? e.box : null; };

describe('Pokédex', () => {
  it('lists the region in family order, starters first', () => {
    const order = dexOrder(content);
    expect(order.slice(0, 3)).toEqual(['sprigatito', 'floragato', 'meowscarada']);
    expect(order.indexOf('pidgeotto')).toBe(order.indexOf('pidgey') + 1);
    expect(new Set(order).size).toBe(order.length);
  });

  it('counts the party as caught and shows entries only for what was caught', () => {
    const g = atPc();
    const evs = g.handle({ t: 'dex' });
    const d = evs.find(e => e.t === 'dex');
    if (!d || d.t !== 'dex') throw new Error('no dex event');
    const spr = d.entries.find(e => e.species === 'sprigatito')!;
    expect(spr).toMatchObject({ seen: true, caught: true, name: 'Sprigatito' });
    expect(spr.text).toBeTruthy();
    const unseen = d.entries.find(e => e.species === 'meowscarada')!;
    expect(unseen).toMatchObject({ seen: false, caught: false });
    expect(unseen.name).toBeUndefined();
    const view = evs.find(e => e.t === 'view');
    expect(view && view.t === 'view' && view.view.dex).toEqual({ seen: 3, caught: 3 });
  });

  it('marks foes seen when they are sent out', () => {
    const g = atPc();
    g.debug = true;
    g.handle({ t: 'debug', cmd: 'multiBattle' });
    expect(g.state.dex.seen.mareanie).toBe(1);
    expect(g.state.dex.caught.mareanie).toBeUndefined();
  });

  it('old saves get a Pokédex from what the player owns', () => {
    const save = atPc().toSave() as Partial<SaveData>;
    delete save.dex; save.v = 3;
    const s = migrate(save as SaveData);
    expect(Object.keys(s.dex.caught).sort()).toEqual(['pidgey', 'psyduck', 'sprigatito']);
  });
});

describe('PC storage', () => {
  it('only works while a PC is switched on', () => {
    const g = atPc();
    g.handle({ t: 'pc', op: 'deposit', uid: g.state.party[1].uid });
    expect(g.state.party).toHaveLength(3);
  });

  it('deposits, withdraws and releases, keeping one Pokémon that can battle', () => {
    const g = atPc();
    expect(pcBox(g.handle({ t: 'interact' }))).toEqual([]);
    const [a, b, c] = g.state.party;
    expect(pcBox(g.handle({ t: 'pc', op: 'deposit', uid: b.uid }))!.map(m => m.uid)).toEqual([b.uid]);
    g.handle({ t: 'pc', op: 'deposit', uid: c.uid });
    const last = g.handle({ t: 'pc', op: 'deposit', uid: a.uid });
    expect(last.some(e => e.t === 'say' && /last Pokémon/.test(e.text))).toBe(true);
    expect(g.state.party.map(m => m.uid)).toEqual([a.uid]);
    g.handle({ t: 'pc', op: 'withdraw', uid: c.uid });
    expect(g.state.party.map(m => m.uid)).toEqual([a.uid, c.uid]);
    g.handle({ t: 'pc', op: 'release', uid: b.uid });
    expect(g.state.box).toEqual([]);
    expect(g.state.dex.caught.pidgey).toBe(1);   // released, but still registered
  });

  it('closes when the player walks away', () => {
    const g = atPc();
    g.handle({ t: 'interact' });
    g.handle({ t: 'step', dir: 'down' });
    g.handle({ t: 'pc', op: 'deposit', uid: g.state.party[1].uid });
    expect(g.state.box).toEqual([]);
  });
});
