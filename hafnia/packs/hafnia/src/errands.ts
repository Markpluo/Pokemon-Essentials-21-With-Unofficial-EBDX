// The last side quests from the story bible: Barnevognen (a runaway pram on the Søerne path, Ch1), Lene's Night
// Shift (medicine rounds before 05:00, Ch2), the Hygge Passport (twelve coffee stops that also rest the team and
// move the clock, Ch3), Tycho's Star Charts (eight telescopes at night, after Badge 6) and the Midsummer Bonfires
// (eight Sankt Hans fires where the Leaders join in, post-game). index.ts adds the NPCs to their maps.
import type { DayPeriod, Dir, NpcDef, Script, ScriptApi } from '@hafnia/core';
import { capLevel } from './kalvebod';
import { rematch } from './rematch';

const bits = (s: ScriptApi, flag: string) => (s.flag(flag) as number | undefined) ?? 0;
const count = (n: number) => { let c = 0; for (; n; n &= n - 1) c++; return c; };

// ---------- Barnevognen: the runaway pram ----------
// Each time you catch up with the pram it bumps a root and rolls on, one stage closer to the lake.

const PRAM: { x: number; y: number; roll: [Dir, number][] }[] = [
  { x: 7, y: 20, roll: [['up', 4], ['right', 1]] },
  { x: 8, y: 16, roll: [['up', 1], ['left', 5]] },
  { x: 3, y: 15, roll: [['left', 1], ['up', 1]] },
  { x: 2, y: 14, roll: [] }
];
const ROLL_LINES = [
  'The pram hits a root and bounces away up the path!',
  'You almost had it! It swerves off toward the water!',
  'Bzzt! Rotom: It\'s heading straight for the lake!'
];

const pramLady: Script = function* (s) {
  if (s.flag('pramDone')) { s.say('Karoline: Little Bo is still asleep. Slept through the\nwhole thing. Babies are like that here.'); return; }
  if (s.flag('pramGo')) { s.say('Karoline: The pram! It\'s rolling toward the lake!\nPlease, you\'re faster than me!'); return; }
  if (!s.flag('ch1')) { s.say('Karoline: Coffee by the lake, the pram in the sun.\nThis is the best part of the day.'); return; }
  s.say('Karoline: I only looked away for one sip of coffee!\nThe brake slipped and the pram rolled off!');
  s.say('Karoline: There\'s an Egg sleeping in it, from the\nVuggestuen. Please catch it before the lake does!');
  s.setFlag('pramGo', true);
};

const pramTalk = (i: number): Script => function* (s) {
  const stage = PRAM[i];
  if (!stage.roll.length) {
    s.say(`${s.player.name} grabbed the handle, one wheel already\nin the reeds. Got it!`);
    s.setFlag('pram', i + 1); s.setFlag('pramDone', true);
    s.say('Karoline came running along the path, out of breath.');
    s.say('Karoline: You saved it! The Egg didn\'t even wake up.\nThe Vuggestuen says it\'s a lake Pokémon. It should be with you.');
    s.giveEgg('azurill', { perfectIvs: 3, hiddenAbility: true }); s.me('me_get');
    s.say(`${s.player.name} received an Egg!`);
    s.checkpoint();
    return;
  }
  const n = s.npc(`pram${i}`);
  n.exclaim();
  s.say(ROLL_LINES[i]);
  for (const [dir, steps] of stage.roll) n.walk(dir, steps, 5);
  s.setFlag('pram', i + 1);
};

// ---------- Lene's Night Shift ----------
// Mum works nights at the Nørrebro Center. Four parcels, four patients, home before the shift ends at 05:00.

