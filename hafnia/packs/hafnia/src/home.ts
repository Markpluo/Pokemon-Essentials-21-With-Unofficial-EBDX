// Nørrebro and its buildings: the intro, Mum's flat, the courtyard, Superkilen, the mural quest,
// Gym 1 (Tariq), Lukas after the badge and the Chapter 1 blackout.
import type { NpcDef, Script, ScriptApi } from '@hafnia/core';
import { grown, itemBall, sign, talk, trainer, type MapScripts, type Step } from './lib';
import { rematch } from './rematch';
import { lukasStarter } from './starters';

export const NAMES = ['Mark', 'Asta', 'Viggo', 'Ida', 'Noor', 'Frej'];
export const MART_STOCK = ['potion', 'superpotion', 'antidote', 'paralyzeheal', 'awakening', 'burnheal', 'fullheal', 'revive', 'pokeball', 'greatball', 'netball', 'repel', 'hyperpotion', 'ultraball'];

// ---------- intro and the flat (P1, P9) ----------

export const intro: Script = function* (s) {
  s.say('intro.1');
  const name: string = yield s.askName('intro.2', NAMES);
  s.setName(name);
  const look = yield s.pickLook('intro.look');
  s.setLook(look);
  s.say('intro.3');
  s.fade(0, 20);
  s.say('p.bed.note');
  s.setFlag('note', true);
  const mum = s.npc('mum');
  mum.walk('right', 3, 14);
  mum.facePlayer(); s.player.faceTo(mum.x, mum.y);
  s.say('p.mum.1'); s.say('p.mum.2'); s.say('p.mum.3');
  s.setFlag('mumTalked', true);
  s.checkpoint();
};

const mumTalk: Script = function* (s) {
  if (!s.flag('starter')) { s.say('p.mum.3'); return; }
  if (s.flag('c1done') && !s.flag('lily')) s.say('Mum: The lights are back on. For now.\nBe careful by the harbour, love.');
  s.say('p.mum.heal');
  s.heal(); s.me('me_heal');
  s.setRespawn('flat', 6, 4, 'up', 'Mum: There you are. Let me look at your team...\nThere. Right as rain.');
};

const bed: Script = function* (s) {
  if (!s.flag('note')) { s.setFlag('note', true); s.say('p.bed.note'); return; }
  const c: number = yield s.ask('Your bed. Have a rest?', ['Sleep until morning', 'Sleep until night', 'Not now'], 2);
  if (c === 2) return;
  s.fade(1, 20);
  s.heal();
  s.setTime(c === 0 ? 'morning' : 'night');
  s.fade(0, 20);
  s.me('me_heal');
  s.say(c === 0 ? 'You slept until morning. Your team is rested.' : 'You napped until nightfall. Your team is rested.');
};

const jensen: Script = function* (s) {
  if (!s.flag('ch1')) { s.say('p.stair.jensen.1'); s.say('p.stair.jensen.2'); return; }
  if (!s.hasItem('oranberry')) { s.say('p.stair.jensen.daily'); s.giveItem('oranberry'); s.me('me_item'); s.say(`${s.player.name} got an Oran Berry!`); return; }
  s.say('p.stair.jensen.2');
};

// P9: back home after Maja, the evening news and the Mermaid gag.
const flatEnter: Script = function* (s) {
  if (!s.flag('beatMaja') || s.flag('hook')) return;
  s.setFlag('hook', true);
  s.setTime('evening');
  s.say('p.news.1'); s.say('p.news.2'); s.say('p.news.tourist');
  s.say('p.mum.night');
  s.fade(1, 30);
  s.heal();
  s.setTime('morning');
  s.setFlag('ch1', true);
  s.fade(0, 30);
  s.checkpoint();
  s.chapterEnd('Chapter 1', 'The Red Streak');
};

// ---------- Nørrebro ----------

// P2: Lukas and Maja in the courtyard the first time you step outside.
function* courtyard(s: ScriptApi): Step {
  const lukas = s.npc('lukas'), maja = s.npc('maja');
  s.player.faceTo(lukas.x, lukas.y);
  s.say('p.yard.lukas.1'); s.say('p.yard.maja.1'); s.say('p.yard.lukas.2'); s.say('p.yard.maja.2');
  lukas.walk('right', 4, 8, true); maja.walk('right', 3, 8);
  lukas.walk('down', 6, 8, true); maja.walk('down', 6, 8);
  lukas.hide(); maja.hide();
  s.setFlag('yard', true);
}

