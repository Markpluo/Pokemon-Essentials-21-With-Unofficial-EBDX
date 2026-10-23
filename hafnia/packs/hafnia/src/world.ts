// Maps and building stamps for the Hafnia demo (Prologue to the end of Chapter 13). Plain data,
// so the client can import it for rendering without the scripts.
// Outdoor tiles: '.' ground, '=' brick path, 'g' tall grass, 'f' flowers, 'T' trees, '~' sea, 'o' still water,
//   'r' Den Røde Plads, 'k' Den Sorte Plads, 'q' cobbles, 'a' asphalt/concrete, 'l' bike lane, 'd' planks,
//   'H' house fronts, 'x' shipping containers, 'n' railings.
// Indoor and tunnels: '_' floor, 'w' wall, 'K' furniture, 'm' doormat, 'c' tunnel floor, 'R' rock, 'p' pipes, 'P' planters,
//   'u' drain water, 'i' ice, 'z' Trick Room floor (steps go the opposite way), 'j' coaster track.
import type { Dir, MapDef, Stamp, Warp } from '@hafnia/core';

type MapData = Omit<MapDef, 'npcs' | 'doors' | 'events' | 'onEnter'>;

// Building stamps from Outside.png: parts are [srcX, srcY, w, h, dx, dy] in tiles. `draw` ones are hand-drawn by the client.
export const STAMPS: Record<string, Stamp> = {
  lab: { parts: [[0, 192, 5, 5, 0, 0]], w: 5, h: 5, door: [2, 4] },
  home: { parts: [[0, 197, 5, 5, 0, 0]], w: 5, h: 5, door: [1, 4] },
  blue: { parts: [[0, 208, 4, 3, 0, 0]], w: 4, h: 3, door: [1, 2] },
  orange: { parts: [[4, 208, 4, 3, 0, 0]], w: 4, h: 3 },
  red: { parts: [[0, 206, 4, 2, 0, 0], [0, 210, 4, 1, 0, 2]], w: 4, h: 3, door: [1, 2] },
  green: { parts: [[4, 206, 4, 2, 0, 0], [4, 210, 4, 1, 0, 2]], w: 4, h: 3 },
  pc: { parts: [[0, 326, 5, 5, 0, 0]], w: 5, h: 5, door: [2, 4] },
  gym: { parts: [[0, 350, 7, 5, 0, 0]], w: 7, h: 5, door: [3, 4] },
  palm: { draw: 'palmHouse', w: 8, h: 4, door: [4, 3] },     // the tileset has no greenhouse
  mural: { draw: 'mural', w: 6, h: 2 },                      // Tariq's mural wall at Superkilen
  tower: { draw: 'roundTower', w: 4, h: 5, door: [1, 4] },   // Rundetårn
  cafe: { draw: 'cafe', w: 4, h: 3, door: [1, 2] },          // a gabled Nyhavn house with a café door
  houseboat: { draw: 'houseboat', w: 6, h: 3, door: [2, 2] }, // Alva's gym on the moat
  pyramid: { draw: 'pyramid', w: 3, h: 2, door: [1, 1] },     // the glass entrance to the Cisterns in Søndermarken
  kastellet: { draw: 'kastellet', w: 6, h: 3, door: [3, 2] }, // Kastellet's gate through the ramparts
  substation: { draw: 'substation', w: 4, h: 3, door: [2, 2] }, // Vanguard's hidden sub-station in Dyrehaven
  circus: { draw: 'circus', w: 6, h: 4, door: [3, 3] },       // Pierrot's striped tent at Bakken
  lighthouse: { draw: 'lighthouse', w: 3, h: 5, door: [1, 4] }, // Trekroner's dead lighthouse
  bunker: { draw: 'bunker', w: 5, h: 3, door: [2, 2] },        // the old gun battery, cells below
  fortgate: { draw: 'fortgate', w: 6, h: 3, door: [3, 2] },    // Vanguard's steel door into the fort
  borsen: { draw: 'borsen', w: 10, h: 4, door: [5, 3] },       // Børsen under scaffolding, the dragon spire's stump
  palace: { draw: 'palace', w: 9, h: 5, door: [4, 4] },       // Christiansborg (the League opens in Chapter 13)
  copenhill: { draw: 'copenhill', w: 12, h: 6, door: [6, 5] }, // Amager Bakke: the power plant with the ski slope on its roof
  kronborg: { draw: 'kronborg', w: 10, h: 6, door: [5, 5] }    // Kronborg: sandstone walls, green spires, the casemates gate
};

const makeGrid = (w: number, h: number, ch: string) => Array.from({ length: h }, () => Array<string>(w).fill(ch));
function fill(g: string[][], x: number, y: number, w: number, h: number, ch: string) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (g[j] && g[j][i] !== undefined) g[j][i] = ch;
}
function dots(g: string[][], ch: string, pts: number[][]) { for (const [x, y] of pts) g[y][x] = ch; }
const grid = (rows: string[]) => {
  const w = rows[0].length;
  rows.forEach((r, i) => { if (r.length !== w) throw new Error(`map row ${i} is ${r.length} wide, expected ${w}`); });
  return { grid: rows.map(r => r.split('')), w, h: rows.length };
};

/** A plain room with a doormat in the middle of the bottom wall that leads back outside. */
function room(id: string, name: string, rows: string[], back: { to: string; x: number; y: number }, bgm = 'overworld'): MapData {
  const g = grid(rows);
  const warps: Warp[] = [];
  g.grid.forEach((r, y) => r.forEach((c, x) => { if (c === 'm') warps.push({ x, y, to: back.to, tx: back.x, ty: back.y, dir: 'down' }); }));
  return { id, name, ...g, battleBg: 'indoor1', bgm, buildings: [], indoor: true, warps };
}

// ---------- Nørrebro ----------

// Home walk-up, Lukas's building, the Pokémon Center, and Superkilen (red square, black square, mural) in front of Gym 1.
function norrebro(): MapData {
  const W = 28, H = 22, g = makeGrid(W, H, '.');
  fill(g, 0, 0, W, 2, 'T'); fill(g, 0, 19, W, 3, 'T');
  fill(g, 0, 0, 2, H, 'T'); fill(g, 26, 0, 2, H, 'T');
  fill(g, 2, 8, 24, 1, '=');                  // Nørrebrogade
  fill(g, 12, 8, 2, 14, '=');                 // road south to the bridge
  fill(g, 3, 14, 9, 4, 'k');                  // Den Sorte Plads
  fill(g, 15, 14, 11, 4, 'r');                // Den Røde Plads
  dots(g, 'f', [[2, 3], [2, 4], [8, 3], [9, 3], [12, 3], [12, 4], [18, 4], [18, 5], [25, 3], [25, 4],
    [2, 10], [3, 10], [9, 11], [10, 11], [15, 10], [2, 18], [10, 18], [16, 18], [25, 18]]);
  fill(g, 24, 9, 2, 4, 'g');                  // courtyard planters
  fill(g, 0, 8, 2, 1, '=');                   // Nørrebrogade runs on west to Den Grønne Sti (Ch3)
  fill(g, 15, 0, 2, 2, 'q');                  // the lane north to Assistens Kirkegård (Ch4)
  return {
    id: 'norrebro', name: 'Nørrebro', grid: g, w: W, h: H, battleBg: 'city', bgm: 'overworld',
    buildings: [
      { s: 'home', x: 3, y: 3, id: 'home' }, { s: 'blue', x: 9, y: 5, id: 'lukas' }, { s: 'orange', x: 14, y: 5 },
      { s: 'pc', x: 20, y: 3, id: 'pc' }, { s: 'gym', x: 17, y: 9, id: 'gym' }, { s: 'mural', x: 3, y: 11 }
    ],
    encounters: [[30, 'pidgey'], [30, 'skwovet'], [20, 'rattata'], [15, 'nickit'], [5, 'toxel']],
    encountersNight: [[35, 'rattata'], [30, 'nickit'], [20, 'hoothoot'], [10, 'greavard'], [5, 'toxel']],
    levels: [6, 9],
    exits: { down: { to: 'bridge', offset: -3 }, left: { to: 'route2', offset: -5 }, up: { to: 'assistens', offset: 0 } }
  };
}

const flat = () => room('flat', 'Home', [
  'wwwwwwwwwwww',
  'wKKK_______w',
  'w__________w',
  'w____KK____w',
  'w__________w',
  'w__________w',
  'w_____m____w',
  'wwwwwwwwwwww'
], { to: 'norrebro', x: 4, y: 8 });

const lukasFlat = () => room('lukasflat', 'Lukas\'s flat', [
  'wwwwwwwwww',
  'wKK____KKw',
  'w________w',
  'w___KK___w',
  'w________w',
  'w____m___w',
  'wwwwwwwwww'
], { to: 'norrebro', x: 10, y: 8 });

/** Pokémon Center: nurse counter on the left, Mart counter on the right. */
const center = (id: string, name: string, to: string, x: number, y: number) => room(id, name, [
  'wwwwwwwwwwwww',
  'wKKKK___KKKKw',
  'w___________w',
  'w___________w',
  'wKK_______KKw',
  'w___________w',
  'w_____m_____w',
  'wwwwwwwwwwwww'
], { to, x, y });

// Gym 1: a sealed room until the spray switches are pressed in the mural's colour order.
const gym1 = () => room('gym1', 'Superkilen Gym', [
  'wwwwwwwwwwwwwww',
  'wrrrrrrrrrrrrrw',
  'wrrrrrrrrrrrrrw',
  'wrrrrrrrrrrrrrw',
  'wwwwwwrrrwwwwww',
  'wkkkkkkkkkkkkkw',
  'wkkkkkkkkkkkkkw',
  'wkkkkkkkkkkkkkw',
  'wkkkkkkkkkkkkkw',
  'wkkkkkkkkkkkkkw',
  'wkkkkkkkkkkkkkw',
  'wkkkkkkkkkkkkkw',
  'wkkkkkkmkkkkkkw',
  'wwwwwwwwwwwwwww'
], { to: 'norrebro', x: 20, y: 14 }, 'overworld');

// ---------- Dronning Louises Bro ----------

// Four bike lanes cross the bridge deck; commuters ride in waves (patrol NPCs in the pack).
function bridge(): MapData {
  return {
    id: 'bridge', name: 'Dronning Louises Bro', ...grid([
      'TTTTTTTTT==TTTTTTTTT',
      'TT.......==.......TT',
      'TT.f.....==.....f.TT',
      'ooon....aaaa....nooo',
      'ooonaaaaaaaaaaaanooo',
      'ooonllllllllllllnooo',
      'ooonllllllllllllnooo',
      'ooonaaaaaaaaaaaanooo',
      'ooonllllllllllllnooo',
      'ooonllllllllllllnooo',
      'ooonaaaaaaaaaaaanooo',
      'ooon....aaaa....nooo',
      'TT.f.....==.....f.TT',
      'TT.......==.......TT',
      'TTTTTTTTT==TTTTTTTTT',
      'TTTTTTTTT==TTTTTTTTT'
    ]), battleBg: 'city', bgm: 'overworld', buildings: [],
    exits: { up: { to: 'norrebro', offset: 3 }, down: { to: 'route1', offset: 1 } }
  };
}

// ---------- Route 1: Søerne Path ----------

