import { kv } from '@vercel/kv';

function authed(req) {
  const pw = process.env.ADMIN_PASSWORD ?? 'sontee2026';
  return req.headers['x-admin-token'] === Buffer.from(`${pw}:sontee`).toString('base64');
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  if (!authed(req)) return res.status(401).json({ ok: false });

  const subs = (await kv.get('sontee:subscribers')) ?? [];
  return res.status(200).json({ ok: true, subs, total: subs.length });
}
