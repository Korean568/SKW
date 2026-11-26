/*
 * node web/scripts/build-web.js
 *
 * 스토리 게임의 브라우저판(itch.io HTML5, iPhone · iPad · Android · PC 브라우저)을 만든다.
 * PC판 · Android 앱과 같은 게임 빌드(desktop/scripts/build-story.js: source/build.js --story, 스튜디오 오프닝 없음)에
 *   1) <head> 맨 앞(<meta charset> 바로 뒤)에 web/web-shim.js (window.skwDesktop, platform 'web') 를 끼워 넣고
 *   2) viewport 에 viewport-fit=cover 를 확인하고, iPhone 홈 화면 · 상태 표시줄용 meta 태그와 apple-touch-icon(180x180)을 넣어
 *   3) web/dist/index.html 과 web/dist/second-korean-wars-web.zip (zip 맨 위에 index.html 하나) 을 만든다.
 * web/dist/ 는 저장소에 올리지 않는다 (web/.gitignore).
 *
 * Node 기본 모듈만 쓴다 (zip · PNG 도 직접). 게임 빌드에 필요한 esbuild 는 desktop/node_modules 에서 찾는다:
 *   cd desktop && ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci      (Electron 실행 파일은 받지 않아도 된다)
 * 없으면 tools/node_modules 의 esbuild 를 쓴다 (source/build.js 의 대체 경로).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const WEB = path.join(__dirname, '..');
const REPO = path.join(WEB, '..');
const DIST = path.join(WEB, 'dist');
const ZIP = 'second-korean-wars-web.zip';

const die = (msg) => { console.error('[build-web] 오류: ' + msg); process.exit(1); };

/* ── CRC-32 (PNG · zip 공용) ── */
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = (buf, c = -1) => { for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };

/* ── PNG: 읽기(8비트 RGB/RGBA, 인터레이스 없음) · 줄이기(면적 평균) · 쓰기(RGB) ── */
function readPng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('PNG 가 아닙니다');
  let p = 8, w, h, bd, ct, il; const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('latin1', p + 4, p + 8), d = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); bd = d[8]; ct = d[9]; il = d[12]; }
    else if (type === 'IDAT') idat.push(d);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (bd !== 8 || (ct !== 6 && ct !== 2) || il) throw new Error(`지원하지 않는 PNG 형식 (bit ${bd}, color ${ct}, interlace ${il})`);
  const bpp = ct === 6 ? 4 : 3, stride = w * bpp, raw = zlib.inflateSync(Buffer.concat(idat)), px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), o = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[o + x - bpp] : 0, b = y ? px[o - stride + x] : 0, c = x >= bpp && y ? px[o - stride + x - bpp] : 0;
      let v = src[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[o + x] = v & 255;
    }
  }
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) { for (let k = 0; k < 3; k++) rgba[i * 4 + k] = px[i * bpp + k]; rgba[i * 4 + 3] = bpp === 4 ? px[i * bpp + 3] : 255; }
  return { w, h, rgba };
}
// 면적 평균으로 줄이고 배경색 위에 합성 (iPhone 은 투명한 아이콘 바탕을 검게 칠함 → 게임 배경색으로 미리 채움)
function scaleOnto(img, W, H, bg) {
  const out = Buffer.alloc(W * H * 3), sx = img.w / W, sy = img.h / H;
  for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) {
    const x0 = X * sx, x1 = x0 + sx, y0 = Y * sy, y1 = y0 + sy; let r = 0, g = 0, b = 0, a = 0, n = 0;
    for (let y = Math.floor(y0); y < Math.ceil(y1); y++) {
      const wy = Math.min(y + 1, y1) - Math.max(y, y0);
      for (let x = Math.floor(x0); x < Math.ceil(x1); x++) {
        const wgt = wy * (Math.min(x + 1, x1) - Math.max(x, x0)), i = (y * img.w + x) * 4, al = img.rgba[i + 3] / 255 * wgt;
        r += img.rgba[i] * al; g += img.rgba[i + 1] * al; b += img.rgba[i + 2] * al; a += al; n += wgt;
      }
    }
    const k = (Y * W + X) * 3, cov = a / n, inv = a ? 1 / a : 0;
    out[k] = Math.round(r * inv * cov + bg[0] * (1 - cov)); out[k + 1] = Math.round(g * inv * cov + bg[1] * (1 - cov)); out[k + 2] = Math.round(b * inv * cov + bg[2] * (1 - cov));
  }
  return out;
}
function writePng(W, H, rgb) {
  const raw = Buffer.alloc(H * (W * 3 + 1));
  for (let y = 0; y < H; y++) rgb.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3);
  const chunk = (type, data) => { const l = Buffer.alloc(4), c = Buffer.alloc(4), td = Buffer.concat([Buffer.from(type, 'latin1'), data]); l.writeUInt32BE(data.length); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/* ── zip 쓰기 (deflate, 파일 여러 개) · 다시 읽어 확인 ── */
function makeZip(files, date = new Date()) {
  const dt = ((date.getFullYear() - 1980) << 25 | (date.getMonth() + 1) << 21 | date.getDate() << 16 | date.getHours() << 11 | date.getMinutes() << 5 | date.getSeconds() >> 1) >>> 0;
  const loc = [], cen = []; let off = 0;
  for (const [name, data] of files) {
    const nm = Buffer.from(name, 'utf8'), comp = zlib.deflateRawSync(data, { level: 9 }), crc = crc32(data);
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(8, 8); h.writeUInt32LE(dt, 10);
    h.writeUInt32LE(crc, 14); h.writeUInt32LE(comp.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(nm.length, 26); h.writeUInt16LE(0, 28);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(0x031e, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(8, 10); c.writeUInt32LE(dt, 12);
    c.writeUInt32LE(crc, 16); c.writeUInt32LE(comp.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(nm.length, 28); c.writeUInt32LE((0o100644 << 16) >>> 0, 38); c.writeUInt32LE(off, 42);
    loc.push(h, nm, comp); cen.push(c, nm); off += 30 + nm.length + comp.length;
  }
  const cd = Buffer.concat(cen), e = Buffer.alloc(22);
  e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(files.length, 8); e.writeUInt16LE(files.length, 10); e.writeUInt32LE(cd.length, 12); e.writeUInt32LE(off, 16);
  return Buffer.concat([...loc, cd, e]);
}
function readZip(buf) { // 확인용: 중앙 디렉터리를 따라 파일을 풀어 돌려줌
  const e = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06])), n = buf.readUInt16LE(e + 10), out = {};
  let p = buf.readUInt32LE(e + 16);
  for (let i = 0; i < n; i++) {
    const m = buf.readUInt16LE(p + 10), crc = buf.readUInt32LE(p + 16), cs = buf.readUInt32LE(p + 20), nl = buf.readUInt16LE(p + 28), xl = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32), lo = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nl), ds = lo + 30 + buf.readUInt16LE(lo + 26) + buf.readUInt16LE(lo + 28);
    const raw = buf.subarray(ds, ds + cs), data = m === 8 ? zlib.inflateRawSync(raw) : raw;
    if (crc32(data) !== crc) throw new Error('zip CRC 불일치: ' + name);
    out[name] = data; p += 46 + nl + xl + cl;
  }
  return out;
}

module.exports = { readPng, scaleOnto, writePng, makeZip, readZip, crc32 };
if (require.main !== module) return;

/* ── 1) 스토리 게임 빌드 (오프닝 <script> 는 build-story 가 뺀다) ── */
const hasEsbuild = [path.join(REPO, 'desktop', 'node_modules'), path.join(REPO, 'tools', 'node_modules')]
  .some((d) => fs.existsSync(path.join(d, 'esbuild', 'package.json')));
if (!hasEsbuild) die('esbuild 가 없습니다. 먼저 실행하세요:\n    cd desktop && ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci');
const version = require(path.join(REPO, 'desktop', 'package.json')).version;
if (!/^[0-9A-Za-z.+-]+$/.test(version)) die('desktop/package.json 의 version 이 이상합니다: ' + version);
let r;
try { r = require(path.join(REPO, 'desktop', 'scripts', 'build-story.js'))(); } catch (e) { die(e.message); }
let html = r.html;
if (/SkwNative|skw:quit/.test(html)) die('게임 HTML 에 다른 플랫폼의 다리 스크립트가 들어 있습니다');