function route1(): MapData {
  return {
    id: 'route1', name: 'Route 1: Søerne Path', ...grid([
      'TTTTTTTTTT==TTTTTTTT',
      'TTTTTTTTTT==TTTTTTTT',
      'TT..f.....==...f..TT',
      'TTgggg....==..ggggTT',
      'TTgggg....==..ggggTT',
      'TTgggg....==..ggggTT',
      'TT........==......TT',
      'TT........==......TT',
      'TToooo....==.gggg.TT',
      'TToooooo..==.gggg.TT',
      'TTooooooo.==.gggg.TT',
      'TTooooooo.==......TT',
      'TTooooooo.==..f...TT',
      'TToooooo..==......TT',
      'TT.oooo...==.gggg.TT',
      'TT........==.gggg.TT',
      'TTggggg...==.gggg.TT',
      'TTggggg...==......TT',
      'TTggggg...==..f...TT',
      'TT........==......TT',
      'TT..f.....==......TT',
      'TT........==.gggg.TT',
      'TTgggg....==.gggg.TT',
      'TTgggg....==.gggg.TT',
      'TTgggg....==..nnnnTT',
      'TT........==..n.f.TT',
      'TT..f.....==......TT',
      'TT........==..n...TT',
      'TTTT......==..nnTTTT',
      'TTTTTT....==..TTTTTT',
      'TTTTTTTTTT==TTTTTTTT',
      'TTTTTTTTTT==TTTTTTTT'
    ]),
    battleBg: 'field', bgm: 'overworld', buildings: [],
    encounters: [[30, 'pidgey'], [25, 'lillipup'], [20, 'wingull'], [15, 'psyduck'], [7, 'lotad'], [3, 'buneary']],
    encountersNight: [[30, 'hoothoot'], [25, 'psyduck'], [20, 'lotad'], [15, 'rattata'], [10, 'buneary']],
    levels: [3, 6],
    fishing: [[70, 'magikarp'], [30, 'psyduck']], fishLevels: [5, 10],
    exits: { up: { to: 'bridge', offset: -1 }, down: { to: 'garden', offset: 2 } }
  };
}

// ---------- Botanical Garden, Palm House, Steam Tunnels ----------

function garden(): MapData {
  const W = 28, H = 22, g = makeGrid(W, H, '.');
  fill(g, 0, 0, W, 2, 'T'); fill(g, 0, 19, W, 3, 'T');
  fill(g, 0, 0, 2, H, 'T'); fill(g, 26, 0, 2, H, 'T');
  fill(g, 12, 0, 2, 7, '=');
  fill(g, 8, 6, 12, 1, '='); fill(g, 8, 6, 1, 7, '='); fill(g, 19, 6, 1, 7, '=');
  fill(g, 8, 11, 12, 2, '=');
  fill(g, 20, 11, 8, 2, '=');                 // east gate to Indre By
  fill(g, 3, 13, 5, 4, 'o'); fill(g, 21, 13, 4, 4, 'o');
  dots(g, 'f', [[4, 3], [5, 3], [6, 3], [4, 4], [6, 4], [20, 3], [21, 3], [22, 3], [21, 4], [10, 14], [11, 14],
    [12, 15], [15, 15], [16, 14], [17, 14], [9, 17], [18, 17], [12, 17], [15, 17]]);
  dots(g, 'T', [[2, 5], [3, 5], [2, 6], [3, 6]]);   // a whole 2x2 tree, not a half-height stub
  fill(g, 2, 7, 4, 3, 'g'); fill(g, 21, 7, 4, 3, 'g');   // flower beds
  return {
    id: 'garden', name: 'Botanical Garden', grid: g, w: W, h: H, battleBg: 'field', bgm: 'overworld',
    buildings: [{ s: 'palm', x: 10, y: 7, id: 'palm' }],
    encounters: [[30, 'combee'], [25, 'bounsweet'], [20, 'petilil'], [20, 'cutiefly'], [5, 'smoliv']],
    encountersNight: [[30, 'combee'], [30, 'spinarak'], [25, 'oddish'], [15, 'cutiefly']],
    levels: [8, 11],
    exits: { up: { to: 'route1', offset: -2 }, right: { to: 'indreby', offset: -2 } }
  };
}

const palmhouse = (): MapData => ({
  ...room('palmhouse', 'The Palm House', [
    'wwwwwwwwwwwwwwwwww',
    'wPPP__________PPPw',
    'wP______________Pw',
    'wP__dddddddddd__Pw',
    'w___d________d___w',
    'wPP_d__PPPP__d_PPw',
    'w___d________d___w',
    'w___dddddddddd___w',
    'wP______________Pw',
    'wPP____________PPw',
    'w_______mm_______w',
    'wwwwwwwwwwwwwwwwww'
  ], { to: 'garden', x: 14, y: 11 }),
  battleBg: 'field'
});

function tunnels(): MapData {
  return {
    id: 'tunnels', name: 'Steam Tunnels', ...grid([
      'RRRRRRRRRRRRRRRRRRRRRRRR',
      'RmcccccccccccccccccccccR',
      'RccccccccccccccccccccccR',
      'RpppppppppppppppppppccRR',
      'RRRRRRRRRRRRRRRRRRRRccRR',
      'RccccccccccccccccccccccR',
      'RccccccccccccccccccccccR',
      'RccRRRRRRRRRRRRRRRRRRRRR',
      'RccRRRRRRRRRRRRRRRRRRRRR',
      'RccccccccccccccccccccccR',
      'RccccccccccccccccccccccR',
      'RppppppppppppppppccRpppR',
      'RRRRRRRRRRRRRRRRRccRRRRR',
      'RRRRRRRRRRRRRRRccccccRRR',
      'RRRRRRRRRRRRRRRccccccRRR',
      'RRRRRRRRRRRRRRRRRRRRRRRR'
    ]),
    battleBg: 'indoor1', bgm: 'overworld', buildings: [], indoor: true, dark: true,
    encounterTile: 'c', encounters: [[45, 'grimer'], [30, 'rattata'], [20, 'zubat'], [5, 'trubbish']], levels: [9, 12],
    warps: [{ x: 1, y: 1, to: 'garden', tx: 23, ty: 11, dir: 'down' }]
  };
}

// ---------- Indre By ----------

function indreby(): MapData {
  return {
    id: 'indreby', name: 'Indre By: Strøget', ...grid([
      'HHHHHHHHHHHHHHHHHHHHHHHHHHHHHH',
      'HHHHHHHHHHHHHHHHHHHHHHHHHHHHHH',
      'HHHHHHHHHHHHHHHHHHHHHHHHHHHHHH',
      'HHHHHHHHHHHHHHHHHHHHHHHHHHHHHH',
      'HHHHHHHHHHHHHHHHHHHHHHHHHHHHHH',
      'HqqqqqqqqqqqqqqqqqqqqqqqqqqqqH',
      'HqqqqqqqqqqqqqqqqqqqqqqqqqqqqH',
      'HqqqqqqqqqqqqqqqqqqqqqqqqqqqqH',
      'HHHHqqHHHHHHHHHHHHHHHHHHqqHHHH',
      'qqqqqqqqqqqqqqqqqqqqqqqqqqqqqq',
      'qqqqqqqqqqqqqqqqqqqqqqqqqqqqqq',
      'Hqqqqqqqqqqqqqqqqqqqqqqqqqqqqq',
      'HHHHHHHHHHHHHqqqHHHHHHHHHHHHHH',
      'HHHHHHHHHHHHHqqqHHHHHHHHHHHHHH',
      'HHHHHHHHHHHHHqqqHHHHHHHHHHHHHH',
      'HHHHHHHHHHHHHqqqHHHHHHHHHHHHHH'
    ]),
    battleBg: 'city', bgm: 'overworld',
    buildings: [{ s: 'pc', x: 3, y: 0, id: 'pc' }, { s: 'tower', x: 20, y: 0, id: 'tower' }],
    exits: { left: { to: 'garden', offset: 2 }, right: { to: 'nyhavn', offset: -1 }, down: { to: 'route4', offset: -6 } }
  };
}

const tower = () => room('towerin', 'Rundetårn', [
  'wwwwwwwww',
  'wKK___ddw',
  'w_____ddw',
  'w_______w',
  'w___m___w',
  'wwwwwwwww'
], { to: 'indreby', x: 21, y: 5 });

// ---------- Nyhavn ----------

function nyhavn(): MapData {
  return {
    id: 'nyhavn', name: 'Nyhavn', ...grid([
      'HHHHHHHHHHHHHHHHHHHHHHHHHH',
      'HHHHHHHHHHHHHHHHHHHHHHHHHH',
      'HHHHHHHHHHHHHHHHHHHHHHHHHH',
      'HHqqqqqqqqqqqqqqqqqqqqqqqq',
      'HHqqqqqqqqqqqqqqqqqqqqqqqq',
      'HH~~~~~~~~~~~~~~~~~~~~qqqq',
      'HH~~~~~~~~~~~~~~~~~~~~qqqq',
      'HH~~~~~~~~~~~~~~~~~~~~qqqq',
      'qqqqqqqqqqqqqqqqqqqqqqqqqq',
      'qqqqqqqqqqqqqqqqqqqqqqqqqq',
      'qqqqqqqqqqqqqqqqqqqqqqqqqq',
      'HHHHHHHHHHHHHHHHHHHddddddd',
      'HHHHHHHHHHHHHHHHHHHd~~~~~~',
      'HHHHHHHHHHHHHHHHHHHd~~~~~~'
    ]),
    battleBg: 'city', bgm: 'overworld',
    buildings: [{ s: 'cafe', x: 9, y: 0, id: 'cafe' }],
    fishing: [[50, 'magikarp'], [30, 'tentacool'], [20, 'finizen']], fishLevels: [12, 17],
    exits: { left: { to: 'indreby', offset: 1 }, right: { to: 'osterbro', offset: 4 } }
  };
}

const cafe = () => room('cafein', 'Café in Nyhavn', [
  'wwwwwwwwwww',
  'wKKK___KKKw',
  'w_________w',
  'w_KK___KK_w',
  'w_________w',
  'w____m____w',
  'wwwwwwwwwww'
], { to: 'nyhavn', x: 10, y: 3 });

// ---------- Refshaleøen drydock ----------

function drydock(): MapData {
  return {
    id: 'drydock', name: 'Refshaleøen', ...grid([
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
      '~ddddd~~~~~~~~~~~~~~~~~~~~~~',
      '~ddddaaaaaaaxaaaaaaaaxaaaaa~',
      '~~~~aaggggaaxaaggggaaxaaaaa~',
      '~~~~aaggggaaxaaggggaaxaaaaa~',
      '~~~~aaaaaaaaxaaaaaaaaxaaaaaa',
      '~~~~aaaaaaaaaaaaaaaaaxaaaaaa',
      '~~~~aaggggaaxaaggggaaaaaaaa~',
      '~~~~aaggggaaxaaggggaaxaaaaa~',
      '~~~~aaaaaaaaxaaaaaaaaxaaaaa~',
      '~~~~xxxxxxxxxxxxxxxxxxaaaaa~',
      '~~~~~~~~~~~~~~~~~~~~~~ooooo~',
      '~~~~~~~~~~~~~~~~~~~~~~ooooo~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~'
    ]),
    battleBg: 'city', bgm: 'overworld', buildings: [],
    encounters: [[30, 'trubbish'], [25, 'rattata'], [20, 'machop'], [15, 'mareanie'], [10, 'rolycoly']],
    encountersNight: [[30, 'trubbish'], [30, 'zubat'], [25, 'stunky'], [15, 'mareanie']],
    levels: [14, 17],
    exits: { right: { to: 'shipyards', offset: 0 } }   // the shipyards open in Chapter 10
  };
}

// ---------- Route 4, Christianshavn, Stadsgraven ----------

function route4(): MapData {
  return {
    id: 'route4', name: 'Route 4: Knippelsbro', ...grid([
      'TTTTTTTqqqTTTTTTTTTT',
      '~~~~~~nqqqn~~~~~~~~~',
      '~~~~~~nqqqn~~~~~~~~~',
      '~~~~~~nqqqn~~~~~~~~~',
      '~~~~~~nqqqn~~~~~~~~~',
      'TT..ggqqqqgg..f..TTT',
      'qqqqggqqqqgg.....TTT',
      'qqqqqqqqqq..gggg.TTT',
      'TTf...qqqq..gggg.TTT',
      'TToooooqqoooooooooTT',
      'TToooooqqoooooooooTT',
      'TT....qqqq.......TTT',
      'TT.gggqqqq..ggg..TTT',
      'TT.gggqqqq..ggg..TTT',
      'TT....qqqq.......TTT',
      'TTTTTTqqqqTTTTTTTTTT'
    ]),
    battleBg: 'city', bgm: 'overworld', buildings: [],
    encounters: [[35, 'wingull'], [25, 'pidgey'], [20, 'skwovet'], [15, 'starly'], [5, 'wattrel']],
    encountersNight: [[30, 'hoothoot'], [25, 'wingull'], [25, 'nickit'], [20, 'murkrow']],
    levels: [13, 16],
    fishing: [[50, 'magikarp'], [30, 'tentacool'], [20, 'finizen']], fishLevels: [12, 17],
    exits: { up: { to: 'indreby', offset: 6 }, down: { to: 'christianshavn', offset: 6 }, left: { to: 'slotsholmen', offset: 3 } }
  };
}