// 1.5 and 1.6: Lukas waits outside the gym after the badge, then the relay goes up and the lights go out.
function* lukasAndBlackout(s: ScriptApi): Step {
  const l = s.npc('lukas2');
  const [x, y] = s.freeSpotNear(s.player.x, s.player.y);
  l.place(x, y, 'up'); l.show(); l.facePlayer(); s.player.faceTo(x, y);
  s.say('c1.lukas.1'); s.say('c1.lukas.2'); s.say('c1.lukas.3');
  const ls = lukasStarter(s);
  const r = yield s.battle({ kind: 'trainer', trainer: { name: 'Lukas', title: 'Rival', sprite: 'tr/lukas' }, bg: 'city', ai: 2,
    foes: [{ species: 'magnemite', level: 11, moves: ['thundershock', 'supersonic', 'thunderwave'] }, { species: grown(ls, 13), level: 13 }] });
  if (r !== 'win') { l.hide(); return; }
  s.say('c1.lukas.lose');
  l.hide();
  s.setFlag('lukas1', true);
  s.fade(1, 30);
  s.setTime('evening');
  s.fade(0, 30);
  s.say('c1.relay'); s.say('c1.tariq.relay');
  s.sfx('select');
  s.fade(0.85, 10);
  s.say('c1.blackout'); s.say('c1.roof');
  s.warp('flat', 6, 4, 'up');
  s.fade(0, 20);
  s.say('c1.mum.dark');
  s.setTime('night');
  s.setFlag('c1done', true);
  s.checkpoint();
  s.chapterEnd('Chapter 1 complete', 'The Red Streak');
}

const norrebroEnter: Script = function* (s) {
  if (s.flag('mumTalked') && !s.flag('yard')) yield* courtyard(s);
  else if (s.flag('badge') && !s.flag('lukas1')) yield* lukasAndBlackout(s);
};

// 1.1: Tariq at the mural and Commander Kaas's ultimatum.
const kaasScene: Script = function* (s) {
  s.setFlag('kaas', true);
  s.say('c1.kilen.sign');
  const t = s.npc('tariq');
  s.player.faceTo(t.x, t.y); t.facePlayer();
  s.say('c1.tariq.1');
  const k = s.npc('kaas'), e1 = s.npc('enf1'), e2 = s.npc('enf2');
  k.show(); e1.show(); e2.show();
  k.walk('left', 1, 12); t.face('right');
  s.say('c1.kaas.1'); s.say('c1.tariq.2'); s.say('c1.kaas.2');
  k.walk('right', 3, 10, true); e1.walk('right', 3, 10, true); e2.walk('right', 3, 10);
  k.hide(); e1.hide(); e2.hide();
  t.facePlayer();
  s.say('c1.tariq.3'); s.say('c1.tariq.4');
  s.checkpoint();
};

const PAINTS = ['paintGreen', 'paintGold', 'paintSilver', 'paintPurple'];

const tariqTalk: Script = function* (s) {
  if (!s.flag('ch1')) { s.say('Tariq: Careful, wet paint! This is the Sound.\nOur mural. Come back when it\'s finished.'); return; }
  if (!s.flag('tunnelsDone')) { s.say('c1.tariq.4'); return; }
  if (!s.flag('muralQuest')) { s.setFlag('muralQuest', true); s.say('c1.mural.tariq'); return; }
  const have = PAINTS.filter(p => s.flag(p)).length;
  if (have < 4) { s.say(`Tariq: ${have} of 4 colours so far. Green, gold, silver,\npurple. Ask around Nørrebro.`); return; }
  s.say('c1.mural.done.1'); s.say('c1.mural.done.2'); s.say('c1.mural.done.3');
  s.setFlag('mural', true);
  s.npc('tariq').hide();
  s.checkpoint();
};

const paintGiver = (flag: string, line: string, label: string): Script => function* (s) {
  if (!s.flag('muralQuest')) { s.say('Nice day for it. Tariq\'s mural is coming along.'); return; }
  if (s.flag(flag)) { s.say('Go on, Tariq\'s waiting for that paint.'); return; }
  s.say(line);
  s.setFlag(flag, true); s.me('me_item');
  s.say(`${s.player.name} got the ${label}!`);
};

function* yusufGold(s: ScriptApi): Step {
  if (!s.flag('muralQuest') || s.flag('paintGold')) return;
  s.say('c1.paint.gold'); s.setFlag('paintGold', true); s.me('me_item'); s.say(`${s.player.name} got the gold paint!`);
}

