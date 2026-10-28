// Bugs found playing the game through (see bot/playthrough): each one set up from a save, then checked.
import { describe, expect, it } from 'vitest';
import { Content, Game, makeMon, Rng, type SaveData, type ServerEvent } from '@hafnia/core';
import { hafnia } from '../src';

const content = new Content([hafnia]);

/** A game loaded from a save at (map, x, y) with these flags, answering every prompt with `answers` then the first option. */
function at(map: string, x: number, y: number, flags: Record<string, unknown>, badges: string[] = []) {
  const base = Game.newGame(content, 3).game.toSave();
  const save: SaveData = {
    ...base, map: `hafnia:${map}`, x, y, dir: 'down', badges, party: [makeMon('popplio', 30, new Rng(1))],
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
  const talk = (dir: 'up' | 'down' | 'left' | 'right') => { take(game.handle({ t: 'turn', dir })); take(game.handle({ t: 'interact' })); };
  return { game, said, answers, talk, flag: (k: string) => game.state.flags[`hafnia:${k}`] };
}

describe('fixes from the playthrough', () => {
  it('Yusuf still hands over the gold paint if he was beaten before Tariq asked for paint', () => {
    const g = at('norrebro', 19, 14, { 'tr.yusuf': true, muralQuest: true, ch1: true });
    g.talk('left');
    expect(g.flag('paintGold')).toBe(true);
    expect(g.said.some(t => /got the gold paint/.test(t))).toBe(true);
  });

  it('every item ball has its own flag, so picking one up never hides another', () => {
    const ids = Object.values(hafnia.maps).flatMap(m => m.npcs.filter(n => n.id.startsWith('item.')).map(n => n.id));
    expect(ids.length).toBeGreaterThan(5);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
  });

  it('a ferry runs from Islands Brygge to Dragør and back', () => {
    const g = at('islandsbrygge', 3, 11, { ch3: true });
    g.talk('left');
    expect(g.game.state.map).toBe('hafnia:dragor');
    g.talk('up');
    expect(g.game.state.map).toBe('hafnia:islandsbrygge');
  });
});