function christianshavn(): MapData {
  return {
    id: 'christianshavn', name: 'Christianshavn & Freetown', ...grid([
      'HHHHHHHHHHHHqqqqHHHHHHHHHHHH',
      'HHHHHHHHHHHHqqqqHHHHHHHHHHHH',
      'HHqqqqqqqqqqqqqqqqqqqqqqqqHH',
      'HHqqqqqqqqqqqqqqqqqqqqqqqqHH',
      'HH~~~~~~~~~~qqqq~~~~~~~~~~HH',
      'HH~~~~~~~~~~qqqq~~~~~~~~~~HH',
      'TT..........qqqq..........TT',
      'TT.gggg.....qqqq...........T',
      'TT.gggg..KK.qqqq.KK.........',
      'TT.gggg.....qqqq............',
      'TT..........qqqq............',
      'TT..ggg...ffqqqqff........TT',
      'TT..ggg.....qqqq..........TT',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTT'
    ]),
    battleBg: 'city', bgm: 'overworld',
    buildings: [{ s: 'pc', x: 20, y: 6, id: 'pc' }],
    encounters: [[25, 'cutiefly'], [25, 'hoppip'], [20, 'smoliv'], [20, 'skwovet'], [10, 'shroodle']],
    encountersNight: [[30, 'stunky'], [30, 'nickit'], [20, 'shroodle'], [20, 'hoothoot']],
    levels: [15, 18],
    fishing: [[50, 'magikarp'], [30, 'tentacool'], [20, 'shellos']], fishLevels: [12, 17],
    exits: { up: { to: 'route4', offset: -6 }, right: { to: 'stadsgraven', offset: 0 } }
  };
}

function stadsgraven(): MapData {
  return {
    id: 'stadsgraven', name: 'Stadsgraven', ...grid([
      'TTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TT.ggg....oooooooooooooTTT',
      'TT.ggg....oooooooooooooTTT',
      'TT........oooooooooooooTTT',
      'TT.....dddddddoooooooooTTT',
      'TT.....d.....dooooooooooTT',
      'TT.....d.....ddddddddoooTT',
      'TT.....d..........ooooooTT',
      '.......d..........ooooooTT',
      '.......d..........ooooooTT',
      '...........ggg....ooooooTT',
      'TT.........ggg....ooooooTT',
      'TT................ooooooTT',
      'TTTTTTTTTTTTTTTTTTTTTTTTTT'
    ]),
    battleBg: 'field', bgm: 'overworld',
    buildings: [{ s: 'houseboat', x: 15, y: 3, id: 'gym' }],
    encounters: [[25, 'cutiefly'], [25, 'hoppip'], [20, 'smoliv'], [20, 'skwovet'], [10, 'shroodle']],
    encountersNight: [[30, 'stunky'], [30, 'nickit'], [20, 'shroodle'], [20, 'hoothoot']],
    levels: [15, 18],
    fishing: [[50, 'magikarp'], [30, 'tentacool'], [20, 'shellos']], fishLevels: [12, 17],
    exits: { left: { to: 'christianshavn', offset: 0 } }
  };
}

// Gym 2: houseboats on the moat. Solar mirrors make lilies bloom into bridges (floor objects in the pack).
const gym2 = (): MapData => ({
  ...room('gym2', 'Stadsgraven Gym', [
    'wwwwwwwwwwwwwwwww',
    'wdddddddddddddddw',
    'wdddddddddddddddw',
    'wooooooooooooooow',
    'wooooooooooooooow',
    'wddddddooooooooow',
    'wddddddooooooooow',
    'wooooooooooooooow',
    'wdddddddddddddddw',
    'wdddddddmdddddddw',
    'wwwwwwwwwwwwwwwww'
  ], { to: 'stadsgraven', x: 17, y: 6 }),
  battleBg: 'field'
});

// Dragør (Ch3): the yellow fishing village. Vuggestuen (the daycare) and its pram yard behind a beech
// hedge, cobbled lanes and the old harbour. Reached by Skipper Mads's ferry from Islands Brygge.
function dragor(): MapData {
  const W = 26, H = 20, g = makeGrid(W, H, '.');
  fill(g, 0, 0, W, 2, 'T'); fill(g, 0, 18, W, 2, 'T'); fill(g, 0, 0, 2, H, 'T');
  fill(g, 21, 0, 5, H, '~');                  // Øresund
  fill(g, 20, 2, 1, 16, 'q');                 // the quay
  fill(g, 2, 9, 18, 1, 'q');                  // Strandgade
  fill(g, 10, 2, 1, 16, 'q');                 // Kongevejen
  fill(g, 2, 11, 8, 6, 'T'); fill(g, 4, 12, 4, 4, '.'); g[11][4] = g[11][5] = '.';   // pram yard inside a beech hedge
  dots(g, 'f', [[4, 12], [7, 12], [2, 3], [2, 4], [8, 2], [9, 2], [12, 7], [13, 7], [17, 7], [18, 7], [12, 16], [18, 16]]);
  return {
    id: 'dragor', name: 'Dragør', grid: g, w: W, h: H, battleBg: 'city', bgm: 'overworld',
    buildings: [
      { s: 'home', x: 3, y: 3, id: 'vuggestuen' }, { s: 'orange', x: 12, y: 3 }, { s: 'green', x: 16, y: 3 },
      { s: 'red', x: 12, y: 12 }, { s: 'orange', x: 16, y: 12 }
    ]
  };
}

// ---------- Chapter 3: Route 2, Vesterbro, Kødbyen, Cykelslangen, Islands Brygge ----------

// Route 2: Den Grønne Sti, the sunken green bike highway from Nørrebro towards Vesterbro.
function route2(): MapData {
  const W = 30, H = 16, g = makeGrid(W, H, '.');
  fill(g, 0, 0, W, 1, 'T'); fill(g, 0, 13, W, 3, 'T'); fill(g, 0, 0, 2, H, 'T'); fill(g, 28, 0, 2, H, 'T');
  fill(g, 4, 3, 26, 1, 'l');                  // the bike path, in from Nørrebro on the right...
  fill(g, 4, 3, 1, 13, 'l');                  // ...and down to Vesterbro
  fill(g, 3, 13, 3, 3, '.'); fill(g, 4, 13, 1, 3, 'l');
  fill(g, 2, 1, 7, 2, 'g'); fill(g, 20, 1, 6, 2, 'g'); fill(g, 11, 4, 4, 2, 'g'); fill(g, 16, 7, 3, 2, 'g');
  fill(g, 15, 10, 4, 2, 'g'); fill(g, 7, 11, 3, 2, 'g'); fill(g, 2, 7, 2, 2, 'g');
  fill(g, 7, 5, 2, 2, 'T'); fill(g, 19, 5, 2, 2, 'T'); fill(g, 9, 8, 5, 2, 'T'); fill(g, 21, 8, 4, 2, 'T');
  fill(g, 22, 4, 4, 2, 'a');                  // under the Frederiksberg overpass
  fill(g, 22, 0, 2, 4, 'a');                  // ...and the stairs up to Frederiksberg (Ch5)
  dots(g, 'f', [[10, 1], [13, 1], [16, 2], [11, 7], [25, 7], [23, 11], [12, 12]]);
  return {
    id: 'route2', name: 'Route 2: Den Grønne Sti', grid: g, w: W, h: H, battleBg: 'field', bgm: 'overworld', buildings: [],
    encounters: [[30, 'skwovet'], [25, 'nickit'], [20, 'combee'], [15, 'shroodle'], [10, 'flittle']],
    encountersNight: [[35, 'nickit'], [25, 'hoothoot'], [20, 'shroodle'], [20, 'stunky']],
    levels: [17, 20],
    exits: { right: { to: 'norrebro', offset: 5 }, down: { to: 'vesterbro', offset: 9 }, up: { to: 'frederiksberg', offset: -9 } }
  };
}

// Vesterbro: red-brick courtyards, the Hygge café and the Pokémon Center. Istedgade runs east to Cykelslangen.
function vesterbro(): MapData {
  const W = 28, H = 20, g = makeGrid(W, H, '.');
  fill(g, 0, 0, W, 2, 'H'); fill(g, 0, 18, W, 2, 'H'); fill(g, 0, 0, 2, H, 'H'); fill(g, 26, 0, 2, H, 'H');
  fill(g, 12, 0, 3, H, 'q');                  // Vesterbrogade, north to the Green Path and south to Kødbyen
  fill(g, 2, 9, 26, 2, 'q');                  // Istedgade, east to the bridge
  fill(g, 2, 15, 6, 3, 'H'); fill(g, 20, 15, 6, 3, 'H');
  dots(g, 'f', [[3, 3], [3, 4], [10, 3], [16, 12], [16, 13], [23, 12], [3, 12], [9, 13]]);
  fill(g, 22, 3, 3, 2, 'T');
  return {
    id: 'vesterbro', name: 'Vesterbro', grid: g, w: W, h: H, battleBg: 'city', bgm: 'overworld',
    buildings: [
      { s: 'cafe', x: 4, y: 5, id: 'cafe' }, { s: 'orange', x: 8, y: 4 }, { s: 'pc', x: 16, y: 3, id: 'pc' },
      { s: 'orange', x: 4, y: 12 }, { s: 'blue', x: 17, y: 12, id: 'bakery' }
    ],
    exits: { up: { to: 'route2', offset: -9 }, right: { to: 'route3', offset: -5 }, down: { to: 'kodbyen', offset: 0 } }
  };
}

const vbCafe = () => room('cafevb', 'Kaffebaren', [
  'wwwwwwwwwww',
  'wKKK___KKKw',
  'w_________w',
  'w_K_____K_w',
  'w_________w',
  'w____m____w',
  'wwwwwwwwwww'
], { to: 'vesterbro', x: 5, y: 8 });

// Kødbyen, the white-tiled Meatpacking District: Kasper's food-bank kitchen, the locker row, the neon square and Gym 3.
function kodbyen(): MapData {
  const W = 28, H = 20, g = makeGrid(W, H, 'W');
  fill(g, 0, 0, W, 2, 'H'); fill(g, 0, 18, W, 2, 'H'); fill(g, 0, 0, 2, H, 'H'); fill(g, 26, 0, 2, H, 'H');
  fill(g, 12, 0, 3, 2, 'W');                  // the gateway from Vesterbro
  fill(g, 14, 11, 10, 6, 'v');                // the neon square
  fill(g, 2, 2, 8, 1, 'H');
  return {
    id: 'kodbyen', name: 'Kødbyen', grid: g, w: W, h: H, battleBg: 'city', bgm: 'overworld',
    buildings: [{ s: 'blue', x: 4, y: 4, id: 'kitchen' }, { s: 'gym', x: 18, y: 3, id: 'gym' }],
    exits: { up: { to: 'vesterbro', offset: 0 } }
  };
}

const kitchen = () => room('kitchen', 'Kasper\'s Kitchen', [
  'wwwwwwwwwwwww',
  'wKKKKK_KKKKKw',
  'w___________w',
  'w_KK_____KK_w',
  'w___________w',
  'w_KK_____KK_w',
  'w_____m_____w',
  'wwwwwwwwwwwww'
], { to: 'kodbyen', x: 5, y: 7 });

