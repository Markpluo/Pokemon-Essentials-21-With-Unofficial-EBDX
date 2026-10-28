// The last story-bible side quests (errands.ts) and the items they hand out: Oval Stone by day, the Soothe Bell
// and the Termokande.
import { describe, expect, it } from 'vitest';
import { Content, Game, makeMon, Rng, type SaveData, type ServerEvent } from '@hafnia/core';
import { hafnia } from '../src';

const content = new Content([hafnia]);

/** A game loaded at (map, x, y) at `hour` with these flags; prompts take `answers` in order, then the first option. */
function at(map: string, x: number, y: number, hour: number, flags: Record<string, unknown>, badges: string[] = []) {
  const base = Game.newGame(content, 3).game.toSave();
  const save: SaveData = {
    ...base, map: `hafnia:${map}`, x, y, dir: 'down', badges, clock: hour * 60, money: 5000, party: [makeMon('popplio', 30, new Rng(1))],
    flags: { ...base.flags, ...Object.fromEntries(Object.entries({ intro: true, starter: true, ...flags }).map(([k, v]) => [`hafnia:${k}`, v])) }
  };
  const game = Game.load(content, save);
  const said: string[] = [];
  const answers: number[] = [];
  const take = (evs: ServerEvent[]): void => {
    for (const e of evs) { if (e.t === 'error') throw new Error(e.message); if (e.t === 'say') said.push(e.text); }
    const p = [...evs].reverse().find(e => e.t === 'prompt');
    if (p) take(game.handle({ t: 'answer', index: answers.shift() ?? 0 }));
  };
  take(game.resumeEvents());
  const talk = (dir: 'up' | 'down' | 'left' | 'right', from?: [number, number]) => {
    if (from) Object.assign(game.state, { x: from[0], y: from[1] });
    take(game.handle({ t: 'turn', dir })); take(game.handle({ t: 'interact' }));
  };
  const go = (m: string, x: number, y: number) => Object.assign(game.state, { map: `hafnia:${m}`, x, y });
  const use = (item: string, uid = '') => take(game.handle({ t: 'useItem', item, uid }));
  return { game, said, answers, talk, go, use, flag: (k: string) => game.state.flags[`hafnia:${k}`] };
}

describe('Barnevognen', () => {
  it('chases the pram down the Søerne path and hands over an Azurill egg', () => {
    const g = at('route1', 5, 21, 11, { ch1: true });
    g.talk('up');
    expect(g.flag('pramGo')).toBe(true);
    g.talk('up', [7, 21]); g.talk('up', [8, 17]); g.talk('up', [3, 16]);
    expect(g.flag('pram')).toBe(3);
    g.talk('up', [2, 15]);
    expect(g.flag('pramDone')).toBe(true);
    expect(g.game.state.party.some(m => m.egg && m.species === 'azurill')).toBe(true);
  });
});

describe('Lene\'s Night Shift', () => {
  it('waits for the night, runs four parcels and gives a Happiny egg and an Oval Stone', () => {
    const g = at('pcnorrebro', 4, 4, 12, { c2: true });
    g.talk('up');
    expect(g.flag('leneShift')).toBe(true);
    expect(g.game.period).toBe('night');
    g.game.state.flags['hafnia:leneDone'] = 0b1110;
    g.go('norrebro', 23, 15);
    g.talk('right');
    expect(g.flag('leneDone')).toBe(0b1111);
    g.go('pcnorrebro', 4, 4);
    g.talk('up');
    expect(g.flag('leneShiftDone')).toBe(true);
    expect(g.game.state.party.some(m => m.egg && m.species === 'happiny')).toBe(true);
    expect(g.game.state.bag.ovalstone).toBe(1);
    expect(g.game.state.bag.medbag ?? 0).toBe(0);
  });

  it('ends the round if a parcel arrives after five', () => {
    const g = at('norrebro', 23, 15, 6, { c2: true, leneShift: true, leneDone: 0 });
    g.game.state.bag.medbag = 1;
    g.talk('right');
    expect(g.flag('leneShift')).toBe(false);
    expect(g.game.state.bag.medbag).toBe(0);
  });

  it('Happiny evolves with the Oval Stone only in daylight', () => {
    const g = at('norrebro', 5, 5, 22, {});
    const hap = makeMon('happiny', 20, new Rng(2));
    g.game.state.party.push(hap); g.game.state.bag.ovalstone = 1;
    g.use('ovalstone', hap.uid);
    expect([hap.species, g.game.state.bag.ovalstone]).toEqual(['happiny', 1]);
    expect(g.said.at(-1)).toMatch(/daylight/);
    g.game.state.clock = 11 * 60;
    g.use('ovalstone', hap.uid);
    expect([hap.species, g.game.state.bag.ovalstone]).toEqual(['chansey', 0]);
  });
});

