// Which animation plays for what. A move uses its pack's bespoke timeline when there is one
// (packs/*/anims.json), otherwise the generic one for its type and category. The shared set covers
// stat changes, status conditions, critical hits and weather (design/battle-animations.md §3).
import type { AnimPack, AnimStep, AnimTimeline, StatusId, Weather } from '@hafnia/core';

interface TypeStyle { color: string; particles: string; shape: string; special: 'beam' | 'projectile' }
const TYPE_STYLE: Record<string, TypeStyle> = {
  normal: { color: '#e8e4cc', particles: 'stars', shape: 'orb', special: 'projectile' },
  fire: { color: '#ff7a1f', particles: 'embers', shape: 'orb', special: 'projectile' },
  water: { color: '#4f9dff', particles: 'drops', shape: 'drop', special: 'beam' },
  grass: { color: '#5cc243', particles: 'leaves', shape: 'leaf', special: 'projectile' },
  electric: { color: '#ffd83a', particles: 'sparks', shape: 'spark', special: 'beam' },
  ice: { color: '#9fe8ff', particles: 'ice', shape: 'shard', special: 'beam' },
  fighting: { color: '#e0553f', particles: 'stars', shape: 'orb', special: 'projectile' },
  poison: { color: '#b45ad0', particles: 'bubbles', shape: 'orb', special: 'projectile' },
  ground: { color: '#c9a052', particles: 'dust', shape: 'rock', special: 'projectile' },
  flying: { color: '#d6e6ff', particles: 'feathers', shape: 'ring', special: 'projectile' },
  psychic: { color: '#ff5fa8', particles: 'stars', shape: 'ring', special: 'beam' },
  bug: { color: '#a8c21a', particles: 'spores', shape: 'orb', special: 'projectile' },
  rock: { color: '#b09a62', particles: 'rocks', shape: 'rock', special: 'projectile' },
  ghost: { color: '#8a6cc8', particles: 'shadows', shape: 'orb', special: 'projectile' },
  dragon: { color: '#7a4cff', particles: 'sparks', shape: 'orb', special: 'beam' },
  dark: { color: '#4a3a5a', particles: 'shadows', shape: 'orb', special: 'projectile' },
  steel: { color: '#c8d0e0', particles: 'stars', shape: 'shard', special: 'projectile' },
  fairy: { color: '#ff9fd0', particles: 'hearts', shape: 'star', special: 'projectile' }
};

// Generic templates; `$name` is filled in from the type's style. Each stays under 900 ms.
const HIT: AnimStep = {
  do: 'par', steps: [
    { do: 'burst', at: 'target', color: '$color', ms: 280 },
    { do: 'particles', preset: '$particles' as any, at: 'target', ms: 450, count: 10 },
    { do: 'shake', who: 'target', ms: 300 }
  ]
};
const GENERIC: Record<'Physical' | 'Special' | 'Status' | 'StatusSelf', AnimTimeline> = {
  Physical: [{ do: 'lunge', who: 'user', ms: 240, dist: 30 }, HIT],
  Special: [
    { do: 'par', steps: [{ do: 'tint', who: 'user', color: '$color', ms: 200, alpha: 0.45 }, { do: '$special' as any, from: 'user', to: 'target', color: '$color', shape: '$shape' as any, ms: 380, size: 14, count: 3, gap: 60 }] },
    HIT
  ],
  Status: [
    { do: 'wave', from: 'user', to: 'target', color: '$color', ms: 380 },
    { do: 'par', steps: [{ do: 'particles', preset: '$particles' as any, at: 'target', ms: 450, count: 10 }, { do: 'tint', who: 'target', color: '$color', ms: 400, alpha: 0.45 }] }
  ],
  StatusSelf: [
    { do: 'par', steps: [{ do: 'particles', preset: '$particles' as any, at: 'user', ms: 600, count: 12 }, { do: 'tint', who: 'user', color: '$color', ms: 500, alpha: 0.5 }, { do: 'hop', who: 'user', ms: 300, height: 8 }] }
  ]
};

function fill(tl: AnimTimeline, style: TypeStyle): AnimTimeline {
  const sub = (v: unknown) => (typeof v === 'string' && v.startsWith('$') ? (style as any)[v.slice(1)] ?? v : v);
  const walk = (s: AnimStep): AnimStep => {
    const out: any = {};
    for (const [k, v] of Object.entries(s)) out[k] = k === 'steps' ? (v as AnimStep[]).map(walk) : sub(v);
    return out;
  };
  return tl.map(walk);
}

const MOVES: Record<string, AnimTimeline> = {};
/** Adds a pack's bespoke move animations. A later pack overrides an earlier one. */
export function registerAnims(pack: AnimPack) { Object.assign(MOVES, pack.moves); }
/** Moves with a bespoke animation, for the preview screen. */
export const animatedMoves = () => Object.keys(MOVES).sort();
export const ANIM_TYPES = Object.keys(TYPE_STYLE);

export function moveAnim(id: string, type: string, category: 'Physical' | 'Special' | 'Status', self: boolean): AnimTimeline {
  const style = TYPE_STYLE[type] ?? TYPE_STYLE.normal;
  const tl = MOVES[id] ?? GENERIC[category === 'Status' && self ? 'StatusSelf' : category];
  return fill(tl, style);
}

