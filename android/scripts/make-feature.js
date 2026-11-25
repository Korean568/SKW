/*
 * Play 스토어 "그래픽 이미지"(feature graphic, 1024x500) 만들기
 *
 *   node android/scripts/make-feature.js
 *
 * store/feature-bg.jpg (게임 화면 렌더) 위에 제목을 얹어 store/feature-1024x500.png 로 저장한다.
 * Playwright(Chromium) 가 필요하다: npm i -g playwright && npx playwright install chromium (NODE_PATH 를 맞추거나 npm i playwright)
 * 만든 PNG 는 저장소에 올려 둔다 — 그림이나 제목을 바꿨을 때만 다시 실행.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const STORE = path.join(__dirname, '..', 'store');
const bg = 'data:image/jpeg;base64,' + fs.readFileSync(path.join(STORE, 'feature-bg.jpg')).toString('base64');
const html = `<!doctype html><meta charset=utf-8><style>
html,body{margin:0;width:1024px;height:500px;overflow:hidden;background:#000}
.bg{position:absolute;inset:0;background:url(${bg}) 50% 62%/cover}
.sh{position:absolute;inset:0;background:linear-gradient(90deg,#000d 0%,#000a 34%,#0000 72%),linear-gradient(0deg,#0009 0%,#0000 30%)}
.t{position:absolute;left:64px;top:50%;transform:translateY(-54%);color:#fff;font-family:'Noto Sans KR','Noto Sans CJK KR',system-ui,sans-serif}
.t h1{margin:0;font-weight:900;font-size:78px;line-height:.94;letter-spacing:.04em;text-shadow:0 4px 24px #000c}
.t h1 i{display:block;font-style:normal}
.t p{margin:18px 0 0;font-weight:700;font-size:30px;letter-spacing:.32em;color:#e8edf2;text-shadow:0 2px 10px #000}
</style><div class=bg></div><div class=sh></div>
<div class=t><h1>SECOND<i>KOREAN WARS</i></h1><p>제 2차 한국전쟁</p></div>`;

let chromium;
try { ({ chromium } = require('playwright')); } catch (e) {
  console.error('playwright 가 없습니다 (npm i -g playwright 후 NODE_PATH 를 맞추거나 npm i playwright)');
  process.exit(1);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const out = path.join(STORE, 'feature-1024x500.png');
  await page.screenshot({ path: out, omitBackground: false });
  await browser.close();
  console.log('feature →', out, fs.statSync(out).size, 'bytes');
})().catch((e) => { console.error(e); process.exit(1); });