/* ── 2) 다리 스크립트 (주석을 지우고 한 덩어리로, 버전을 넣어서) ── */
const shim = fs.readFileSync(path.join(WEB, 'web-shim.js'), 'utf8')
  .replace(/\/\*[^]*?\*\//g, '').split('\n').map((l) => l.trim()).filter(Boolean).join('\n')
  .replace('__SKW_VERSION__', version);
if (shim.includes('__SKW_VERSION__') || !shim.includes(`'${version}'`)) die('web-shim.js 에 버전 자리(__SKW_VERSION__)가 하나 있어야 합니다');
if (/<\/script/i.test(shim)) die('web-shim.js 안에 </script 가 있으면 안 됩니다');
if (/[^\x00-\x7f]/.test(shim)) die('web-shim.js 의 코드는 ASCII 만 써야 합니다');
const tag = '<script>' + shim + '</script>';
const charset = /<meta\s+charset=["']?utf-8["']?\s*\/?>/i;
const head = /<head[^>]*>/i;
if (!head.test(html)) die('게임 HTML 에 <head> 가 없습니다');
const headEnd = html.search(/<\/head>/i), firstScript = html.search(/<script\b/i);
if (charset.test(html) && html.search(charset) < headEnd) html = html.replace(charset, (m) => m + tag);
else html = html.replace(head, (m) => m + '<meta charset="utf-8">' + tag);
const at = html.indexOf(tag);
if (at < 0 || (firstScript >= 0 && at > firstScript)) die('다리 스크립트가 게임의 첫 <script> 보다 앞에 있지 않습니다');
if (html.indexOf('<meta charset') < 0 || html.indexOf('<meta charset') > 512) die('<meta charset> 이 문서 맨 앞에 없습니다');

/* ── 3) viewport-fit=cover · iPhone/Android 홈 화면용 meta · apple-touch-icon ── */
const vp = /<meta\s+name=["']?viewport["']?\s+content=(["'])([^"']*)\1\s*\/?>/i;
if (vp.test(html)) html = html.replace(vp, (m, q, c) => /viewport-fit\s*=/.test(c) ? m : `<meta name="viewport" content="${c},viewport-fit=cover">`);
else html = html.replace(tag, () => tag + '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">');
let icon = '', iconNote = '아이콘 없음';
try {
  const png = writePng(180, 180, scaleOnto(readPng(fs.readFileSync(path.join(REPO, 'desktop', 'build', 'icon.png'))), 180, 180, [11, 15, 20]));
  icon = `<link rel="apple-touch-icon" href="data:image/png;base64,${png.toString('base64')}">`; iconNote = `apple-touch-icon 180x180 ${(png.length / 1024).toFixed(1)} KB`;
} catch (e) { console.warn('[build-web] 경고: apple-touch-icon 을 만들지 못했습니다 (' + e.message + ') — 아이콘 없이 계속'); }
const metas = '<meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes">'
  + '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="Second Korean Wars">'
  + '<meta name="theme-color" content="#000000"><meta name="format-detection" content="telephone=no">' + icon;
html = html.replace(vp, (m) => m + metas);
if (!html.includes('apple-mobile-web-app-capable')) die('meta 태그를 넣지 못했습니다 (viewport 태그 없음)');
if (!/viewport-fit=cover/.test(html.match(vp)[2])) die('viewport-fit=cover 가 없습니다');
if (/clkky-opening\.js/.test(html)) die('스튜디오 오프닝이 남아 있습니다');

/* ── 4) 저장: dist/index.html + dist/second-korean-wars-web.zip (zip 맨 위에 index.html) ── */
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
const buf = Buffer.from(html, 'utf8');
fs.writeFileSync(path.join(DIST, 'index.html'), buf);
const zip = makeZip([['index.html', buf]]);
const back = readZip(zip);
if (Object.keys(back).join() !== 'index.html' || !back['index.html'].equals(buf)) die('zip 을 다시 읽어 보니 내용이 다릅니다');
fs.writeFileSync(path.join(DIST, ZIP), zip);
console.log(`[build-web] 브라우저판 ${version} → ${path.relative(REPO, path.join(DIST, 'index.html'))} (${(buf.length / 1024).toFixed(0)} KB · 오프닝 <script> ${r.openingRemoved}줄 뺌 · 다리 스크립트 ${tag.length} B · ${iconNote})`);
console.log(`[build-web] itch.io 용 zip → ${path.relative(REPO, path.join(DIST, ZIP))} (${(zip.length / 1024).toFixed(0)} KB, 안에 index.html 하나)`);
