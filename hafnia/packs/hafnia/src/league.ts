// Chapter 13, Christiansborg: the city's dark night by candlelight, home to Mum, and the morning the League opens.
// Four halls under the palace (Valdemar's stables, Admiral Clara's hall, Nikolai's Great Hall, Freja on the Tower
// stairs), then the Tower roof: Ørsted and Lukas, co-Champions, against you and Maja. Then fireworks over Tivoli,
// the new statue on Langelinie ("...Okay. Not tiny."), and a ferry horn: Maja has heard singing under Bornholm.
import type { FoeSpec, NpcDef, Script, ScriptApi } from '@hafnia/core';
import { grown, sign, talk, trainer, type MapScripts, type Step } from './lib';
import { lukasStarter, majaStarter } from './starters';

// ---------- The chapter starts: the dark night ----------

/** Runs on the next map you enter after Langelira is caught. */
export function* ch13Start(s: ScriptApi): Step {
  if (!s.flag('ch12done') || s.flag('ch13')) return;
  s.setFlag('ch13', true);
  s.chapterEnd('Chapter 13', 'Christiansborg');
  s.say('c13.start.1'); s.say('c13.start.2'); s.say('c13.start.3');
  s.fade(1, 20);
  s.warp('flat', 6, 3, 'up');
  s.fade(0, 20);
  s.say('c13.home.mum.1'); s.say('c13.home.mum.2'); s.say('c13.home.mum.3');
  s.fade(1, 24);
  s.setTime('morning');
  s.heal();
  s.fade(0, 24);
  s.say('c13.home.morning'); s.say('c13.home.radio.1'); s.say('c13.home.radio.2');
  s.say('c13.home.mum.4');
  s.setRespawn('flat', 6, 4, 'up', s.t('c13.respawn'));
  s.checkpoint();
}

/** Christiansborg's doors open for the League in Chapter 13. */
export const palaceDoor: Script = function* (s) {
  if (!s.flag('ch13')) { s.say('c13.palace.locked'); return; }
  s.say('c13.palace.enter');
  s.sfx('door');
  s.warp('leaguehall', 6, 5, 'up');
};

// ---------- The League hall ----------

/** Karla spars with challengers as often as they like, so the climb to the League's levels is trainer battles,
 *  not hours in tall grass. The first time she also hands over Exp. Candy. */
const KARLA_TEAM: FoeSpec[] = [
  { species: 'staraptor', level: 56 }, { species: 'luxray', level: 56 }, { species: 'lucario', level: 57 },
  { species: 'gyarados', level: 57 }, { species: 'haxorus', level: 58, item: 'sitrusberry' }
];
const karla: Script = function* (s) {
  if (!s.flag('karlaCandy')) {
    s.say('Karla: Nervous? Everyone is, the first time.\nI spar with challengers before they go up.');
    s.say('Karla: Here. The League gives these to everyone\nwho makes it this far.');
    s.setFlag('karlaCandy', true);
    s.giveItem('expcandyl', 3); s.me('me_item');
    s.say(`${s.player.name} got 3 Exp. Candy L!`);
  }
  const c: number = yield s.ask('Karla: Want a practice round? As many as you like.', ['Spar', 'Not now'], 1);
  if (c !== 0) return;
  const r = yield s.battle({ kind: 'trainer', ai: 2, bg: 'indoor1', soft: true, trainer: { name: 'Karla', title: 'Ace Trainer', sprite: 'tr/acef' }, foes: KARLA_TEAM });
  if (r === 'win') s.say('Karla: Good. The nurse can patch you up.\nCome back whenever.');
  else s.say('Karla: Close. Heal up and try again.');
};

const LEAGUEHALL: MapScripts = {
  npcs: [
    { id: 'lgguard', sprite: 'chars/guard', x: 5, y: 1, dir: 'down', talk: function* (s) { s.say('c13.lobby.guard.1'); s.say('c13.lobby.guard.2'); } },
    { id: 'lgnurse', sprite: 'chars/nurse', x: 3, y: 1, dir: 'down', talk: function* (s) {
      s.say('c13.lobby.nurse'); s.heal(); s.me('me_heal');
      s.setRespawn('leaguehall', 6, 4, 'up', 'Palace Nurse: Rest a moment. The halls will wait.');
      s.checkpoint();
    } },
    { id: 'lgclerk', sprite: 'chars/clerk', x: 9, y: 1, dir: 'down', talk: function* (s) {
      s.say('c13.lobby.clerk');
      yield* s.mart(['hyperpotion', 'revive', 'fullheal', 'ultraball']);
    } },
    { id: 'lgkarla', sprite: 'chars/acef', x: 10, y: 4, dir: 'left', talk: karla }
  ],
  events: [{ x: 6, y: 0, w: 1, h: 1, on: 'step', run: function* (s) { s.sfx('door'); s.warp('stables', 5, 7, 'up'); } }]
};

