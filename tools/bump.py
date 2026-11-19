# 배포 전에 실행: 파일 주소에 버전 번호를 붙여 브라우저가 예전 파일(캐시)을 쓰지 않게 함
#   python tools/bump.py
import os, re, time, json
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
v = time.strftime('%Y%m%d%H%M%S')
p = os.path.join(root, 'index.html')
s = open(p, encoding='utf-8').read()
js = sorted(f for f in os.listdir(os.path.join(root, 'js')) if f.endswith('.js'))
# import map 을 통째로 다시 씀 (외부 라이브러리 + 우리 js 파일 버전)
m = re.search(r'(<script type="importmap">)(.*?)(</script>)', s, re.S)
imports = {k: val for k, val in json.loads(m.group(2))['imports'].items() if not k.startswith('./js/')}
for f in js:
    imports[f'./js/{f}'] = f'./js/{f}?v={v}'
block = json.dumps({'imports': imports}, indent=2, ensure_ascii=False)
block = '\n'.join('  ' + line for line in block.split('\n'))
s = s[:m.start(2)] + '\n' + block + '\n  ' + s[m.end(2):]
s = re.sub(r'src="js/main\.js(\?v=\d+)?"', f'src="js/main.js?v={v}"', s)
s = re.sub(r'href="css/style\.css(\?v=\d+)?"', f'href="css/style.css?v={v}"', s)
if 'window.SKW_VERSION' in s:
    s = re.sub(r"window\.SKW_VERSION = '\d*';", f"window.SKW_VERSION = '{v}';", s)
else:
    s = s.replace('  <script type="importmap">', f"  <script>window.SKW_VERSION = '{v}';</script>\n  <script type=\"importmap\">", 1)
json.loads(re.search(r'<script type="importmap">(.*?)</script>', s, re.S).group(1))   # 검사
open(p, 'w', encoding='utf-8').write(s)
print('version', v)