const PATIENTS: { id: string; map: string; x: number; y: number; sprite: string; dir: Dir; name: string; thanks: string }[] = [
  { id: 'patient1', map: 'norrebro', x: 24, y: 15, sprite: 'chars/oldman', dir: 'left', name: 'Hr. Nielsen',
    thanks: 'Hr. Nielsen: My Lillipup\'s cough syrup! Tell Lene she\'s\nan angel. And that the Lillipup says woof.' },
  { id: 'patient2', map: 'bridge', x: 10, y: 13, sprite: 'chars/jogger', dir: 'up', name: 'Sara',
    thanks: 'Sara: Burn Heal for my Wattrel? I\'ve been jogging in\ncircles all night waiting. Thank you!' },
  { id: 'patient3', map: 'indreby', x: 14, y: 13, sprite: 'chars/student', dir: 'up', name: 'Malik',
    thanks: 'Malik: Exam tomorrow, and my Natu has a fever.\nThese drops will fix it? You\'re a lifesaver.' },
  { id: 'patient4', map: 'nyhavn', x: 24, y: 8, sprite: 'chars/sailor', dir: 'left', name: 'Skipper Bent',
    thanks: 'Skipper Bent: Seasick pills for a Wingull. Don\'t laugh.\nIt happens to the best of us. My thanks to Lene.' }
];
const ALL_PATIENTS = (1 << PATIENTS.length) - 1;
/** The shift runs 20:00 to 05:00. */
const onShift = (s: ScriptApi) => s.clock >= 20 * 60 || s.clock < 5 * 60;

function endShift(s: ScriptApi) {
  s.setFlag('leneShift', false); s.setFlag('leneDone', 0); s.takeItem('medbag');
}

const leneShift: Script = function* (s) {
  if (s.flag('leneShiftDone')) { s.say('Lene: Back to the night shift for me. Go home and sleep,\nsweetheart. And look after that little one.'); return; }
  if (s.flag('leneShift')) {
    if (!onShift(s)) {
      endShift(s);
      s.say('Lene: It\'s past five, love. The day nurse took the last\nparcels round. We\'ll try again another night.');
      return;
    }
    const done = bits(s, 'leneDone');
    if (done !== ALL_PATIENTS) { s.say(`Lene: ${count(done)} of ${PATIENTS.length} delivered. The rest are on the labels.\nBack before five!`); return; }
    s.setFlag('leneShift', false); s.setFlag('leneShiftDone', true); s.takeItem('medbag');
    s.say('Lene: All four, and before five! You\'re a better nurse\nthan half the day shift. Don\'t tell them I said that.');
    s.say('Lene: A Happiny laid this on the ward last week and\nnobody claimed it. It wants a home. And take this stone too.');
    s.giveEgg('happiny', { perfectIvs: 3, hiddenAbility: true }); s.giveItem('ovalstone'); s.me('me_get');
    s.say(`${s.player.name} received an Egg and an Oval Stone!`);
    s.say('Lene: Happiny like their stone in daylight. Show it the\nOval Stone during the day and see what happens.');
    s.checkpoint();
    return;
  }
  if (!s.flag('c2')) { s.say('Lene: Hello, love! I\'m on shift. Off you go, the\nnurses here will fuss over your team.'); return; }
  if (s.period !== 'night') {
    s.say('Lene: The night shift starts at eight. Some nights I could\nuse a runner... come back then?');
    const w: number = yield s.ask('Wait for Lene\'s night shift?', ['Wait until night', 'Not now'], 1);
    if (w !== 0) return;
    s.fade(1, 20); s.setTime('night'); s.fade(0, 20);
  }
  s.say('Lene: Four patients need their medicine tonight, and I\ncan\'t leave the ward. Could you run it for me?');
  s.say('Lene: Nørrebro, the Lakes bridge, Strøget and Nyhavn.\nBack before five, when my shift ends.');
  const c: number = yield s.ask('Run Lene\'s medicine round?', ['Yes', 'Not tonight'], 1);
  if (c !== 0) return;
  s.setFlag('leneShift', true); s.setFlag('leneDone', 0);
  s.giveItem('medbag'); s.me('me_item');
  s.say(`${s.player.name} got Lene's Medicine Bag!`);
};

