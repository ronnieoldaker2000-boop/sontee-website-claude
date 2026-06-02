import { createRequire } from 'module';
import { readdir } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const puppeteer = require('C:/Users/ronni/AppData/Local/Temp/puppeteer-test/node_modules/puppeteer/lib/puppeteer/puppeteer.js');

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const outDir = join(__dirname, 'temporary screenshots');

const url = process.argv[2] || 'http://localhost:3000';
const label = process.argv[3] ? `-${process.argv[3]}` : '';

async function nextIndex() {
  try {
    const files = await readdir(outDir);
    const nums = files
      .map(f => f.match(/^screenshot-(\d+)/))
      .filter(Boolean)
      .map(m => parseInt(m[1], 10));
    return nums.length ? Math.max(...nums) + 1 : 1;
  } catch {
    return 1;
  }
}

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 1200));

  const idx = await nextIndex();
  const filename = `screenshot-${idx}${label}.png`;
  const filepath = join(outDir, filename);
  await page.screenshot({ path: filepath, fullPage: false });
  await browser.close();

  console.log(`Saved: temporary screenshots/${filename}`);
})();
