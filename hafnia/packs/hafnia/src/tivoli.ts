// Tivoli Gardens (post-game): closed for the winter season until you are Champion, then the Christmas season opens.
// The Battle Gardens: Nikolai's Tower Challenge in Dæmonen (four trainers in a row with no healing, then Nikolai,
// once a day), and daily Elite Four rematches: Valdemar in the Concert Hall, Clara on the lake boats, Freja on the
// Pantomime stage. Together with the Gym Leader rematches it is the post-game's steady income.
import type { FoeSpec, Script, ScriptApi } from '@hafnia/core';
import { eliteRematch } from './rematch';
import { sign, talk, type MapScripts, type Step } from './lib';

export const tivoliDoor: Script = function* (s) {
  if (!s.flag('champion')) {
    s.say('TIVOLI. A sign on the Moorish gate:\n"Closed for the winter. The Christmas season opens soon!"');
    return;
  }
  if (!s.flag('tivoliOpen')) {
    s.setFlag('tivoliOpen', true);
    s.say('The gate is strung with lights. A sign:\n"TIVOLI CHRISTMAS SEASON. Battle Gardens now open!"');
  }
  s.warp('tivoli', 15, 20, 'up');
};

const T = (species: string, level: number, moves?: string[]): FoeSpec => ({ species, level, ...(moves ? { moves } : {}) });

/** Tower Challenge trainers; each day picks four of them in a rotating order. */
const TOWER: { name: string; title: string; sprite: string; foes: FoeSpec[] }[] = [
  { name: 'Mikkel', title: 'Ace Trainer', sprite: 'tr/acem', foes: [T('staraptor', 66), T('luxray', 67), T('haxorus', 67)] },
  { name: 'Ida', title: 'Ace Trainer', sprite: 'tr/acef', foes: [T('gardevoir', 66), T('milotic', 67), T('azumarill', 67)] },
  { name: 'Bo', title: 'Busker', sprite: 'tr/juggler', foes: [T('mrrime', 66), T('grimmsnarl', 67), T('hatterene', 67)] },
  { name: 'Lise', title: 'Swimmer', sprite: 'tr/swimmer', foes: [T('barraskewda', 66), T('toxapex', 67), T('lapras', 67)] },
  { name: 'Henrik', title: 'Engineer', sprite: 'tr/engineer', foes: [T('magnezone', 66), T('klinklang', 67), T('copperajah', 67)] },
  { name: 'Ulla', title: 'Medium', sprite: 'tr/channeler', foes: [T('chandelure', 66), T('mismagius', 67), T('golurk', 67)] },
  { name: 'Frederik', title: 'Cyclist', sprite: 'tr/biker', foes: [T('galvantula', 66), T('zebstrika', 67), T('staraptor', 67)] }
];

const NIKOLAI: FoeSpec[] = [
  T('houndoom', 70, ['flamethrower', 'darkpulse', 'sludgebomb', 'nastyplot']),
  T('krookodile', 70, ['earthquake', 'knockoff', 'stoneedge', 'bulkup']),
  T('chandelure', 71, ['shadowball', 'flamethrower', 'energyball', 'willowisp']),
  T('volcarona', 71, ['fierydance', 'bugbuzz', 'gigadrain', 'quiverdance']),
  { ...T('blacephalon', 72, ['fireblast', 'shadowball', 'psyshock', 'calmmind']), item: 'sitrusberry' }
];

