'use strict';
{ /* ═══ DESKTOP — 다운로드(PC)판 전용 모드: 일시정지 메뉴 · 설정 · 진행 저장 · 타이틀 추가 버튼 ═══
     window.skwDesktop(Electron preload) 이 있거나 주소에 ?desktop 이 있을 때만 켜짐. 아니면 아무 것도 하지 않음 (웹판 그대로). */
  const D = window.skwDesktop;
  if (D || G.params.has('desktop')) {
    // 브라우저판(itch.io HTML5 · web/web-shim.js, platform 'web'): "게임 종료" 없음 · 전체 화면은 되는 곳에서만(iPhone 안 됨) · F11 은 브라우저 몫
    const web = !!(D && D.platform === 'web'), canQuit = !web, canFs = !web || !!D.canFullscreen;
    const KEY = 'skw-desktop-settings', PKEY = 'skw-progress', TITLE = 'Second Korean Wars · 제 2차 한국전쟁';
    const ls = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem(k)); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } };
    // 설정: q 그래픽('auto'|LOW|MEDIUM|HIGH) · scale 렌더 배율(0 = 자동 동적 해상도, 50~100 수동) · fs 전체 화면 · vol 소리 · sens 마우스 감도 · sub 자막(s|m|l)
    const cfg = Object.assign({ q: 'auto', scale: 0, fs: null, vol: 1, sens: 1, sub: 'm' }, ls(KEY) || {});
    const save = () => ls(KEY, cfg);
    let done = ls(PKEY); if (!Array.isArray(done)) done = [];
    const dynURL = G.params.get('dyn'); // 주소로 준 ?dyn=0 은 존중

    /* ── 플랫폼: Electron preload 또는 브라우저 대체 ── */
    const quiet = p => p && p.catch && p.catch(() => { });
    const fsGet = () => Promise.resolve(D ? D.isFullscreen() : !!document.fullscreenElement).catch(() => false);
    const fsSet = v => { try { if (D) return quiet(D.setFullscreen(!!v)); const de = document.documentElement; v ? de.requestFullscreen && quiet(de.requestFullscreen()) : document.fullscreenElement && quiet(document.exitFullscreen()); } catch (e) { } };
    const quit = () => { try { D ? D.quit() : window.close(); } catch (e) { } };

    /* ── 마우스 감도: MouseEvent.movementX/Y 게터를 배율로 감쌈 (다른 모듈 수정 없이 모든 시점 조작에 적용) ── */
    for (const k of ['movementX', 'movementY']) {
      const d = Object.getOwnPropertyDescriptor(MouseEvent.prototype, k);
      if (d && d.get) Object.defineProperty(MouseEvent.prototype, k, { configurable: true, enumerable: d.enumerable, get() { return d.get.call(this) * cfg.sens; } });
    }
    // 소리: 오디오는 첫 시작(사용자 입력) 때 만들어지므로 init 뒤에 다시 적용 · 일시정지 중에는 작게
    const vol = () => G.sfx && G.sfx.volume && G.sfx.volume(cfg.vol * (G.paused ? .3 : 1));
    // 흐름 모듈이 스스로 포인터 고정을 풀 때(엔딩·선택지·사망)는 메뉴를 열지 않도록 표시
    let progExit = 0, openT = 0;
    const exitPL = document.exitPointerLock && document.exitPointerLock.bind(document);
    if (exitPL) document.exitPointerLock = () => { if (document.pointerLockElement) progExit = performance.now(); return exitPL(); };

    /* ── 상태 ── */
    const story = () => G.story && G.story.S && G.story.S.on ? 1 : [2, 3, 4].find(n => G['story' + n] && G['story' + n].on) || 0; // 진행 중인 스토리 번호 (0 = 타이틀)
    const ov = () => document.getElementById('ov');
    let ui, menu = '', from = '', sel = 0;

    const touch = () => !!(G.touch && G.touch.on); // 터치(휴대폰·안드로이드 앱): 메뉴 구성과 자막 크기를 손가락·작은 화면에 맞춤 (mod_touch 가 뒤에 로드되므로 쓸 때 확인)
    const sub = () => ui.sub.textContent = touch()
      ? (cfg.sub === 's' ? 'html.touch body #dl{font-size:clamp(12px,3.3vh,17px)}html.touch body #cap{font-size:clamp(12px,3.3vh,18px)}'
        : cfg.sub === 'l' ? 'html.touch body #dl{font-size:clamp(17px,5vh,26px)}html.touch body #cap{font-size:clamp(17px,5vh,27px)}' : '')
      : cfg.sub === 's' ? 'html body #dl{font-size:1.95vh}html body #cap{font-size:2.05vh}'
        : cfg.sub === 'l' ? 'html body #dl{font-size:3.15vh}html body #cap{font-size:3.25vh}' : '';
    const scale = () => { // 렌더 배율: 수동이면 gpu 모듈의 동적 해상도(?dyn=0 과 같은 경로)를 끄고 G.dyn 고정
      if (cfg.scale) { G.params.set('dyn', '0'); G.dyn = cfg.scale / 100; }
      else { dynURL === null ? G.params.delete('dyn') : G.params.set('dyn', dynURL); G.dyn = 1; }
      G.resize();
    };
    const quality = q => { // 'auto' | LOW | MEDIUM | HIGH — 성능 알약(mod_gpu)과 같은 경로
      const g = G.mods.gpu, m = q === 'auto' ? '' : q;
      g && g.pick ? g.pick(m) : G.setQuality(m || 'MEDIUM', !!m);
      if (cfg.scale) scale();
    };
    const marks = () => { // 타이틀 챕터 옆 ✓
      const o = ov(); if (!o) return;
      o.querySelectorAll('.ch>div').forEach((e, i) => {
        let s = e.querySelector('.dkd'); const on = done.includes(i + 1);
        if (on && !s) { s = G.el('span', { className: 'dkd', textContent: '✓', title: '완료' }, e.firstElementChild || e); }
        if (!on && s) s.remove();
      });
    };
    const finish = n => { if (n && !done.includes(n)) { done.push(n); done.sort(); ls(PKEY, done); marks(); } };

    /* ── 메뉴 ── */
    const NAMES = ['', '스토리 1 — 서강시 : 전쟁의 시작', '스토리 2 — 북한 마을 : 5일전으로', '스토리 3 — 북한 주석궁 : 다시 지금 북한으로', '스토리 4 — 폐허가 된 서강 : 고혁명의 배신'];
    function show(m) {
      menu = m; ui.root.className = m ? 'on' : ''; ui.p.style.display = m === 'pause' ? '' : 'none'; ui.s.style.display = m === 'set' ? '' : 'none';
      if (m === 'pause') ui.st.textContent = NAMES[story()] || '';
      if (m === 'set') sync();
      const o = ov(); o && (o.style.visibility = m === 'set' && from === 'title' ? 'hidden' : ''); // 타이틀에서 연 설정: 타이틀 글자를 가림
      sel = 0; hi();
    }
    const items = () => [...(menu === 'pause' ? ui.p : ui.s).querySelectorAll('[data-a]')];
    const hi = () => items().forEach((e, i) => e.classList.toggle('sel', i === sel));
    function pause() {
      if (menu || !story()) return;
      G.paused = true; vol(); openT = performance.now();
      if (document.pointerLockElement) document.exitPointerLock();
      show('pause');
    }
    function resume() { show(''); G.paused = false; G.keys = {}; vol(); held = 0; }
    // 메뉴 없이 잠깐 멈춤 (mod_touch: 휴대폰을 세로로 돌렸을 때 "가로로 돌려 주세요" 화면 뒤에서) — 같은 G.paused 경로. 풀 때 메뉴가 열려 있으면 그대로 둠
    let held = 0;
    function hold(v) {
      if (v) { if (held || menu || G.paused || !story()) return; held = 1; G.paused = true; vol(); if (document.pointerLockElement) document.exitPointerLock(); }
      else if (held) { held = 0; if (!menu) { G.paused = false; G.keys = {}; vol(); } }
    }
    function settings(f) { from = f; show('set'); }
    function back() { from === 'pause' ? show('pause') : show(''); }
    function toTitle() {
      show(''); G.paused = false; G.keys = {}; held = 0; vol();
      try { G.fps && G.fps.on && G.fps.stop(); } catch (e) { G.err('[desktop] ' + e); }
      try { G.story && G.story.title && G.story.title(); } catch (e) { G.err('[desktop] ' + e); }
      for (const l of ['engine', 'cabin', 'missile', 'wind', 'siren', 'sea']) G.sfx && G.sfx.loop && G.sfx.loop(l, 0); // 스토리 1 의 지속음도 정리 (처음 실행한 타이틀과 같게)
      for (const id of ['dl', 'cap', 'ttl']) { const e = document.getElementById(id); e && (e.style.opacity = 0); }
      marks();
    }
    const ACT = { resume, set: () => settings('pause'), title: toTitle, quit, back };

    /* ── 설정 화면 갱신 ── */
    function sync() {
      const r = ui.s, seg = (k, v) => r.querySelectorAll(`[data-k=${k}] button`).forEach(b => b.classList.toggle('on', b.dataset.v === String(v)));
      seg('q', G.qManual ? G.Q.name : 'auto'); seg('sub', cfg.sub); G.i18n && seg('lang', G.lang); seg('sc', cfg.scale ? '' : 'auto');
      const sc = r.querySelector('[data-k=sc] input'); sc.value = cfg.scale || Math.round(G.dyn * 100);
      r.querySelector('[data-k=sc] output').textContent = (cfg.scale ? cfg.scale : Math.round(G.dyn * 100)) + ' %' + (cfg.scale ? '' : ' (자동)');
      r.querySelector('[data-k=vol] input').value = Math.round(cfg.vol * 100); r.querySelector('[data-k=vol] output').textContent = Math.round(cfg.vol * 100) + ' %';
      r.querySelector('[data-k=sens] input').value = cfg.sens; r.querySelector('[data-k=sens] output').textContent = cfg.sens.toFixed(1) + 'x';
      fsGet().then(v => { if (menu === 'set') seg('fs', v ? 1 : 0); });
    }
    function onSet(k, v, input) {
      if (k === 'q') { cfg.q = v; quality(v); }
      if (k === 'sc') { cfg.scale = v === 'auto' ? 0 : +v; scale(); }
      if (k === 'fs') { cfg.fs = v === '1'; fsSet(cfg.fs); setTimeout(sync, 400); }
      if (k === 'vol') { cfg.vol = v / 100; vol(); }
      if (k === 'sens') cfg.sens = +v;
      if (k === 'sub') { cfg.sub = v; sub(); }
      if (k === 'lang') G.i18n && G.i18n.set(v); // 언어 (mod_i18n): 화면 글자는 사전이 바로 바꿈
      save(); if (!input || k !== 'sc') sync(); else ui.s.querySelector('[data-k=sc] output').textContent = v + ' %';
    }

    /* ── 입력 ── */
    addEventListener('keydown', e => {
      if (e.code === 'F11' && !web) { e.preventDefault(); e.stopPropagation(); if (!e.repeat) fsGet().then(v => { cfg.fs = !v; save(); fsSet(cfg.fs); }); return; }
      if (e.code === 'Escape' && (menu || story())) { // 타이틀(진행 중인 스토리 없음)에서는 아무 일 없음
        e.preventDefault(); e.stopPropagation();
        if (menu === 'set') back();
        else if (menu === 'pause') { if (performance.now() - openT > 400) resume(); } // 포인터 고정 해제로 막 열린 메뉴는 같은 Esc 로 닫지 않음
        else pause();
        return;
      }
      if (!menu) return;
      e.stopPropagation(); // 메뉴가 열려 있는 동안 게임 · 타이틀 키 입력 차단
      const it = items();
      if (e.code === 'ArrowDown' || e.code === 'ArrowUp') { e.preventDefault(); sel = (sel + (e.code === 'ArrowDown' ? 1 : it.length - 1)) % it.length; hi(); }
      else if ((e.code === 'Enter' || e.code === 'Space') && it[sel]) { e.preventDefault(); it[sel].click(); }
      else if (e.code === 'Tab') e.preventDefault();
    }, true);
    for (const t of ['mousedown', 'mousemove', 'wheel']) addEventListener(t, e => { if (menu) e.stopPropagation(); }, { capture: true, passive: true });
    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement) { progExit = 0; return; }
      const prog = progExit && performance.now() - progExit < 1500; progExit = 0;
      if (!prog && !menu && story() && !G.paused) pause(); // 브라우저가 Esc 로 고정을 푼 경우 · 창 전환 → 바로 메뉴
    });

    G.desktop = { cfg, pause, resume, settings, back, toTitle, hold, get held() { return held; }, get menu() { return menu; }, progress: () => done.slice(), finish, web };

    G.register('desktop', {
      init() {
        document.title = TITLE;
        // 스토리 2~4 의 안개·구름 설정이 타이틀에 남지 않게: 처음 화면으로 갈 때 시작 시점 환경으로 되돌림 (엔딩 카드 버튼 경로 포함)
        const env0 = Object.assign({}, G.env), tt = G.story && G.story.title;
        if (tt) G.story.title = (...a) => { const r = tt(...a); G.setEnv(env0); for (const k of ['cloudBase', 'cloudTop']) k in env0 || delete G.env[k]; return r; };
        const sInit = G.sfx && G.sfx.init; if (sInit) G.sfx.init = (...a) => { const r = sInit(...a); vol(); return r; };
        G.css(`#dk{position:absolute;inset:0;z-index:20;display:none;align-content:center;justify-items:start;padding:0 7vw;background:linear-gradient(90deg,#000e,#000c 45%,#0008);pointer-events:auto;color:#dfe8f2;font:clamp(13px,1.15vw,22px)/1.5 system-ui}#dk.on{display:grid}
#dk .tb{display:inline-block;margin:0 0 1.1em;padding:.25em .9em .3em;font:600 max(11px,.95vw) system-ui;letter-spacing:.28em;border:1px solid #fff5;border-radius:999px;background:#0006}#dk .tb b{color:#fff}
#dk h2{margin:0;font:800 clamp(36px,5vw,96px)/.95 system-ui;letter-spacing:.05em;color:#fff}#dk .st{margin:.5em 0 .2em;color:#aebccb;font-size:1.05em}
#dk .m{margin-top:1.2em}#dk .m>div{margin:.55em 0;padding:.1em 0 .1em 1em;border-left:3px solid #fff3;opacity:.55;cursor:pointer;font-size:1.45em;letter-spacing:.12em;transition:opacity .2s,border-color .2s}#dk .m>div:hover,#dk .m>div.sel{opacity:1;border-color:#fff}
#dk .h{margin-top:1.6em;font-size:max(11px,.9vw);color:#9fb1c4}#dk .h b{color:#dfe8f2;font-weight:600}
#dk .g{display:grid;grid-template-columns:auto auto;gap:.85em 2.2em;align-items:center;margin-top:1.3em}#dk .g>span{color:#aebccb;letter-spacing:.12em}
#dk .g>div{display:flex;align-items:center;gap:.5em}#dk .g button{font:600 .95em system-ui;letter-spacing:.08em;padding:.3em .9em;color:#dfe8f2;background:#0006;border:1px solid #fff4;border-radius:5px;cursor:pointer}#dk .g button:hover{border-color:#fff}#dk .g button.on{color:#0b0f14;background:#fff;border-color:#fff}
#dk input[type=range]{width:clamp(150px,15vw,300px);accent-color:#fff;cursor:pointer}#dk output{min-width:6.5em;color:#fff;font-variant-numeric:tabular-nums}
#dk .bk{margin-top:1.6em;padding:.45em 2.2em;font:700 1.2em system-ui;letter-spacing:.3em;color:#0b0f14;background:#fff;border:0;border-radius:6px;cursor:pointer;box-shadow:0 6px 30px #fff4}#dk .bk.sel{outline:2px solid #fff;outline-offset:3px}
#ov .dkb{display:flex;gap:.7em;margin:.2em 0 0}#ov .dkb button{margin:.5em 0 0;padding:.35em 1.5em;font:600 max(11px,1.05vw) system-ui;letter-spacing:.22em;color:#dfe8f2;background:#0006;border:1px solid #fff5;border-radius:6px;box-shadow:none}#ov .dkb button:hover{color:#fff;border-color:#fff}
#ov .dkd{margin-left:.55em;color:#a8e0a2;font-weight:700}#ov .dkv{position:absolute;right:2vw;bottom:2vh;font:11px ui-monospace,monospace;letter-spacing:.08em;color:#9fb1c4;opacity:.75}`);
        const root = G.el('div', { id: 'dk' });
        root.innerHTML = `<div class=p><div class=tb>SECOND <b>KOREAN</b> WARS</div><h2>일시 정지</h2><div class=st></div>
<div class=m><div data-a=resume>계속하기</div><div data-a=set>설정</div><div data-a=title>처음 화면으로</div>${canQuit ? '<div data-a=quit>게임 종료</div>' : ''}</div>
<div class=h><b>Esc</b> 계속하기 · <b>↑ ↓</b> 선택 · <b>Enter</b> 확인</div></div>
<div class=s><div class=tb>SECOND <b>KOREAN</b> WARS</div><h2>설정</h2><div class=g>
<span>그래픽</span><div data-k=q><button data-v=auto>자동</button><button data-v=LOW>LOW</button><button data-v=MEDIUM>MEDIUM</button><button data-v=HIGH>HIGH</button></div>
<span>렌더 배율</span><div data-k=sc><button data-v=auto>자동</button><input type=range min=50 max=100 step=5><output></output></div>
<span>전체 화면</span><div data-k=fs><button data-v=1>켜기</button><button data-v=0>끄기</button></div>
<span>소리 크기</span><div data-k=vol><input type=range min=0 max=100 step=5><output></output></div>
<span>마우스 감도</span><div data-k=sens><input type=range min=.3 max=3 step=.1><output></output></div>
<span>자막 크기</span><div data-k=sub><button data-v=s>작게</button><button data-v=m>보통</button><button data-v=l>크게</button></div>
${G.i18n ? '<span>언어</span><div data-k=lang><button data-v=ko data-i18n-skip>한국어</button><button data-v=en data-i18n-skip>English</button></div>' : ''}
</div><button class=bk data-a=back>돌아가기</button><div class=h><b>Esc</b> 돌아가기${web ? '' : ' · <b>F11</b> 전체 화면'}</div></div>`;
        ui = { root, p: root.querySelector('.p'), s: root.querySelector('.s'), st: root.querySelector('.st'), sub: G.el('style', {}, document.head) };
        if (touch() || !canFs) { // 터치: 전체 화면 줄은 뜻이 없고(앱은 늘 전체 화면) 감도는 손가락 시점 감도 · 브라우저판: 전체 화면이 안 되는 곳(iPhone · 허락 없는 iframe)
          const f = root.querySelector('[data-k=fs]'); f.style.display = f.previousElementSibling.style.display = 'none';
        }
        if (touch()) root.querySelector('[data-k=sens]').previousElementSibling.textContent = '시점 감도';
        G.i18n && G.i18n.onChange(() => { menu === 'set' && sync(); }); // 처음 화면 버튼 등 다른 곳에서 바꿔도 설정 표시 맞춤
        root.addEventListener('click', e => { const a = e.target.closest('[data-a]'); if (a) return ACT[a.dataset.a](); const b = e.target.closest('[data-k] button'); b && onSet(b.parentNode.dataset.k, b.dataset.v); });
        root.addEventListener('input', e => { const k = e.target.parentNode.dataset.k; k && onSet(k, e.target.value, 1); });
        root.addEventListener('mouseover', e => { const a = e.target.closest('[data-a]'), i = items().indexOf(a); if (i >= 0) { sel = i; hi(); } });
        // 타이틀: 설정 · 게임 종료 버튼, 버전, 외부 링크는 기본 브라우저로
        const o = ov();
        if (o) {
          const start = o.querySelector('button'), bar = G.el('div', { className: 'dkb' }, o);
          start && start.after(bar);
          G.el('button', { textContent: '설정', onclick: () => settings('title') }, bar);
          canQuit && G.el('button', { textContent: '게임 종료', onclick: quit }, bar);
          G.el('div', { className: 'dkv', textContent: D ? 'v' + (D.gameVersion || D.version) : 'dev · browser' }, o);
          const a = o.querySelector('a.tb');
          if (a && D && D.openExternal) a.addEventListener('click', e => { e.preventDefault(); quiet(D.openExternal(a.href)); });
          marks();
        }
        // 저장된 설정 적용 (?q= 로 고정한 경우 그래픽은 그대로)
        sub();
        if (!G.params.get('q') && (cfg.q === 'auto' ? G.qManual : G.PRESETS[cfg.q] && (!G.qManual || cfg.q !== G.Q.name))) quality(cfg.q);
        if (cfg.scale) scale();
        if (cfg.fs !== null && D && !web && !touch()) fsSet(cfg.fs); // 브라우저는 사용자 입력 없이 전체 화면을 켤 수 없다
        vol();
      },
      onQuality(Q) { if (!G.params.get('q')) { cfg.q = G.qManual ? Q.name : 'auto'; save(); } menu === 'set' && sync(); }, // F2 · 성능 알약으로 바꾼 것도 기억
      update() {
        // 엔딩 카드에 닿으면 완료 기록 (스토리 1 은 승리 엔딩만)
        const s1 = G.story && G.story.S;
        if (s1 && s1.on && s1.beat === 'end' && s1.win) finish(1);
        for (const n of [2, 3, 4]) { const st = G['story' + n]; st && st.on && st.S && st.S.beat === 'end' && finish(n); }
        if (cfg.scale && Math.abs(G.dyn - cfg.scale / 100) > .001) scale(); // 자동 등급 내림이 배율을 되돌려도 수동 값 유지
        if (document.title !== TITLE) document.title = TITLE;
      }
    });
  }
}
