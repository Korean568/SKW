/*
 * iOS 앱 아이콘 (1024x1024 한 장, 알파 채널 없음 — App Store 는 투명한 아이콘을 받지 않는다)
 *
 *   node ios/scripts/make-icon.js [출력.png]      (기본: ios/SKW/Resources/Assets.xcassets/AppIcon.appiconset/AppIcon-1024.png)
 *
 * desktop/build/icon.png (512x512, 투명 배경의 낙하산병) 을 Android 스토어 아이콘(android/scripts/make-icons.py 의 store/icon-512.png)과
 * 같은 모양으로 만든다: 하늘색 세로 그라데이션 위에 그림을 가운데, 그림의 바깥 반지름이 캔버스의 FIT 만큼.
 * 모서리는 iOS 가 둥글게 자른다. 외부 라이브러리 없이 Node 만 쓴다 (PNG 읽기 · 쓰기는 zlib).
 * prepare-resources.js 가 빌드할 때마다 부른다 (만든 PNG 는 저장소에 넣지 않음).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const IOS = path.join(__dirname, '..');
const REPO = path.join(IOS, '..');
const SRC = path.join(REPO, 'desktop', 'build', 'icon.png');
const OUT = path.join(IOS, 'SKW', 'Resources', 'Assets.xcassets', 'AppIcon.appiconset', 'AppIcon-1024.png');
const SIZE = 1024;
const TOP = [38, 84, 122], BOTTOM = [150, 190, 214]; // make-icons.py 와 같은 색
const FIT = 0.38;                                     // 그림 반지름 / 캔버스 (Android 스토어 아이콘 0.37 · 옛 아이콘 0.40 사이)

// PNG 읽기: 8비트 RGB · RGBA · 회색 · 회색+알파, 비월(interlace) 없음 → RGBA 바이트
function readPng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('PNG 가 아닙니다');
  let i = 8, w = 0, h = 0, depth = 0, type = 0, lace = 0;
  const idat = [];
  while (i < buf.length) {
    const len = buf.readUInt32BE(i), t = buf.toString('latin1', i + 4, i + 8), d = buf.subarray(i + 8, i + 8 + len);
    if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); depth = d[8]; type = d[9]; lace = d[12]; }
    else if (t === 'IDAT') idat.push(d);
    else if (t === 'IEND') break;
    i += 12 + len;
  }
  const ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[type];
  if (depth !== 8 || !ch || lace) throw new Error(`지원하지 않는 PNG (bit depth ${depth}, color type ${type}, interlace ${lace})`);
  const raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * ch, px = Buffer.alloc(w * h * ch);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, o = y * stride, p = o - stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? px[o + x - ch] : 0, b = y ? px[p + x] : 0, c = x >= ch && y ? px[p + x - ch] : 0;
      let v = raw[src + x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      else if (f !== 0) throw new Error('PNG 필터 ' + f);
      px[o + x] = v & 255;
    }
  }
  const rgba = Buffer.alloc(w * h * 4);
  for (let k = 0; k < w * h; k++) {
    const s = k * ch;
    if (ch === 4) px.copy(rgba, k * 4, s, s + 4);
    else if (ch === 3) { px.copy(rgba, k * 4, s, s + 3); rgba[k * 4 + 3] = 255; }
    else { rgba[k * 4] = rgba[k * 4 + 1] = rgba[k * 4 + 2] = px[s]; rgba[k * 4 + 3] = ch === 2 ? px[s + 1] : 255; }
  }
  return { w, h, rgba };
}

const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = (b) => { let c = -1; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (t, d) => {
  const len = Buffer.alloc(4), crc = Buffer.alloc(4), td = Buffer.concat([Buffer.from(t, 'latin1'), d]);
  len.writeUInt32BE(d.length); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

// PNG 쓰기: 8비트 RGB (color type 2 — 알파 채널 없음), 줄마다 Sub 필터
function writePng(w, h, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const stride = w * 3, raw = Buffer.alloc(h * (stride + 1));
  for (let y = 0; y < h; y++) {
    const o = y * (stride + 1), s = y * stride;
    raw[o] = 1;
    for (let x = 0; x < stride; x++) raw[o + 1 + x] = (rgb[s + x] - (x >= 3 ? rgb[s + x - 3] : 0)) & 255;
  }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

function makeIcon(src = SRC, size = SIZE) {
  const { w, h, rgba } = readPng(fs.readFileSync(src));
  // 그림 부분(알파 > 8)만 잘라 내고, 그림 중심에서 가장 먼 불투명 픽셀까지의 거리(반지름)
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (rgba[(y * w + x) * 4 + 3] > 8) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  if (x1 < 0) throw new Error('아이콘이 비어 있습니다');
  const aw = x1 - x0 + 1, ah = y1 - y0 + 1, cx = aw / 2, cy = ah / 2;
  let r = 0;
  for (let y = 0; y < ah; y++) for (let x = 0; x < aw; x++) if (rgba[((y + y0) * w + x + x0) * 4 + 3] > 8) r = Math.max(r, Math.hypot(x + 0.5 - cx, y + 0.5 - cy));
  const scale = FIT * size / r, dw = Math.round(aw * scale), dh = Math.round(ah * scale);
  const ox = Math.floor((size - dw) / 2), oy = Math.floor((size - dh) / 2);
  // 미리 곱한 알파(premultiplied)로 쌍선형 표본 — 투명한 가장자리 색이 번지지 않게
  const pm = new Float32Array(aw * ah * 4);
  for (let y = 0; y < ah; y++) for (let x = 0; x < aw; x++) {
    const s = ((y + y0) * w + x + x0) * 4, d = (y * aw + x) * 4, a = rgba[s + 3] / 255;
    pm[d] = rgba[s] * a; pm[d + 1] = rgba[s + 1] * a; pm[d + 2] = rgba[s + 2] * a; pm[d + 3] = a;
  }
  const at = (x, y, c) => (x < 0 || y < 0 || x >= aw || y >= ah ? 0 : pm[(y * aw + x) * 4 + c]);
  const out = Buffer.alloc(size * size * 3);
  for (let y = 0; y < size; y++) {
    const t = y / (size - 1), bg = TOP.map((a, k) => a + (BOTTOM[k] - a) * t);
    for (let x = 0; x < size; x++) {
      let col = bg;
      const u = (x - ox + 0.5) / scale - 0.5, v = (y - oy + 0.5) / scale - 0.5;
      if (u > -1 && v > -1 && u < aw && v < ah) {
        const ix = Math.floor(u), iy = Math.floor(v), fx = u - ix, fy = v - iy, s = [0, 0, 0, 0];
        for (let c = 0; c < 4; c++) s[c] = (at(ix, iy, c) * (1 - fx) + at(ix + 1, iy, c) * fx) * (1 - fy) + (at(ix, iy + 1, c) * (1 - fx) + at(ix + 1, iy + 1, c) * fx) * fy;
        col = bg.map((b, k) => s[k] + b * (1 - s[3]));
      }
      const o = (y * size + x) * 3;
      for (let k = 0; k < 3; k++) out[o + k] = Math.max(0, Math.min(255, Math.round(col[k])));
    }
  }
  return writePng(size, size, out);
}

module.exports = { makeIcon, readPng, writePng, OUT };

if (require.main === module) {
  const out = process.argv[2] ? path.resolve(process.argv[2]) : OUT;
  const png = makeIcon();
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, png);
  const chk = readPng(png);
  console.log(`[make-icon] ${path.relative(REPO, out)} ${chk.w}x${chk.h} RGB (알파 없음) · ${(png.length / 1024).toFixed(0)} KB`);
}