const toxel: Script = function* (s) {
  if (s.flag('paintPurple')) { s.cry('toxel'); s.say('Toxel: Toxi! (It looks happy with its berry.)'); return; }
  s.cry('toxel');
  if (!s.flag('muralQuest') || !s.hasItem('oranberry')) {
    s.say('A Toxel is chewing on a purple paint can.\nIt won\'t let go. Maybe it\'s hungry?');
    if (s.flag('muralQuest')) s.say('(Fru Jensen in your stairwell often has berries.)');
    return;
  }
  const c: number = yield s.ask('A Toxel is chewing on a purple paint can.\nOffer it an Oran Berry?', ['Yes', 'No'], 1);
  if (c !== 0) return;
  s.takeItem('oranberry');
  s.say('c1.paint.purple');
  s.setFlag('paintPurple', true); s.me('me_item');
  s.say(`${s.player.name} got the purple paint!`);
};

const gymDoor: Script = function* (s) {
  if (!s.flag('mural')) { s.say('c1.gym.sign'); s.say(s.flag('ch1') ? 'The doors are locked. Tariq is busy with the mural.' : 'The doors are locked.'); return; }
  s.warp('gym1', 7, 11, 'up');
};

const NORREBRO_NPCS: NpcDef[] = [
  { id: 'lukas', sprite: 'chars/lukas', x: 8, y: 9, dir: 'up', when: f => !f('yard'), talk: talk('p.yard.lukas.2') },
  { id: 'maja', sprite: 'chars/maja', x: 9, y: 9, dir: 'up', when: f => !f('yard'), talk: talk('p.yard.maja.2') },
  { id: 'lukas2', sprite: 'chars/lukas', x: 0, y: 0, dir: 'down', hidden: true },
  { id: 'baker', sprite: 'chars/oldman', x: 11, y: 9, dir: 'down',
    talk: talk('Baker: Cardamom buns, fresh from Sankt Hans Torv!\nOn the house for my favourite neighbour.') },
  { id: 'tourist', sprite: 'chars/kid', x: 25, y: 13, dir: 'left',
    talk: talk('Tourist: We saw the statue at Langelinie today.\nThe Mermaid is so tiny! Everyone says that.') },
  { id: 'tariq', sprite: 'chars/tariq', x: 6, y: 13, dir: 'up', when: f => !f('mural'), talk: tariqTalk },
  { id: 'kaas', sprite: 'chars/kaas', x: 9, y: 13, dir: 'left', hidden: true },
  { id: 'enf1', sprite: 'chars/enforcer', x: 10, y: 13, dir: 'left', hidden: true },
  { id: 'enf2', sprite: 'chars/enforcer', x: 11, y: 13, dir: 'left', hidden: true },
  { id: 'muralfx', sprite: 'obj:muralcreature', x: 5, y: 11, dir: 'down', object: true, when: f => !!f('mural'),
    talk: talk('c1.mural.done.2') },
  { id: 'gardenerg', sprite: 'chars/gardener', x: 3, y: 9, dir: 'down', when: f => !!f('ch1'),
    talk: paintGiver('paintGreen', 'c1.paint.green', 'hedge-green paint') },
  { id: 'courier', sprite: 'chars/courier', x: 16, y: 9, dir: 'down', when: f => !!f('ch1'),
    talk: paintGiver('paintSilver', 'c1.paint.silver', 'silver paint') },
  { id: 'toxel', sprite: 'chars/toxel', x: 25, y: 6, dir: 'left', object: true, when: f => !!f('ch1'), talk: toxel },
  trainer({ id: 'yusuf', x: 18, y: 14, dir: 'right', sprite: 'chars/skater', sight: 2, cls: 'Skater', name: 'Yusuf',
    when: f => !!f('starter'), foes: [{ species: 'stunky', level: 7 }],
    intro: ['Skater Yusuf: Red Square\'s ours. You skate or you sit.'], lose: ['Yusuf: Sat down. Hard.'],
    after: ['Yusuf: Tariq painted half of Superkilen.\nThe other half was us. Mostly the floor.'],
    // Beaten before Tariq asked for paint? He hands it over when you talk to him again.
    reward: yusufGold, again: yusufGold }),
  trainer({ id: 'laura', x: 20, y: 17, dir: 'up', sprite: 'chars/painter', sight: 3, cls: 'Muralist', name: 'Laura',
    when: f => !!f('starter'), foes: [{ species: 'smeargle', level: 8 }],
    intro: ['Muralist Laura: Smeargle and I sign every wall\nwe paint. Want to be on one?'], lose: ['Laura: Okay, you can sign this one.'] }),
  trainer({ id: 'jonas', x: 16, y: 11, dir: 'up', sprite: 'chars/biker', sight: 3, cls: 'Cyclist', name: 'Jonas',
    when: f => !!f('starter'), foes: [{ species: 'starly', level: 8 }, { species: 'pidgey', level: 9 }],
    intro: ['Cyclist Jonas: Nørrebrogade has more bikes\nthan cars. And more battles than both!'], lose: ['Jonas: Flat tyre. Flat everything.'] }),
  trainer({ id: 'kim', x: 24, y: 8, dir: 'left', sprite: 'chars/rocker', sight: 3, cls: 'Raver', name: 'Kim', period: ['night'],
    when: f => !!f('starter'), foes: [{ species: 'pawmi', level: 9 }],
    intro: ['Raver Kim: The party\'s in a courtyard somewhere.\nI forgot which one. Battle me while I think!'], lose: ['Kim: That bass drop was you, wasn\'t it.'] }),
  trainer({ id: 'asta', x: 13, y: 18, dir: 'left', sprite: 'chars/channeler', sight: 1, cls: 'Ghost Hunter', name: 'Asta', period: ['night'],
    when: f => !!f('starter'), foes: [{ species: 'greavard', level: 9 }],
    intro: ['Ghost Hunter Asta: Assistens Cemetery is that way.\nBut the ghosts come here for the street food.'], lose: ['Asta: Boo. That was me being sad.'] }),
  itemBall('item.nb1', 2, 5, 'oranberry', 2, 'Oran Berries')
];

