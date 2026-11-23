// 단일 HTML 빌드: template.html + core.js + mod_*.js → index.html
//   node build.js [출력 경로]            압축 빌드 (WGSL 축약 + JS/CSS minify) — 기본 출력 ../index.html
//   node build.js [출력 경로] --readable 읽기 쉬운 빌드 (디버깅용)
//   node build.js [출력 경로] --raw      자기해제 압축 없이 minify 만 (JS 가 그대로 보임)
//   --naval : 예전 해상 반격 임무 모듈도 포함 (?mode=naval)
//   --stubs : 아직 없는 모듈을 stubs.js 로 채움 (개발용)
// 기본 빌드는 minify 한 JS 를 gzip + base64 로 담고, 브라우저 내장 DecompressionStream 으로 풀어 실행하는 자기해제 방식 (외부 라이브러리 없음)
const fs = require('fs'), path = require('path'), zlib = require('zlib'), D = __dirname;
const out = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : path.join(D, '..', 'index.html'), stubs = process.argv.includes('--stubs'), readable = process.argv.includes('--readable'), raw = process.argv.includes('--raw');
// 기본 빌드 = 스토리 1 (여객기). 예전 해상 반격 임무(ocean·models·game)는 --naval 을 붙일 때만 함께 넣음 (그때는 ?mode=naval 로 실행)
const naval = process.argv.includes('--naval');
const MODS = ['gpu', 'sky', 'post', 'ocean', 'mesh', 'models', 'fx', 'audio', 'game', 'people', 'cabin', 'fps', 'village', 'story2', 'palace', 'story3', 'ruins', 'story4', 'story'].filter(m => naval || !['ocean', 'models', 'game'].includes(m));
const strip = s => s.replace(/^'use strict';\s*/, '').trimEnd();
const read = f => strip(fs.readFileSync(path.join(D, f), 'utf8'));

// WGSL 축약: 주석 제거, 공백 접기, 구두점 주변 공백 제거 (+/- 가 연달아 붙어 ++/-- 가 되지 않게 보호)
const minWgsl = s => s.replace(/\/\/[^\n]*/g, '').replace(/\s+/g, ' ')
  .replace(/ ?([{}()\[\];,:=*\/<>&|!%@]) ?/g, '$1').replace(/([^+\-]) ?([+\-]) ?(?=[^+\-])/g, '$1$2').trim();
