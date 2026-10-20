// The base game, "Copper & Current", as a content pack: the Hafnia prologue from Nørrebro
// to the first badge. Story follows the bible (section 9) as realigned in the POC.
import { speciesName, type BattleOptions, type MapDef, type NpcDef, type Pack, type Script, type ScriptApi } from '@hafnia/core';
import manifest from '../pack.json';
import { MAPS, STAMPS } from './world';

// Starters are stand-ins for Bøgekit, Glødevipper and Sælvik until custom sprites exist.
const STARTERS = [
  { species: 'sprigatito', blurb: 'Stand-in for Bøgekit, the Royal Guard kitten. Grass type.' },
  { species: 'ponyta', blurb: 'Stand-in for Glødevipper, the little Yule-goat stag. Fire type.' },
  { species: 'popplio', blurb: 'Stand-in for Sælvik, the harbour seal pup. Water type.' }
];
const STRONG: Record<string, string> = { sprigatito: 'ponyta', ponyta: 'popplio', popplio: 'sprigatito' }; // Lukas counters you
const WEAK: Record<string, string> = { sprigatito: 'popplio', ponyta: 'sprigatito', popplio: 'ponyta' };   // Maja takes the one yours beats

const NAMES = ['Mark', 'Asta', 'Viggo', 'Ida'];

const talk = (...lines: string[]): Script => function* (s) { for (const l of lines) s.say(l); };

function* findItem(s: ScriptApi, flag: string, item: string, qty: number, label: string) {
  s.setFlag(flag, true);
  s.giveItem(item, qty);
  s.me('me_item');
  s.say(`${s.player.name} found ${qty} ${label}!`);
}

const trainer = (o: {
  flag: string; intro: string[]; win: string[]; after: string[];
  battle: Omit<BattleOptions, 'kind'>;
}): Script => function* (s) {
  if (s.flag(o.flag)) { for (const l of o.after) s.say(l); return; }
  for (const l of o.intro) s.say(l);
  const r = yield s.battle({ kind: 'trainer', ...o.battle });
  if (r === 'win') { s.setFlag(o.flag, true); for (const l of o.win) s.say(l); }
};

// ---------- story scripts ----------

const intro: Script = function* (s) {
  s.say('Welcome to Hafnia, the first city in the world\nrun on 100% clean energy. Or so they say.');
  const i: number = yield s.ask('Before we begin... what is your name?', NAMES);
  s.setName(NAMES[i]);
  s.say(`${s.player.name}! Your adventure starts in Nørrebro.`);
  s.warp('norrebro', 4, 8, 'right');
  s.npc('mum').face('left');
  s.say(`Mum: Morning, ${s.player.name}! I'm off to my night shift\nat Rigshospitalet. Long one tonight.`);
  s.say('Mum: Lukas and Maja are already outside. Today\'s\nthe day Professor Ørsted hands out Pokémon!');
  s.say('Mum: The Palm House is south, past the Lakes.\nDon\'t forget a jacket. Love you!');
  s.setFlag('mumLeft', true);
  s.npc('mum').hide();
};

const pickStarter: Script = function* (s) {
  let sp = '';
  for (;;) {
    const i: number = yield s.pickSpecies(STARTERS);
    sp = STARTERS[i].species;
    s.cry(sp);
    const c: number = yield s.ask(`Choose ${speciesName(sp)}?`, ['Yes', 'No'], 1);
    if (c === 0) break;
  }
  s.givePokemon(sp, 5);
  s.setFlag('starter', sp);
  s.me('me_get');
  s.say(`${s.player.name} received ${speciesName(sp)}!`);
  s.giveItem('pokeball', 5); s.giveItem('potion', 2);
  s.say('Professor Ørsted: Take these too: 5 Poké Balls\nand 2 Potions. And mind the Rotom Pokédex, it bites.');
  const lsp = STRONG[sp], msp = WEAK[sp];
  s.setFlag('lukasStarter', lsp); s.setFlag('majaStarter', msp);
  const lukas = s.npc('lukas3');
  lukas.facePlayer(); s.player.faceTo(lukas.x, lukas.y);
  s.say(`Lukas: Then I'll take ${speciesName(lsp)}!\nIt has the type advantage. Simple maths.`);
  s.say(`Maja: I'll take ${speciesName(msp)}. Type charts aren't\neverything, Lukas. It looked at me first.`);
  s.say(`Lukas: Come on, ${s.player.name}! First battle, right here!`);
  const r = yield s.battle({ kind: 'trainer', trainer: { name: 'Lukas', title: 'Rival', sprite: 'tr/lukas' },
    foes: [{ species: lsp, level: 5 }], bg: 'field', soft: true });
  if (r === 'win') s.say('Lukas: Huh. I ran the numbers and everything.\nNext time the maths will work.');
  else s.say('Lukas: The numbers don\'t lie! Don\'t feel bad,\nyou\'ll catch up. Probably.');
  s.heal();
  s.say('Professor Ørsted: Marvellous! I patched everyone up.\nTariq runs the gym at Superkilen, back in Nørrebro.');
  s.say('Lukas: I\'m off to the Vanguard info centre.\nSee you around, champ!');
  s.say('Maja: And I\'ll catch you on the path home.\nDon\'t think you\'re getting off easy!');
  s.setFlag('beatLukas', true);
  s.checkpoint();
};