const patientTalk = (i: number): Script => function* (s) {
  const p = PATIENTS[i];
  if (!onShift(s)) {
    endShift(s);
    s.say(`${p.name}: The day nurse came by already, thanks.\nIsn't Lene's shift over at five?`);
    return;
  }
  s.setFlag('leneDone', bits(s, 'leneDone') | (1 << i));
  s.say(p.thanks);
  s.say(bits(s, 'leneDone') === ALL_PATIENTS ? 'That was the last parcel. Back to Lene!' : `Delivered! (${count(bits(s, 'leneDone'))} of ${PATIENTS.length})`);
};

// ---------- The Hygge Passport: twelve coffee stops ----------
// Every stop rests the team and lets you sit until another time of day (200 kr., free once stamped).

const CAFES: { id: string; map: string; x: number; y: number; dir: Dir; name: string }[] = [
  { id: 'norrebro', map: 'norrebro', x: 24, y: 16, dir: 'left', name: 'Kaffe på Pladsen' },
  { id: 'route1', map: 'route1', x: 16, y: 18, dir: 'left', name: 'Søpavillonen' },
  { id: 'bridge', map: 'bridge', x: 5, y: 3, dir: 'down', name: 'Bro-Kaffe' },
  { id: 'indreby', map: 'indreby', x: 25, y: 9, dir: 'down', name: 'Strøgets Kaffebar' },
  { id: 'nyhavn', map: 'nyhavn', x: 2, y: 9, dir: 'right', name: 'Kanalkaffe' },
  { id: 'christianshavn', map: 'christianshavn', x: 12, y: 2, dir: 'down', name: 'Fristadens Kaffe' },
  { id: 'vesterbro', map: 'vesterbro', x: 24, y: 8, dir: 'left', name: 'Istedgade Espresso' },
  { id: 'kodbyen', map: 'kodbyen', x: 13, y: 2, dir: 'down', name: 'Slagter-Kaffe' },
  { id: 'islandsbrygge', map: 'islandsbrygge', x: 3, y: 9, dir: 'right', name: 'Havnebadets Kiosk' },
  { id: 'frederiksberg', map: 'frederiksberg', x: 20, y: 4, dir: 'down', name: 'Slotskaffe' },
  { id: 'osterbro', map: 'osterbro', x: 9, y: 2, dir: 'down', name: 'Langelinie Pavillon' },
  { id: 'dragor', map: 'dragor', x: 10, y: 5, dir: 'down', name: 'Dragør Kro-kaffe' }
];
const ALL_CAFES = (1 << CAFES.length) - 1;
const REST_PRICE = 200;
const PERIODS: DayPeriod[] = ['morning', 'day', 'evening', 'night'];

const cafeTalk = (i: number): Script => function* (s) {
  const cafe = CAFES[i], bit = 1 << i;
  s.say(`Barista: Welcome to ${cafe.name}! Coffee, a candle,\na blanket. Take as long as you like.`);
  if (s.flag('ch3') && !s.hasItem('hyggepass') && !s.flag('hyggeDone')) {
    s.say('Barista: You don\'t have a Hygge Passport yet? Here.\nGet a stamp at all twelve coffee stops in Hafnia.');
    s.giveItem('hyggepass'); s.me('me_item');
    s.say(`${s.player.name} got a Hygge Passport!`);
  }
  const stamped = (bits(s, 'hygge') & bit) !== 0;
  const price = stamped ? 0 : REST_PRICE;
  const c: number = yield s.ask(price ? `Sit down for a coffee? (${price} kr.)\nStay until...` : 'Your stamp is here. A coffee on the house?\nStay until...',
    ['Morning', 'Day', 'Evening', 'Night', 'No, thanks'], 4);
  if (c > 3) return;
  if (price && !s.takeMoney(price)) { s.say('Barista: Ah, that\'s 200 kr. Maybe next time!'); return; }
  s.fade(1, 20); s.heal(); s.setTime(PERIODS[c]); s.fade(0, 20);
  s.me('me_heal');
  s.say('Steam, candlelight and a blanket over your knees.\nYour team curls up beside you. Hygge.');
  if (stamped || !s.hasItem('hyggepass')) return;
  const all = bits(s, 'hygge') | bit;
  s.setFlag('hygge', all);
  s.sfx('select');
  s.say(`Barista: And a stamp for your passport. That's\n${count(all)} of ${CAFES.length}!`);
  if (all !== ALL_CAFES) return;
  s.setFlag('hyggeDone', true); s.takeItem('hyggepass');
  s.say('Barista: Twelve stamps! You\'ve had more coffee than\na Copenhagen taxi driver. That deserves a prize.');
  s.say('Barista: This little one lives in our oldest teacup.\nIt likes you. And a thermos, so you can take hygge along.');
  const lv = Math.max(20, capLevel(s) - 2);
  const m = s.givePokemon('sinistea', lv); s.cry('sinistea');
  s.say(`${s.player.name} received ${m.nickname ?? 'Sinistea'}!`);
  s.giveItem('crackedpot'); s.giveItem('soothebell'); s.giveItem('termokande'); s.me('me_item');
  s.say(`${s.player.name} got a Cracked Pot, a Soothe Bell\nand the Termokande!`);
  s.checkpoint();
};