// Gym 3, the Kødbyen Cold Stores: sea ice over the locker floors. Slide to the three steam valves (in the walls)
// and open them in menu order; the steam melts the ice block in the gap below Kasper.
const gym3 = (): MapData => ({
  ...room('gym3', 'Kødbyen Cold Stores', [
    'wwwwwwwwwwwwwww',
    'w_____________w',
    'w_____________w',
    'wwwwwww_wwwwwww',
    'wiiiiiiiKiKiiiw',
    'wiiKiiiiiiiiiiw',
    'wiiiiiiiiiiiKiw',
    'wiiiiiiKiiiiiiw',
    'wKiiiiiiiiiiiiw',
    'wiiiiiiiiKiiiiw',
    'w_____________w',
    'w______m______w',
    'wwwwwwwwwwwwwww'
  ], { to: 'kodbyen', x: 21, y: 8 }),
  battleBg: 'indoor1'
});

// Route 3: Cykelslangen, the orange cycle snake over the harbour. A tailwind blows the whole way across.
function route3(): MapData {
  return {
    id: 'route3', name: 'Route 3: Cykelslangen', ...grid([
      '~~~~~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~yyyyyyy~~~~~~~~~',
      '~~~~~~~~yyyyyyyyyy~~~~~~~~',
      'yyyyyyyyyyy~~~~yyyyyyyyyyy',
      'yyyyyyyyyy~~~~~~yyyyyyyyyy',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~'
    ]),
    battleBg: 'city', bgm: 'overworld', buildings: [],
    fishing: [[50, 'tentacool'], [30, 'wingull'], [20, 'finizen']], fishLevels: [17, 21],
    exits: { left: { to: 'vesterbro', offset: 5 }, right: { to: 'islandsbrygge', offset: 4 } }
  };
}

// Islands Brygge: lawns, grain silos turned flats and the harbour bath. The south lawn runs out at the edge of
// Kalvebod Wilds; past the reeds it's open water until the bike has Hydrofoils.
function islandsbrygge(): MapData {
  const W = 26, H = 22, g = makeGrid(W, H, '.');
  fill(g, 0, 0, W, 2, 'H'); fill(g, 22, 0, 4, H, 'H'); fill(g, 0, 20, W, 2, '~');
  fill(g, 0, 2, 2, 18, '~'); fill(g, 0, 8, 2, 2, 'y');              // the bridge lands on the west quay
  fill(g, 2, 2, 1, 18, 'q');                                          // the quay
  fill(g, 3, 3, 8, 6, 'o'); fill(g, 3, 3, 8, 1, 'd'); fill(g, 3, 8, 8, 1, 'd'); fill(g, 3, 3, 1, 6, 'd'); fill(g, 10, 3, 1, 6, 'd');
  fill(g, 6, 5, 2, 2, 'd');                                            // the harbour bath's diving pier
  fill(g, 14, 3, 6, 4, 'H');                                           // silo flats
  fill(g, 2, 14, 20, 6, 'g'); fill(g, 6, 16, 3, 2, 'o'); fill(g, 15, 15, 2, 2, 'T');   // the Kalvebod edge: reeds and a pond
  fill(g, 12, 9, 1, 11, '='); fill(g, 2, 9, 20, 1, '=');
  dots(g, 'f', [[13, 11], [18, 11], [20, 8], [4, 11], [8, 12]]);
  return {
    id: 'islandsbrygge', name: 'Islands Brygge', grid: g, w: W, h: H, battleBg: 'field', bgm: 'overworld', buildings: [],
    encounters: [[25, 'wooloo'], [20, 'mudbray'], [20, 'wattrel'], [15, 'bramblin'], [10, 'ralts'], [10, 'starly']],
    encountersNight: [[30, 'hoothoot'], [25, 'mudbray'], [20, 'ralts'], [15, 'stunky'], [10, 'bramblin']],
    levels: [19, 22],
    fishing: [[40, 'tentacool'], [30, 'finizen'], [30, 'shellos']], fishLevels: [18, 22],
    exits: { left: { to: 'route3', offset: -4 } }
  };
}

// ---------- Chapter 4: Lanterns Out ----------

// Assistens Kirkegård: headstones under old trees, Søren's lanterns along the main avenue, a storm drain
// in the east corner and the Lantern Walk (Gym 4) through the gate at the top.
function assistens(): MapData {
  const W = 28, H = 24, g = makeGrid(W, H, '.');
  fill(g, 0, 0, W, 2, 'T'); fill(g, 0, 22, W, 2, 'T'); fill(g, 0, 0, 2, H, 'T'); fill(g, 26, 0, 2, H, 'T');
  fill(g, 15, 0, 2, H, 'q');                  // the main avenue, Nørrebro to the Lantern Walk gate
  fill(g, 2, 12, 24, 1, 'q');                 // the cross path
  fill(g, 3, 2, 7, 2, 'g'); fill(g, 19, 19, 4, 2, 'g'); fill(g, 2, 13, 3, 2, 'g');
  fill(g, 3, 20, 3, 2, 'T'); fill(g, 21, 2, 3, 2, 'T'); fill(g, 8, 21, 4, 1, 'T');
  dots(g, 'f', [[13, 3], [18, 3], [13, 10], [18, 14], [3, 11], [25, 11], [7, 14], [22, 14]]);
  return {
    id: 'assistens', name: 'Assistens Kirkegård', grid: g, w: W, h: H, battleBg: 'field', bgm: 'overworld', buildings: [],
    encounters: [[30, 'skwovet'], [20, 'phantump'], [20, 'nickit'], [15, 'cutiefly'], [15, 'greavard']],
    encountersNight: [[30, 'litwick'], [25, 'gastly'], [20, 'misdreavus'], [15, 'greavard'], [10, 'hoothoot']],
    levels: [22, 26],
    exits: { down: { to: 'norrebro', offset: 0 }, up: { to: 'gym4', offset: -8 } }
  };
}

// Under the cemetery: a storm drain where the groundwater is sinking and freezing. The ice crossing is
// left, down, left, down from the east corridor (checked by a solver: no position on it is a dead end).
function stormdrain(): MapData {
  const W = 22, H = 17, g = makeGrid(W, H, 'R');
  fill(g, 1, 1, 20, 2, 'c');                  // the upper culvert
  fill(g, 4, 3, 14, 1, 'u');                  // drain water, running east
  fill(g, 19, 3, 2, 10, 'c'); fill(g, 18, 6, 1, 1, 'c');
  fill(g, 4, 5, 14, 8, 'i');                  // the frozen sump
  dots(g, 'R', [[13, 6], [9, 12], [17, 7], [6, 9], [15, 10]]);
  fill(g, 10, 13, 1, 1, 'c'); fill(g, 5, 14, 11, 2, 'c');   // down into the intake chamber
  return {
    id: 'stormdrain', name: 'Storm Drain', grid: g, w: W, h: H, battleBg: 'indoor1', bgm: 'overworld', buildings: [], indoor: true, dark: true,
    encounterTile: 'c', encounters: [[35, 'zubat'], [25, 'wooper'], [25, 'grimer'], [15, 'litwick']], levels: [23, 26]
  };
}

// Gym 4: Søren's Lantern Walk at night. Three hedges, three gaps each; the rhymes on the monuments say
// which gap is true. Through a wrong one the wind blows the lantern out and the paths twist you back.
function gym4(): MapData {
  const W = 15, H = 20, g = makeGrid(W, H, '.');
  fill(g, 0, 0, W, 1, 'T'); fill(g, 0, 0, 1, H, 'T'); fill(g, W - 1, 0, 1, H, 'T'); fill(g, 0, H - 1, W, 1, 'T');
  for (const y of [4, 8, 12]) { fill(g, 1, y, W - 2, 1, 'T'); dots(g, 'q', [[2, y], [7, y], [12, y]]); }
  fill(g, 7, 13, 1, 6, 'q'); fill(g, 7, H - 1, 2, 1, 'q');
  dots(g, 'f', [[3, 2], [11, 2], [2, 6], [12, 10], [3, 15], [11, 16]]);
  return {
    id: 'gym4', name: 'The Lantern Walk', grid: g, w: W, h: H, battleBg: 'field', bgm: 'overworld', buildings: [], dark: true,
    exits: { down: { to: 'assistens', offset: 8 } }
  };
}

// ---------- Chapter 5: The Cisterns ----------

// Frederiksberg: the palace at the top of the avenue, the zoo fence, and Søndermarken's lawns with the
// glass pyramid over the old royal reservoir. In from Den Grønne Sti's overpass stairs at the bottom.
function frederiksberg(): MapData {
  const W = 28, H = 24, g = makeGrid(W, H, '.');
  fill(g, 0, 0, W, 2, 'T'); fill(g, 0, 22, W, 2, 'T'); fill(g, 0, 0, 2, H, 'T'); fill(g, 26, 0, 2, H, 'T');
  fill(g, 13, 6, 2, 18, 'q');                 // Frederiksberg Allé, up to the palace
  fill(g, 9, 2, 10, 3, 'H');                  // Frederiksberg Palace (the cadet academy)
  fill(g, 7, 5, 14, 2, 'q');                  // the palace forecourt
  fill(g, 5, 14, 8, 1, '=');                  // to the Pokémon Center
  fill(g, 15, 15, 7, 1, '=');                 // into Søndermarken, to the pyramid
  fill(g, 2, 17, 9, 1, 'n'); fill(g, 2, 18, 9, 4, 'g');   // the zoo fence; the paddock behind it
  fill(g, 17, 9, 4, 3, 'g'); fill(g, 22, 17, 3, 3, 'g'); fill(g, 16, 18, 3, 3, 'g'); fill(g, 3, 2, 4, 2, 'g');
  fill(g, 23, 9, 2, 2, 'T'); fill(g, 17, 13, 2, 1, 'T'); fill(g, 24, 13, 2, 2, 'T'); fill(g, 21, 2, 3, 2, 'T');
  dots(g, 'f', [[8, 4], [19, 4], [16, 7], [11, 7], [4, 8], [22, 21], [15, 20], [25, 16]]);
  return {
    id: 'frederiksberg', name: 'Frederiksberg', grid: g, w: W, h: H, battleBg: 'field', bgm: 'overworld',
    buildings: [{ s: 'pc', x: 3, y: 9, id: 'pc' }, { s: 'pyramid', x: 20, y: 13, id: 'cisterns' }],
    encounters: [[25, 'deerling'], [25, 'fletchling'], [20, 'pikipek'], [15, 'skwovet'], [10, 'hoppip'], [5, 'buneary']],
    encountersNight: [[30, 'noibat'], [25, 'hoothoot'], [20, 'deerling'], [15, 'murkrow'], [10, 'stunky']],
    levels: [25, 28],
    exits: { down: { to: 'route2', offset: 9 } }
  };
}

// The Cisterns under Søndermarken, pitch dark. Hall A has the mirror pool and the false wall; the
// reservoir (Hall B) is mostly deep water, with two stone causeways that surface as the sluice wheels
// lower the level (the client draws flood covers over them until then). Hall C has Brix's drones, and
// the Sunken Archive lies west of it.
function cisterns(): MapData {
  return {
    id: 'cisterns', name: 'The Cisterns', ...grid([
      'RRRRRRRRRRRRRRRRRRRRRRRRRRRRRR',
      'RcccccccccccRccuuuuuuuuuuuuucR',
      'RcccccccccccRccccccccccccccccR',
      'RccRcRcRcRccRccuuuuuuuuuuucuuR',
      'RcccccccccccRccuuuuuuuuuuucuuR',
      'RccccccccccccccuuRuuRuuRuucuuR',
      'RcccccccccccRccuuuuuuuuuuucuuR',
      'RccRcRcRcRccRccuuuuuuuuuuucuuR',
      'RcccccccccccRccuuRuuRuuuuucuuR',
      'RcccccccccccRccuuuuuuccccccuuR',
      'RRRRRRRRRRRRRRRuuuuuucuuuuuuuR',
      'RRRRRRRRRRRRRRRRRRRRRcRRRRRRRR',
      'RcKKKKKKKKKcRccccccccccccccccR',
      'RcccccccccccRccccccccccccccccR',
      'RcccccccccccRcccRcccRcccRccccR',
      'RcccccccccccRccccccccccccccccR',
      'RccccccccccccccccccccccccccccR',
      'RcccccccccccRccccccccccccccccR',
      'RcccccccccccRcccRcccRcccRccccR',
      'RcccccccccccRccccccccccccccccR',
      'RcccccccccccRccccccccccccccccR',
      'RRRRRRRRRRRRRRRRRRRRRRRRRRRRRR'
    ]),
    battleBg: 'indoor1', bgm: 'overworld', buildings: [], indoor: true, dark: true,
    encounterTile: 'c', encounters: [[35, 'zubat'], [25, 'wooper'], [25, 'dewpider'], [10, 'sableye'], [5, 'golbat']], levels: [26, 29]
  };
}

