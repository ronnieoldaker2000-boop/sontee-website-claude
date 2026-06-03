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
  if (req.method !== 'GET') return res.status(405).end();
  if (!authed(req)) return res.status(401).json({ ok: false });

  const subs = (await redis.get('sontee:subscribers')) ?? [];
  return res.status(200).json({ ok: true, subs, total: subs.length });
}