// ---------- Superkilen Gym ----------

const SWITCHES = [
  { id: 'swPurple', x: 2, colour: 'purple' }, { id: 'swGreen', x: 4, colour: 'green' },
  { id: 'swGold', x: 10, colour: 'gold' }, { id: 'swSilver', x: 12, colour: 'silver' }
];
const ORDER = ['green', 'gold', 'silver', 'purple'];

const switchTalk = (colour: string): Script => function* (s) {
  if (s.flag('vents')) { s.say('The switch is locked open.'); return; }
  const n = (s.flag('gymSeq') as number) || 0;
  s.sfx('select');
  if (ORDER[n] !== colour) { s.setFlag('gymSeq', 0); s.sfx('hit_weak'); s.say('c1.gym.wrong'); return; }
  s.setFlag('gymSeq', n + 1);
  s.sfx('spray');
  if (n + 1 < ORDER.length) { s.say(`Pssht! A ${colour} spray. Something clicks.`); return; }
  s.setFlag('vents', true);
  for (const v of ['vent1', 'vent2', 'vent3']) s.npc(v).hide();
  s.say('The smog vents shut with a clank! The way is clear.');
};

const tariqGym: Script = function* (s) {
  if (s.flag('champion')) { yield* rematch(s, 'tariq'); return; }
  if (s.flag('badge')) { s.say('Tariq: Keep the squares loud.\nAnd keep an eye on that relay.'); return; }
  s.say('c1.tariq.intro.1'); s.say('c1.tariq.intro.2');
  const c: number = yield s.ask('Tariq: Ready?', ['Yes', 'Not yet'], 1);
  if (c !== 0) { s.say('Tariq: Train up. The Steam Tunnels Grimer\nteach you a lot about poison.'); return; }
  const r = yield s.battle({ kind: 'trainer', leader: true, trainer: { name: 'Tariq', title: 'Leader', sprite: 'tr/tariq' }, bg: 'city', foes: [
    { species: 'grimer', level: 12, moves: ['poisongas', 'mudslap', 'harden', 'disable'] },
    { species: 'croagunk', level: 12, moves: ['poisonsting', 'astonish', 'mudslap', 'taunt'] },
    { species: 'shroodle', level: 14, moves: ['toxicspikes', 'furyswipes', 'poisonfang', 'flatter'], item: 'blacksludge' }
  ] });
  if (r !== 'win') return;
  s.say('c1.tariq.lose'); s.say('c1.tariq.badge');
  s.setFlag('badge', true);
  s.giveBadge('spray', 'Spray Badge');
  s.me('me_badge');
  s.say('c1.got.badge');
  s.say('c1.tariq.tm');
  s.giveItem('tmacidspray'); s.me('me_item');
  s.say(`${s.player.name} got TM Acid Spray!`);
  s.say('c1.tariq.bell'); s.say('c1.tariq.obey');
  s.checkpoint();
};