// ---------- Chapter 6: Look Up ----------

// Rundetårn's spiral ramp, drawn as three square rings of 2-wide corridor around the observatory.
// In at the bottom, west and up through the outer ring (a door to the library hall on the west wall),
// across the Trick Room floor at the top, down the east side (the Trinitatis loft door), then in through
// the gap at (16,19) to the middle ring, whose east side is Trick Room again, in at (8,16) to the inner
// ring with the three brass rings, and through the orrery gate at (11,13) to Tycho.
function rundetarn(): MapData {
  const W = 23, H = 23, g = makeGrid(W, H, '_');
  const ring = (a: number, b: number) => { fill(g, a, a, b - a + 1, 1, 'w'); fill(g, a, b, b - a + 1, 1, 'w'); fill(g, a, a, 1, b - a + 1, 'w'); fill(g, b, a, 1, b - a + 1, 'w'); };
  ring(0, 22); ring(3, 19); ring(6, 16); ring(9, 13);
  fill(g, 13, 20, 1, 2, 'w');                 // outer ring: the way up starts west
  g[19][16] = '_';                            // into the middle ring
  fill(g, 15, 17, 1, 2, 'w');                 // middle ring: east first
  g[16][8] = '_';                             // into the inner ring
  fill(g, 10, 14, 1, 2, 'w');                 // inner ring: west first
  g[13][11] = '_';                            // the orrery gate (an object until the rings line up)
  fill(g, 3, 1, 17, 2, 'z');                  // Trick Room: the top of the outer ring
  fill(g, 17, 6, 2, 11, 'z');                 // Trick Room: the east side of the middle ring
  dots(g, 'K', [[7, 1], [11, 2], [15, 1], [17, 9], [18, 13]]);   // brass instruments to weave around
  g[21][11] = 'm'; g[11][0] = 'm'; g[11][22] = 'm';
  return {
    id: 'rundetarn', name: 'Rundetårn: the Ramp', grid: g, w: W, h: H, battleBg: 'indoor1', bgm: 'overworld', buildings: [], indoor: true,
    warps: [
      { x: 11, y: 21, to: 'towerin', tx: 6, ty: 3, dir: 'down' },
      { x: 0, y: 11, to: 'bibliotek', tx: 11, ty: 4, dir: 'left' },
      { x: 22, y: 11, to: 'trinitatis', tx: 1, ty: 4, dir: 'right' }
    ]
  };
}

// Bibliotekssalen, the old university library hall halfway up the tower. The objective lens rolled under the shelves.
const bibliotek = (): MapData => ({
  id: 'bibliotek', name: 'Bibliotekssalen', ...grid([
    'wwwwwwwwwwwwww',
    'wKK_KK__KK_KKw',
    'w____________w',
    'w_KK__KK__KK_w',
    'w____________m',
    'w_KK__KK__KK_w',
    'w____________w',
    'wwwwwwwwwwwwww'
  ]), battleBg: 'indoor1', bgm: 'overworld', buildings: [], indoor: true,
  warps: [{ x: 13, y: 4, to: 'rundetarn', tx: 1, ty: 11, dir: 'right' }]
});

// The loft of Trinitatis Church, through the little door where tower and church meet: beams, dust and a Murkrow's nest.
const trinitatis = (): MapData => ({
  id: 'trinitatis', name: 'Trinitatis Loft', ...grid([
    'wwwwwwwwwwwwww',
    'w__K___K___K_w',
    'w____________w',
    'w_K___K___K__w',
    'm____________w',
    'w__K___K___K_w',
    'w____________w',
    'wwwwwwwwwwwwww'
  ]), battleBg: 'indoor1', bgm: 'overworld', buildings: [], indoor: true, dark: true,
  warps: [{ x: 0, y: 4, to: 'rundetarn', tx: 21, ty: 11, dir: 'left' }]
});

// ---------- Chapter 7: North by Kystbanen ----------

// Østerbro: in from Nyhavn along the Langelinie promenade, Kastellet's star fortress, the Pokémon Center,
// Fælledparken's lawns, the pier out to the little statue, and Strandvejen leading north. Østerport station
// (Kystbanen) is by the road.
function osterbro(): MapData {
  return {
    id: 'osterbro', name: 'Østerbro: Langelinie', ...grid([
      'TTTTTTTTTTTTTTTTTTTTTTqqqqTTTT',
      'T.....................qqqq...T',
      'T.....................qqqq.f.T',
      'T.....................qqqq...T',
      'T....=................qqqq...T',
      'T....=................qqqq...T',
      'T....=.......=........qqqq...T',
      'qqqqqqqqqqqqqqqqqqqqqqqqqq...T',
      'qqqqqqqqqqqqqqqqqqqqqqqqqq...T',
      'qq..gggggg...ff.....dd.......T',
      'qq..gggggg..........dd~~~~~~~~',
      'qq..gggggg....TT....dd~~~~~~~~',
      'qq..gggggg....TT....dd~~~~~~~~',
      'qq..gggggg..........dd~~~~~~~~',
      'qq..................dd~~~~~~~~',
      'T.....TT............dd~~~~~~~~',
      'T.....TT...ggggg....dd~~~~~~~~',
      'T...........ggggg...dd~~~~~~~~',
      'Tqqqqqqqqqqqqqqqqqqqdd~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
      '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~'
    ]),
    battleBg: 'city', bgm: 'overworld',
    buildings: [{ s: 'kastellet', x: 2, y: 1, id: 'kastellet' }, { s: 'pc', x: 11, y: 1, id: 'pc' }],
    encounters: [[25, 'wingull'], [25, 'skwovet'], [20, 'fidough'], [15, 'cutiefly'], [15, 'wooloo']],
    encountersNight: [[30, 'hoothoot'], [25, 'noibat'], [25, 'nickit'], [20, 'murkrow']],
    levels: [30, 33],
    fishing: [[40, 'tentacool'], [30, 'finizen'], [20, 'shellder'], [10, 'wingull']], fishLevels: [28, 32],
    exits: { left: { to: 'nyhavn', offset: -4 }, up: { to: 'route8', offset: -17 } }
  };
}

// Kastellet: the star fortress, ramparts lined with trees, red barracks and the commandant's parade ground.
function kastellet(): MapData {
  const W = 24, H = 20, g = makeGrid(W, H, '.');
  fill(g, 0, 0, W, 1, 'T'); fill(g, 0, H - 1, W, 1, 'T'); fill(g, 0, 0, 2, H, 'T'); fill(g, W - 2, 0, 2, H, 'T');
  fill(g, 2, 0, 3, 3, 'T'); fill(g, 19, 0, 3, 3, 'T'); fill(g, 2, 16, 3, 3, 'T'); fill(g, 19, 16, 3, 3, 'T');   // the bastions
  fill(g, 10, 1, 2, 18, 'q'); fill(g, 2, 12, 20, 2, 'q');
  g[H - 1][10] = 'm'; g[H - 1][11] = 'm';
  dots(g, 'f', [[6, 1], [15, 1], [7, 17], [16, 17]]);
  return {
    id: 'kastellet', name: 'Kastellet', grid: g, w: W, h: H, battleBg: 'field', bgm: 'overworld',
    buildings: [{ s: 'red', x: 4, y: 3 }, { s: 'red', x: 4, y: 7 }, { s: 'red', x: 16, y: 3 }, { s: 'red', x: 16, y: 7 }],
    warps: [{ x: 10, y: H - 1, to: 'osterbro', tx: 5, ty: 4, dir: 'down' }, { x: 11, y: H - 1, to: 'osterbro', tx: 5, ty: 4, dir: 'down' }]
  };
}

// Route 8: Strandvejen, the coast road north. Villas on the left, the bike lane and beach on the right, the
// ice-bath club's pier out into the Sound. A lane west leads to Lyngby and Frilandsmuseet.
function route8(): MapData {
  const W = 16, H = 40, g = makeGrid(W, H, '.');
  fill(g, 0, 0, 1, H, 'T'); fill(g, 0, 0, 5, 1, 'T'); fill(g, 9, 0, 7, 1, 'T'); fill(g, 0, H - 1, 5, 1, 'T'); fill(g, 9, H - 1, 7, 1, 'T');
  fill(g, 5, 0, 2, H, 'a'); fill(g, 7, 0, 2, H, 'l');
  fill(g, 11, 1, 5, H - 1, '~');
  for (const y of [2, 7, 17, 22, 28, 33]) fill(g, 1, y, 3, 3, 'H');   // the villas
  fill(g, 0, 12, 5, 2, '='); g[12][0] = '='; g[13][0] = '=';          // the lane to Lyngby
  fill(g, 9, 24, 6, 2, 'd');                                          // the ice-bath club pier
  fill(g, 9, 4, 2, 4, 'g'); fill(g, 9, 14, 2, 5, 'g'); fill(g, 9, 30, 2, 5, 'g'); fill(g, 1, 15, 3, 2, 'g'); fill(g, 1, 36, 3, 2, 'g');
  dots(g, 'f', [[4, 6], [4, 21], [4, 27], [10, 10]]);
  return {
    id: 'route8', name: 'Route 8: Strandvejen', grid: g, w: W, h: H, battleBg: 'field', bgm: 'overworld', buildings: [],
    encounters: [[25, 'wingull'], [20, 'psyduck'], [20, 'clauncher'], [20, 'spheal'], [15, 'buizel']],
    encountersNight: [[30, 'noibat'], [25, 'psyduck'], [20, 'spheal'], [15, 'clauncher'], [10, 'murkrow']],
    levels: [31, 34],
    fishing: [[35, 'tentacool'], [25, 'shellder'], [25, 'finizen'], [15, 'clauncher']], fishLevels: [30, 34],
    exits: { down: { to: 'osterbro', offset: 17 }, up: { to: 'dyrehaven', offset: 10 }, left: { to: 'lyngby', offset: -3 } }
  };
}

// Lyngby: Frilandsmuseet, the open-air museum of old farmhouses, with fields, a pond and Ingrid's porch.
function lyngby(): MapData {
  const W = 26, H = 20, g = makeGrid(W, H, '.');
  fill(g, 0, 0, W, 1, 'T'); fill(g, 0, H - 1, W, 1, 'T'); fill(g, 0, 0, 1, H, 'T'); fill(g, W - 1, 0, 1, H, 'T');
  fill(g, 1, 9, W - 1, 2, '='); g[9][W - 1] = '='; g[10][W - 1] = '=';
  fill(g, 12, 1, 2, 8, '='); fill(g, 12, 11, 2, 8, '=');
  fill(g, 2, 13, 6, 4, 'g'); fill(g, 17, 2, 6, 3, 'g'); fill(g, 16, 13, 7, 4, 'g');
  fill(g, 3, 2, 4, 3, 'o');                   // the duck pond
  dots(g, 'f', [[8, 3], [9, 3], [15, 6], [20, 11], [3, 18], [10, 15]]);
  return {
    id: 'lyngby', name: 'Lyngby: Frilandsmuseet', grid: g, w: W, h: H, battleBg: 'field', bgm: 'overworld',
    buildings: [{ s: 'red', x: 7, y: 5 }, { s: 'green', x: 16, y: 5 }, { s: 'orange', x: 4, y: 11 }, { s: 'red', x: 18, y: 11 }],
    encounters: [[25, 'wooloo'], [20, 'cutiefly'], [20, 'skwovet'], [15, 'impidimp'], [10, 'morelull'], [10, 'fidough']],
    encountersNight: [[30, 'impidimp'], [25, 'morelull'], [20, 'hoothoot'], [15, 'phantump'], [10, 'murkrow']],
    levels: [31, 34],
    exits: { right: { to: 'route8', offset: 3 } }
  };
}

