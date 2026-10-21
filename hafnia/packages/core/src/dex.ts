// The Pokédex (seen and caught) and the PC storage boxes.
import { Dex } from '@pkmn/sim';
import type { Content } from './content';
import { speciesExtra, speciesName, speciesTypes, type Mon } from './pokemon';
import type { DexEntry } from './protocol';

export interface DexState { seen: Record<string, 1>; caught: Record<string, 1> }
export const emptyDex = (): DexState => ({ seen: {}, caught: {} });

export function markSeen(d: DexState, species: string) { d.seen[species] = 1; }
export function markCaught(d: DexState, m: Mon) {
  if (m.egg) return;
  d.seen[m.species] = 1; d.caught[m.species] = 1;
}

/** Hafnia Dex order: each pack's species (pack.json "dex", else "species") with what they evolve into by
 *  level placed right after them, so a family reads in order. DLC packs append their own. */
export function dexOrder(content: Content): string[] {
  const out: string[] = [], seen = new Set<string>();
  const add = (id: string) => {
    if (seen.has(id)) return;
    try { speciesExtra(id); } catch { return; }
    seen.add(id); out.push(id);
    for (const [to, method] of speciesExtra(id).evolutions ?? []) if (method.startsWith('Level')) add(to);
  };
  for (const p of content.packs.values()) for (const id of p.manifest.dex ?? p.manifest.species) if (id !== 'ditto') add(id);
  for (const p of content.packs.values()) if (p.manifest.species.includes('ditto')) add('ditto');
  return out;
}

let cache: { content: Content; order: string[] } | null = null;
export function dexEntries(content: Content, d: DexState): DexEntry[] {
  if (cache?.content !== content) cache = { content, order: dexOrder(content) };
  return cache.order.map((species, i) => {
    const seen = !!d.seen[species], caught = !!d.caught[species];
    if (!seen) return { n: i + 1, species, seen, caught };
    const x = speciesExtra(species), sp = Dex.species.get(species);
    return {
      n: i + 1, species, seen, caught, key: x.key, name: speciesName(species), types: speciesTypes(species),
      ...(caught ? { category: x.category ? `${x.category} Pokémon` : '', text: x.dex ?? '', height: sp.heightm, weight: sp.weightkg } : {})
    };
  });
}
