// The "current goal" line in the start menu: the step after the furthest one done, so an optional
// or skipped step never holds it back. Each entry is [flag that marks the step done, what to do until then].
import type { FlagReader } from '@hafnia/core';

const STEPS: [string, string][] = [
  ['starter', 'Meet Professor Ørsted at the Palm House,\nsouth past the Lakes.'],
  ['majaLeft', 'Listen to Professor Ørsted in the Palm House.'],
  ['beatMaja', 'Maja went to the Lakes. Head north on\nthe Søerne Path.'],
  ['hook', 'It\'s getting dark. Go home to Nørrebro.'],
  ['kaas', 'Step outside into Nørrebro.'],
  ['tunnelQuest', 'Tariq says the Professor rang. Visit\nthe Palm House.'],
  ['swarm', 'Find out what\'s wrong with the heating in the\nSteam Tunnels, through the hatch in the garden.'],
  ['tunnelsDone', 'The heat is back. Tell Professor Ørsted\nin the Palm House.'],
  ['muralQuest', 'Tariq sounded urgent. Find him at the mural\nin Nørrebro.'],
  ['mural', 'Collect four paint colours around Nørrebro\nfor Tariq\'s mural.'],
  ['badge', 'Challenge Tariq at the Superkilen Gym.'],
  ['c1done', 'Head out of the Gym into Nørrebro.'],
  ['c2', 'Explore the city: Indre By is east of the\nBotanical Garden.'],
  ['nyAttack', 'Walk east along Strøget to Nyhavn.'],
  ['copper', 'Follow the Black Fleet: take the harbour bus\nfrom Nyhavn to Refshaleøen.'],
  ['enforcer', 'Cross Knippelsbro, south of Strøget,\nto Christianshavn.'],
  ['scan', 'Look around Christianshavn and the\nFreetown market with Maja.'],
  ['alvaMet', 'Find Alva at Stadsgraven, east of\nChristianshavn.'],
  ['boomsDone', 'Push the three floating booms into line\nfor Alva at Stadsgraven.'],
  ['lily', 'Challenge Alva at her houseboat Gym.'],
  ['demoEnd', 'Maja\'s message: Dronning Louises Bro. Dusk.'],
  ['ch3', 'Kasper\'s food bank needs hands. Take\nDen Grønne Sti west out of Nørrebro.'],
  ['dinnerQuest', 'Find Kasper\'s Kitchen in Kødbyen, south\nof Vesterbro.'],
  ['dinnerDone', 'Bring Kasper mussels and sea buckthorn from\nIslands Brygge, and his salt from his locker.'],
  ['frost', 'Challenge Kasper at the Kødbyen Cold Stores.'],
  ['ch3done', 'Maja\'s message: race her over Cykelslangen.'],
];

export function goal(f: FlagReader): string | null {
  if (!f('mumTalked')) return null;
  let next = STEPS.length;
  while (next > 0 && !f(STEPS[next - 1][0])) next--;
  return next < STEPS.length ? STEPS[next][1] : 'The story continues in Chapter 4: Lanterns Out.';
}
