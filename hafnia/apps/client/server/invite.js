// Shared by the invite middleware and /api/invite (Cloudflare Pages Functions).
// The cookie is "<expiry ms>.<HMAC-SHA256 of the expiry>", signed with the INVITE_SECRET env var.
export const COOKIE = 'cc_invite';
export const MAX_AGE = 60 * 24 * 3600; // 60 days

const enc = new TextEncoder();
const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function sign(secret, data) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}

export async function makeToken(secret) {
  const exp = String(Date.now() + MAX_AGE * 1000);
  return `${exp}.${await sign(secret, exp)}`;
}

export async function validToken(secret, token) {
  if (!secret || !token) return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const want = await sign(secret, exp);
  if (want.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

export function readCookie(request, name) {
  const m = (request.headers.get('cookie') ?? '').match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? m[1] : null;
}
