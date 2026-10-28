// Small side quests from the story bible that live on maps from other chapters: Gækkebrev (the snowdrop riddle
// letters, Christianshavn), the Winter Bathers' Relay (Islands Brygge's harbour baths) and Ørsted's Hatchery Log
// (the Palm House). index.ts adds the NPCs to their maps.
import type { NpcDef, Script } from '@hafnia/core';
import { TR, sign } from './lib';

// ---------- Gækkebrev: guess who sent each snowdrop letter ----------
// A gækkebrev is signed with one dot per letter of the sender's name. Ella has eight and no idea who sent them.

const LETTERS: { verse: string; options: string[]; right: number }[] = [
  { verse: 'I paint the walls where the skaters roll,\nand keep the squares loud, that\'s my goal.', options: ['Tariq', 'Kasper', 'Lukas'], right: 0 },
  { verse: 'My kitchen is cold, my herring is fine,\nin Kødbyen I\'ll cook for you any time.', options: ['Knud', 'Kasper', 'Ørsted'], right: 1 },
  { verse: 'Among the palms I count every seed,\nand give new trainers the partner they need.', options: ['Maja', 'Lene', 'Ørsted'], right: 2 },
  { verse: 'My zine is folded, my camera small,\nI photograph courtyards, one and all.', options: ['Maja', 'Freja', 'Lene'], right: 0 },
  { verse: 'I\'ll beat you next time, just wait and see,\nmy starter is stronger. And so is me.', options: ['Tariq', 'Lukas', 'Freja'], right: 1 },
  { verse: 'I patch up Pokémon all through the night,\nand leave your dinner warm and right.', options: ['Lene', 'Maja', 'Knud'], right: 0 },
  { verse: 'A black-sailed ship, a lighthouse cold,\nI take back what Vanguard took, I\'m told.', options: ['Ørsted', 'Kasper', 'Freja'], right: 2 },
  { verse: 'Sixty years I\'ve fished this sound;\nthe herring went, but I\'m still around.', options: ['Knud', 'Lukas', 'Tariq'], right: 0 }
];

const ella: Script = function* (s) {
  if (s.flag('gaekDone')) { s.say('Ella: Eight letters, eight senders! I owe everyone\nan Easter egg now. A chocolate one. Probably.'); return; }
  let n = (s.flag('gaek') as number | undefined) ?? 0;
  if (n === 0) {
    s.say('Ella: Snowdrop letters! Gækkebreve! Someone sends me one\nevery spring, and I never guess who.');
    s.say('Ella: The sender signs with dots, one for each letter of\ntheir name. Help me guess? If I\'m wrong, I owe THEM an egg.');
  }
  const c: number = yield s.ask(`Ella: Read letter ${n + 1} of ${LETTERS.length}?`, ['Read it', 'Later'], 1);
  if (c !== 0) return;
  while (n < LETTERS.length) {
    const l = LETTERS[n];
    const name = l.options[l.right];
    s.say(`"${l.verse}"\nSigned: ${'. '.repeat([...name].length).trim()}`);
    const pick: number = yield s.ask('Who sent it?', l.options);
    if (pick !== l.right) {
      s.say(`Ella: ${l.options[pick]}? That doesn't fit the dots...\nLet's think about it and try again later.`);
      return;
    }
    n++;
    s.setFlag('gaek', n);
    s.say(n < LETTERS.length ? `Ella: ${name}! Of course! (${n} of ${LETTERS.length})` : `Ella: ${name}! That's all of them!`);
  }
  s.setFlag('gaekDone', true);
  s.say('Ella: You win, so you get the egg. That\'s the rule.\nMum found it in the snowdrops. It wasn\'t chocolate.');
  s.giveEgg('togepi', { perfectIvs: 2 }); s.me('me_get');
  s.say(`${s.player.name} received an Egg!`);
  s.checkpoint();
};

// ---------- The Winter Bathers' Relay: three baths, three bathers, no healing ----------

const RELAY: { name: string; bath: string; foes: { species: string; level: number }[] }[] = [
  { name: 'Grete', bath: 'Islands Brygge', foes: [{ species: 'spheal', level: 22 }, { species: 'finizen', level: 23 }] },
  { name: 'Ove', bath: 'Fisketorvet', foes: [{ species: 'shellos', level: 23 }, { species: 'buizel', level: 23 }] },
  { name: 'Birgitte', bath: 'Sluseholmen', foes: [{ species: 'tentacool', level: 23 }, { species: 'pelipper', level: 24 }, { species: 'floatzel', level: 24 }] }
];