// ---------- Tycho's Star Charts ----------

const SCOPES: { id: string; map: string; x: number; y: number; star: string; line: string }[] = [
  { id: 'indreby', map: 'indreby', x: 4, y: 7, star: 'the Great Bear', line: 'Seven bright stars over the rooftops of Strøget. The Plough.' },
  { id: 'nyhavn', map: 'nyhavn', x: 24, y: 4, star: 'Orion', line: 'Three stars in a row above the masts. Orion\'s belt.' },
  { id: 'christianshavn', map: 'christianshavn', x: 14, y: 1, star: 'the Swan', line: 'A cross of stars over the Freetown, flying down the Milky Way.' },
  { id: 'osterbro', map: 'osterbro', x: 17, y: 2, star: 'the Little Bear', line: 'The Pole Star, right above Kastellet. Sailors steered by it.' },
  { id: 'frederiksberg', map: 'frederiksberg', x: 7, y: 4, star: 'the Pleiades', line: 'A tiny blue cluster over the palace. The Seven Sisters.' },
  { id: 'islandsbrygge', map: 'islandsbrygge', x: 4, y: 12, star: 'the Lyre', line: 'Vega, blue-white, over the harbour baths. The Lyre.' },
  { id: 'slotsholmen', map: 'slotsholmen', x: 12, y: 3, star: 'the Dragon', line: 'A long faint chain of stars winds between the bears. The Dragon.' },
  { id: 'copenhill', map: 'copenhill', x: 25, y: 10, star: 'Cassiopeia', line: 'A crooked W. Tycho saw a new star born here in 1572.' }
];
const ALL_SCOPES = (1 << SCOPES.length) - 1;

const kirsten: Script = function* (s) {
  if (s.flag('starsDone')) { s.say('Kirsten: Tycho framed your chart. It hangs next to his\nown, from 1572. He pretends not to look at it.'); return; }
  if (!s.flag('ch6done')) { s.say('Kirsten: The observatory is closed while Tycho\nfixes the telescope. Look up anyway!'); return; }
  if (!s.hasItem('starchart')) {
    s.say('Kirsten: I\'m Tycho\'s assistant. He wants a new chart\nof the Hafnian sky, seen from all over the city.');
    s.say('Kirsten: We left eight telescopes on rooftops and piers.\nLook through each one at night and mark what you see.');
    s.giveItem('starchart'); s.me('me_item');
    s.say(`${s.player.name} got Tycho's Star Chart!`);
    return;
  }
  const n = bits(s, 'stars');
  if (n !== ALL_SCOPES) { s.say(`Kirsten: ${count(n)} of ${SCOPES.length} constellations so far.\nThe telescopes only work at night, of course.`); return; }
  s.setFlag('starsDone', true); s.takeItem('starchart');
  s.say('Kirsten: All eight! Tycho will cry. He\'ll say it\'s the\ndust. Here, these fell on Amager last winter.');
  s.giveItem('moonstone', 3);
  s.say('Kirsten: And this Egg was found on the observatory roof\nafter a meteor shower. We think it came with the stars.');
  s.giveEgg('cleffa', { perfectIvs: 3, hiddenAbility: true }); s.me('me_get');
  s.say(`${s.player.name} got 3 Moon Stones and an Egg!`);
  s.checkpoint();
};

