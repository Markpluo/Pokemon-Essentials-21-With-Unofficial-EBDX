// Getting around (PR #9, brought up to Chapter 10): every bus stop stands on open ground with room to get
// off below it, and the current-goal line follows the story to the end of the latest chapter.
import { describe, expect, it } from 'vitest';
import { Content, Game } from '@hafnia/core';
import { hafnia } from '../src';
import { STOPS } from '../src/natbus';
import { goal } from '../src/goal';

const content = new Content([hafnia]);

describe('bus stops', () => {
  it('stand on open ground with a free tile below for riders', () => {
    const { game } = Game.newGame(content, 1);
    const bad: string[] = [];
    for (const t of STOPS) {
      const m = hafnia.maps[t.map], others = m.npcs.filter(n => n.id !== 'busstop');
      if (game.solid(t.x, t.y, `hafnia:${t.map}`) && !others.length) bad.push(`${t.map}: stop on a solid tile`);
      if (others.some(n => n.x === t.x && n.y === t.y)) bad.push(`${t.map}: stop on top of ${others.find(n => n.x === t.x && n.y === t.y)!.id}`);
      if (game.solid(t.x, t.y + 1, `hafnia:${t.map}`)) bad.push(`${t.map}: riders get off onto a solid tile`);
      const blocker = others.find(n => n.x === t.x && n.y === t.y + 1 && !n.when && !n.hidden);
      if (blocker) bad.push(`${t.map}: ${blocker.id} stands where riders get off`);
    }
    expect(bad).toEqual([]);
  });
});

describe('current goal', () => {
  it('moves on as the story flags are set, through Chapter 10', () => {
    const flags = new Set<string>(['mumTalked']);
    const f = (n: string) => flags.has(n);
    expect(goal(f)).toMatch(/Palm House/);
    flags.add('ch3done'); expect(goal(f)).toMatch(/home to Nørrebro/);
    flags.add('ch9done'); expect(goal(f)).toMatch(/Brix/);
    flags.add('ch10done'); expect(goal(f)).toMatch(/west from CopenHill/);
    flags.add('e4freja'); expect(goal(f)).toMatch(/Tower roof/);
    flags.add('champion'); expect(goal(f)).toMatch(/Champion/);
  });
});
