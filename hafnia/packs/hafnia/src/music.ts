// Which music and area sound each map and battle uses. These are music *keys*; pack.json "audio"
// says which file plays for each key, so a new track replaces a placeholder by changing one line
// there (the full list with the target feel per key is in AUDIO.md next to pack.json).
import type { BattleOptions, MapDef } from '@hafnia/core';

/** Map id -> music key (and night music / looping area sound where the map has one). */
export const MAP_MUSIC: Record<string, { bgm: string; night?: string; ambient?: string }> = {
  // Prologue, Chapter 1: Nørrebro and the lakes
  norrebro: { bgm: 'norrebro', night: 'town_night' },
  flat: { bgm: 'home' }, lukasflat: { bgm: 'home' },
  bridge: { bgm: 'route_lakes' }, route1: { bgm: 'route_lakes', ambient: 'amb_birds' },
  garden: { bgm: 'lab', ambient: 'amb_birds' }, palmhouse: { bgm: 'lab' },
  tunnels: { bgm: 'cave', ambient: 'amb_steam' },
  // Chapter 2: the old city and the harbour
  indreby: { bgm: 'city' }, towerin: { bgm: 'tower' },
  nyhavn: { bgm: 'harbour', night: 'town_night', ambient: 'amb_waves' }, cafein: { bgm: 'cafe' },
  drydock: { bgm: 'industrial', ambient: 'amb_machinery' },
  route4: { bgm: 'route_city', ambient: 'amb_waves' },
  christianshavn: { bgm: 'freetown', night: 'town_night' },
  stadsgraven: { bgm: 'park', ambient: 'amb_birds' },
  // Chapter 3: Dragør, Vesterbro, Kødbyen
  dragor: { bgm: 'village', ambient: 'amb_waves' },
  route2: { bgm: 'route_city' }, route3: { bgm: 'route_bike' },
  vesterbro: { bgm: 'vesterbro', night: 'town_night' }, cafevb: { bgm: 'cafe' }, bakery: { bgm: 'cafe' },
  kodbyen: { bgm: 'industrial' }, kitchen: { bgm: 'cafe' },
  islandsbrygge: { bgm: 'harbour', ambient: 'amb_waves' },
  // Chapter 4: Assistens Kirkegård and the Lantern Walk
  assistens: { bgm: 'cemetery', ambient: 'amb_wind' },
  stormdrain: { bgm: 'cave', ambient: 'amb_drips' },
  // Chapter 5: Frederiksberg and the Cisterns
  frederiksberg: { bgm: 'park', ambient: 'amb_birds' },
  cisterns: { bgm: 'cisterns', ambient: 'amb_drips' },
  // Chapter 6: Rundetårn
  rundetarn: { bgm: 'tower' }, bibliotek: { bgm: 'tower' }, trinitatis: { bgm: 'tower', ambient: 'amb_wind' },
  // Chapter 7: north by Kystbanen
  osterbro: { bgm: 'harbour', ambient: 'amb_waves' },
  kastellet: { bgm: 'kastellet', ambient: 'amb_wind' },
  route8: { bgm: 'route_coast', ambient: 'amb_waves' },
  lyngby: { bgm: 'village', ambient: 'amb_birds' },
  dyrehaven: { bgm: 'forest', ambient: 'amb_birds' },
  substation: { bgm: 'vanguard', ambient: 'amb_hum' },
  bakken: { bgm: 'bakken' },
  // Chapter 8: Trekroner
  fleetboat: { bgm: 'fleet', ambient: 'amb_waves' },
  trekroner: { bgm: 'sea', ambient: 'amb_waves' },
  tklighthouse: { bgm: 'fleet', ambient: 'amb_wind' },
  battery: { bgm: 'fleet', ambient: 'amb_waves' },
  siphon: { bgm: 'vanguard', ambient: 'amb_hum' },
  // Chapter 9: Slotsholmen and Børsen
  slotsholmen: { bgm: 'palace' }, borsen: { bgm: 'palace' },
  // Chapter 10: the shipyards and CopenHill
  shipyards: { bgm: 'industrial', ambient: 'amb_machinery' },
  eastquay: { bgm: 'industrial', ambient: 'amb_waves' },
  cranetop: { bgm: 'industrial', ambient: 'amb_wind' },
  copenhill: { bgm: 'copenhill', ambient: 'amb_wind' }
};

/** A map's music: its own if it names one, else the table above, else by kind of map. */
export function withMusic(m: MapDef): MapDef {
  if (m.bgm !== 'overworld') return m;
  const t = MAP_MUSIC[m.id];
  if (t) return { ...m, bgm: t.bgm, ...(t.night ? { bgmNight: t.night } : {}), ...(t.ambient ? { ambient: t.ambient } : {}) };
  if (m.id.startsWith('pc')) return { ...m, bgm: 'center' };
  if (/^gym\d/.test(m.id)) return { ...m, bgm: 'gym', ...(m.id === 'gym8' ? { ambient: 'amb_hum' } : {}) };
  return m;
}

const FLEET = new Set(['Deckhand', 'Bosun', 'Sailor']);
const VANGUARD = new Set(['Grid Enforcer', 'Grid Technician', 'Engineer', 'Vanguard Scientist', 'Vanguard Lawyer', 'Survey Drone']);
const BOSSES = new Set(['Captain', 'Commander']);
const LEGENDS = new Set(['langelira', 'kronvakt']);

/** Battle music by who you fight (audio-plan.md §3). */
export function battleMusic(o: BattleOptions): string | undefined {
  if (o.kind === 'wild') return o.foes.some(f => LEGENDS.has(f.species)) ? 'battle_legend' : undefined;
  const title = o.trainer?.title ?? '';
  if (o.leader || title === 'Leader') return 'battle_leader';
  if (title === 'Rival') return 'battle_rival';
  if (BOSSES.has(title)) return 'battle_boss';
  if (FLEET.has(title)) return 'battle_fleet';
  if (VANGUARD.has(title)) return 'battle_vanguard';
  return undefined;
}
