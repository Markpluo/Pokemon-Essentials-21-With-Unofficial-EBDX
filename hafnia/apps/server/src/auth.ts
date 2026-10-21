// Checks the login token a client sends when it connects. Players sign in with Supabase Auth
// (email magic link) in the browser, then pass their access token (a JWT) to the game server.
// - SUPABASE_URL: verify against the project's published signing keys (JWKS), the current Supabase default.
// - SUPABASE_JWT_SECRET: verify projects that still use the legacy shared HS256 secret.
// - DEV_AUTH=1: local development only. A token "dev:<email>" logs in as that user, no checks.
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

export interface Identity { id: string; email: string }
export type Verifier = (token: string) => Promise<Identity | null>;

export interface AuthConfig { supabaseUrl?: string; jwtSecret?: string; devAuth?: boolean }

export function makeVerifier(c: AuthConfig): Verifier {
  const jwks = c.supabaseUrl ? createRemoteJWKSet(new URL(`${c.supabaseUrl.replace(/\/$/, '')}/auth/v1/.well-known/jwks.json`)) : null;
  const secret = c.jwtSecret ? new TextEncoder().encode(c.jwtSecret) : null;
  const issuer = c.supabaseUrl ? `${c.supabaseUrl.replace(/\/$/, '')}/auth/v1` : undefined;
  const identity = (p: JWTPayload): Identity | null =>
    typeof p.sub === 'string' && p.role === 'authenticated' ? { id: p.sub, email: String(p.email ?? '') } : null;

  return async token => {
    if (typeof token !== 'string' || token.length > 4096) return null;
    if (c.devAuth && token.startsWith('dev:')) {
      const email = token.slice(4).trim().toLowerCase();
      return email ? { id: devId(email), email } : null;
    }
    const opts = { audience: 'authenticated', ...(issuer ? { issuer } : {}) };
    if (jwks) { try { return identity((await jwtVerify(token, jwks, opts)).payload); } catch { /* try the shared secret */ } }
    if (secret) { try { return identity((await jwtVerify(token, secret, opts)).payload); } catch { return null; } }
    return null;
  };
}

/** A stable UUID-shaped id for a dev login, so dev accounts also fit the Postgres schema. */
function devId(email: string) {
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (const ch of email) { h1 = Math.imul(h1 ^ ch.charCodeAt(0), 16777619) >>> 0; h2 = Math.imul(h2 ^ ch.charCodeAt(0), 2246822507) >>> 0; }
  const hex = (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')).repeat(2);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
