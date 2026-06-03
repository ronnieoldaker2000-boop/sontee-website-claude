import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { name, email } = req.body ?? {};

  if (!name?.trim() || name.trim().length > 120)
    return res.status(400).json({ ok: false, msg: 'Please enter your name.' });
  if (!email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320)
    return res.status(400).json({ ok: false, msg: 'Please enter a valid email address.' });

  const subs = (await redis.get('sontee:subscribers')) ?? [];
  if (subs.some(s => s.email.toLowerCase() === email.toLowerCase()))
    return res.status(409).json({ ok: false, msg: 'already_registered' });

  subs.push({ name: name.trim(), email: email.trim().toLowerCase(), ts: Date.now() });
  await redis.set('sontee:subscribers', subs);

  return res.status(200).json({ ok: true });
}