// ---------- The four halls ----------

interface Member { id: string; map: string; name: string; sprite: string; key: string; next: string; foes: FoeSpec[] }

const MEMBERS: Member[] = [
  { id: 'valdemar', map: 'stables', name: 'Valdemar', sprite: 'valdemar', key: 'v', next: 'admiral', foes: [
    // No Sand Stream: a whole league of sandstorm chip on teams without a Rock or Ground type was a slog.
    { species: 'hippowdon', level: 55, ability: 'Sand Force', moves: ['earthquake', 'stoneedge', 'slackoff', 'yawn'] },
    { species: 'gigalith', level: 55, moves: ['stoneedge', 'heavyslam', 'bulldoze', 'irondefense'] },
    { species: 'rhyperior', level: 56, moves: ['stoneedge', 'drillrun', 'megahorn', 'icepunch'] },
    { species: 'mudsdale', level: 57, moves: ['highhorsepower', 'heavyslam', 'rocktomb', 'closecombat'], item: 'sitrusberry' }
  ] },
  { id: 'clara', map: 'admiral', name: 'Clara', sprite: 'clara', key: 'c', next: 'greathall', foes: [
    { species: 'pelipper', level: 57, moves: ['hurricane', 'scald', 'uturn', 'roost'] },
    { species: 'swanna', level: 57, moves: ['bravebird', 'surf', 'roost', 'icebeam'] },
    { species: 'barraskewda', level: 58, moves: ['liquidation', 'closecombat', 'psychicfangs', 'aquajet'] },
    { species: 'kingdra', level: 59, moves: ['hydropump', 'dracometeor', 'icebeam', 'raindance'], item: 'sitrusberry' }
  ] },
  { id: 'nikolai', map: 'greathall', name: 'Nikolai', sprite: 'nikolai', key: 'n', next: 'towerstairs', foes: [
    { species: 'houndoom', level: 58, moves: ['flamethrower', 'darkpulse', 'sludgebomb', 'nastyplot'] },
    { species: 'krookodile', level: 58, moves: ['earthquake', 'knockoff', 'stoneedge', 'bulkup'] },
    { species: 'chandelure', level: 59, moves: ['shadowball', 'flamethrower', 'energyball', 'willowisp'] },
    { species: 'blacephalon', level: 60, moves: ['fireblast', 'shadowball', 'psyshock', 'calmmind'], item: 'sitrusberry' }
  ] },
  { id: 'freja', map: 'towerstairs', name: 'Freja', sprite: 'freja', key: 'f', next: 'towerroof', foes: [
    { species: 'skuntank', level: 59, moves: ['crunch', 'poisonjab', 'suckerpunch', 'fireblast'] },
    { species: 'dhelmise', level: 59, moves: ['anchorshot', 'powerwhip', 'shadowclaw', 'earthquake'] },
    { species: 'sharpedo', level: 59, moves: ['waterfall', 'crunch', 'icefang', 'aquajet'] },
    { species: 'qwilfishhisui', level: 60, moves: ['crunch', 'gunkshot', 'waterfall', 'spikes'] },
    { species: 'dragalge', level: 61, moves: ['sludgewave', 'dracometeor', 'scald', 'toxicspikes'], item: 'sitrusberry' }
  ] }
];

const memberTalk = (m: Member): Script => function* (s) {
  const flag = `e4${m.id}`;
  if (s.flag(flag)) { s.say(`c13.${m.key}.after`); return; }
  s.say(`c13.${m.key}.intro.1`); s.say(`c13.${m.key}.intro.2`);
  const r = yield s.battle({
    kind: 'trainer', ai: 3, leader: true, bg: m.id === 'clara' ? 'city' : 'indoor1',
    trainer: { name: m.name, title: 'Elite Four', sprite: `tr/${m.sprite}` }, foes: m.foes
  });
  if (r !== 'win') return;
  s.setFlag(flag, true);
  s.say(`c13.${m.key}.lose`);
  s.checkpoint();
};