// JS 를 훑어 WGSL 이 든 템플릿 리터럴만 찾아 축약 (${...} 보간 부분은 그대로 둠)
function shrinkWgsl(src) {
  let o = '', i = 0, n = src.length, cnt = 0;
  const str = q => { let j = i + 1; while (j < n && src[j] !== q) j += src[j] === '\\' ? 2 : 1; o += src.slice(i, j + 1); i = j + 1; };
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') { const j = src.indexOf('\n', i); o += src.slice(i, j < 0 ? n : j); i = j < 0 ? n : j; }
    else if (c === '/' && d === '*') { const j = src.indexOf('*/', i) + 2; o += src.slice(i, j); i = j; }
    else if (c === '"' || c === "'") str(c);
    else if (c === '`') {
      const parts = []; let j = i + 1, t = '';
      while (j < n && src[j] !== '`') {
        if (src[j] === '\\') { t += src.slice(j, j + 2); j += 2; }
        else if (src[j] === '$' && src[j + 1] === '{') { let k = j + 2, dep = 1; while (dep) { if (src[k] === '{') dep++; if (src[k] === '}') dep--; k++; } parts.push(t, src.slice(j, k)); t = ''; j = k; }
        else t += src[j++];
      }
      parts.push(t);
      const all = parts.filter((_, k) => !(k & 1)).join(' ');
      // 보간(${...}) 경계의 줄바꿈은 유지 — 끼워 넣는 조각이 // 주석으로 끝나도 뒤 코드가 주석에 먹히지 않게
      const edge = (p, re, on) => on && re.test(p) ? (/\n/.test(p.match(re)[0]) ? '\n' : ' ') : '';
      if (/@(vertex|fragment|compute)\b|\bfn \w+\s*\(|@group\(|\b(vec[234][fiu]|mat\dx\df)\(|\b(let|var) \w+\s*[:=]/.test(all)) { cnt++; o += '`' + parts.map((p, k) => k & 1 ? p : edge(p, /^\s+/, k) + minWgsl(p) + edge(p, /\s+$/, k < parts.length - 1)).join('') + '`'; }
      else o += src.slice(i, j + 1);
      i = j + 1;
    } else { o += c; i++; }
  }
  return [o, cnt];
}

let code = read('core.js'); const rep = [['core', Buffer.byteLength(code)]];
if (!naval) code = code.replace(/G\.mode = new URLSearchParams[^;]*;/, "G.mode = 'story';");
for (const m of MODS) {
  if (!fs.existsSync(path.join(D, `mod_${m}.js`))) { console.log(`  (없음) mod_${m}.js`); continue; }
  const s = read(`mod_${m}.js`); code += '\n\n' + s; rep.push([m, Buffer.byteLength(s)]);
}
if (stubs) code += '\n\n' + read('stubs.js');
code += '\n\nG.boot();';
let html = fs.readFileSync(path.join(D, 'template.html'), 'utf8');
const srcKB = Buffer.byteLength(code) / 1024; let rawKB = 0;
if (readable) html = html.replace('/*__CODE__*/', () => "'use strict';\n" + code);
else {
  let esbuild; try { esbuild = require('esbuild'); } catch (e) { esbuild = require(path.join(D, '..', 'tools', 'node_modules', 'esbuild')); }
  const [w, cnt] = shrinkWgsl(code);
  let js = esbuild.transformSync(`(()=>{'use strict';${w}\n})();`, { minify: true, target: 'es2022', legalComments: 'none' }).code.trim();
  rawKB = Buffer.byteLength(js) / 1024;
  // 자기해제: gzip → base64. DecompressionStream 이 없는 구형 브라우저는 WebGPU 도 없으므로 같은 안내를 표시
  if (!raw) js = `(async()=>{if(!self.DecompressionStream)return document.body.insertAdjacentHTML("beforeend","<div id=fatal><div><h1>이 브라우저에서는 실행할 수 없습니다</h1><p>WebGPU 를 지원하는 최신 Chrome · Edge · Safari 가 필요합니다.</p></div></div>");(0,eval)(await new Response(new Blob([Uint8Array.from(atob("${zlib.gzipSync(Buffer.from(js), { level: 9 }).toString('base64')}"),c=>c.charCodeAt(0))]).stream().pipeThrough(new DecompressionStream("gzip"))).text())})()`;
  const css = (_, s) => '<style>' + esbuild.transformSync(s, { loader: 'css', minify: true }).code.trim();
  html = html.replace(/<style>([^]*?)(?=<\/style>)/, css).replace(/>\s+</g, '><').replace('/*__CODE__*/', () => js).replace(/<script>\s+/, '<script>').replace(/\s+<\/script>/, '</script>');
  console.log(`  WGSL 템플릿 ${cnt}개 축약`);
}
fs.writeFileSync(out, html);
for (const [k, v] of rep) console.log(`  ${k.padEnd(8)} ${(v / 1024).toFixed(1)} KB`);
const b = Buffer.byteLength(html);
console.log(`=> ${out}  ${(b / 1024).toFixed(1)} KB (${b} bytes)${readable ? ' 읽기용' : raw ? ' (압축 안 함)' : ` 자기해제 압축 · 풀린 JS ${rawKB.toFixed(1)} KB`} · 소스 ${srcKB.toFixed(1)} KB · gzip ${(zlib.gzipSync(html, { level: 9 }).length / 1024).toFixed(1)} KB`);
