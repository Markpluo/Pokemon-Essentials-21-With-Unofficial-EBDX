// Maps and building stamps for the Hafnia demo (Prologue to the end of Chapter 2). Plain data,
// so the client can import it for rendering without the scripts.
// Outdoor tiles: '.' ground, '=' brick path, 'g' tall grass, 'f' flowers, 'T' trees, '~' sea, 'o' still water,
//   'r' Den Røde Plads, 'k' Den Sorte Plads, 'q' cobbles, 'a' asphalt/concrete, 'l' bike lane, 'd' planks,
//   'H' house fronts, 'x' shipping containers, 'n' railings.
// Indoor and tunnels: '_' floor, 'w' wall, 'K' furniture, 'm' doormat, 'c' tunnel floor, 'R' rock, 'p' pipes, 'P' planters.
import type { MapDef, Stamp, Warp } from '@hafnia/core';

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
  houseboat: { draw: 'houseboat', w: 6, h: 3, door: [2, 2] } // Alva's gym on the moat
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
  return {
    id: 'norrebro', name: 'Nørrebro', grid: g, w: W, h: H, battleBg: 'city', bgm: 'overworld',
    buildings: [
      { s: 'home', x: 3, y: 3, id: 'home' }, { s: 'blue', x: 9, y: 5, id: 'lukas' }, { s: 'orange', x: 14, y: 5 },
      { s: 'pc', x: 20, y: 3, id: 'pc' }, { s: 'gym', x: 17, y: 9, id: 'gym' }, { s: 'mural', x: 3, y: 11 }
    ],
    encounters: [[30, 'pidgey'], [30, 'skwovet'], [20, 'rattata'], [15, 'nickit'], [5, 'toxel']],
    encountersNight: [[35, 'rattata'], [30, 'nickit'], [20, 'hoothoot'], [10, 'greavard'], [5, 'toxel']],
    levels: [6, 9],
    exits: { down: { to: 'bridge', offset: -3 } }
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
  dots(g, 'T', [[2, 6], [3, 6]]);
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
    exits: { left: { to: 'indreby', offset: 1 } }
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
      '~~~~aaaaaaaaxaaaaaaaaxaaaaa~',
      '~~~~aaaaaaaaaaaaaaaaaxaaaaa~',
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
    levels: [14, 17]
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
      'TT..ggqqqqgg.....TTT',
      'TT....qqqq..gggg.TTT',
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
    exits: { up: { to: 'indreby', offset: 6 }, down: { to: 'christianshavn', offset: 6 } }
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
// hedge, cobbled lanes and the old harbour. Reached by debug warp until the Amager Coast Path exists.
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

export const MAPS = {
  norrebro: norrebro(), flat: flat(), lukasflat: lukasFlat(), pcnorrebro: center('pcnorrebro', 'Pokémon Center', 'norrebro', 22, 8),
  gym1: gym1(), bridge: bridge(), route1: route1(), garden: garden(), palmhouse: palmhouse(), tunnels: tunnels(),
  indreby: indreby(), pcindreby: center('pcindreby', 'Pokémon Center', 'indreby', 5, 5), towerin: tower(),
  nyhavn: nyhavn(), cafein: cafe(), drydock: drydock(), route4: route4(), christianshavn: christianshavn(),
  pcchristianshavn: center('pcchristianshavn', 'Pokémon Center', 'christianshavn', 22, 11),
  stadsgraven: stadsgraven(), gym2: gym2(), dragor: dragor()
};