/** The stair at the top of each hall: shut until its member is beaten. */
const hallDoor = (m: Member): Script => function* (s) {
  if (!s.flag(`e4${m.id}`)) { s.say('c13.door.shut'); return; }
  s.say('c13.door.open');
  s.sfx('door');
  s.warp(m.next, 5, m.next === 'towerroof' ? 5 : 7, 'up');
};

// ---------- The hall puzzles ----------
// Each hall's gap in row 4 is held shut until its puzzle is solved (flag e4p<member>). Beating the member also
// counts, so saves from before the puzzles existed walk straight through.

const solved = (m: string) => (f: (n: string) => any) => !!f(`e4p${m}`) || !!f(`e4${m}`);
const open = (s: ScriptApi, m: string, gate: string, line: string) => {
  s.setFlag(`e4p${m}`, true);
  s.sfx('door');
  s.say(line);
  s.npc(gate).hide();
  s.checkpoint();
};

/** Valdemar's stables: saddle the three horses eldest first; a wrong one and the saddles slip off. */
const HORSES = [
  { id: 'gnist', name: 'Gnist', species: 'ponyta', kind: 'Ponyta', x: 2, y: 5 },
  { id: 'stjerne', name: 'Stjerne', species: 'rapidash', kind: 'Rapidash', x: 8, y: 5 },
  { id: 'brun', name: 'Brun', species: 'mudbray', kind: 'Mudbray', x: 8, y: 7 }
];
const horse = (i: number): Script => function* (s) {
  const h = HORSES[i];
  if (solved('valdemar')(n => s.flag(n))) { s.cry(h.species); s.say(`${h.name} nickers. Saddled and ready to ride.`); return; }
  const done = (s.flag('e4saddle') as number | undefined) ?? 0;
  if (i < done) { s.say(`${h.name} is already saddled.`); return; }
  const c: number = yield s.ask(`${h.name} the ${h.kind} flicks an ear at you.`, ['Saddle', 'Leave'], 1);
  if (c !== 0) return;
  s.cry(h.species);
  if (i !== done) {
    s.setFlag('e4saddle', 0);
    s.say(`${h.name} shies away! The other horses stamp,\nand every saddle slides off into the straw.`);
    s.say('An old groom\'s voice: "Eldest first. They know their order\nbetter than you do."');
    return;
  }
  s.setFlag('e4saddle', done + 1);
  s.say(`${h.name} stands still for the saddle.`);
  if (done + 1 === HORSES.length) open(s, 'valdemar', 'stablegate', 'All three horses saddled. The stable gate swings open.');
};

/** Clara's hall: four lamps on one wick-line; lighting or snuffing one flips its neighbours too. Light them all. */
const LAMPS = [2, 4, 6, 8];
const lampBits = (f: (n: string) => any) => (f('e4lamps') as number | undefined) ?? 0b0101;
const lamp = (i: number): Script => function* (s) {
  if (solved('clara')(n => s.flag(n))) { s.say('The lamp burns steady. The Admiral\'s hall is ready.'); return; }
  const c: number = yield s.ask('A brass ship\'s lamp on a shared wick-line.', ['Turn the wick', 'Leave'], 1);
  if (c !== 0) return;
  let bits = lampBits(n => s.flag(n));
  for (const j of [i - 1, i, i + 1]) if (j >= 0 && j < LAMPS.length) bits ^= 1 << j;
  s.setFlag('e4lamps', bits);
  s.sfx('select');
  if (bits === 0b1111) open(s, 'clara', 'admiralgate', 'All four lamps blaze. A cannon port grinds aside.');
};
const lampNpcs = (): NpcDef[] => LAMPS.flatMap((x, i) => [
  { id: `e4lamp${i}`, sprite: 'obj:lanternout', x, y: 6, dir: 'down', object: true, when: f => !solved('clara')(f) && !(lampBits(f) & (1 << i)), talk: lamp(i) },
  { id: `e4lamplit${i}`, sprite: 'obj:lantern', x, y: 6, dir: 'down', object: true, when: f => solved('clara')(f) || !!(lampBits(f) & (1 << i)), talk: lamp(i) }
] as NpcDef[]);