const profTalk: Script = function* (s) {
  if (!s.flag('starter')) {
    s.say('Professor Ørsted: Ah, the three of you made it!\nWelcome to the Palm House.');
    s.say('Professor Ørsted: I study Bio-Resonance: how Pokémon\nand a city can hum in harmony. Like a song.');
    yield* pickStarter(s);
    return;
  }
  s.heal(); s.me('me_heal');
  if (!s.flag('badge')) s.say('Professor Ørsted: Your team looks rested now.\nTariq\'s gym is at Superkilen, back in Nørrebro.');
  else s.say('Professor Ørsted: A badge already! Splendid.\nThose harbour readings still worry me...');
};

const majaBattle: Script = function* (s) {
  s.say(`Maja: There you are, ${s.player.name}! Lukas thinks battles\nare maths. Let me show you they're stories.`);
  const r = yield s.battle({ kind: 'trainer', trainer: { name: 'Maja', title: 'Rival', sprite: 'tr/maja' },
    foes: [{ species: 'pidgey', level: 4 }, { species: s.flag('majaStarter') || 'popplio', level: 6 }], bg: 'field', soft: true });
  s.setFlag('beatMaja', true);
  if (r === 'win') s.say('Maja: Okay, that goes on the front page.\n"Local kid beats zine editor."');
  else s.say('Maja: Ha! Front page: "Zine editor wins."\nGo heal up, you\'ve earned it.');
  s.say('Maja: Superkilen is where Tariq skates.\nWatch out, his Pokémon are toxic. Literally.');
  s.npc('maja2').hide();
  s.checkpoint();
};

const gymTalk: Script = function* (s) {
  if (s.flag('badge')) { s.say('Tariq: Keep the streets loud and the squares\nfor the people. See you on the mural.'); return; }
  if (!s.flag('starter')) { s.say('Tariq: No Pokémon, no battle, little bro.\nThe Professor\'s handing them out today.'); return; }
  if (!s.flag('beatSkater')) { s.say('Tariq: Noor is guarding the gym door today.\nGet past Noor first, then we talk.'); return; }
  s.say('Tariq: Welcome to Superkilen. I\'m Tariq.\nThis square belongs to the neighbourhood.');
  s.say('Tariq: Vanguard wants to "upgrade" it.\nMy Poison-types disagree.');
  if (!s.partyAlive()) { s.say('Tariq: Your team needs a rest first.\nThe Pokémon Center is up the street.'); return; }
  const c: number = yield s.ask('Tariq: Ready to roll?', ['Yes', 'Not yet'], 1);
  if (c !== 0) { s.say('Tariq: Train in the Lakes\' tall grass first.\nI\'ll be here.'); return; }
  const r = yield s.battle({ kind: 'trainer', leader: true, trainer: { name: 'Tariq', title: 'Leader', sprite: 'tr/tariq' },
    foes: [{ species: 'toxel', level: 9 }, { species: 'trubbish', level: 10 }, { species: 'shroodle', level: 11 }], bg: 'city' });
  if (r !== 'win') return;
  s.setFlag('badge', true);
  s.say('Tariq: Respect. You fight like you belong here.\nThis is the Spray Badge.');
  s.me('me_badge');
  s.say(`${s.player.name} received the Spray Badge!`);
  s.say('...Bzzt! The Rotom Pokédex rings.');
  s.say('Professor Ørsted: Congratulations on your badge!\nBut... the harbour water readings are wrong.');
  s.say('Professor Ørsted: Colder every hour, near Langelinie.\nI\'d best look at my data again.');
  // Freja's tease
  const fr = s.npc('freja');
  const [x, y] = s.freeSpotNear(s.player.x, s.player.y);
  fr.place(x, y, 'down'); fr.show(); fr.facePlayer();
  s.player.faceTo(x, y); s.sfx('exclaim');
  s.say('Woman in a yellow-and-black oilskin: Nice badge.\nEnjoy the lights while they\'re on.');
  s.say('Woman: The water at Langelinie is freezing.\nIn June. Ask yourself why.');
  s.say('Woman: Name\'s Freja. You\'ll be hearing from\nthe Black Fleet.');
  fr.hide();
  s.checkpoint();
  s.chapterEnd('Copper & Current', 'Prologue complete');
};

