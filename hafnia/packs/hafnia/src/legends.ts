// Hafnia's own Pokémon, which Showdown doesn't know: their battle data goes into the simulator's dex (simData),
// and catch rate, EXP, level-up moves and Pokédex text into the PBS table (speciesExtra). Sprites are in
// pack.json "pokemon" (placeholder recolours until the real art is drawn).
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
    }
  },
  Moves: {
    sirensrequiem: {
      num: -2001, name: 'Siren\'s Requiem', type: 'Water', category: 'Special', basePower: 90, accuracy: 100, pp: 10, priority: 0,
      flags: { protect: 1, mirror: 1, sound: 1, bypasssub: 1 }, target: 'normal',
      secondary: { chance: 100, boosts: { spa: -1 } },
      // The song brings the rain with it.
      onAfterMoveSecondarySelf(this: { field: { setWeather(w: string): boolean } }) { this.field.setWeather('raindance'); }
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
  rotomreactor: {
    key: 'ROTOM_REACTOR', catchRate: 0, baseExp: 250, growth: 'Medium', category: 'Plasma',
    dex: 'A Rotom that dived into the Bifrost Reactor. The copper coils hold it together, and keep it burning.',
    moves: [[1, 'thundershock'], [1, 'metalsound'], [30, 'discharge'], [40, 'flashcannon'], [50, 'heatwave']]
  }
};
