// Stands in for lib/core.ts inside the playthrough bundle: game-core is already bundled in.
import * as core from '../lib/core-entry';
export type Core = typeof core;
export const loadCore = async (): Promise<Core> => core;
