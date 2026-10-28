// Every music key, area sound and sound effect the pack uses has a file in pack.json "audio",
// so a missing placeholder shows up here instead of as silence in the game.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { hafnia } from '../src';
import { battleMusic, MAP_MUSIC } from '../src/music';

const audio = hafnia.manifest.audio;
const src = join(__dirname, '..', 'src');

describe('audio', () => {
  it('every map has music, and every music and area key has a file', () => {
    for (const m of Object.values(hafnia.maps)) {
      for (const key of [m.bgm, m.bgmNight, m.ambient]) if (key) expect(audio[key], `${m.id}: ${key}`).toBeDefined();
    }
  });

  it('only maps outside the table still play the old one-track-for-everything music', () => {
    const plain = Object.values(hafnia.maps).filter(m => m.bgm === 'overworld').map(m => m.id);
    expect(plain.filter(id => MAP_MUSIC[id])).toEqual([]);
  });

  it('every music key points at a file that exists', () => {
    for (const [k, v] of Object.entries(audio)) if (v.startsWith('pack:')) expect(existsSync(join(__dirname, '..', v.slice(5))), `${k}: ${v}`).toBe(true);
  });

  it('battle music by trainer class', () => {
    const t = (title: string, leader = false) => battleMusic({ kind: 'trainer', foes: [], leader, trainer: { name: 'X', title, sprite: '' } });
    expect(t('Leader', true)).toBe('battle_leader');
    expect(t('Rival')).toBe('battle_rival');
    expect(t('Deckhand')).toBe('battle_fleet');
    expect(t('Grid Enforcer')).toBe('battle_vanguard');
    expect(t('Commander')).toBe('battle_boss');
    expect(t('Champion', true)).toBe('battle_champion');
    expect(t('Elite Four', true)).toBe('battle_elite');
    expect(t('Lumen Nord CEO')).toBe('battle_lumen');
    expect(t('Jogger')).toBeUndefined();
    expect(battleMusic({ kind: 'wild', foes: [{ species: 'langelira', level: 45 }] })).toBe('battle_legend');
    for (const k of ['battle_leader', 'battle_rival', 'battle_fleet', 'battle_vanguard', 'battle_boss', 'battle_legend', 'battle_lowhp', 'battle_champion', 'battle_elite', 'battle_lumen', 'bike']) expect(audio[k], k).toBeDefined();
  });

  it('every sfx() and me() a script plays has a file', () => {
    for (const f of readdirSync(src)) {
      const code = readFileSync(join(src, f), 'utf8');
      for (const [, name] of code.matchAll(/\.(?:sfx|me)\('([a-z_0-9]+)'/g)) expect(audio[name], `${f}: ${name}`).toBeDefined();
    }
  });
});