const pokemonCenter: Script = function* (s) {
  s.say('Nurse: Welcome to the Pokémon Center!\nLet me heal your Pokémon.');
  s.heal(); s.me('me_heal');
  s.setRespawn('norrebro', 22, 8, 'down', 'Nurse: Your team is rested. Be careful out there!');
  s.say('Nurse: Your Pokémon are fighting fit!\nI saved your progress, too.');
  s.checkpoint();
};

// ---------- NPCs ----------

const NPCS: Record<keyof typeof MAPS, NpcDef[]> = {
  norrebro: [
    { id: 'mum', sprite: 'chars/mum', x: 5, y: 8, dir: 'left', when: f => !f('mumLeft'),
      talk: talk('Mum: Off to the night shift at Rigshospitalet.\nThere are cardamom buns in the bag.') },
    { id: 'lukas', sprite: 'chars/lukas', x: 8, y: 9, dir: 'up', when: f => !f('starter'),
      talk: talk('Lukas: Professor Ørsted is giving out Pokémon today!\nPalm House, Botanical Garden. South past the Lakes.',
        'Lukas: Vanguard says Hafnia is the first city\nrunning on 100% clean energy. I want to work there.') },
    { id: 'maja', sprite: 'chars/maja', x: 9, y: 9, dir: 'up', when: f => !f('starter'),
      talk: talk('Maja: "100% clean." Sure. Nobody asks where\nthe power actually comes from.',
        'Maja: I\'m putting it in my zine. Now go,\nbefore Lukas grabs the best Pokémon.') },
    { id: 'baker', sprite: 'chars/oldman', x: 11, y: 9, dir: 'down',
      talk: talk('Baker: Fresh cardamom buns! Sankt Hans Torv\'s finest.\nOn the house for my favourite neighbour.') },
    { id: 'tourist', sprite: 'chars/kid', x: 25, y: 10, dir: 'left',
      talk: talk('Tourist: We saw the statue at Langelinie today.\nIt\'s so... tiny! Everyone says that.',
        'Tourist: The water there was strangely cold, too.\nIn June!') },
    { id: 'skater', sprite: 'chars/skater', x: 19, y: 14, dir: 'right', trainer: { sight: 1, flag: 'beatSkater' }, when: f => !!f('starter'),
      talk: trainer({
        flag: 'beatSkater',
        intro: ['Skater Noor: This is Superkilen, the Red Square.\nYou want Tariq? Get past me first!'],
        win: ['Skater Noor: Bailed hard. Respect.'],
        after: ['Skater Noor: Tariq painted that whole mural.\nHe\'ll smoke you. Respectfully.'],
        battle: { trainer: { name: 'Noor', title: 'Skater', sprite: 'tr/skater' }, foes: [{ species: 'grimer', level: 7 }, { species: 'trubbish', level: 8 }], bg: 'city' }
      }) },
    { id: 'tariq', sprite: 'chars/tariq', x: 21, y: 14, dir: 'down', talk: gymTalk },
    { id: 'freja', sprite: 'chars/freja', x: 0, y: 0, dir: 'down', hidden: true }
  ],
  route1: [
    { id: 'jogger', sprite: 'chars/kid', x: 12, y: 6, dir: 'left',
      talk: talk('Jogger: Tall grass means wild Pokémon!\nWeaken them first, then throw a Poké Ball.',
        'Jogger: Going for Tariq\'s badge? Poison hates Psychic\nmoves. The Psyduck here learn Confusion.') },
    { id: 'mads', sprite: 'chars/biker', x: 10, y: 19, dir: 'down', trainer: { sight: 5, flag: 'beatMads' }, when: f => !!f('starter'),
      talk: trainer({
        flag: 'beatMads',
        intro: ['Cyclist Mads: Hey! You\'re walking in the bike lane!\nThat calls for a battle!'],
        win: ['Mads: Okay, okay. You can use the lane.\nJust ring your bell next time.'],
        after: ['Mads: Remember: stay in the bike lane,\nand always signal before you stop!'],
        battle: { trainer: { name: 'Mads', title: 'Cyclist', sprite: 'tr/biker' }, foes: [{ species: 'lillipup', level: 6 }, { species: 'pidgey', level: 6 }], bg: 'field' }
      }) },
    { id: 'maja2', sprite: 'chars/maja', x: 12, y: 27, dir: 'left', trainer: { sight: 3, flag: 'beatMaja' },
      when: f => !!f('beatLukas') && !f('beatMaja'), talk: majaBattle },
    { id: 'deckhand', sprite: 'chars/deckhand', x: 8, y: 14, dir: 'left',
      talk: talk('Oilskin sailor: ...What? I\'m just looking at the lake.\nNot at those Vanguard sensor buoys. No.',
        'Oilskin sailor: You didn\'t see a yellow-and-black coat.\nGot it, kid?') },
    { id: 'item1', sprite: 'chars/ball', x: 16, y: 12, dir: 'down', object: true, when: f => !f('item1'),
      talk: s => findItem(s, 'item1', 'potion', 2, 'Potions') },
    { id: 'item2', sprite: 'chars/ball', x: 3, y: 26, dir: 'down', object: true, when: f => !f('item2'),
      talk: s => findItem(s, 'item2', 'pokeball', 3, 'Poké Balls') }
  ],
  garden: [
    { id: 'prof', sprite: 'chars/prof', x: 13, y: 11, dir: 'down', talk: profTalk },
    { id: 'lukas3', sprite: 'chars/lukas', x: 15, y: 11, dir: 'left', when: f => !f('beatLukas'),
      talk: talk('Lukas: Took you long enough!\nTalk to the Professor, I\'m dying to choose.') },
    { id: 'maja3', sprite: 'chars/maja', x: 16, y: 11, dir: 'left', when: f => !f('starter'),
      talk: talk('Maja: This greenhouse is from 1874.\nPrettiest building in the city. Don\'t tell Lukas.') },
    { id: 'gardener', sprite: 'chars/sailor', x: 22, y: 7, dir: 'down',
      talk: talk('Gardener: Lotad love the lakes up north.\nThe Palm House is far too warm for them.') },
    { id: 'item3', sprite: 'chars/ball', x: 24, y: 17, dir: 'down', object: true, when: f => !f('item3'),
      talk: s => findItem(s, 'item3', 'potion', 2, 'Potions') }
  ]
};

const DOORS: Record<keyof typeof MAPS, Record<string, Script>> = {
  norrebro: {
    home: talk('Your fourth-floor walk-up. Mum\'s bike is gone,\nso she\'s already at the hospital.'),
    lukas: talk('Lukas\'s flat. A Vanguard poster is taped\nto the door: "Powering Tomorrow, Today."'),
    pc: pokemonCenter,
    gym: gymTalk
  },
  route1: {},
  garden: {
    palm: talk('The Palm House. Tropical air drifts out.\nProfessor Ørsted is waiting outside.')
  }
};

const maps: Record<string, MapDef> = {};
for (const [id, m] of Object.entries(MAPS) as [keyof typeof MAPS, (typeof MAPS)[keyof typeof MAPS]][]) {
  maps[id] = { ...m, npcs: NPCS[id], doors: DOORS[id] };
}

export const hafnia: Pack = {
  manifest,
  maps,
  stamps: STAMPS,
  newGame: {
    map: 'norrebro', x: 4, y: 8, dir: 'down', intro,
    respawn: { map: 'norrebro', x: 22, y: 8, dir: 'down', text: 'Nurse: Your team is rested. Be careful out there!' }
  }
};

export default hafnia;
