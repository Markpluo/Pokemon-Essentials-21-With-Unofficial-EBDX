// Maps and building stamps for the Hafnia prologue: Nørrebro, Route 1 (Søerne Path) and the
// Botanical Garden. Plain data, so the client can import it for rendering without the scripts.
// Tiles: '.' ground, '=' brick path, 'g' tall grass, 'f' flowers, 'T' trees, '~' sea, 'o' still water,
// 'r' Den Røde Plads (red square), 'k' Den Sorte Plads (black square).
import type { MapDef, Stamp } from '@hafnia/core';

type MapData = Omit<MapDef, 'npcs' | 'doors'>;

// Building stamps from Outside.png: parts are [srcX, srcY, w, h, dx, dy] in tiles.
export const STAMPS: Record<string, Stamp> = {
  lab: { parts: [[0, 192, 5, 5, 0, 0]], w: 5, h: 5, door: [2, 4] },
  home: { parts: [[0, 197, 5, 5, 0, 0]], w: 5, h: 5, door: [1, 4] },
  blue: { parts: [[0, 208, 4, 3, 0, 0]], w: 4, h: 3, door: [1, 2] },
  orange: { parts: [[4, 208, 4, 3, 0, 0]], w: 4, h: 3 },
  red: { parts: [[0, 206, 4, 2, 0, 0], [0, 210, 4, 1, 0, 2]], w: 4, h: 3, door: [1, 2] },
  green: { parts: [[4, 206, 4, 2, 0, 0], [4, 210, 4, 1, 0, 2]], w: 4, h: 3 },
  pc: { parts: [[0, 326, 5, 5, 0, 0]], w: 5, h: 5, door: [2, 4] },
  gym: { parts: [[0, 352, 7, 3, 0, 0]], w: 7, h: 3, door: [3, 2] },
  palm: { parts: [[4, 228, 4, 3, 0, 0], [4, 228, 4, 2, 4, 0], [4, 232, 4, 1, 4, 2]], w: 8, h: 3, door: [1, 2] }
};

const makeGrid = (w: number, h: number, ch: string) => Array.from({ length: h }, () => Array<string>(w).fill(ch));
function fill(g: string[][], x: number, y: number, w: number, h: number, ch: string) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (g[j] && g[j][i] !== undefined) g[j][i] = ch;
}
function dots(g: string[][], ch: string, pts: number[][]) { for (const [x, y] of pts) g[y][x] = ch; }

// Nørrebro: home walk-up, Pokémon Center, and Superkilen (red square, black square) in front of Gym 1.
function norrebro(): MapData {
  const W = 28, H = 22, g = makeGrid(W, H, '.');
  fill(g, 0, 0, W, 2, 'T'); fill(g, 0, 19, W, 3, 'T');
  fill(g, 0, 0, 1, H, 'T'); fill(g, 27, 0, 1, H, 'T');
  fill(g, 1, 8, 26, 1, '=');                  // Nørrebrogade
  fill(g, 13, 8, 2, 14, '=');                 // road south to the Lakes
  fill(g, 3, 14, 9, 4, 'k');                  // Den Sorte Plads
  fill(g, 15, 14, 11, 4, 'r');                // Den Røde Plads
  fill(g, 16, 9, 10, 1, '=');
  dots(g, 'f', [[2, 3], [2, 4], [8, 3], [9, 3], [12, 3], [12, 4], [18, 4], [18, 5], [25, 3], [25, 4],
    [2, 10], [3, 10], [10, 11], [11, 11], [4, 12], [16, 11], [26, 12], [2, 18], [11, 18], [16, 18], [25, 18]]);
  dots(g, 'T', [[1, 11], [1, 12], [6, 11], [7, 11]]);
  return {
    id: 'norrebro', name: 'Nørrebro', grid: g, w: W, h: H, battleBg: 'city', bgm: 'overworld',
    buildings: [
      { s: 'home', x: 3, y: 3, id: 'home' }, { s: 'blue', x: 9, y: 5, id: 'lukas' }, { s: 'orange', x: 14, y: 5 },
      { s: 'pc', x: 20, y: 3, id: 'pc' }, { s: 'gym', x: 17, y: 11, id: 'gym' }
    ],
    exits: { down: { to: 'route1', offset: -4 } }
  };
}

