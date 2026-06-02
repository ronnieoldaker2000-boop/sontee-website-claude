import { kv } from '@vercel/kv';
import nodemailer from 'nodemailer';

function authed(req) {
  const pw = process.env.ADMIN_PASSWORD ?? 'sontee2026';
  return req.headers['x-admin-token'] === Buffer.from(`${pw}:sontee`).toString('base64');
}

function emailHtml(body) {
  const safe = body
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#060D1E;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:48px 16px">
<tr><td align="center"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td style="padding-bottom:24px;border-bottom:1px solid rgba(120,160,230,0.15)">
  <span style="font-size:12px;font-weight:700;letter-spacing:0.18em;color:#ede4dd;text-transform:uppercase">SONTEE</span>
</td></tr>
<tr><td style="padding-top:28px;font-size:15px;line-height:1.78;color:rgba(237,228,221,0.85)">${safe}</td></tr>
<tr><td style="padding-top:40px;font-size:11px;color:rgba(237,228,221,0.28)">© 2026 SONTEE. All rights reserved.</td></tr>
</table></td></tr></table></body></html>`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!authed(req)) return res.status(401).json({ ok: false });

  const { subject, message } = req.body ?? {};
  if (!subject?.trim() || !message?.trim())
    return res.status(400).json({ ok: false, msg: 'Subject and message are required.' });

  const subs = (await kv.get('sontee:subscribers')) ?? [];
  if (!subs.length)
    return res.status(200).json({ ok: true, sent: 0, failed: 0, msg: 'No subscribers yet.' });

  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;
  if (!emailUser || !emailPass)
    return res.status(500).json({ ok: false, msg: 'Email not configured. Add EMAIL_USER and EMAIL_PASS to Vercel environment variables.' });

  const transport = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: emailUser, pass: emailPass },
  });

  let sent = 0, failed = 0;
  for (const sub of subs) {
    const first = sub.name.split(' ')[0];
    const body = message.replace(/\{name\}/gi, first);
    try {
      await transport.sendMail({
        from: `"SONTEE" <${emailUser}>`,
        to: sub.email,
        subject,
        text: body,
        html: emailHtml(body),
      });
      sent++;
    } catch (err) {
      console.error(`[email fail] ${sub.email}: ${err.message}`);
      failed++;
    }
  }
  return res.status(200).json({ ok: true, sent, failed });
}
