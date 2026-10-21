// Login tokens: Supabase-style JWTs are checked; dev tokens only work when switched on.
import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { makeVerifier } from '../src/auth';

const secret = 'test-secret-at-least-32-characters-long!';
const sign = (claims: Record<string, unknown>, key = secret, exp = '1h') =>
  new SignJWT(claims).setProtectedHeader({ alg: 'HS256' }).setSubject('7f2c1d5e-0000-4000-8000-000000000001')
    .setAudience('authenticated').setExpirationTime(exp).sign(new TextEncoder().encode(key));

describe('auth', () => {
  it('accepts signed Supabase tokens and refuses everything else', async () => {
    const verify = makeVerifier({ jwtSecret: secret });
    expect(await verify(await sign({ role: 'authenticated', email: 'a@example.com' }))).toEqual({ id: '7f2c1d5e-0000-4000-8000-000000000001', email: 'a@example.com' });
    expect(await verify(await sign({ role: 'anon' }))).toBeNull();
    expect(await verify(await sign({ role: 'authenticated' }, 'another-secret-also-32-characters-long'))).toBeNull();
    expect(await verify(await sign({ role: 'authenticated' }, secret, '-1m'))).toBeNull();
    expect(await verify('dev:a@example.com')).toBeNull();
  });

  it('gives dev logins a stable UUID', async () => {
    const verify = makeVerifier({ devAuth: true });
    const a = await verify('dev:A@example.com'), b = await verify('dev:a@example.com');
    expect(a?.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a).toEqual(b);
  });
});