function route1(): MapData {
  const rows = [
    'TTTTTTTTT==TTTTTTTTT',
    'TTTTTTTTT==TTTTTTTTT',
    'TT..f....==....f..TT',
    'TTgggg...==...ggggTT',
    'TTgggg...==...ggggTT',
    'TTgggg...==...ggggTT',
    'TT.......==.......TT',
    'TT.......==.......TT',
    'TToooo...==..gggg.TT',
    'TToooooo.==..gggg.TT',
    'TTooooooo==..gggg.TT',
    'TTooooooo==.......TT',
    'TTooooooo==...f...TT',
    'TToooooo.==.......TT',
    'TT.oooo..==..gggg.TT',
    'TT.......==..gggg.TT',
    'TTggggg..==..gggg.TT',
    'TTggggg..==.......TT',
    'TTggggg..==...f...TT',
    'TT.......==.......TT',
    'TT..f....==.......TT',
    'TT.......==..gggg.TT',
    'TTgggg...==..gggg.TT',
    'TTgggg...==..gggg.TT',
    'TTgggg...==.......TT',
    'TT.......==....f..TT',
    'TT..f....==.......TT',
    'TT.......==.......TT',
    'TTTT.....==.....TTTT',
    'TTTTT....==....TTTTT',
    'TTTTTTTTT==TTTTTTTTT',
    'TTTTTTTTT==TTTTTTTTT'
  ];
  return {
    id: 'route1', name: 'Route 1: Søerne Path', grid: rows.map(r => r.split('')), w: 20, h: rows.length,
    battleBg: 'field', bgm: 'overworld', buildings: [],
    encounters: [[30, 'pidgey'], [20, 'lillipup'], [20, 'lotad'], [15, 'psyduck'], [10, 'wingull'], [5, 'buneary']],
    levels: [3, 6],
    exits: { up: { to: 'norrebro', offset: 4 }, down: { to: 'garden', offset: 4 } }
  };
}

// Botanical Garden with the Palm House, Professor Ørsted's lab.
function garden(): MapData {
  const W = 28, H = 22, g = makeGrid(W, H, '.');
  fill(g, 0, 0, W, 2, 'T'); fill(g, 0, 19, W, 3, 'T');
  fill(g, 0, 0, 2, H, 'T'); fill(g, 26, 0, 2, H, 'T');
  fill(g, 13, 0, 2, 7, '=');
  fill(g, 8, 6, 12, 1, '='); fill(g, 8, 6, 1, 7, '='); fill(g, 19, 6, 1, 7, '=');
  fill(g, 8, 11, 12, 2, '=');
  fill(g, 3, 13, 5, 4, 'o'); fill(g, 21, 13, 4, 4, 'o');
  dots(g, 'f', [[4, 3], [5, 3], [6, 3], [4, 4], [6, 4], [20, 3], [21, 3], [22, 3], [21, 4], [10, 14], [11, 14],
    [12, 15], [15, 15], [16, 14], [17, 14], [3, 8], [4, 8], [3, 9], [23, 8], [24, 8], [24, 9], [9, 17], [18, 17]]);
  dots(g, 'T', [[2, 6], [3, 6], [24, 11], [25, 11], [12, 17], [15, 17]]);
  return {
    id: 'garden', name: 'Botanical Garden', grid: g, w: W, h: H, battleBg: 'field', bgm: 'overworld',
    buildings: [{ s: 'palm', x: 10, y: 8, id: 'palm' }],
    exits: { up: { to: 'route1', offset: -4 } }
  };
}

export const MAPS = { norrebro: norrebro(), route1: route1(), garden: garden() };
