// Hafnia's own Pokémon, which Showdown doesn't know: their battle data goes into the simulator's dex (simData),
// and catch rate, EXP, level-up moves and Pokédex text into the PBS table (speciesExtra). Sprites are in
// pack.json "pokemon" (stand-in art made from Gemini sheets until the real art is drawn).
import type { SpeciesExtra } from '@hafnia/core';

export const SIM_DATA: Record<string, Record<string, unknown>> = {
  Pokedex: {
    // The siren of the Sound, who sang the Pact with the first fishers of Hafnia.
    langelira: {
      num: -2001, name: 'Langelira', types: ['Water', 'Psychic'], gender: 'N',
      baseStats: { hp: 100, atk: 70, def: 90, spa: 125, spd: 115, spe: 100 },
      abilities: { 0: 'Swift Swim' }, heightm: 3.2, weightkg: 210, color: 'Green', eggGroups: ['Undiscovered']
    },
    // Lindholm's Rotom, fused with the Bifrost Reactor: a boss form, never caught.
    rotomreactor: {
      num: -2002, name: 'Rotom-Reactor', baseSpecies: 'Rotom', forme: 'Reactor', types: ['Electric', 'Steel'], gender: 'N',
      baseStats: { hp: 85, atk: 70, def: 110, spa: 135, spd: 110, spe: 95 },
      abilities: { 0: 'Levitate' }, heightm: 1.2, weightkg: 60, color: 'Blue', eggGroups: ['Undiscovered']
    },
    // The granite guardian under Kronborg, Holger Danske's friend. Sleeps until Hafnia is in mortal peril.
    kronvakt: {
      num: -2003, name: 'Kronvakt', types: ['Steel', 'Fighting'], gender: 'N',
      baseStats: { hp: 105, atk: 130, def: 130, spa: 65, spd: 100, spe: 70 },
      abilities: { 0: 'Steadfast' }, heightm: 3.4, weightkg: 520, color: 'Brown', eggGroups: ['Undiscovered']
    },
    // A gentle troll of reclaimed timber; six named Titans sleep on Hafnia's outskirts.
    troldtrae: {
      num: -2005, name: 'Troldtrae', types: ['Grass', 'Rock'],
      baseStats: { hp: 110, atk: 105, def: 110, spa: 60, spd: 85, spe: 45 },
      abilities: { 0: 'Sturdy', 1: 'Grassy Surge' }, heightm: 4.8, weightkg: 380, color: 'Gray', eggGroups: ['Undiscovered']
    },
    // The Baltic Wyrm asleep in Bornholm's granite; the siphon pulled from it too. (Showdown ids are ASCII, so no ø.)
    kronikon: {
      num: -2004, name: 'Kronikon', types: ['Dragon', 'Rock'], gender: 'N',
      baseStats: { hp: 110, atk: 95, def: 120, spa: 125, spd: 95, spe: 75 },
      abilities: { 0: 'Solid Rock' }, heightm: 9.1, weightkg: 680, color: 'Gray', eggGroups: ['Undiscovered']
    }
  },
  Moves: {
    sirensrequiem: {
      num: -2001, name: 'Siren\'s Requiem', type: 'Water', category: 'Special', basePower: 90, accuracy: 100, pp: 10, priority: 0,
      flags: { protect: 1, mirror: 1, sound: 1, bypasssub: 1 }, target: 'normal',
      secondary: { chance: 100, boosts: { spa: -1 } },
      // The song brings the rain with it.
      onAfterMoveSecondarySelf(this: { field: { setWeather(w: string): boolean } }) { this.field.setWeather('raindance'); }
    },
    // Stronger for each fainted ally: protect what you have.
    danishoath: {
      num: -2002, name: 'Danish Oath', type: 'Steel', category: 'Physical', basePower: 70, accuracy: true, pp: 10, priority: 0,
      flags: { protect: 1, mirror: 1, contact: 1 }, target: 'normal',
      basePowerCallback(pokemon: { side: { totalFainted: number } }) { return 70 + 20 * Math.min(4, pokemon.side.totalFainted); }
    },
    granitesong: {
      // The chronicle in the stone: a hum that hardens the singer.
      num: -2003, name: 'Granite Song', type: 'Rock', category: 'Special', basePower: 90, accuracy: 100, pp: 10, priority: 0,
      flags: { protect: 1, mirror: 1, sound: 1, bypasssub: 1 }, target: 'normal',
      secondary: { chance: 30, self: { boosts: { def: 1, spd: 1 } } }
    }
  }
};

export const SPECIES_EXTRA: Record<string, SpeciesExtra> = {
  langelira: {
    key: 'LANGELIRA', catchRate: 30, baseExp: 290, growth: 'Slow', category: 'Siren',
    dex: 'It sang the Pact with the first fishers of the Sound. When it is silent, the sea forgets to be calm.',
    moves: [[1, 'watergun'], [1, 'confusion'], [8, 'sing'], [16, 'aquaring'], [24, 'psybeam'], [32, 'surf'],
      [40, 'calmmind'], [48, 'psychic'], [55, 'sirensrequiem'], [64, 'icebeam'], [72, 'hydropump']]
  },
  kronvakt: {
    key: 'KRONVAKT', catchRate: 30, baseExp: 290, growth: 'Slow', category: 'Guardian',
    dex: 'A granite giant that swore an oath with Holger Danske. Its copper crown hums when Hafnia is in danger.',
    moves: [[1, 'rocktomb'], [1, 'metalclaw'], [10, 'bulkup'], [20, 'brickbreak'], [30, 'ironhead'], [40, 'irondefense'],
      [50, 'hammerarm'], [60, 'danishoath'], [70, 'closecombat'], [80, 'heavyslam']]
  },
  kronikon: {
    key: 'KRONIKON', name: 'Krønikon', catchRate: 30, baseExp: 300, growth: 'Slow', category: 'Baltic Wyrm',
    dex: 'It sleeps coiled in Bornholm\'s granite and hums the island\'s chronicle. The stone remembers everything it sings.',
    moves: [[1, 'rockthrow'], [1, 'dragonbreath'], [10, 'ancientpower'], [20, 'dragonpulse'], [30, 'stealthrock'], [40, 'powergem'],
      [50, 'granitesong'], [60, 'earthpower'], [70, 'dracometeor'], [80, 'calmmind']]
  },
  troldtrae: {
    key: 'TROLDTRAE', name: 'Troldtræ', catchRate: 45, baseExp: 250, growth: 'Slow', category: 'Timber Troll',
    dex: 'Built itself from fallen trees and old planks. It sleeps for years in the woods and wakes when children laugh nearby.',
    moves: [[1, 'tackle'], [1, 'absorb'], [8, 'rockthrow'], [16, 'leechseed'], [24, 'rockslide'], [32, 'woodhammer'],
      [40, 'ingrain'], [48, 'stoneedge'], [56, 'hornleech'], [64, 'headsmash']]
  },
  rotomreactor: {
    key: 'ROTOM_REACTOR', catchRate: 0, baseExp: 250, growth: 'Medium', category: 'Plasma',
    dex: 'A Rotom that dived into the Bifrost Reactor. The copper coils hold it together, and keep it burning.',
    moves: [[1, 'thundershock'], [1, 'metalsound'], [30, 'discharge'], [40, 'flashcannon'], [50, 'heatwave']]
  }
};
