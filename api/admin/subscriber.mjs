import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

function authed(req) {
  const pw = process.env.ADMIN_PASSWORD ?? 'sontee2026';
  return req.headers['x-admin-token'] === Buffer.from(`${pw}:sontee`).toString('base64');
}

export default async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).end();
  if (!authed(req)) return res.status(401).json({ ok: false });

  const email = req.query?.email;
  if (!email) return res.status(400).json({ ok: false, msg: 'Email required.' });

  const subs = (await redis.get('sontee:subscribers')) ?? [];
  const filtered = subs.filter(s => s.email.toLowerCase() !== email.toLowerCase());
  if (filtered.length === subs.length)
    return res.status(404).json({ ok: false, msg: 'Not found.' });

  await redis.set('sontee:subscribers', filtered);
  return res.status(200).json({ ok: true });
}