const GYM1_NPCS: NpcDef[] = [
  { id: 'tariqg', sprite: 'chars/tariq', x: 7, y: 2, dir: 'down', talk: tariqGym },
  { id: 'guide', sprite: 'chars/oldman', x: 6, y: 11, dir: 'down', talk: function* (s) { s.say(s.flag('badge') ? 'Gym guide: That badge looks loud on you!' : 'c1.gym.guide'); } },
  ...SWITCHES.map(w => ({ id: w.id, sprite: `obj:switch-${w.colour}`, x: w.x, y: 5, dir: 'down' as const, object: true, talk: switchTalk(w.colour) })),
  ...[6, 7, 8].map((x, i) => ({ id: `vent${i + 1}`, sprite: 'obj:vent', x, y: 4, dir: 'down' as const, object: true, when: (f: (n: string) => any) => !f('vents'),
    talk: talk('A smog vent. It puffs purple fumes.') })),
  trainer({ id: 'gymskater', x: 11, y: 12, dir: 'left', sprite: 'chars/skater', sight: 4, cls: 'Skater', name: 'Mikkel',
    foes: [{ species: 'grimer', level: 11 }], intro: ['c1.gym.skater.intro'], lose: ['c1.gym.skater.lose'] }),
  trainer({ id: 'gymmuralist', x: 3, y: 3, dir: 'right', sprite: 'chars/painter', sight: 5, cls: 'Muralist', name: 'Sanne',
    foes: [{ species: 'smeargle', level: 11 }, { species: 'stunky', level: 12 }], intro: ['c1.gym.muralist.intro'], lose: ['c1.gym.muralist.lose'] })
];

// ---------- Pokémon Centers (shared by every town) ----------

export function centerNpcs(map: string, outX: number, outY: number): NpcDef[] {
  return [
    { id: 'nurse', sprite: 'chars/nurse', x: 2, y: 2, dir: 'down', talk: function* (s) {
      s.say('Nurse: Welcome to the Pokémon Center!\nLet me heal your Pokémon.');
      s.heal(); s.me('me_heal');
      s.setRespawn(map, outX, outY, 'down', 'Nurse: Your team is rested. Be careful out there!');
      s.say('Nurse: Your Pokémon are fighting fit!\nWe hope to see you again.');
      s.checkpoint();
    } },
    { id: 'clerk', sprite: 'chars/clerk', x: 10, y: 2, dir: 'down', talk: function* (s) { yield* s.mart(MART_STOCK); } },
    { id: 'pc', sprite: 'obj:pc', x: 6, y: 1, dir: 'down', object: true, talk: function* (s) {
      s.sfx('pc');
      s.say(`${s.player.name} booted up the PC.\nØrsted's storage system is online.`);
      s.openPc();
    } }
  ];
}

export const HOME: Record<string, MapScripts> = {
  flat: {
    onEnter: flatEnter,
    npcs: [
      { id: 'mum', sprite: 'chars/mum', x: 6, y: 2, dir: 'down', talk: mumTalk },
      { id: 'jensen', sprite: 'chars/oldwoman', x: 2, y: 5, dir: 'right', talk: jensen },
      sign('tv', 8, 1, 'obj:tv', 'p.tv'),
      { id: 'bed', sprite: 'obj:bed', x: 10, y: 1, dir: 'down', object: true, talk: bed }
    ]
  },
  lukasflat: {
    npcs: [
      { id: 'lukasdad', sprite: 'chars/gentleman', x: 3, y: 2, dir: 'down', talk: function* (s) {
        s.say(s.flag('lukas1') ? 'Lukas\'s dad: A scholarship! Our Lukas, at Vanguard.\nHis mother would have been so proud.'
          : 'Lukas\'s dad: Lukas? Out since dawn, with his\nspreadsheets. That boy never stops counting.');
      } },
      sign('poster', 5, 1, 'obj:poster', 'A Vanguard poster: "Powering Tomorrow, Today."\nSomeone has drawn a moustache on it. Maja?')
    ]
  },
  pcnorrebro: { npcs: centerNpcs('norrebro', 22, 8) },
  gym1: { npcs: GYM1_NPCS },
  norrebro: {
    onEnter: norrebroEnter,
    npcs: NORREBRO_NPCS,
    doors: {
      home: function* (s) { s.warp('flat', 6, 5, 'up'); },
      lukas: function* (s) { s.warp('lukasflat', 5, 4, 'up'); },
      pc: function* (s) { s.warp('pcnorrebro', 6, 5, 'up'); },
      gym: gymDoor
    },
    events: [{ x: 3, y: 14, w: 9, h: 4, on: 'step', when: f => !!f('ch1') && !f('kaas'), run: kaasScene }]
  }
};