describe('the Hygge Passport', () => {
  it('rests the team, moves the clock and pays out on the twelfth stamp', () => {
    const g = at('norrebro', 23, 16, 11, { ch3: true, hygge: 0b111111111110 });
    g.game.state.bag.hyggepass = 1;
    g.game.state.party[0].hp = 1;
    g.answers.push(2);                       // stay until evening
    g.talk('right');
    expect(g.game.period).toBe('evening');
    expect(g.game.state.party[0].hp).toBeGreaterThan(1);
    expect(g.flag('hyggeDone')).toBe(true);
    expect(g.game.state.money).toBe(4800);
    expect(g.game.state.party.some(m => m.species === 'sinistea')).toBe(true);
    expect([g.game.state.bag.soothebell, g.game.state.bag.termokande, g.game.state.bag.crackedpot]).toEqual([1, 1, 1]);
  });

  it('the Soothe Bell evolves friendship Pokémon and is never used up', () => {
    const g = at('norrebro', 5, 5, 11, {});
    const az = makeMon('azurill', 10, new Rng(3));
    g.game.state.party.push(az); g.game.state.bag.soothebell = 1;
    g.use('soothebell', az.uid);
    expect([az.species, g.game.state.bag.soothebell]).toEqual(['marill', 1]);
  });

  it('the Termokande moves the clock outdoors but not indoors', () => {
    const g = at('norrebro', 5, 5, 11, {});
    g.game.state.bag.termokande = 1;
    g.answers.push(3);
    g.use('termokande');
    expect(g.game.period).toBe('night');
    g.go('pcnorrebro', 4, 4);
    g.use('termokande');
    expect(g.said.at(-1)).toMatch(/outdoors/);
  });
});

describe('Tycho\'s Star Charts', () => {
  it('marks constellations at night and Kirsten pays out for all eight', () => {
    const g = at('towerin', 3, 3, 11, { ch6done: true });
    g.talk('up');
    expect(g.game.state.bag.starchart).toBe(1);
    g.game.state.flags['hafnia:stars'] = 0b01111111;
    g.go('copenhill', 24, 10);
    g.talk('right');                         // waits for night, then looks
    expect(g.flag('stars')).toBe(0b11111111);
    g.go('towerin', 3, 3);
    g.talk('up');
    expect(g.flag('starsDone')).toBe(true);
    expect(g.game.state.bag.moonstone).toBe(3);
    expect(g.game.state.party.some(m => m.egg && m.species === 'cleffa')).toBe(true);
  });
});

describe('the Midsummer Bonfires', () => {
  it('lighting the eighth bonfire brings its Leader and the reward', () => {
    const lit = Object.fromEntries(['tariq', 'alva', 'kasper', 'soren', 'tycho', 'pierrot', 'margrethe'].map(k => [`fire.${k}`, true]));
    const g = at('copenhill', 2, 10, 11, { champion: true, ...lit });
    g.talk('up');
    expect(g.flag('fire.astrid')).toBe(true);
    expect(g.flag('firesDone')).toBe(true);
    expect([g.game.state.bag.ember, g.game.state.bag.tmflamethrower, g.game.state.bag.expcandyl]).toEqual([1, 1, 3]);
  });
});
