// Converts the Essentials PBS species files into packages/core/data/species.json.
// Battle mechanics (types, base stats, abilities, moves) come from the Showdown simulator;
// this file adds what Showdown does not have: catch rate, base EXP, growth rate,
// level-up learnsets, evolutions and Pokédex text.
// Usage: npm run pbs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Dex } from '@pkmn/sim';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const pbs = join(root, '..', 'PBS');
const out = join(root, 'packages', 'core', 'data', 'species.json');

function parse(file) {
  const entries = [];
  let cur = null;
  for (const raw of readFileSync(join(pbs, file), 'utf8').split(/\r?\n/)) {
    const line = raw.replace(/^﻿/, '').trim();
    if (!line || line.startsWith('#')) continue;
    const head = line.match(/^\[(.+)\]$/);
    if (head) { cur = { ID: head[1] }; entries.push(cur); continue; }
    const kv = line.match(/^(\w+)\s*=\s*(.*)$/);
    if (kv && cur) cur[kv[1]] = kv[2];
  }
  return entries;
}

const toId = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const species = {};
const unknownMoves = new Set();
let skipped = 0;

for (const file of ['pokemon.txt', 'pokemon_base_Gen_9_Pack.txt']) {
  for (const e of parse(file)) {
    const id = toId(e.ID);
    if (!Dex.species.get(id).exists) { skipped++; continue; }
    const nums = (e.Moves || '').split(',');
    const moves = [];
    for (let i = 0; i + 1 < nums.length; i += 2) {
      const mv = toId(nums[i + 1]);
      if (Dex.moves.get(mv).exists) moves.push([Number(nums[i]), mv]);
      else unknownMoves.add(nums[i + 1]);
    }
    const evo = (e.Evolutions || '').split(',');
    const evolutions = [];
    for (let i = 0; i + 2 < evo.length; i += 3) evolutions.push([toId(evo[i]), evo[i + 1], evo[i + 2]]);
    species[id] = {
      key: e.ID, // Essentials ID, used for sprite and cry file names
      catchRate: Number(e.CatchRate || 45),
      baseExp: Number(e.BaseExp || 64),
      growth: e.GrowthRate || 'Medium',
      moves,
      ...(evolutions.length ? { evolutions } : {}),
      ...(e.Category ? { category: e.Category } : {}),
      ...(e.Pokedex ? { dex: e.Pokedex } : {})
    };
  }
}

writeFileSync(out, JSON.stringify(species));
console.log(`species.json: ${Object.keys(species).length} species, ${skipped} skipped (unknown to Showdown), ` +
  `${unknownMoves.size} unknown moves dropped${unknownMoves.size ? ': ' + [...unknownMoves].slice(0, 12).join(', ') : ''}`);