/** Nikolai's Great Hall: his Lampent asks three questions about your journey. One wrong answer and it starts over. */
const QUIZ: { q: string; options: string[]; right: number }[] = [
  { q: 'Who keeps Superkilen\'s squares loud?', options: ['Tariq', 'Kasper', 'Tycho'], right: 0 },
  { q: 'Who captains the Black Fleet?', options: ['Clara', 'Freja', 'Margrethe'], right: 1 },
  { q: 'What answered you in the storm on CopenHill?', options: ['Kronvakt', 'Krønikon', 'Langelira'], right: 2 }
];
const quiz: Script = function* (s) {
  s.cry('lampent');
  s.say('Nikolai\'s Lampent bobs in the gap, its flame flickering.\nIt wants to know what you remember.');
  for (const q of QUIZ) {
    const c: number = yield s.ask(`Lampent: ${q.q}`, q.options);
    if (c !== q.right) { s.say('The flame shrinks to a sulky blue spark.\nLampent turns its back on you.'); return; }
    s.say('The flame flares bright.');
  }
  open(s, 'nikolai', 'quizgate', 'Lampent drifts aside, purring like a candle.\nThe way to Nikolai is open.');
};

/** Freja's stairs: two of her crew stand watch; beat both and the Bosun lets you up. */
const bosun: Script = function* (s) {
  if (!s.flag('tr.e4crew1') || !s.flag('tr.e4crew2')) {
    s.say('Fleet Bosun: The Captain sees nobody my crew hasn\'t tested.\nBoth of them. Off you go.');
    return;
  }
  s.say('Fleet Bosun: Both down? Ha. Then you\'ve earned the stairs.\nMind the Captain. She bites.');
  open(s, 'freja', 'bosungate', 'The Bosun steps aside.');
};

const PUZZLES: Record<string, NpcDef[]> = {
  valdemar: [
    { id: 'stablegate', sprite: 'obj:barrier', x: 5, y: 4, dir: 'down', object: true, when: f => !solved('valdemar')(f),
      talk: talk('A stable gate, bolted from the far side.') },
    ...HORSES.map((h, i): NpcDef => ({ id: `horse${h.id}`, sprite: `chars/${h.species}`, x: h.x, y: h.y, dir: 'down', talk: horse(i) })),
    sign('stableboard', 1, 6, 'obj:sign', 'ROYAL STABLES. Gnist, foaled 2004. Brun, foaled 2019.\nStjerne, foaled 2011. The eldest is always saddled first.')
  ],
  clara: [
    { id: 'admiralgate', sprite: 'obj:barrier', x: 5, y: 4, dir: 'down', object: true, when: f => !solved('clara')(f),
      talk: talk('A cannon port, shut tight. A brass plate below it:\n"Light every lamp and the Admiral will receive you."') },
    ...lampNpcs(),
    sign('lamporders', 1, 7, 'obj:sign', 'STANDING ORDERS: The lamps share one wick-line.\nTurn one and its neighbours turn with it.')
  ],
  nikolai: [
    { id: 'quizgate', sprite: 'chars/lampent', x: 5, y: 4, dir: 'down', when: f => !solved('nikolai')(f), talk: quiz }
  ],
  freja: [
    { id: 'bosungate', sprite: 'chars/sailor', x: 5, y: 4, dir: 'down', when: f => !solved('freja')(f), talk: bosun },
    trainer({ id: 'e4crew1', x: 2, y: 6, dir: 'right', sprite: 'chars/deckhand', sight: 3, cls: 'Deckhand', name: 'Rasmus',
      foes: [{ species: 'overqwil', level: 55 }, { species: 'sharpedo', level: 56 }],
      intro: ['Deckhand Rasmus: The Captain\'s busy being an Elite.\nYou\'ll be busy with me.'], lose: ['Deckhand Rasmus: Right. One more of us to go.'] }),
    trainer({ id: 'e4crew2', x: 8, y: 6, dir: 'left', sprite: 'chars/deckhand', sight: 3, cls: 'Deckhand', name: 'Sanna',
      foes: [{ species: 'toxapex', level: 55 }, { species: 'pelipper', level: 56 }],
      intro: ['Deckhand Sanna: Freja pardoned us all. We owe her\none good watch. Here it is!'], lose: ['Deckhand Sanna: Fine. Tell the Bosun.'] })
  ]
};

const hall = (m: Member): MapScripts => ({
  npcs: [
    // Freja is away at Trekroner with the Fleet while the lighthouse is rebuilt (post-game P5).
    { id: m.id, sprite: `chars/${m.sprite}`, x: 5, y: 2, dir: 'down', talk: memberTalk(m),
      ...(m.id === 'freja' ? { when: f => !f('pg5') || !!f('pg5done') } : {}) } as NpcDef,
    { id: `${m.id}door`, sprite: 'obj:stairs', x: 5, y: 0, dir: 'down', object: true, talk: hallDoor(m) },
    ...PUZZLES[m.id]
  ]
});