const scopeTalk = (i: number): Script => function* (s) {
  const sc = SCOPES[i], bit = 1 << i;
  s.say('One of Tycho\'s telescopes, pointed at the sky.');
  if (s.period !== 'night') {
    const c: number = yield s.ask('Too bright to see any stars.\nWait for nightfall?', ['Wait', 'Leave it'], 1);
    if (c !== 0) return;
    s.fade(1, 20); s.setTime('night'); s.fade(0, 20);
  }
  s.say(sc.line);
  if (!s.hasItem('starchart') || (bits(s, 'stars') & bit)) return;
  const all = bits(s, 'stars') | bit;
  s.setFlag('stars', all); s.sfx('select');
  s.say(`${s.player.name} marked ${sc.star} on the chart.\n(${count(all)} of ${SCOPES.length})`);
};

// ---------- Midsummer Bonfires ----------

type LeaderKey = Parameters<typeof rematch>[1];
const FIRES: { id: LeaderKey; map: string; x: number; y: number; sprite: string; name: string; line: string }[] = [
  { id: 'tariq', map: 'norrebro', x: 3, y: 16, sprite: 'chars/tariq', name: 'Tariq', line: 'Tariq: Sankt Hans on Den Sorte Plads! I painted the witch\nmyself. She looks a bit like Lindholm, don\'t you think?' },
  { id: 'alva', map: 'christianshavn', x: 26, y: 8, sprite: 'chars/alva', name: 'Alva', line: 'Alva: Midsummer is when the herbs are strongest.\nI hung some over the fire for luck.' },
  { id: 'kasper', map: 'kodbyen', x: 3, y: 8, sprite: 'chars/kasper', name: 'Kasper', line: 'Kasper: Bonfire, herring, new potatoes. If anyone\nsays "barbecue", they\'re going in the harbour.' },
  { id: 'soren', map: 'assistens', x: 24, y: 6, sprite: 'chars/soren', name: 'Søren', line: 'Søren: The shortest night of the year. Even the ghosts\ncome out to watch the fire. Look, there\'s Litwick.' },
  { id: 'tycho', map: 'indreby', x: 2, y: 10, sprite: 'chars/scientist', name: 'Tycho', line: 'Tycho: The sun barely sets tonight. Perfect for a fire,\nterrible for astronomy. I brought marshmallows.' },
  { id: 'pierrot', map: 'bakken', x: 27, y: 6, sprite: 'chars/juggler', name: 'Pierrot', line: 'Pierrot juggles three burning sticks over the fire,\nthen bows. The crowd at Bakken cheers.' },
  { id: 'margrethe', map: 'slotsholmen', x: 2, y: 9, sprite: 'chars/margrethe', name: 'Margrethe', line: 'Margrethe: The fire is fully insured. I checked.\nNow, everyone: "Vi elsker vort land..."' },
  { id: 'astrid', map: 'copenhill', x: 2, y: 9, sprite: 'chars/astrid', name: 'Astrid', line: 'Astrid: A wood fire next to a power plant. My daughter\nsays that\'s ironic. I say it\'s hygge.' }
];

