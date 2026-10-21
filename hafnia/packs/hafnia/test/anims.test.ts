// The pack's battle animations must use known steps, presets and shapes, and name real moves.
import { describe, expect, it } from 'vitest';
import { Dex } from '@pkmn/sim';
import { checkTimeline, type AnimPack } from '@hafnia/core';
import anims from '../anims.json';

describe('battle animations', () => {
  const pack = anims as AnimPack;
  it('every timeline is well formed', () => {
    const errors = Object.entries(pack.moves).flatMap(([id, tl]) => checkTimeline(tl, id));
    expect(errors).toEqual([]);
  });
  it('every animated move exists', () => {
    const missing = Object.keys(pack.moves).filter(id => Dex.moves.get(id).id !== id || !Dex.moves.get(id).exists);
    expect(missing).toEqual([]);
  });
  it('covers the moves the starters learn early', () => {
    for (const id of ['tackle', 'scratch', 'pound', 'ember', 'watergun', 'leafage', 'growl', 'tailwhip', 'leer']) expect(pack.moves[id]).toBeDefined();
  });
});
