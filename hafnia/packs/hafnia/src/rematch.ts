// Gym Leader rematches (post-game): once the player is Champion, each Leader takes a rematch once a day with a
// full team in the mid-60s. They pay like any Leader, which gives the post-game a steady income for Ultra Balls.
import type { FoeSpec, ScriptApi } from '@hafnia/core';
import type { Step } from './lib';

interface Rematch { name: string; title?: string; sprite: string; bg: string; hello: string; lose: string; done: string; foes: FoeSpec[] }

const team = (list: [string, number][]): FoeSpec[] =>
  list.map(([species, level], i) => ({ species, level, ...(i === list.length - 1 ? { item: 'sitrusberry' } : {}) }));

const LEADERS: Record<string, Rematch> = {
  tariq: { name: 'Tariq', sprite: 'tariq', bg: 'city', hello: 'Tariq: Champion! The squares got louder since you left.',
    lose: 'Tariq: Still the best colours in Nørrebro. Come back tomorrow.', done: 'Tariq: One round a day. The paint has to dry.',
    foes: team([['toxicroak', 64], ['skuntank', 64], ['overqwil', 65], ['toxapex', 65], ['grafaiai', 66]]) },
  alva: { name: 'Alva', sprite: 'alva', bg: 'field', hello: 'Alva: The lilies are in full bloom. So is my team.',
    lose: 'Alva: You grow faster than anything on my barges.', done: 'Alva: Let the garden rest until tomorrow.',
    foes: team([['sawsbuck', 64], ['shiinotic', 64], ['tropius', 65], ['lilligant', 65], ['venusaur', 66]]) },
  kasper: { name: 'Kasper', sprite: 'kasper', bg: 'indoor1', hello: 'Kasper: Back for a second course? I sharpened the menu.',
    lose: 'Kasper: Fine. FINE. Best service I have had all week.', done: 'Kasper: The kitchen is closed. Come back tomorrow.',
    foes: team([['dewgong', 64], ['cryogonal', 65], ['lapras', 65], ['mrrime', 65], ['ironbundle', 66]]) },
  soren: { name: 'Søren', sprite: 'soren', bg: 'field', hello: 'Søren: The lanterns burn brighter now. Walk with me again?',
    lose: 'Søren: My brother would have liked you.', done: 'Søren: The lanterns rest by day. Tomorrow, then.',
    foes: team([['golurk', 64], ['mismagius', 65], ['dhelmise', 65], ['chandelure', 66], ['fluttermane', 66]]) },
  tycho: { name: 'Tycho', sprite: 'tycho', bg: 'indoor1', hello: 'Tycho: The stars predicted you. Shall we test them?',
    lose: 'Tycho: An eclipse. I should have seen it coming.', done: 'Tycho: The telescope needs a night to cool. Tomorrow.',
    foes: team([['xatu', 65], ['hypno', 65], ['gardevoir', 65], ['espathra', 66], ['starmie', 66]]) },
  pierrot: { name: 'Pierrot', sprite: 'pierrot', bg: 'indoor1', hello: 'Pierrot bows deeply, then points at you. An encore.',
    lose: 'Pierrot claps, slowly, and hands you a card: "Bravo."', done: 'Pierrot shakes his head. One show a day.',
    foes: team([['slurpuff', 65], ['wigglytuff', 65], ['azumarill', 66], ['mimikyu', 66], ['tinkaton', 66]]) },
  margrethe: { name: 'Margrethe', sprite: 'margrethe', bg: 'indoor1', hello: 'Margrethe: The ledger shows an open account between us.',
    lose: 'Margrethe: Balanced. Paid in full.', done: 'Margrethe: One audit a day is the rule.',
    foes: team([['skarmory', 66], ['probopass', 66], ['corviknight', 66], ['copperajah', 67], ['metagross', 67]]) },
  astrid: { name: 'Astrid', sprite: 'astrid', bg: 'indoor1', hello: 'Astrid: The new grid runs on the wind. Let\'s see if you still run on nerve.',
    lose: 'Astrid: Clean output. My daughter says hi, by the way.', done: 'Astrid: The turbines need a day. So do I.',
    foes: team([['zebstrika', 67], ['heliolisk', 67], ['galvantula', 67], ['vikavolt', 68], ['electivire', 68]]) }
};

/** The Champion's rematch with a Gym Leader, once per in-game day. */
// The Elite Four take their rematches at Tivoli's Battle Gardens (tivoli.ts); Nikolai runs Dæmonen's Tower Challenge.
const ELITE: Record<string, Rematch> = {
  valdemar: { name: 'Valdemar', title: 'Elite Four', sprite: 'valdemar', bg: 'indoor1', hello: 'Valdemar: The hall\'s acoustics are excellent. Let us hear\nhow the earth sounds.',
    lose: 'Valdemar: Bravo. I shall applaud standing up.', done: 'Valdemar: One concert a day. The orchestra has unions.',
    foes: team([['hippowdon', 68], ['gigalith', 68], ['rhyperior', 69], ['krookodile', 69], ['mudsdale', 70]]) },
  clara: { name: 'Clara', title: 'Elite Four', sprite: 'clara', bg: 'city', hello: 'Clara: The lake boats are mine for the winter.\nAll aboard for a rematch?',
    lose: 'Clara: Capsized! Lovely. Tomorrow, same pier.', done: 'Clara: The boats are moored for tonight. Tomorrow!',
    foes: team([['pelipper', 68], ['swanna', 68], ['barraskewda', 69], ['lapras', 69], ['kingdra', 70]]) },
  freja: { name: 'Freja', title: 'Elite Four', sprite: 'freja', bg: 'indoor1', hello: 'Freja: Even pirates like the pantomime. Pierrot lets me\nuse the stage after the show.',
    lose: 'Freja: Ha! The crowd liked that. So did I.', done: 'Freja: Curtain\'s down for today, sailor.',
    foes: team([['skuntank', 68], ['dhelmise', 68], ['sharpedo', 69], ['qwilfishhisui', 69], ['dragalge', 70]]) }
};

export function* eliteRematch(s: ScriptApi, key: keyof typeof ELITE): Step {
  const L = ELITE[key], flag = `rematch.${key}`;
  if (s.flag(flag) === s.day) { s.say(L.done); return; }
  s.say(L.hello);
  const c: number = yield s.ask(`${L.name}: A rematch? Full team, no holding back.`, ['Yes', 'Not today'], 1);
  if (c !== 0) return;
  const r = yield s.battle({ kind: 'trainer', leader: true, ai: 3, bg: L.bg, trainer: { name: L.name, title: L.title ?? 'Elite Four', sprite: `tr/${L.sprite}` }, foes: L.foes });
  if (r !== 'win') return;
  s.setFlag(flag, s.day);
  s.say(L.lose);
}

export function* rematch(s: ScriptApi, key: keyof typeof LEADERS): Step {
  const L = LEADERS[key], flag = `rematch.${key}`;
  if (s.flag(flag) === s.day) { s.say(L.done); return; }
  s.say(L.hello);
  const c: number = yield s.ask(key === 'pierrot' ? 'Pierrot holds up five fingers. A rematch?' : `${L.name}: A rematch? Full team, no holding back.`, ['Yes', 'Not today'], 1);
  if (c !== 0) return;
  const r = yield s.battle({ kind: 'trainer', leader: true, ai: 3, bg: L.bg, trainer: { name: L.name, title: 'Leader', sprite: `tr/${L.sprite}` }, foes: L.foes });
  if (r !== 'win') return;
  s.setFlag(flag, s.day);
  s.say(L.lose);
}

export const REMATCH_LEADERS = Object.keys(LEADERS);
