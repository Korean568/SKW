/*
 * 게임 탭 아이콘(SVG, ../source/template.html 의 <link rel="icon">)을 512x512 PNG 로 바꿔
 * build/icon.png 에 저장한다. electron-builder 가 이 파일로 Windows .ico · macOS .icns · Linux 아이콘을 만든다.
 *
 * 한 번 만들어 커밋해 두면 되므로 빌드 때마다 돌릴 필요는 없다 (아이콘을 바꿨을 때만: npm run icon).
 * Playwright(Chromium) 가 필요하다: npm i -g playwright && npx playwright install chromium
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const tpl = fs.readFileSync(path.join(ROOT, '..', 'source', 'template.html'), 'utf8');
const m = tpl.match(/<link rel="icon" href="data:image\/svg\+xml,([^"]+)"/);
if (!m) { console.error('template.html 에서 SVG 아이콘을 찾지 못했습니다'); process.exit(1); }
const svg = decodeURIComponent(m[1]).replace(/^<svg /, '<svg width="512" height="512" ');

let chromium;
try { ({ chromium } = require('playwright')); } catch (e) {
  console.error('playwright 가 없습니다 (npm i -g playwright 후 NODE_PATH 를 맞추거나 npm i playwright)');
  process.exit(1);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">${svg}</body></html>`);
  const out = path.join(ROOT, 'build', 'icon.png');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await page.locator('svg').screenshot({ path: out, omitBackground: true });
  await browser.close();
  console.log('icon →', out, fs.statSync(out).size, 'bytes');
})().catch((e) => { console.error(e); process.exit(1); });
