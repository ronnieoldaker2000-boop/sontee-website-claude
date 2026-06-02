export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { password } = req.body ?? {};
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'sontee2026';

  if (password !== adminPassword) {
    await new Promise(r => setTimeout(r, 500));
    return res.status(401).json({ ok: false, msg: 'Incorrect password.' });
  }

  const token = Buffer.from(`${adminPassword}:sontee`).toString('base64');
  return res.status(200).json({ ok: true, token });
}