const lifeguard: Script = function* (s) {
  if (s.flag('relayDone')) { s.say('Lifeguard: Relay champion of all three baths! Your picture\'s\ngoing up in the changing rooms. Next to the lost socks.'); return; }
  s.say('c3.ib.guard');
  if (!s.flag('tr.ibswim1') || !s.flag('tr.ibswim2')) { s.say('c3.ib.guard.2'); return; }
  s.say('Lifeguard: You beat Lone AND Torben? Then the winter bathers\nwant you in their relay: here, Fisketorvet and Sluseholmen.');
  s.say('Lifeguard: Three champions, one after the other.\nNo healing between baths. Cold water rules.');
  const c: number = yield s.ask('Swim the Winter Bathers\' Relay?', ['Yes', 'Not now'], 1);
  if (c !== 0) return;
  for (const r of RELAY) {
    s.say(`Lifeguard: ${r.bath} bath! Winter bather ${r.name}, in the water!`);
    const res = yield s.battle({ kind: 'trainer', soft: true, trainer: { name: r.name, title: 'Swimmer', sprite: TR.Swimmer }, foes: r.foes });
    if (res !== 'win') { s.heal(); s.say('Lifeguard: Out of the water, warm up, try again.\nNobody wins the relay the first winter.'); return; }
  }
  s.setFlag('relayDone', true);
  s.say('Lifeguard: All three baths! Here: the relay prize.\nThe bathers swear by it.');
  s.giveItem('tmscald'); s.giveItem('expcandym', 2); s.me('me_item');
  s.say(`${s.player.name} got TM Scald and 2 Exp. Candy M!`);
  s.checkpoint();
};

// ---------- Ørsted's Hatchery Log: rewards for eggs hatched ----------

const HATCH_POOL = ['eevee', 'togepi', 'phanpy', 'fidough', 'pikachu', 'charmander', 'popplio', 'sprigatito'];

const hatcheryLog: Script = function* (s) {
  const n = s.hatched();
  s.say(`ØRSTED'S HATCHERY LOG. In his tidy hand: "Eggs hatched by\n${s.player.name}: ${n}."`);
  if (n >= 10 && !s.flag('hatch10')) {
    s.setFlag('hatch10', true);
    s.say('A note is tucked in at ten: "Well done! For the next ten.\nØ."'); s.giveItem('expcandyl', 3); s.me('me_item');
    s.say(`${s.player.name} got 3 Exp. Candy L!`);
  }
  if (n >= 25 && !s.flag('hatch25')) {
    s.setFlag('hatch25', true);
    s.say('At twenty-five: "A Destiny Knot from my own breeding days.\nThe daycare will know what to do with it. Ø."');
    s.giveItem('destinyknot'); s.giveItem('expcandyl', 2); s.me('me_item');
    s.say(`${s.player.name} got a Destiny Knot and 2 Exp. Candy L!`);
  }
  if (n >= 50) {
    if (s.flag('hatchDay') === s.day) { s.say('"Tomorrow\'s egg is still warming. Ø."'); return; }
    s.setFlag('hatchDay', s.day);
    const sp = HATCH_POOL[(s.day + n) % HATCH_POOL.length];
    s.say('At fifty: "You out-breed me. Take one of mine each day,\nthe best of the clutch. Ø."');
    s.giveEgg(sp, { perfectIvs: 3, hiddenAbility: true }); s.me('me_get');
    s.say(`${s.player.name} received an Egg!`);
    return;
  }
  if (n < 10) s.say(`"Ten eggs and I'll leave something here. ${10 - n} to go."`);
  else if (n < 25) s.say(`"At twenty-five, something for the daycare. ${25 - n} to go."`);
  else s.say(`"At fifty, something every day. ${50 - n} to go."`);
};

/** NPCs by map; index.ts appends them, replacing a map NPC with the same id (the lifeguard). */
export const SIDE_NPCS: Record<string, NpcDef[]> = {
  christianshavn: [{ id: 'ella', sprite: 'chars/kid', x: 7, y: 11, dir: 'down', talk: ella }],
  islandsbrygge: [{ id: 'lifeguard', sprite: 'chars/lifeguard', x: 11, y: 4, dir: 'left', talk: lifeguard }],
  palmhouse: [{ ...sign('hatchlog', 15, 7, 'obj:lectern', ''), talk: hatcheryLog, when: f => !!f('ch5') }]
};
