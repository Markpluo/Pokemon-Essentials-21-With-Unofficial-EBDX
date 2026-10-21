// Chat moderation helpers (online-ops.md §2): profanity masking in English and Danish,
// link blocking for new accounts, trainer-name rules and a token-bucket rate limiter.

// Short on purpose: stems that are offensive in any context. Matching is on whole words or word starts.
const BAD = [
  'fuck', 'shit', 'cunt', 'bitch', 'bastard', 'dick', 'cock', 'pussy', 'whore', 'slut', 'nigg', 'faggot', 'retard',
  'kusse', 'fisse', 'luder', 'kælling', 'kaelling', 'røvhul', 'rovhul', 'perker', 'bøsserøv', 'spasser', 'møgso'
];
const BAD_RE = new RegExp(`(^|[^\\p{L}])(${BAD.join('|')})\\p{L}*`, 'giu');

export function maskProfanity(text: string): string {
  return text.replace(BAD_RE, (m, pre: string) => pre + '*'.repeat(m.length - pre.length));
}
export const hasProfanity = (text: string) => maskProfanity(text) !== text;

const LINK_RE = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|gg|dk|de|se|no|ly|me|co|xyz|ru)\b)/i;
export const hasLink = (text: string) => LINK_RE.test(text);

/** Trims, drops control characters and caps the length. */
export function cleanText(text: unknown, max = 200): string {
  return String(text ?? '').replace(/[\u0000-\u001f\u007f​-‏‪-‮]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Trainer names: 3 to 12 letters, digits, spaces, "-" or "_", Danish letters included, nothing rude. */
export function nameProblem(name: string): string | null {
  if (!/^[\p{L}0-9][\p{L}0-9 _-]{1,10}[\p{L}0-9]$/u.test(name)) return 'Names are 3 to 12 letters or digits.';
  if (hasProfanity(name)) return 'Please pick a different name.';
  return null;
}

/** Allows `rate` actions per second with bursts up to `burst`. */
export class Bucket {
  private tokens: number;
  private last: number;
  constructor(private rate: number, private burst: number, private now: () => number = Date.now) {
    this.tokens = burst; this.last = now();
  }
  take(): boolean {
    const t = this.now();
    this.tokens = Math.min(this.burst, this.tokens + (t - this.last) * this.rate / 1000);
    this.last = t;
    if (this.tokens < 1) return false;
    this.tokens--;
    return true;
  }
}
