// Chapter 13, Christiansborg: the city's dark night by candlelight, home to Mum, and the morning the League opens.
// Four halls under the palace (Valdemar's stables, Admiral Clara's hall, Nikolai's Great Hall, Freja on the Tower
// stairs), then the Tower roof: Ørsted and Lukas, co-Champions, against you and Maja. Then fireworks over Tivoli,
// the new statue on Langelinie ("...Okay. Not tiny."), and a ferry horn: Maja has heard singing under Bornholm.
import type { FoeSpec, NpcDef, Script, ScriptApi } from '@hafnia/core';
import { grown, type MapScripts, type Step } from './lib';
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
    } }
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

const hall = (m: Member): MapScripts => ({
  npcs: [
    { id: m.id, sprite: `chars/${m.sprite}`, x: 5, y: 2, dir: 'down', talk: memberTalk(m) } as NpcDef,
    { id: `${m.id}door`, sprite: 'obj:stairs', x: 5, y: 0, dir: 'down', object: true, talk: hallDoor(m) }
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
