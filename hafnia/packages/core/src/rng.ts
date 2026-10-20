// Small seeded PRNG (mulberry32). Its state is one number, so it saves with the game
// and a server can replay or audit any roll.
export class Rng {
  constructor(public state: number) {}

  next(): number {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(n: number): number { return Math.floor(this.next() * n); }
  chance(p: number): boolean { return this.next() < p; }
  pick<T>(list: readonly T[]): T { return list[this.int(list.length)]; }

  /** A seed string for the Showdown simulator's own PRNG. */
  simSeed(): string {
    let hex = '';
    for (let i = 0; i < 4; i++) hex += this.int(0x100000000).toString(16).padStart(8, '0');
    return `sodium,${hex}`;
  }
}
