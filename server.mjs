import { createServer } from 'http';
import { readFile, writeFile, stat, mkdir } from 'fs/promises';
import { join, extname, resolve as resolvePath } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PORT      = 3000;
const DATA_DIR  = join(__dirname, 'data');
const SUBS_FILE = join(DATA_DIR, 'subscribers.json');
const CFG_FILE  = join(__dirname, 'config.json');

const BLOCKLIST = new Set([
  'config.json','server.mjs','serve.mjs','serve-mobile.mjs','screenshot.mjs','package.json'
]);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.mjs':  'application/javascript',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff2':'font/woff2',
  '.woff': 'font/woff',
  '.ttf':  'font/ttf',
};

// ── helpers ──────────────────────────────────────────────────────────────────

const DEFAULT_CFG = { adminPassword: 'sontee2026', email: { user: '', pass: '' }, fromName: 'SONTEE' };

async function loadConfig() {
  try { return { ...DEFAULT_CFG, ...JSON.parse(await readFile(CFG_FILE, 'utf8')) }; }
  catch { await writeFile(CFG_FILE, JSON.stringify(DEFAULT_CFG, null, 2)); return DEFAULT_CFG; }
}

async function loadSubs() {
  try { return JSON.parse(await readFile(SUBS_FILE, 'utf8')); } catch { return []; }
}

async function saveSubs(subs) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(SUBS_FILE, JSON.stringify(subs, null, 2));
}

async function addSub(name, email) {
  const subs = await loadSubs();
  if (subs.some(s => s.email.toLowerCase() === email.toLowerCase())) return false;
  subs.push({ name: name.trim(), email: email.trim().toLowerCase(), ts: Date.now() });
  await saveSubs(subs);
  return true;
}

function readBody(req) {
  return new Promise(ok => {
    let d = '';
    req.on('data', c => { d += c; if (d.length > 1e5) req.destroy(); });
    req.on('end', () => { try { ok(JSON.parse(d)); } catch { ok({}); } });
    req.on('error', () => ok({}));
  });
}

function token(pw) { return Buffer.from(`${pw}:sontee`).toString('base64'); }
function authed(req, pw) { return req.headers['x-admin-token'] === token(pw); }

function reply(res, status, data, ct = 'application/json') {
  res.writeHead(status, { 'Content-Type': ct });
  res.end(Buffer.isBuffer(data) || typeof data === 'string' ? data : JSON.stringify(data));
}

function emailHtml(body) {
  const safe = body
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\n/g,'<br>');
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

// ── server ────────────────────────────────────────────────────────────────────

createServer(async (req, res) => {
  const url  = new URL(req.url, 'http://localhost');
  const p    = url.pathname;
  const meth = req.method;

  if (meth === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // POST /api/subscribe
  if (p === '/api/subscribe' && meth === 'POST') {
    const { name, email } = await readBody(req);
    if (!name?.trim() || name.trim().length > 120)
      return reply(res, 400, { ok: false, msg: 'Please enter your name.' });
    if (!email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320)
      return reply(res, 400, { ok: false, msg: 'Please enter a valid email address.' });
    const added = await addSub(name, email);
    if (!added) return reply(res, 409, { ok: false, msg: 'already_registered' });
    console.log(`[new sub] ${name.trim()} <${email.trim().toLowerCase()}>`);
    return reply(res, 200, { ok: true });
  }

  // POST /api/admin/login
  if (p === '/api/admin/login' && meth === 'POST') {
    const { password } = await readBody(req);
    const cfg = await loadConfig();
    if (password === cfg.adminPassword)
      return reply(res, 200, { ok: true, token: token(password) });
    await new Promise(r => setTimeout(r, 500));
    return reply(res, 401, { ok: false, msg: 'Incorrect password.' });
  }

  // GET /api/admin/subscribers
  if (p === '/api/admin/subscribers' && meth === 'GET') {
    const cfg = await loadConfig();
    if (!authed(req, cfg.adminPassword)) return reply(res, 401, { ok: false });
    const subs = await loadSubs();
    return reply(res, 200, { ok: true, subs, total: subs.length });
  }

  // DELETE /api/admin/subscriber
  if (p === '/api/admin/subscriber' && meth === 'DELETE') {
    const cfg = await loadConfig();
    if (!authed(req, cfg.adminPassword)) return reply(res, 401, { ok: false });
    const email = url.searchParams.get('email');
    if (!email) return reply(res, 400, { ok: false, msg: 'Email required.' });
    const subs = await loadSubs();
    const filtered = subs.filter(s => s.email.toLowerCase() !== email.toLowerCase());
    if (filtered.length === subs.length) return reply(res, 404, { ok: false, msg: 'Not found.' });
    await saveSubs(filtered);
    console.log(`[removed] ${email}`);
    return reply(res, 200, { ok: true });
  }

  // POST /api/admin/send
  if (p === '/api/admin/send' && meth === 'POST') {
    const cfg = await loadConfig();
    if (!authed(req, cfg.adminPassword)) return reply(res, 401, { ok: false });
    const { subject, message } = await readBody(req);
    if (!subject?.trim() || !message?.trim())
      return reply(res, 400, { ok: false, msg: 'Subject and message are required.' });
    const subs = await loadSubs();
    if (!subs.length)
      return reply(res, 200, { ok: true, sent: 0, failed: 0, msg: 'No subscribers yet.' });
    if (!cfg.email?.user || !cfg.email?.pass || cfg.email.user.includes('your-gmail'))
      return reply(res, 500, { ok: false, msg: 'Email not configured. Open config.json and set your Gmail address and App Password.' });

    let nodemailer;
    try { nodemailer = (await import('nodemailer')).default; }
    catch { return reply(res, 500, { ok: false, msg: 'Run "npm install" in the project folder first.' }); }

    const transport = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: cfg.email.user, pass: cfg.email.pass }
    });

    let sent = 0, failed = 0;
    for (const sub of subs) {
      const first = sub.name.split(' ')[0];
      const body  = message.replace(/\{name\}/gi, first);
      try {
        await transport.sendMail({
          from: `"${cfg.fromName}" <${cfg.email.user}>`,
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
    console.log(`[email] sent=${sent} failed=${failed}`);
    return reply(res, 200, { ok: true, sent, failed });
  }

  // GET /admin  →  serve admin page
  if (p === '/admin') {
    try {
      const html = await readFile(join(__dirname, 'admin.html'));
      return reply(res, 200, html, 'text/html; charset=utf-8');
    } catch {
      return reply(res, 404, 'Not found', 'text/plain');
    }
  }

  // Static files
  const filePath   = join(__dirname, p === '/' ? 'index.html' : p);
  const resolvedFP = resolvePath(filePath);
  const resolvedD  = resolvePath(__dirname);

  if (!resolvedFP.startsWith(resolvedD))
    return reply(res, 403, 'Forbidden', 'text/plain');

  const rel = resolvedFP.slice(resolvedD.length + 1).replace(/\\/g, '/');
  if (BLOCKLIST.has(rel) || rel.startsWith('data/') || rel === 'admin.html')
    return reply(res, 403, 'Forbidden', 'text/plain');

  try {
    await stat(filePath);
    const data = await readFile(filePath);
    const ct   = MIME[extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': ct, 'Cache-Control': 'no-cache' });
    res.end(data);
  } catch {
    reply(res, 404, 'Not Found', 'text/plain');
  }

}).listen(PORT, () => {
  console.log(`\n  SONTEE server  →  http://localhost:${PORT}`);
  console.log(`  Admin panel    →  http://localhost:${PORT}/admin`);
  console.log(`  Admin password →  sontee2026  (change in config.json)\n`);
});