// Dyrehaven: the royal deer park. Gnarled oaks, open grass where the Stantler graze, the Eremitage hunting
// lodge, Klampenborg station at the south gate, and Vanguard's sub-station hidden in the trees to the east.
function dyrehaven(): MapData {
  const W = 34, H = 28, g = makeGrid(W, H, '.');
  fill(g, 0, 0, W, 1, 'T'); fill(g, 0, H - 1, W, 1, 'T'); fill(g, 0, 0, 1, H, 'T'); fill(g, W - 1, 0, 1, H, 'T');
  g[0][15] = '.'; g[0][16] = '.'; g[0][17] = '.'; g[0][18] = '.';
  for (let x = 15; x <= 18; x++) g[H - 1][x] = '.';
  fill(g, 15, 1, 4, H - 2, '=');              // the main ride up to Bakken
  fill(g, 19, 9, 9, 2, '=');                  // the track to the sub-station
  fill(g, 2, 3, 10, 6, 'g'); fill(g, 3, 13, 9, 6, 'g'); fill(g, 21, 15, 9, 7, 'g'); fill(g, 2, 21, 8, 4, 'g');
  const oaks = [[4, 10], [8, 10], [12, 12], [13, 4], [20, 3], [23, 3], [30, 3], [20, 13], [24, 13], [30, 12], [12, 20], [21, 23], [26, 23], [6, 25], [11, 25], [30, 25]];
  for (const [x, y] of oaks) fill(g, x, y, 2, 2, 'T');
  fill(g, 29, 4, 4, 4, 'T'); fill(g, 22, 1, 7, 2, 'T');
  return {
    id: 'dyrehaven', name: 'Dyrehaven', grid: g, w: W, h: H, battleBg: 'field', bgm: 'overworld',
    buildings: [{ s: 'orange', x: 6, y: 1 }, { s: 'substation', x: 24, y: 5, id: 'substation' }],
    encounters: [[25, 'stantler'], [20, 'deerling'], [15, 'phantump'], [15, 'skwovet'], [10, 'cutiefly'], [10, 'morelull'], [5, 'sawsbuck']],
    encountersNight: [[30, 'phantump'], [25, 'stantler'], [20, 'morelull'], [15, 'noibat'], [10, 'hoothoot']],
    levels: [33, 36],
    exits: { down: { to: 'route8', offset: -10 }, up: { to: 'bakken', offset: -2 } }
  };
}

const substation = () => room('substation', 'Vanguard Sub-station D-7', [
  'wwwwwwwwwwwwwww',
  'wpppp_____ppppw',
  'w_____________w',
  'w_pp_______pp_w',
  'w_____________w',
  'w_pp_______pp_w',
  'w_____________w',
  'w______m______w',
  'wwwwwwwwwwwwwww'
], { to: 'dyrehaven', x: 26, y: 8 });

// Bakken: the world's oldest amusement park, deep in the deer park. The neon square, Pierrot's circus tent
// (Gym 6, the Rutschebanen inside) and the Pokémon Center.
function bakken(): MapData {
  const W = 30, H = 22, g = makeGrid(W, H, '.');
  fill(g, 0, 0, W, 1, 'T'); fill(g, 0, H - 1, W, 1, 'T'); fill(g, 0, 0, 1, H, 'T'); fill(g, W - 1, 0, 1, H, 'T');
  for (let x = 13; x <= 16; x++) g[H - 1][x] = 'q';
  fill(g, 13, 15, 4, 6, 'q');                 // the gate road
  fill(g, 8, 7, 14, 8, 'v');                  // the neon square
  fill(g, 4, 8, 4, 2, 'q'); fill(g, 22, 10, 5, 2, 'q');
  fill(g, 2, 15, 6, 4, 'g'); fill(g, 22, 15, 6, 4, 'g');
  dots(g, 'T', [[2, 2], [3, 2], [26, 2], [27, 2], [2, 12], [27, 13], [9, 18], [20, 18]]);
  dots(g, 'f', [[7, 13], [22, 8], [11, 17], [18, 17]]);
  return {
    id: 'bakken', name: 'Bakken', grid: g, w: W, h: H, battleBg: 'city', bgm: 'overworld',
    buildings: [{ s: 'circus', x: 12, y: 1, id: 'gym' }, { s: 'pc', x: 2, y: 3, id: 'pc' }],
    exits: { down: { to: 'dyrehaven', offset: 2 } }
  };
}

// Gym 6, inside Pierrot's tent: the Hall of Mirrors below, the Rutschebanen's platforms above. Coaster cars
// ('j' is the track) carry you between platforms; only one route reaches the stage.
const gym6 = (): MapData => {
  const g = grid([
    'wwwwwwwwwwwwwwwwwwwww',
    'w_____jj_____jj_____w',
    'w_____jj_____jj_____w',
    'w_____jj_____jj_____w',
    'wjjjjjjjjjjjjjjjjjjjw',
    'wjjjjjjjjjjjjjjjjjjjw',
    'wjjjjjjjjjjjjjjjjjjjw',
    'wjjjjjjj_____jjjjjjjw',
    'wjjjjjjj_____jjjjjjjw',
    'wjjjjjjj_____jjjjjjjw',
    'wwwwwwwwww_wwwwwwwwww',
    'w___________________w',
    'w___________________w',
    'w___________________w',
    'w___________________w',
    'w___________________w',
    'wwwwwwwwwwmwwwwwwwwww'
  ]);
  return {
    id: 'gym6', name: 'Bakken: Pierrot\'s Tent', ...g, battleBg: 'indoor1', bgm: 'overworld', buildings: [], indoor: true, dark: true,
    warps: [{ x: 10, y: 16, to: 'bakken', tx: 15, ty: 5, dir: 'down' }]
  };
};

const bakery = () => room('bakery', 'Bageriet', [
  'wwwwwwwwwww',
  'wKKK___KKKw',
  'w_________w',
  'w_K_____K_w',
  'w_________w',
  'w____m____w',
  'wwwwwwwwwww'
], { to: 'vesterbro', x: 18, y: 15 });

// ---------- Chapter 8: Trekroner ----------

// The Black Fleet's houseboat on the Christianshavn canal: chart table, bunks, Freja's map wall.
const fleetboat = () => room('fleetboat', 'The Black Fleet\'s Houseboat', [
  'wwwwwwwwwww',
  'wKK_____KKw',
  'w_________w',
  'w__K___K__w',
  'w_________w',
  'w____m____w',
  'wwwwwwwwwww'
], { to: 'christianshavn', x: 3, y: 7 });

// Trekroner Sea Fort at night: a ring of old ramparts in the harbour mouth. The jetty and the gun battery in
// the lower yard, a wall with two gaps (each watched by a Grid Enforcer), and the dead lighthouse and
// Vanguard's steel door in the upper yard. Weeds have taken the old gun pits.
function trekroner(): MapData {
  const W = 26, H = 24, g = makeGrid(W, H, 'q');
  fill(g, 0, 0, W, 1, '~'); fill(g, 0, 0, 1, H, '~'); fill(g, W - 1, 0, 1, H, '~'); fill(g, 0, 19, W, 5, '~');
  fill(g, 1, 1, W - 2, 1, 'R'); fill(g, 1, 1, 1, 18, 'R'); fill(g, W - 2, 1, 1, 18, 'R'); fill(g, 1, 18, W - 2, 1, 'R');
  g[18][12] = 'q'; g[18][13] = 'q';           // the sea gate
  fill(g, 12, 19, 2, 4, 'd');                 // the jetty
  fill(g, 2, 10, W - 4, 1, 'R'); g[10][5] = 'q'; g[10][20] = 'q';   // the inner wall and its two gaps
  fill(g, 2, 14, 4, 3, 'g'); fill(g, 19, 16, 4, 2, 'g'); fill(g, 8, 7, 3, 2, 'g'); fill(g, 16, 7, 3, 2, 'g');
  return {
    id: 'trekroner', name: 'Trekroner Sea Fort', grid: g, w: W, h: H, battleBg: 'city', bgm: 'overworld',
    buildings: [{ s: 'lighthouse', x: 2, y: 2, id: 'lighthouse' }, { s: 'fortgate', x: 10, y: 2, id: 'siphon' }, { s: 'bunker', x: 19, y: 12, id: 'battery' }],
    encounters: [[30, 'golbat'], [25, 'pelipper'], [20, 'magneton'], [15, 'murkrow'], [10, 'noibat']],
    levels: [37, 40]
  };
}

const tklighthouse = () => room('tklighthouse', 'Trekroner Lighthouse', [
  'wwwwwwwww',
  'wK_____Kw',
  'w_______w',
  'w_K___K_w',
  'w_______w',
  'w___m___w',
  'wwwwwwwww'
], { to: 'trekroner', x: 3, y: 7 });

// The gun battery: three old cells along the top (iron doors), the guard post, the corridor.
const battery = () => room('battery', 'Trekroner: Gun Battery', [
  'wwwwwwwwwwwwwwwwwww',
  'w___w___w___w_____w',
  'w___w___w___w_____w',
  'ww_www_www_ww_____w',
  'w_________________w',
  'w_________________w',
  'w_pp__________pp__w',
  'w_________________w',
  'w_________________w',
  'w________m________w',
  'wwwwwwwwwwwwwwwwwww'
], { to: 'trekroner', x: 21, y: 15 });

// The siphon chamber: Vanguard's machines, and a viewport into the deep.
const siphon = () => room('siphon', 'Trekroner: Siphon Chamber', [
  'wwwwwwwwwwwwwwwww',
  'wpppp_______ppppw',
  'w_______________w',
  'w__K_________K__w',
  'w_______________w',
  'w__K_________K__w',
  'w_______________w',
  'w_______________w',
  'w_pp_________pp_w',
  'w_______________w',
  'w_______m_______w',
  'wwwwwwwwwwwwwwwww'
], { to: 'trekroner', x: 13, y: 5 });

// ---------- Chapter 9: The Spire ----------

// Slotsholmen: Børsen under scaffolding after the fire, Christiansborg behind it, the canal and Knippelsbro to the east.
function slotsholmen(): MapData {
  const W = 30, H = 20, g = makeGrid(W, H, 'q');
  fill(g, 0, 0, W, 1, 'H'); fill(g, 0, 0, 1, H, 'H'); fill(g, 0, H - 1, W, 1, '~'); fill(g, 0, H - 2, W, 1, 'n');
  fill(g, 26, 0, 4, H, '~'); fill(g, 25, 0, 1, H - 2, 'n');
  fill(g, 25, 9, 5, 2, 'q');                  // the lane east onto Knippelsbro
  fill(g, 2, 13, 5, 3, 'g'); fill(g, 10, 14, 5, 3, 'g'); fill(g, 12, 7, 3, 2, 'g');
  dots(g, 'f', [[2, 11], [10, 11], [16, 11], [23, 11]]);
  return {
    id: 'slotsholmen', name: 'Slotsholmen', grid: g, w: W, h: H, battleBg: 'city', bgm: 'overworld',
    buildings: [{ s: 'borsen', x: 14, y: 2, id: 'borsen' }, { s: 'palace', x: 2, y: 1, id: 'palace' }, { s: 'pc', x: 19, y: 12, id: 'pc' }],
    encounters: [[25, 'corvisquire'], [20, 'bronzor'], [20, 'magneton'], [15, 'pawniard'], [10, 'cufant'], [10, 'skarmory']],
    encountersNight: [[30, 'bronzor'], [25, 'murkrow'], [20, 'magneton'], [15, 'pawniard'], [10, 'noibat']],
    levels: [40, 43],
    exits: { right: { to: 'route4', offset: -3 } }
  };
}

