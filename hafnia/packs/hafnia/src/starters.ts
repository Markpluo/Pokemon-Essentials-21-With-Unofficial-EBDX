// The five starters (stand-ins until Mark's own designs) and which ones the rivals take.
import { speciesName, type ScriptApi } from '@hafnia/core';

export const STARTERS = [
  { species: 'sprigatito', blurb: 'Ørsted: "Guards the King\'s Garden hedges. Very serious about naps." Grass type.' },
  { species: 'charmander', blurb: 'Ørsted: "Warm as a Midsummer bonfire. Keep it away from my ferns." Fire type.' },
  { species: 'popplio', blurb: 'Ørsted: "Swims the harbour baths all winter. Thinks it\'s a seal." Water type.' },
  { species: 'eevee', blurb: 'Ørsted: "Changes with the city around it. Nobody knows into what." Normal type.' },
  { species: 'pikachu', blurb: 'Ørsted: "Keeps chewing the Palm House cables. Hums like a transformer." Electric type.' }
];

/** Lukas takes the one with the type advantage; Maja takes one yours beats (or simply likes). */
export const LUKAS_PICK: Record<string, string> = {
  sprigatito: 'charmander', charmander: 'popplio', popplio: 'sprigatito', eevee: 'charmander', pikachu: 'sprigatito'
};
export const MAJA_PICK: Record<string, string> = {
  sprigatito: 'popplio', charmander: 'sprigatito', popplio: 'charmander', eevee: 'sprigatito', pikachu: 'popplio'
};

/** {starter}, {lstarter} and {mstarter} in the string table. */
export function starterVars(flag: (name: string) => any): Record<string, string> {
  const name = (id: unknown) => (typeof id === 'string' && id ? speciesName(id) : 'it');
  return { starter: name(flag('starter')), lstarter: name(flag('lukasStarter')), mstarter: name(flag('majaStarter')) };
}

export const lukasStarter = (s: ScriptApi) => (s.flag('lukasStarter') as string) || 'charmander';
export const majaStarter = (s: ScriptApi) => (s.flag('majaStarter') as string) || 'popplio';