// ---------- The Tower roof: the Champions ----------

function* champions(s: ScriptApi): Step {
  if (s.flag('champion')) return;
  s.say('c13.roof.1');
  s.say('c13.roof.orsted.1'); s.say('c13.roof.lukas.1'); s.say('c13.roof.lukas.2'); s.say('c13.roof.orsted.2');
  const maja = s.npc('maja13');
  const [x, y] = s.freeSpotNear(s.player.x, s.player.y);
  maja.place(x, y, 'up'); maja.show();
  s.say('c13.roof.maja.1');
  const r = yield s.battle({
    kind: 'trainer', ai: 3, leader: true, bg: 'city', trainer: { name: 'Ørsted', title: 'Champion', sprite: 'tr/prof' },
    foes: [
      { species: 'venusaur', level: 60, moves: ['gigadrain', 'sludgebomb', 'earthpower', 'synthesis'] },
      { species: 'bronzong', level: 60, moves: ['flashcannon', 'psychic', 'earthquake', 'trickroom'] },
      { species: 'archaludon', level: 62, moves: ['electroshot', 'dracometeor', 'flashcannon', 'bodypress'], item: 'sitrusberry' }
    ],
    multi: {
      // Maja's moves only ever hit the other side.
      partner: { name: 'Maja', sprite: 'tr/maja', foes: [
        { species: 'toxapex', level: 60, moves: ['scald', 'sludgebomb', 'recover', 'toxicspikes'] },
        { species: 'tinkaton', level: 60, moves: ['gigatonhammer', 'playrough', 'knockoff', 'stealthrock'] },
        { species: grown(majaStarter(s), 61), level: 61 }
      ] },
      second: { name: 'Lukas', title: 'Champion', sprite: 'tr/lukas', foes: [
        { species: 'magnezone', level: 60, moves: ['thunderbolt', 'flashcannon', 'bodypress', 'voltswitch'] },
        { species: 'porygonz', level: 60, moves: ['triattack', 'thunderbolt', 'icebeam', 'agility'] },
        { species: grown(lukasStarter(s), 62), level: 62 }
      ] }
    }
  });
  if (r !== 'win') { maja.hide(); return; }
  s.setFlag('champion', true);
  s.say('c13.roof.win.1'); s.say('c13.roof.win.2'); s.say('c13.roof.win.3');
  s.me('me_badge');
  yield* ending(s);
}

function* ending(s: ScriptApi): Step {
  s.fade(1, 30);
  s.setTime('night');
  s.fade(0, 20);
  s.sfx('hit_super'); s.say('c13.end.1');
  s.say('c13.end.2'); s.say('c13.end.3'); s.say('c13.end.4');
  s.cry('langelira');
  s.say('c13.end.5');
  s.fade(1, 30);
  s.say('c13.credits');
  s.say('c13.post.1'); s.say('c13.post.2');
  s.setFlag('ch13done', true);
  s.warp('flat', 6, 3, 'up');
  s.setTime('morning');
  s.fade(0, 30);
  s.setRespawn('flat', 6, 4, 'up', s.t('c13.respawn'));
  s.checkpoint();
  s.chapterEnd('The End', 'Copper & Current');
  s.say('c13.end');
}

const TOWERROOF: MapScripts = {
  onEnter: function* (s) { yield* champions(s); },
  npcs: [
    { id: 'orsted13', sprite: 'chars/prof', x: 4, y: 2, dir: 'down', when: f => !f('ch13done'), talk: function* (s) { yield* champions(s); } },
    { id: 'lukas13', sprite: 'chars/lukas', x: 6, y: 2, dir: 'down', when: f => !f('ch13done'), talk: function* (s) { yield* champions(s); } },
    { id: 'maja13', sprite: 'chars/maja', x: 5, y: 4, dir: 'up', hidden: true, when: f => !f('ch13done') }
  ]
};

export const LEAGUE_SCRIPTS: Record<string, MapScripts> = {
  leaguehall: LEAGUEHALL, towerroof: TOWERROOF,
  ...Object.fromEntries(MEMBERS.map(m => [m.map, hall(m)]))
};