function* towerChallenge(s: ScriptApi): Step {
  if (s.flag('tower.day') === s.day) { s.say('Nikolai: The coaster\'s cooling down. One run a night!\nCome back tomorrow.'); return; }
  s.say('Nikolai: Welcome to the Tower Challenge! Four of the best\ntrainers in Tivoli, back to back, then me.');
  s.say('Nikolai: No healing between the four rounds. Win, and the fireworks\ntonight are for you. Again.');
  const c: number = yield s.ask('Start the Tower Challenge?', ['Start', 'Not tonight'], 1);
  if (c !== 0) return;
  s.heal();
  for (let i = 0; i < 4; i++) {
    const t = TOWER[(s.day * 3 + i) % TOWER.length];
    s.say(i === 0 ? `Round 1! ${t.title} ${t.name} steps up.` : `Round ${i + 1}! ${t.title} ${t.name} is next.`);
    const r = yield s.battle({ kind: 'trainer', ai: 3, bg: 'city', trainer: { name: t.name, title: t.title, sprite: t.sprite }, foes: t.foes });
    if (r !== 'win') { s.setFlag('tower.day', s.day); return; }
  }
  s.say('Nikolai: Four down! The stage crew will patch your team up.\nNow the main event. I light the sky, you try to outshine it!');
  s.heal(); s.me('me_heal');
  const r = yield s.battle({ kind: 'trainer', leader: true, ai: 3, bg: 'city', trainer: { name: 'Nikolai', title: 'Elite Four', sprite: 'tr/nikolai' }, foes: NIKOLAI });
  s.setFlag('tower.day', s.day);
  if (r !== 'win') return;
  const wins = (s.flag('tower.wins') ?? 0) + 1;
  s.setFlag('tower.wins', wins);
  s.say(`Nikolai: Spectacular! That's ${wins} Tower ${wins === 1 ? 'win' : 'wins'} for you.\nHere, a little something from the stage crew.`);
  s.giveItem('expcandyl', 2); s.me('me_item');
  s.say(`${s.player.name} received 2 Exp. Candy L!`);
  if (wins % 5 === 0) {
    s.giveItem('ultraball', 10); s.me('me_item');
    s.say(`And a crate of 10 Ultra Balls for ${wins} wins!`);
  }
  s.checkpoint();
}

const TIVOLI: MapScripts = {
  npcs: [
    { id: 'tvclara', sprite: 'chars/clara', x: 12, y: 18, dir: 'up', talk: s => eliteRematch(s, 'clara') },
    { id: 'tvvendor', sprite: 'chars/baker', x: 18, y: 13, dir: 'down', talk: function* (s) {
      s.say('Vendor: Æbleskiver! Gløgg! A bag of each, 200 kr.,\nand your team feels like new.');
      const c: number = yield s.ask('Buy æbleskiver and gløgg?', ['Yes (200 kr.)', 'No'], 1);
      if (c !== 0) return;
      if (!s.takeMoney(200)) { s.say('Vendor: You\'re a bit short, I\'m afraid.'); return; }
      s.heal(); s.me('me_heal');
      s.say('Your team shares the æbleskiver. Everyone is rested.');
    } },
    { id: 'tvkid', sprite: 'chars/kid', x: 20, y: 9, dir: 'left', talk: talk('Kid: Dæmonen goes upside down THREE times!\nNikolai rides it before every challenge.') },
    { id: 'tvlady', sprite: 'chars/lady', x: 6, y: 11, dir: 'right', talk: talk('Lady: My grandmother came here when the lake still\nhad its old pagoda. The lights never change. Good.') },
    sign('tvsign', 17, 20, 'obj:sign', 'TIVOLI BATTLE GARDENS\nDæmonen: Tower Challenge (Nikolai). Concert Hall:\nValdemar. Lake boats: Clara. Pantomime: Freja.'),
    sign('coastersign', 12, 6, 'obj:sign', 'RUTSCHEBANEN, 1914. One of the oldest wooden\nroller coasters still running. The brakeman rides along.')
  ],
  doors: {
    daemonen: function* (s) { s.warp('daemonentower', 5, 4, 'up'); },
    concert: function* (s) { s.warp('concerthall', 6, 4, 'up'); },
    pantomime: function* (s) { s.warp('pantomimehall', 5, 3, 'up'); }
  }
};

export const TIVOLI_SCRIPTS: Record<string, MapScripts> = {
  tivoli: TIVOLI,
  daemonentower: { npcs: [{ id: 'tvnikolai', sprite: 'chars/nikolai', x: 5, y: 2, dir: 'down', talk: towerChallenge }] },
  concerthall: { npcs: [{ id: 'tvvaldemar', sprite: 'chars/valdemar', x: 6, y: 2, dir: 'down', talk: s => eliteRematch(s, 'valdemar') }] },
  pantomimehall: { npcs: [{ id: 'tvfreja', sprite: 'chars/freja', x: 5, y: 2, dir: 'down', talk: s => eliteRematch(s, 'freja') }] }
};