// Børsen's great hall: crates, scaffolding inside too, the archive desk and the stair down to the vault.
const borsenHall = () => room('borsen', 'Børsen', [
  'wwwwwwwwwwwwwwwww',
  'wKKK____w____KKKw',
  'w_______w_______w',
  'w__KK_______KK__w',
  'w_______________w',
  'w__KK_______KK__w',
  'w_______________w',
  'w_______________w',
  'w_______m_______w',
  'wwwwwwwwwwwwwwwww'
], { to: 'slotsholmen', x: 19, y: 6 });

// Gym 7, the vault beneath the dragon spire: three merchants' counting-houses, the brass scales and the vault gate.
const gym7 = () => room('gym7', 'Børsen: The Vault', [
  'wwwwwwwwwwwwwwwwwww',
  'w_______KKK_______w',
  'w_________________w',
  'w_________________w',
  'wwwwwwww___wwwwwwww',
  'w_________________w',
  'w__KKK_______KKK__w',
  'w_________________w',
  'w_________________w',
  'w______KKKKK______w',
  'w_________________w',
  'w__KKK_______KKK__w',
  'w_________________w',
  'w_________________w',
  'wwwwwwwwwwwwwwwwwww'
], { to: 'borsen', x: 12, y: 2 });

// ---------- Chapter 10: Refshaleøen shipyards, the crane, CopenHill ----------

// Victory Road: the old B&W shipyard, container stacks up to the slipway. A dock crane swings you over to the east quay.
function shipyards(): MapData {
  return {
    id: 'shipyards', name: 'Refshaleøen Shipyards', ...grid([
      '~~~~~~~~~~~~~~~~',
      '~aaaaaaaaaaaaaan',
      '~aaxxaaaxxxaaaan',
      '~aaxxaaaxxxaggan',
      '~aaaaaaaaaaaggan',
      'aaaaaaxxaaaaaaan',
      'aaaaaaxxaaxxxaan',
      '~aggaaaaaaxxxaan',
      '~aggaxxxaaaaaaan',
      '~aaaaxxxaaaggaan',
      '~aaaaaaaaaaggaan',
      '~axxaaaggaaaaaan',
      '~axxaaaggaaxxaan',
      '~aaaaaaaaaaxxaan',
      '~aaggaaxxaaaaaan',
      '~aaggaaxxaaaaaan',
      '~aaaaaaaaaaaaaan',
      '~dddddddddddddd~',
      '~~~~~~~~~~~~~~~~'
    ]),
    ...YARD_WILD,
    exits: { left: { to: 'drydock', offset: 0 } }
  };
}

// The east quay over the slipway: the great gantry crane where Lukas waits, and the bridge road on to Amager.
function eastquay(): MapData {
  return {
    id: 'eastquay', name: 'Refshaleøen: East Quay', ...grid([
      '~~~~~~~~~~~~~~~',
      'naaaaaaaaaaaaa~',
      'naaxxxxxaaaxxa~',
      'naaxxxxxaaaxxa~',
      'naaaaaaaaaaaaa~',
      'naaaaaagggaaaa~',
      'naxxaaagggaaxa~',
      'naxxaaaaaaaaxa~',
      'naaaaaxxxaaaaa~',
      'naaaaaxxxaagga~',
      'naggaaaaaaagga~',
      'naggaaxxaaaaaa~',
      'naaaaaxxaaxxaa~',
      'naaaaaaaaaxxaa~',
      'naxxaaaggaaaaa~',
      'naxxaaaggaaaaaa',
      'naaaaaaaaaaaaaa',
      '~ddddddddddddd~',
      '~~~~~~~~~~~~~~~'
    ]),
    ...YARD_WILD,
    exits: { right: { to: 'copenhill', offset: -5 } }
  };
}

const YARD_WILD: Omit<MapData, 'id' | 'name' | 'grid' | 'w' | 'h'> = {
  battleBg: 'city', bgm: 'overworld', buildings: [],
  encounters: [[25, 'machoke'], [20, 'gurdurr'], [20, 'magneton'], [15, 'durant'], [10, 'boldore'], [10, 'pelipper']],
  encountersNight: [[30, 'crobat'], [25, 'durant'], [20, 'magneton'], [15, 'gurdurr'], [10, 'boldore']],
  levels: [44, 47],
  fishing: [[50, 'pelipper'], [30, 'kingdra'], [20, 'gyarados']], fishLevels: [42, 46]
};

// The top of the great gantry crane: a steel walkway over the harbour.
const cranetop = (): MapData => ({
  id: 'cranetop', name: 'The Great Crane', ...grid([
    'nnnnnnnnnnnnnnnn',
    'nddddddddddddddn',
    'nddddddddddddddn',
    'nddddddddddddddn',
    'nnnnnnnnnnnnnnnn'
  ]),
  battleBg: 'city', bgm: 'overworld', buildings: []
});

// Amager Bakke's lower slope: the power plant with a ski slope on its roof, the Pokémon Center, and the summit lift
// that stays dark until Chapter 12.
function copenhill(): MapData {
  const W = 28, H = 20, g = makeGrid(W, H, '.');
  fill(g, 0, 0, W, 1, 'T'); fill(g, 0, H - 1, W, 1, 'T'); fill(g, 0, 0, 1, H, 'T'); fill(g, W - 1, 0, 1, H, 'T');
  fill(g, 0, 10, 1, 2, '=');                  // the quay road west to the shipyards
  fill(g, 1, 10, 26, 2, '=');
  fill(g, 14, 7, 1, 3, '=');                  // up to the plant door
  fill(g, 23, 0, 1, 2, '=');                  // the service stair up to the ski slope (Chapter 12)
  fill(g, 2, 2, 5, 4, 'g'); fill(g, 21, 2, 5, 5, 'g'); fill(g, 3, 14, 6, 3, 'g'); fill(g, 11, 14, 5, 3, 'g');
  dots(g, 'f', [[2, 8], [9, 8], [18, 8], [25, 8]]);
  return {
    id: 'copenhill', name: 'CopenHill', grid: g, w: W, h: H, battleBg: 'field', bgm: 'overworld',
    buildings: [{ s: 'copenhill', x: 8, y: 1, id: 'plant' }, { s: 'pc', x: 19, y: 12, id: 'pc' }],
    encounters: [[25, 'luxio'], [20, 'magneton'], [20, 'galvantula'], [15, 'kilowattrel'], [10, 'heliolisk'], [10, 'zebstrika']],
    encountersNight: [[30, 'luxio'], [25, 'crobat'], [20, 'galvantula'], [15, 'magneton'], [10, 'zebstrika']],
    levels: [44, 47],
    exits: { left: { to: 'eastquay', offset: 5 }, up: { to: 'stormhill', offset: -16 } }
  };
}

// Gym 8, the turbine hall: three turbines feed three relays; the summit lift wants relays 1 and 3 live and 2 dark.
const gym8 = () => room('gym8', 'CopenHill: Turbine Hall', [
  'wwwwwwwwwwwwwwwwwww',
  'w_______KKK_______w',
  'w_________________w',
  'w_________________w',
  'wwwwwwww___wwwwwwww',
  'w_________________w',
  'w_________________w',
  'w_________________w',
  'w_________________w',
  'w_________________w',
  'w__KK_________KK__w',
  'w_________________w',
  'w_________________w',
  'w________m________w',
  'wwwwwwwwwwwwwwwwwww'
], { to: 'copenhill', x: 14, y: 7 });

// ---------- Chapter 11: the flood, the M-Ring, Absalon's ruins, Kronborg ----------

// Nyhavn under the storm surge: rooftops and the pontoons the hydrofoil can tie up at.
const floodnyhavn = (): MapData => ({
  id: 'floodnyhavn', name: 'Nyhavn (flooded)', ...grid([
    '~~~~~~~~~~~~~~~~~~~~~~~~',
    '~HHHHH~~~~~~~~~~~~HHHHH~',
    '~HHHHH~~~~~~~~~~~~HHHHH~',
    '~ddddddddddd~~~~~~ddddd~',
    '~~~~~d~~~~~d~~~~~~d~~~~~',
    '~~~~~d~~~~~dddddddd~~~~~',
    '~~ddddd~~~~~~d~d~~~~~~~~',
    '~~d~~~d~~~~~~~~d~~~~~~~~',
    '~~d~~~ddddddddddddddd~~~',
    '~~d~~~~~~~~~~~~~~~~~d~~~',
    '~ddddddd~~~~~~~~~dddd~~~',
    '~~~~~~~d~~~~~~~~~d~~~~~~',
    '~~~~~~~ddddddddddd~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~~~'
  ]),
  battleBg: 'city', bgm: 'overworld', buildings: []
});

// The M-Ring tunnels from Kongens Nytorv to Gammel Strand, dark and half flooded.
const metro = (): MapData => ({
  id: 'metro', name: 'M-Ring Tunnels', ...grid([
    'RRRRRRRRRRRRRRRRRRRRRRRRRRRR',
    'RcccccccccRRRRRRRccccccccccR',
    'RcccccccccRRRRRRRccccccccccR',
    'RccRRRRuuuuuuRRRRccRRRRRRccR',
    'RccRRRRccccccRRRRccRRRRRRccR',
    'RcccccccccccccccccccRRRRRccR',
    'RcccccccccccccccccccRRRRRccR',
    'RRRRRRRRccRRRRRRRRRRRRRRRccR',
    'RccccccccccccccccccccccccccR',
    'RccccccccccccccccccccccccccR',
    'RRRRRRRRRRRRRRRRRRRRRRRRRRRR'
  ]),
  battleBg: 'indoor1', bgm: 'overworld', buildings: [], indoor: true, dark: true,
  encounterTile: 'c', encounters: [[30, 'crobat'], [25, 'magneton'], [20, 'excadrill'], [15, 'boldore'], [10, 'steelix']], levels: [47, 50]
});

// Absalon's ruins under Christiansborg: four badge doors in a row, and the old bishop's altar.
const ruins = (): MapData => ({
  id: 'ruins', name: 'Absalon\'s Ruins', ...grid([
    'RRRRRRRRRRRRRRRRRRRRR',
    'RcccRcccRcccRcccRcccR',
    'RcccccccccccccccccccR',
    'RcccRcccRcccRcccRcccR',
    'RcccRcccRcccRcccRcccR',
    'RRRRRRRRRRRRRRRRRRRRR'
  ]),
  battleBg: 'indoor1', bgm: 'overworld', buildings: [], indoor: true, dark: true,
  encounterTile: 'c', encounters: [[30, 'golett'], [25, 'bronzor'], [20, 'sableye'], [15, 'haunter'], [10, 'golurk']], levels: [48, 51]
});

// Helsingør in the storm: the station, Kronborg on its point, the Pokémon Center, and the Sound.
function helsingor(): MapData {
  const W = 26, H = 18, g = makeGrid(W, H, '.');
  fill(g, 0, 0, W, 1, 'T'); fill(g, 0, 0, 1, H, 'T');
  fill(g, 22, 0, 4, H, '~'); fill(g, 0, 16, W, 2, '~'); fill(g, 21, 0, 1, 16, 'n'); fill(g, 1, 15, 20, 1, 'n');
  fill(g, 1, 7, 20, 1, '=');                   // the harbour road
  fill(g, 15, 7, 1, 1, '=');
  fill(g, 10, 9, 7, 3, 'g'); fill(g, 2, 2, 5, 3, 'g'); fill(g, 14, 12, 6, 2, 'g');
  return {
    id: 'helsingor', name: 'Helsingør', grid: g, w: W, h: H, battleBg: 'field', bgm: 'overworld',
    buildings: [{ s: 'kronborg', x: 10, y: 1, id: 'kronborg' }, { s: 'pc', x: 3, y: 9, id: 'pc' }],
    encounters: [[25, 'pelipper'], [20, 'skarmory'], [20, 'crobat'], [15, 'kingler'], [15, 'dewgong'], [5, 'lapras']],
    encountersNight: [[30, 'crobat'], [25, 'pelipper'], [20, 'haunter'], [15, 'dewgong'], [10, 'kingler']],
    levels: [48, 51],
    fishing: [[45, 'kingler'], [35, 'dewgong'], [20, 'lapras']], fishLevels: [46, 50]
  };
}

