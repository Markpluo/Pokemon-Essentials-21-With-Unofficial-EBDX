// POST {"code": "..."}: checks the code against INVITE_CODES (comma-separated, case-insensitive)
// and sets the invite cookie. Fails closed when the env vars are missing.
import { COOKIE, MAX_AGE, makeToken } from '../../server/invite.js';

export async function onRequestPost({ request, env }) {
  if (!env.INVITE_SECRET || !env.INVITE_CODES) return new Response('Invites are not set up', { status: 503 });
  let code = '';
  try { code = String((await request.json()).code ?? '').trim().toUpperCase(); } catch { /* bad body */ }
  const codes = env.INVITE_CODES.split(',').map(c => c.trim().toUpperCase()).filter(Boolean);
  if (!code || !codes.includes(code)) return new Response('Wrong code', { status: 401 });
  return new Response('ok', {
    headers: { 'Set-Cookie': `${COOKIE}=${await makeToken(env.INVITE_SECRET)}; Max-Age=${MAX_AGE}; Path=/; HttpOnly; Secure; SameSite=Lax` }
  });
}