const bonfireTalk = (i: number): Script => function* (s) {
  const f = FIRES[i], flag = `fire.${f.id}`;
  if (s.flag(flag)) { s.say('The Sankt Hans fire crackles. Sparks drift up into the\nlight summer night.'); return; }
  s.say('A Sankt Hans bonfire, built for Midsummer Eve.\nA straw witch sits on top, waiting.');
  if (s.period !== 'evening' && s.period !== 'night') {
    const c: number = yield s.ask('Bonfires are lit in the evening.\nWait until then?', ['Wait', 'Not now'], 1);
    if (c !== 0) return;
    s.fade(1, 20); s.setTime('evening'); s.fade(0, 20);
  }
  const c: number = yield s.ask('Light the bonfire?', ['Light it', 'Not yet'], 1);
  if (c !== 0) return;
  s.setFlag(flag, true);
  s.sfx('select');
  s.say('Whoosh! The fire takes, and the witch flies off to\nthe Brocken in a shower of sparks.');
  s.say(`${f.name} came over to join in.`);
  s.say(f.line);
  const lit = FIRES.filter(x => s.flag(`fire.${x.id}`)).length;
  if (lit < FIRES.length) { s.say(`(${lit} of ${FIRES.length} Midsummer bonfires lit)`); return; }
  s.setFlag('firesDone', true);
  s.say(`${f.name}: That's all eight! The whole city is singing\ntonight. The Leaders chipped in for something.`);
  s.giveItem('ember'); s.giveItem('tmflamethrower'); s.giveItem('expcandyl', 3); s.me('me_item');
  s.say(`${s.player.name} got the Sankt Hans Ember, TM Flamethrower\nand 3 Exp. Candy L!`);
  s.checkpoint();
};

const leaderAtFire = (i: number): Script => function* (s) {
  const f = FIRES[i];
  s.say(f.line);
  yield* rematch(s, f.id);
};

// ---------- NPCs by map ----------

function add(out: Record<string, NpcDef[]>, map: string, n: NpcDef) { (out[map] ??= []).push(n); }

function npcs(): Record<string, NpcDef[]> {
  const out: Record<string, NpcDef[]> = {};
  add(out, 'route1', { id: 'pramlady', sprite: 'chars/lady', x: 5, y: 20, dir: 'right', period: ['morning', 'day'], talk: pramLady });
  PRAM.forEach((p, i) => add(out, 'route1', { id: `pram${i}`, sprite: 'obj:pram', x: p.x, y: p.y, dir: 'down', object: true,
    period: ['morning', 'day'], when: f => !!f('pramGo') && !f('pramDone') && ((f('pram') as number | undefined) ?? 0) === i, talk: pramTalk(i) }));
  add(out, 'pcnorrebro', { id: 'lenepc', sprite: 'chars/mum', x: 4, y: 3, dir: 'down', talk: leneShift });
  PATIENTS.forEach((p, i) => add(out, p.map, { id: p.id, sprite: p.sprite, x: p.x, y: p.y, dir: p.dir,
    when: f => !!f('leneShift') && !(((f('leneDone') as number | undefined) ?? 0) & (1 << i)), talk: patientTalk(i) }));
  CAFES.forEach((c, i) => add(out, c.map, { id: `cafe.${c.id}`, sprite: 'chars/barista', x: c.x, y: c.y, dir: c.dir, talk: cafeTalk(i) }));
  add(out, 'towerin', { id: 'kirsten', sprite: 'chars/student', x: 3, y: 2, dir: 'down', talk: kirsten });
  SCOPES.forEach((sc, i) => add(out, sc.map, { id: `scope.${sc.id}`, sprite: 'obj:telescope', x: sc.x, y: sc.y, dir: 'down', object: true,
    when: f => !!f('ch6done'), talk: scopeTalk(i) }));
  FIRES.forEach((fi, i) => {
    add(out, fi.map, { id: `fire.${fi.id}`, sprite: 'obj:bonfireout', x: fi.x, y: fi.y, dir: 'down', object: true,
      when: f => !!f('champion') && !f(`fire.${fi.id}`), talk: bonfireTalk(i) });
    add(out, fi.map, { id: `firelit.${fi.id}`, sprite: 'obj:bonfire', x: fi.x, y: fi.y, dir: 'down', object: true,
      when: f => !!f(`fire.${fi.id}`), talk: bonfireTalk(i) });
    add(out, fi.map, { id: `fireleader.${fi.id}`, sprite: fi.sprite, x: fi.x + 1, y: fi.y, dir: 'left',
      when: f => !!f(`fire.${fi.id}`), talk: leaderAtFire(i) });
  });
  return out;
}

export const ERRAND_NPCS = npcs();
