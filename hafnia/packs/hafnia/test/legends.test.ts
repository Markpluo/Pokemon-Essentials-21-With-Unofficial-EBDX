// Hafnia's own Pokémon: the simulator knows them once the pack is loaded, and their signature moves work.
import { describe, expect, it } from 'vitest';
import { Battle, Dex } from '@pkmn/sim';
import { Content, makeMon, Rng, speciesExtra } from '@hafnia/core';
import { hafnia } from '../src';

new Content([hafnia]);

describe("Hafnia's own Pokémon", () => {
  it('Langelira and the Reactor Rotom are in the dex, with PBS data and level-up moves', () => {
    expect(Dex.species.get('langelira').types).toEqual(['Water', 'Psychic']);
    expect(Dex.species.get('rotomreactor').types).toEqual(['Electric', 'Steel']);
    expect(speciesExtra('langelira').key).toBe('LANGELIRA');
    const m = makeMon('langelira', 55, new Rng(1));
    expect(m.moves.map(x => x.id)).toContain('sirensrequiem');
  });

  it('Kronvakt is Steel/Fighting, and Danish Oath never misses and grows with each fainted ally', () => {
    expect(Dex.species.get('kronvakt').types).toEqual(['Steel', 'Fighting']);
    expect(makeMon('kronvakt', 70, new Rng(1)).moves.map(x => x.id)).toContain('danishoath');
    const oath = Dex.moves.get('danishoath') as unknown as { accuracy: unknown; basePowerCallback(p: unknown): number };
    expect(oath.accuracy).toBe(true);
    expect([0, 2, 9].map(n => oath.basePowerCallback({ side: { totalFainted: n } }))).toEqual([70, 110, 150]);
  });

  it('Krønikon is Dragon/Rock and learns Granite Song, a sound-based Rock move', () => {
    expect(Dex.species.get('kronikon').types).toEqual(['Dragon', 'Rock']);
    expect(makeMon('kronikon', 75, new Rng(1)).moves.map(x => x.id)).toContain('granitesong');
    const song = Dex.moves.get('granitesong');
    expect([song.type, song.category, song.basePower, !!song.flags.sound]).toEqual(['Rock', 'Special', 90, true]);
  });

  it("Siren's Requiem hits, lowers the target's Sp. Atk and brings the rain", () => {
    const b = new Battle({ formatid: 'gen9customgame' as never, seed: [1, 2, 3, 4] as never });
    b.setPlayer('p1', { team: [{ species: 'Langelira', moves: ['sirensrequiem'], level: 55, ability: 'Swift Swim', name: 'Langelira', item: '', nature: 'Modest', gender: 'N', evs: {} as never, ivs: {} as never }] as never });
    b.setPlayer('p2', { team: [{ species: 'Snorlax', moves: ['splash'], level: 55, ability: 'Thick Fat', name: 'Snorlax', item: '', nature: 'Hardy', gender: 'M', evs: {} as never, ivs: {} as never }] as never });
    if (b.requestState === 'teampreview') b.makeChoices('team 1', 'team 1');
    b.makeChoices('move 1', 'move 1');
    const foe = b.p2.active[0];
    expect(foe.hp).toBeLessThan(foe.maxhp);
    expect(foe.boosts.spa).toBe(-1);
    expect(b.field.weather).toBe('raindance');
  });
});