// Kronborg's casemates: flooding corridors under the castle, and Holger Danske asleep in the hall.
const casemates = (): MapData => ({
  id: 'casemates', name: 'Kronborg Casemates', ...grid([
    'RRRRRRRRRRRRRRRRRRRRRR',
    'RRRRRRRRRRRRRccccccccR',
    'RRRRRRRRRRRRRccccccccR',
    'RRRRRRRRRRRRRccccccccR',
    'RRRRRRRRRRRRRRRccRRRRR',
    'RccccuuucccccccccccccR',
    'RcccccccccccuuuuccccuR',
    'RccuuuccccccuuuuccccuR',
    'RccuuucccccccccccccccR',
    'RcccccccccRRRRRRRRRRRR',
    'RRRRmRRRRRRRRRRRRRRRRR'
  ]),
  battleBg: 'indoor1', bgm: 'overworld', buildings: [], indoor: true, dark: true,
  encounterTile: 'c', encounters: [[35, 'golbat'], [25, 'haunter'], [20, 'sableye'], [20, 'golett']], levels: [48, 51],
  warps: [{ x: 4, y: 10, to: 'helsingor', tx: 15, ty: 7, dir: 'down' }]
});

// ---------- Chapter 12: CopenHill in the storm, the Smokestack Ring ----------

// The ski slope on the plant's roof, iced over: switchbacks behind railings, three walls of black ice that only
// Kronvakt can break, and the Gym Leaders holding the Enforcers back.
const stormhill = (): MapData => ({
  id: 'stormhill', name: 'CopenHill Slope', ...grid([
    'TTTTTTT==TTTTTTT',
    'T..............T',
    'T..............T',
    'Tnnnnnnnnnnnnn.T',
    'T..............T',
    'T..............T',
    'T.nnnnnnnnnnnnnT',
    'T..............T',
    'T..............T',
    'Tnnnnnnnnnnnnn.T',
    'T..............T',
    'T..............T',
    'T.nnnnnnnnnnnnnT',
    'T..............T',
    'T..............T',
    'Tnnnnnnnnnnnnn.T',
    'T..............T',
    'T..............T',
    'T.nnnnnnnnnnnnnT',
    'T..............T',
    'T..............T',
    'T......=.......T',
    'T......=.......T',
    'T......=.......T',
    'T......=.......T',
    'TTTTTTT=TTTTTTTT'
  ]),
  battleBg: 'field', bgm: 'overworld', buildings: [],
  exits: { down: { to: 'copenhill', offset: 16 }, up: { to: 'smokestack', offset: 0 } }
});

// The Smokestack Ring at the summit: a steel walkway round the stack, the reactor humming underneath.
const smokestack = (): MapData => ({
  id: 'smokestack', name: 'The Smokestack Ring', ...grid([
    'nnnnnnnnnnnnnnnn',
    'n..............n',
    'n.....xxxx.....n',
    'n.....xxxx.....n',
    'n.....xxxx.....n',
    'n..............n',
    'n..............n',
    'n..............n',
    'n..............n',
    'n..............n',
    'n..............n',
    'nnnnnnn..nnnnnnn'
  ]),
  battleBg: 'city', bgm: 'overworld', buildings: [],
  exits: { down: { to: 'stormhill', offset: 0 } }
});

// ---------- Chapter 13: the League at Christiansborg ----------

// The palace hall: the guard, the League's nurse and clerk, and the door to the first hall.
const leaguehall = () => room('leaguehall', 'Christiansborg: League Hall', [
  'wwwwww_wwwwww',
  'w___________w',
  'w_KK_____KK_w',
  'w___________w',
  'w___________w',
  'w___________w',
  'wwwwwwmwwwwww'
], { to: 'slotsholmen', x: 6, y: 6 });

// The four halls; each one's doormat goes back to the League hall to rest.
const stables = () => room('stables', 'The Royal Stables', [
  'wwwww_wwwww',
  'w_________w',
  'w_________w',
  'w_KK___KK_w',
  'w_________w',
  'w_________w',
  'w_________w',
  'w_________w',
  'wwwwwmwwwww'
], { to: 'leaguehall', x: 6, y: 1 });
const admiral = () => room('admiral', 'The Admiral\'s Hall', [
  'wwwww_wwwww',
  'w_________w',
  'w_________w',
  'w_KK___KK_w',
  'w_________w',
  'w_________w',
  'w_________w',
  'w_________w',
  'wwwwwmwwwww'
], { to: 'leaguehall', x: 6, y: 1 });
const greathall = () => room('greathall', 'The Great Hall', [
  'wwwww_wwwww',
  'w_________w',
  'w_________w',
  'w_KK___KK_w',
  'w_________w',
  'w_________w',
  'w_________w',
  'w_________w',
  'wwwwwmwwwww'
], { to: 'leaguehall', x: 6, y: 1 });
const towerstairs = () => room('towerstairs', 'The Tower Stairs', [
  'wwwww_wwwww',
  'w_________w',
  'w_________w',
  'w_KK___KK_w',
  'w_________w',
  'w_________w',
  'w_________w',
  'w_________w',
  'wwwwwmwwwww'
], { to: 'leaguehall', x: 6, y: 1 });

// The Tower roof, over the whole city: the Champions.
const towerroof = (): MapData => ({ ...room('towerroof', 'Christiansborg Tower', [
  'wwwwwwwwwww',
  'w_________w',
  'w_________w',
  'w_________w',
  'w_________w',
  'w_________w',
  'wwwwwmwwwww'
], { to: 'towerstairs', x: 5, y: 1 }), battleBg: 'city' });

// ---------- Post-game P3: the Øresund Bridge and Peberholm ----------

// Route 13: the Øresund Bridge deck in a gale. A road lane, two bike lanes and railings over the Sound;
// the ramp down to Peberholm halfway, and the Swedish end closed ("season opens soon").
function oresund(): MapData {
  const W = 44, H = 11, g = makeGrid(W, H, '~');
  fill(g, 0, 2, W, 1, 'n'); fill(g, 0, 7, W, 1, 'n');
  fill(g, 0, 3, W - 1, 1, 'a'); fill(g, 0, 4, W - 1, 2, 'l'); fill(g, 0, 6, W - 1, 1, 'a');
  fill(g, W - 1, 3, 1, 4, 'n');
  g[7][22] = 'a';                                // the ramp down to Peberholm
  return {
    id: 'oresund', name: 'Route 13: Øresund Bridge', grid: g, w: W, h: H, battleBg: 'city', bgm: 'overworld', buildings: [],
    encounters: [[35, 'wattrel'], [30, 'kilowattrel'], [20, 'skarmory'], [15, 'bombirdier']], levels: [60, 63],
    encounterTile: 'l',
    warps: [
      ...[0, 1, 2, 3].map(i => ({ x: 0, y: 3 + i, to: 'dragor', tx: 19, ty: 17, dir: 'left' as Dir })),
      { x: 22, y: 7, to: 'peberholm', tx: 12, ty: 3, dir: 'down' }
    ]
  };
}

// Peberholm: the island nature built alone, from the bridge's spoil. A Ranger hut, no Pokémon Center, and an
// ecosystem that grew wrong around a huge Echo. Lumen Nord's drones are mapping it.
function peberholm(): MapData {
  const W = 26, H = 20, g = makeGrid(W, H, '.');
  fill(g, 0, 0, W, 2, '~'); fill(g, 0, 18, W, 2, '~'); fill(g, 0, 0, 2, H, '~'); fill(g, 24, 0, 2, H, '~');
  dots(g, '~', [[2, 2], [3, 2], [22, 2], [23, 2], [2, 17], [23, 17], [2, 16], [23, 16]]);
  fill(g, 3, 4, 6, 4, 'g'); fill(g, 16, 4, 6, 4, 'g'); fill(g, 4, 10, 5, 5, 'g'); fill(g, 17, 10, 5, 4, 'g');
  fill(g, 9, 9, 2, 2, 'T'); fill(g, 15, 9, 2, 2, 'T'); fill(g, 3, 15, 2, 2, 'T'); fill(g, 20, 15, 2, 2, 'T');
  dots(g, 'f', [[11, 6], [14, 6], [6, 9], [19, 9], [10, 16], [15, 16]]);
  return {
    id: 'peberholm', name: 'Peberholm Reserve', grid: g, w: W, h: H, battleBg: 'field', bgm: 'overworld', buildings: [],
    encounters: [[18, 'greattusk'], [18, 'irontreads'], [16, 'screamtail'], [16, 'ironbundle'], [12, 'brutebonnet'], [12, 'ironhands'], [8, 'sandyshocks']],
    encountersNight: [[22, 'fluttermane'], [20, 'ironjugulis'], [18, 'slitherwing'], [18, 'ironmoth'], [12, 'screamtail'], [10, 'ironthorns']],
    levels: [62, 66],
    warps: [{ x: 12, y: 2, to: 'oresund', tx: 22, ty: 6, dir: 'up' }]
  };
}

export const MAPS = {
  norrebro: norrebro(), flat: flat(), lukasflat: lukasFlat(), pcnorrebro: center('pcnorrebro', 'Pokémon Center', 'norrebro', 22, 8),
  gym1: gym1(), bridge: bridge(), route1: route1(), garden: garden(), palmhouse: palmhouse(), tunnels: tunnels(),
  indreby: indreby(), pcindreby: center('pcindreby', 'Pokémon Center', 'indreby', 5, 5), towerin: tower(),
  nyhavn: nyhavn(), cafein: cafe(), drydock: drydock(), route4: route4(), christianshavn: christianshavn(),
  pcchristianshavn: center('pcchristianshavn', 'Pokémon Center', 'christianshavn', 22, 11),
  stadsgraven: stadsgraven(), gym2: gym2(), dragor: dragor(),
  route2: route2(), vesterbro: vesterbro(), cafevb: vbCafe(), pcvesterbro: center('pcvesterbro', 'Pokémon Center', 'vesterbro', 18, 8),
  kodbyen: kodbyen(), kitchen: kitchen(), gym3: gym3(), route3: route3(), islandsbrygge: islandsbrygge(),
  assistens: assistens(), stormdrain: stormdrain(), gym4: gym4(), bakery: bakery(),
  frederiksberg: frederiksberg(), pcfrederiksberg: center('pcfrederiksberg', 'Pokémon Center', 'frederiksberg', 5, 14), cisterns: cisterns(),
  rundetarn: rundetarn(), bibliotek: bibliotek(), trinitatis: trinitatis(),
  osterbro: osterbro(), pcosterbro: center('pcosterbro', 'Pokémon Center', 'osterbro', 13, 6), kastellet: kastellet(), route8: route8(),
  lyngby: lyngby(), dyrehaven: dyrehaven(), substation: substation(), bakken: bakken(),
  pcbakken: center('pcbakken', 'Pokémon Center', 'bakken', 4, 8), gym6: gym6(),
  fleetboat: fleetboat(), trekroner: trekroner(), tklighthouse: tklighthouse(), battery: battery(), siphon: siphon(),
  slotsholmen: slotsholmen(), pcslotsholmen: center('pcslotsholmen', 'Pokémon Center', 'slotsholmen', 21, 17), borsen: borsenHall(), gym7: gym7(),
  shipyards: shipyards(), eastquay: eastquay(), cranetop: cranetop(), copenhill: copenhill(), pccopenhill: center('pccopenhill', 'Pokémon Center', 'copenhill', 21, 17), gym8: gym8(),
  floodnyhavn: floodnyhavn(), metro: metro(), ruins: ruins(), helsingor: helsingor(),
  pchelsingor: center('pchelsingor', 'Pokémon Center', 'helsingor', 5, 14), casemates: casemates(),
  stormhill: stormhill(), smokestack: smokestack(),
  oresund: oresund(), peberholm: peberholm(),
  leaguehall: leaguehall(), stables: stables(), admiral: admiral(), greathall: greathall(), towerstairs: towerstairs(), towerroof: towerroof()
};
