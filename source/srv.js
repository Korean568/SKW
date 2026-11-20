// 테스트 도구용 내장 정적 서버 (개발 전용): 스크래치패드 루트를 임시 포트로 제공 → 별도 서버 프로세스가 필요 없음
const http = require('http'), fs = require('fs'), path = require('path'), ROOT = path.join(__dirname, '..');
const MIME = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', json: 'application/json', png: 'image/png', css: 'text/css' };
module.exports = () => new Promise(res => {
  const s = http.createServer((q, r) => {
    const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
    fs.readFile(f, (e, d) => { r.writeHead(e ? 404 : 200, { 'content-type': MIME[f.split('.').pop()] || 'application/octet-stream', 'cache-control': 'no-store' }); r.end(e ? '' : d); });
  });
  s.listen(0, '127.0.0.1', () => { s.unref(); res(s.address().port); });
});
