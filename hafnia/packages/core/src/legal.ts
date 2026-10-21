// Legality check for Pokémon that change owner online (trades). The server creates every
// online Pokémon itself, so this is a safety net against bugs and tampered data (online-ops.md §3).
import { Dex } from '@pkmn/sim';
import { speciesExtra, type Mon } from './pokemon';

const STATS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const;
const int = (n: unknown, lo: number, hi: number) => Number.isInteger(n) && (n as number) >= lo && (n as number) <= hi;

/** Returns why a Pokémon is not legal, or null if it is. `allowed` limits species to the installed packs. */
export function checkMon(m: Mon, allowed?: ReadonlySet<string>): string | null {
  const sp = Dex.species.get(m?.species ?? '');
  if (!sp.exists) return 'unknown species';
  if (allowed && !allowed.has(sp.id)) return 'species not in this game';
  try { speciesExtra(sp.id); } catch { return 'no species data'; }
  if (!int(m.level, 1, 100)) return 'bad level';
  if (!m.uid || typeof m.uid !== 'string') return 'missing id';
  if (!m.ot) return 'missing original trainer';
  if (!Dex.natures.get(m.nature).exists) return 'bad nature';
  if (!Object.values(sp.abilities).includes(m.ability)) return 'bad ability';
  let evTotal = 0;
  for (const k of STATS) {
    if (!int(m.ivs?.[k], 0, 31)) return 'bad IVs';
    if (!int(m.evs?.[k], 0, 252)) return 'bad EVs';
    evTotal += m.evs[k];
  }
  if (evTotal > 510) return 'bad EVs';
  if (!Array.isArray(m.moves) || !m.moves.length || m.moves.length > 4) return 'bad moves';
  for (const mv of m.moves) {
    const d = Dex.moves.get(mv.id);
    if (!d.exists || !int(mv.pp, 0, 64)) return 'bad moves';
  }
  if (!int(m.hp, 0, 9999)) return 'bad HP';
  return null;
}
