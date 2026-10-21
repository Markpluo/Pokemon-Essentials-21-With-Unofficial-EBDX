// Battle animations are data, not code (design/battle-animations.md): a timeline is a list of steps
// that the client plays in order. Packs ship their own move animations as JSON, so this file holds
// only the shape of that data and a checker for the content tests. Nothing here draws anything.

/** Whose sprite a step acts on. `screen` means the whole battle scene. */
export type AnimWho = 'user' | 'target';
export type AnimAt = AnimWho | 'screen';

export const ANIM_SHAPES = ['orb', 'ring', 'shard', 'leaf', 'star', 'note', 'drop', 'rock', 'spark', 'heart', 'arrow', 'streak', 'z', 'feather'] as const;
export type AnimShape = typeof ANIM_SHAPES[number];

export const ANIM_PRESETS = [
  'sparks', 'leaves', 'bubbles', 'embers', 'snow', 'smoke', 'stars', 'petals', 'rocks', 'shadows', 'drops', 'notes', 'zs',
  'hearts', 'arrowsUp', 'arrowsDown', 'rain', 'sand', 'rays', 'dust', 'feathers', 'ice', 'spores', 'glow'
] as const;
export type AnimPreset = typeof ANIM_PRESETS[number];

/** One step. Durations are in milliseconds at normal speed; colours are CSS colours.
 *  A string starting with `$` (such as `$color`) is filled in from the move type's style. */
export type AnimStep =
  | { do: 'lunge'; who?: AnimWho; ms?: number; dist?: number }
  | { do: 'hop'; who?: AnimWho; ms?: number; height?: number; times?: number }
  | { do: 'shake'; who?: AnimWho; ms?: number; amp?: number }
  | { do: 'blink'; who?: AnimWho; ms?: number }
  | { do: 'tint'; who?: AnimWho; color: string; ms?: number; alpha?: number }
  | { do: 'squash'; who?: AnimWho; ms?: number; amount?: number }
  | { do: 'screen'; color: string; ms?: number; alpha?: number }
  | { do: 'quake'; ms?: number; amp?: number }
  | { do: 'projectile'; from?: AnimWho; to?: AnimWho; color: string; shape?: AnimShape; size?: number; ms?: number; arc?: number; count?: number; gap?: number; spread?: number }
  | { do: 'beam'; from?: AnimWho; to?: AnimWho; color: string; width?: number; ms?: number; wobble?: number }
  | { do: 'particles'; preset: AnimPreset; at?: AnimAt; color?: string; ms?: number; count?: number; radius?: number }
  | { do: 'burst'; at?: AnimAt; color: string; size?: number; ms?: number }
  | { do: 'slash'; at?: AnimAt; color?: string; count?: number; ms?: number }
  | { do: 'bite'; at?: AnimAt; color?: string; ms?: number }
  | { do: 'orbit'; at?: AnimAt; color: string; shape?: AnimShape; count?: number; ms?: number; radius?: number }
  | { do: 'wave'; from?: AnimWho; to?: AnimWho; color: string; ms?: number; rings?: number }
  | { do: 'drain'; from?: AnimWho; to?: AnimWho; color: string; ms?: number; count?: number }
  | { do: 'sfx'; name: string; vol?: number }
  | { do: 'wait'; ms: number }
  | { do: 'par'; steps: AnimStep[] };
export type AnimTimeline = AnimStep[];
export type AnimStepKind = AnimStep['do'];

export const ANIM_STEP_KINDS: AnimStepKind[] = [
  'lunge', 'hop', 'shake', 'blink', 'tint', 'squash', 'screen', 'quake', 'projectile', 'beam', 'particles', 'burst',
  'slash', 'bite', 'orbit', 'wave', 'drain', 'sfx', 'wait', 'par'
];

/** A pack's animation file: move id (Showdown id, e.g. `vinewhip`) to timeline. */
export interface AnimPack { moves: Record<string, AnimTimeline> }

/** Problems with a timeline, for the content tests. `$` placeholders are allowed. */
export function checkTimeline(tl: unknown, where: string): string[] {
  const errors: string[] = [];
  const isVar = (v: unknown) => typeof v === 'string' && v.startsWith('$');
  const walk = (steps: unknown, path: string) => {
    if (!Array.isArray(steps)) { errors.push(`${path}: not a list of steps`); return; }
    steps.forEach((s: any, i) => {
      const p = `${path}[${i}]`;
      if (!s || typeof s !== 'object') { errors.push(`${p}: not a step`); return; }
      if (!ANIM_STEP_KINDS.includes(s.do) && !isVar(s.do)) errors.push(`${p}: unknown step "${s.do}"`);
      if (s.do === 'par') walk(s.steps, `${p}.steps`);
      if (s.preset !== undefined && !isVar(s.preset) && !(ANIM_PRESETS as readonly string[]).includes(s.preset)) errors.push(`${p}: unknown preset "${s.preset}"`);
      if (s.shape !== undefined && !isVar(s.shape) && !(ANIM_SHAPES as readonly string[]).includes(s.shape)) errors.push(`${p}: unknown shape "${s.shape}"`);
      for (const k of ['who', 'from', 'to']) if (s[k] !== undefined && s[k] !== 'user' && s[k] !== 'target') errors.push(`${p}: ${k} must be user or target`);
      if (s.at !== undefined && !['user', 'target', 'screen'].includes(s.at)) errors.push(`${p}: at must be user, target or screen`);
      if (s.ms !== undefined && !(typeof s.ms === 'number' && s.ms >= 0 && s.ms <= 5000)) errors.push(`${p}: ms must be 0-5000`);
    });
  };
  walk(tl, where);
  return errors;
}