/** Only the steps that happen on the user's side, for a move that missed. */
export function userPart(tl: AnimTimeline): AnimTimeline {
  const keep = (s: AnimStep): AnimStep | null => {
    if (s.do === 'par') { const steps = s.steps.map(keep).filter(Boolean) as AnimStep[]; return steps.length ? { ...s, steps } : null; }
    const v = s as any;
    if (v.who === 'target' || v.at === 'target' || v.to === 'target' || v.at === undefined && ['burst', 'slash', 'bite', 'orbit', 'particles'].includes(s.do)) return null;
    if (v.who === undefined && ['shake', 'blink', 'tint'].includes(s.do)) return null;
    if (['projectile', 'beam', 'wave', 'drain'].includes(s.do)) return null;
    return s;
  };
  return tl.map(keep).filter(Boolean) as AnimTimeline;
}

// ---------- shared ----------
export const STAT_UP: AnimTimeline = [{ do: 'par', steps: [{ do: 'particles', preset: 'arrowsUp', at: 'user', ms: 650 }, { do: 'tint', who: 'user', color: '#5fb0ff', ms: 600, alpha: 0.45 }] }];
export const STAT_DOWN: AnimTimeline = [{ do: 'par', steps: [{ do: 'particles', preset: 'arrowsDown', at: 'user', ms: 650 }, { do: 'tint', who: 'user', color: '#ff6b5a', ms: 600, alpha: 0.45 }] }];

export const STATUS_ANIM: Record<Exclude<StatusId, ''>, AnimTimeline> = {
  brn: [{ do: 'par', steps: [{ do: 'particles', preset: 'embers', at: 'user', ms: 600, count: 14 }, { do: 'tint', who: 'user', color: '#ff7a1f', ms: 500, alpha: 0.5 }, { do: 'shake', who: 'user', ms: 300, amp: 3 }] }],
  par: [{ do: 'par', steps: [{ do: 'particles', preset: 'sparks', at: 'user', ms: 500, count: 10 }, { do: 'tint', who: 'user', color: '#ffd83a', ms: 450, alpha: 0.55 }, { do: 'shake', who: 'user', ms: 450, amp: 4 }] }],
  psn: [{ do: 'par', steps: [{ do: 'particles', preset: 'bubbles', at: 'user', color: '#b45ad0', ms: 600, count: 12 }, { do: 'tint', who: 'user', color: '#a33ea1', ms: 500, alpha: 0.5 }] }],
  tox: [{ do: 'par', steps: [{ do: 'particles', preset: 'bubbles', at: 'user', color: '#7d2a7b', ms: 650, count: 16 }, { do: 'tint', who: 'user', color: '#7d2a7b', ms: 550, alpha: 0.6 }] }],
  slp: [{ do: 'particles', preset: 'zs', at: 'user', ms: 800 }],
  frz: [{ do: 'par', steps: [{ do: 'particles', preset: 'ice', at: 'user', ms: 500, count: 12 }, { do: 'tint', who: 'user', color: '#9fe8ff', ms: 600, alpha: 0.6 }] }]
};
/** End-of-turn damage from something other than a status (Leech Seed, items, the Overcharge drain). */
export const RESIDUAL: Record<string, AnimTimeline> = {
  leechseed: [{ do: 'drain', from: 'user', to: 'target', color: '#7ad25a', ms: 600 }],
  confusion: [{ do: 'orbit', at: 'user', color: '#fff6a0', shape: 'star', ms: 600 }]
};

export const CRIT: AnimTimeline = [{ do: 'par', steps: [{ do: 'screen', color: '#ffffff', ms: 160, alpha: 0.7 }, { do: 'quake', ms: 220, amp: 6 }] }];
export const HEAL: AnimTimeline = [{ do: 'par', steps: [{ do: 'particles', preset: 'glow', at: 'user', ms: 600, count: 12 }, { do: 'tint', who: 'user', color: '#9fffb0', ms: 500, alpha: 0.45 }] }];
export const SEND_OUT: AnimTimeline = [{ do: 'burst', at: 'user', color: '#ffffff', size: 40, ms: 260 }];

export const WEATHER_ANIM: Record<Exclude<Weather, 'none'>, AnimTimeline> = {
  rain: [{ do: 'par', steps: [{ do: 'particles', preset: 'rain', at: 'screen', ms: 900 }, { do: 'screen', color: '#2a4a8a', ms: 900, alpha: 0.3 }] }],
  sun: [{ do: 'par', steps: [{ do: 'particles', preset: 'rays', at: 'screen', ms: 900 }, { do: 'screen', color: '#ffd36b', ms: 900, alpha: 0.35 }] }],
  sand: [{ do: 'par', steps: [{ do: 'particles', preset: 'sand', at: 'screen', ms: 900 }, { do: 'screen', color: '#c9a052', ms: 900, alpha: 0.3 }] }],
  snow: [{ do: 'par', steps: [{ do: 'particles', preset: 'snow', at: 'screen', ms: 900 }, { do: 'screen', color: '#dff4ff', ms: 900, alpha: 0.3 }] }]
};
