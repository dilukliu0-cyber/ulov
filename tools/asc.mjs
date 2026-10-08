// Мини-клиент App Store Connect API. node tools/asc.mjs <METHOD> <path> [jsonBody]
import crypto from 'node:crypto';
import fs from 'node:fs';
const KEY_ID = process.env.ASC_KEY_ID || '4YM72H56S5';
const ISSUER = process.env.ASC_ISSUER_ID || '';
const P8 = process.env.ASC_KEY_PATH || `D:/download/AuthKey_${KEY_ID}.p8`;
const b64u = (b) => Buffer.from(b).toString('base64url');
export function token() {
  const h = b64u(JSON.stringify({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const p = b64u(JSON.stringify({ iss: ISSUER, iat: now, exp: now + 1100, aud: 'appstoreconnect-v1' }));
  const sig = crypto.sign('sha256', Buffer.from(h + '.' + p), { key: fs.readFileSync(P8), dsaEncoding: 'ieee-p1363' });
  return `${h}.${p}.${b64u(sig)}`;
}
export async function asc(method, path, body) {
  const r = await fetch('https://api.appstoreconnect.apple.com' + path, {
    method, headers: { Authorization: 'Bearer ' + token(), 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await r.text();
  let j; try { j = JSON.parse(txt); } catch { j = txt; }
  return { status: r.status, data: j };
}
if (process.argv[1] && process.argv[1].endsWith('asc.mjs')) {
  const [m, p, b] = process.argv.slice(2);
  const res = await asc(m, p, b ? JSON.parse(b) : undefined);
  console.log(res.status, JSON.stringify(res.data, null, 1).slice(0, 4000));
}
