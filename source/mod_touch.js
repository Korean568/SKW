'use strict';
{ /* ═══ TOUCH — 휴대폰·태블릿 터치 조작 (스토리 게임 · 안드로이드 앱) ═══
     켜지는 경우: 주소에 ?touch · window.skwDesktop.platform === 'android' · 주 입력이 손가락(pointer:coarse)인 기기. 그 밖에는 아무 것도 하지 않음.
     방식: 스토리 모듈을 고치지 않고 입력을 흉내 낸다 — 가상 조이스틱 → W/A/S/D(+Shift) 키 이벤트, 화면 밀기 → mousemove(movementX/Y),
     버튼 → mousedown/up · 키 · 휠. 포인터 고정은 "항상 고정됨"으로 보이게 해서 PC용 안내·자동 일시정지가 끼어들지 않게 한다.
     시점 감도는 mod_desktop 이 MouseEvent.movementX/Y 에 거는 배율을 그대로 탄다. */
  const D = window.skwDesktop;
  let coarse = false; try { coarse = matchMedia('(pointer:coarse)').matches && navigator.maxTouchPoints > 0; } catch (e) { }
  const on = G.mode === 'story' && (G.params.has('touch') || !!(D && D.platform === 'android') || coarse);
  const T = G.touch = { on };
  if (on) {
    const $ = id => document.getElementById(id), now = () => performance.now();
    document.documentElement.classList.add('touch');
    { // 화면 확대 금지 · 노치까지 그리기 (template.html 과 같은 값 — dev.html 등 다른 껍데기에서도 맞춤)
      const m = document.querySelector('meta[name=viewport]');
      m && m.setAttribute('content', 'width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover');
    }

    /* ── 성능: 휴대폰은 화면 밀도가 높다 → 내부 해상도를 LOW ≈ 960×540, MEDIUM ≈ 1280×720 이하로 묶음 (동적 해상도는 그대로 동작) ── */
    const P = G.PRESETS;
    P.LOW.dprCap = Math.max(P.LOW.dprCap, 1.5); P.LOW.maxPx = Math.min(P.LOW.maxPx, 5.2e5);
    P.MEDIUM.maxPx = Math.min(P.MEDIUM.maxPx, 9.3e5); P.HIGH.maxPx = Math.min(P.HIGH.maxPx, 1.7e6);
    // GPU 이름: 모바일 GPU(Adreno · Mali · PowerVR · Xclipse · Apple GPU …)와 이름을 모르는 기기는 LOW 로 시작
    const MOB = /adreno|mali|immortalis|powervr|xclipse|maleoon|apple gpu|apple a\d|qualcomm|\barm\b|imgtec|imagination|samsung|valhall|bifrost|midgard|videocore|tegra/;
    const gm = G.mods.gpu;
    if (gm && gm.detect) {
      const det = gm.detect;
      gm.detect = async function (...a) {
        const i = await det.apply(this, a);
        if (MOB.test((i.name + ' ' + i.vendor + ' ' + i.arch).toLowerCase()) || i.nameTier === '?') { i.mobile = 1; i.nameTier = 'LOW'; i.tier = 'LOW'; }
        return i;
      };
    }

    /* ── 포인터 고정 흉내: 터치에는 커서가 없다 → 항상 캔버스에 고정된 것으로 보이게 (변경 이벤트 없음 = 자동 일시정지 없음) ── */
    try {
      Object.defineProperty(document, 'pointerLockElement', { configurable: true, get: () => G.canvas || $('c') });
      document.exitPointerLock = () => { };
    } catch (e) { }

    /* ── 가짜 입력 ── */
    const held = {}; let taps = [], rx = 0, ry = 0;
    const key = (code, v) => {
      v = !!v; if (!!held[code] === v) return; held[code] = v;
      document.dispatchEvent(new KeyboardEvent(v ? 'keydown' : 'keyup', { code, key: code === 'Space' ? ' ' : code.replace(/^Key|^Digit/, '').toLowerCase(), bubbles: true, cancelable: true }));
    };
    const tap = code => { key(code, 0); key(code, 1); taps.push([code, G.frame + 2, now() + 140]); }; // 두 프레임 이상 눌렀다 뗌
    const mev = (type, o) => (G.canvas || document).dispatchEvent(new MouseEvent(type, Object.assign({ bubbles: true, cancelable: true, view: window }, o)));
    const LOOK = 1.6; // 손가락 1px = 마우스 1.6px
    const look = (dx, dy) => { // 정수 픽셀로 보내고 나머지는 다음 이벤트로
      rx += dx * LOOK; ry += dy * LOOK; const mx = Math.trunc(rx), my = Math.trunc(ry); rx -= mx; ry -= my;
      if (mx || my) mev('mousemove', { movementX: mx, movementY: my, buttons: 1 });
    };
    const tog = { aim: 0, crouch: 0 }; let firing = 0;
    const setAim = v => { v = v ? 1 : 0; if (tog.aim === v) return; tog.aim = v; mev(v ? 'mousedown' : 'mouseup', { button: 2, buttons: v ? 2 : 0 }); };
    const setCrouch = v => { tog.crouch = v ? 1 : 0; key('KeyC', v); };
    const MOVE = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft'];
    const stick = (dx, dy, len) => { // 8방향 · 끝까지 밀면 달리기 (사격·조준 중에는 걷기: 달리면 쏠 수 없으므로)
      const act = len > 10, nx = act ? dx / len : 0, ny = act ? dy / len : 0;
      key('KeyW', ny < -.38); key('KeyS', ny > .38); key('KeyA', nx < -.38); key('KeyD', nx > .38);
      key('ShiftLeft', act && len >= R * .9 && !firing && !tog.aim);
    };
    function release(all) { // 손을 뗀 것으로 — all: 메뉴가 열릴 때(전부) · 아니면 장면이 바뀔 때(사격·조준·앉기만, 조이스틱은 이동이 이어지면 유지)
      if (firing) { firing = 0; mev('mouseup', { button: 0 }); }
      setAim(0); tog.crouch = 0; key('KeyC', 0); taps = taps.filter(p => (key(p[0], 0), 0));
      if (all || !C.move) { for (const k of MOVE) key(k, 0); if (joy) { joy.role = 'none'; joy = null; } ui && (ui.joy.style.display = 'none'); }
      if (all) { for (const k in held) held[k] && key(k, 0); for (const s of tt.values()) { s.el && s.el.classList.remove('dn'); s.role = 'none'; } }
    }

    /* ── 지금 장면: 어떤 조작이 필요한가 ── */
    const C = { n: 0, menu: 0, move: 0, look: 0, set: '' };
    function ctx() {
      const d = G.desktop, s1 = G.story && G.story.S, f = G.fps;
      C.n = s1 && s1.on ? 1 : [2, 3, 4].find(n => G['story' + n] && G['story' + n].on) || 0;
      C.menu = d && d.menu || G.paused ? 1 : 0; C.move = C.look = 0; C.set = '';
      if (C.menu || !C.n) return C;
      if (C.n === 1) {
        if (f && f.on) { if (!f.bot && !f.S.dead) { C.move = C.look = 1; C.set = 'fps'; } }
        else if (s1.beat !== 'end') C.look = 1;
        return C;
      }
      const S = G['story' + C.n].S, fp = S.cm === 'fp', bot = G['story' + C.n].bot;
      if (S.beat === 'end' || S.dead || S.g === 'choice') return C;
      C.look = fp ? 1 : 0;
      if (C.n === 4) { C.move = fp && !bot ? 1 : 0; C.set = C.move ? 's4' : ''; }
      else { C.move = S.walk && fp && !bot ? 1 : 0; C.set = C.move ? (C.n === 3 ? (S.arm ? 's3f' : 's3') : 's2') : ''; }
      return C;
    }
    const shown = e => e && e.style.display === 'block' && e.textContent;

    /* ── 버튼: [이름, 글자, 보이는 장면, 오른쪽, 아래(또는 t = 위), 크기] ── */
    const BTN = [
      ['fire', '사격', 'fps', 22, 48, 82], ['aim', '조준', 'fps s4', 116, 20, 62], ['reload', '장전', 'fps', 120, 92, 58], ['crouch', '앉기', 'fps', 26, 142, 58],
      ['plate', '방탄', 'fps', 100, 162, 58], ['use', '줍기', 'fps', 192, 58, 62], ['weapon', '무기', 'fps', 142, 't40', 56], ['scope', '스코프', 'fps', 206, 't40', 56],
      ['act', '사용', 's2', 26, 60, 78], ['stab', '단검', 's3f', 22, 48, 82], ['toss', '투척', 's3f', 118, 24, 64], ['grab', '줍기', 's3 s3f', 122, 100, 60],
    ];
    const DOWN = { // 누를 때
      fire() { firing = 1; key('ShiftLeft', 0); mev('mousedown', { button: 0, buttons: 1 }); },
      stab() { mev('mousedown', { button: 0, buttons: 1 }); mev('mouseup', { button: 0 }); },
      aim() { setAim(!tog.aim); }, crouch() { setCrouch(!tog.crouch); },
      reload() { tap('KeyR'); }, use() { tap('KeyE'); }, act() { tap('KeyE'); }, grab() { tap('KeyE'); }, plate() { tap('KeyF'); }, scope() { tap('KeyT'); }, toss() { tap('KeyQ'); },
      weapon() { (G.canvas || document).dispatchEvent(new WheelEvent('wheel', { deltaY: 100, bubbles: true })); },
      pause() { G.desktop && G.desktop.pause(); sync(); },
    };
    const UP = { fire() { if (firing) { firing = 0; mev('mouseup', { button: 0 }); } } };
    const DRAG = { fire: 1, stab: 1 }; // 누른 손가락을 밀면 시점도 같이 움직임

    /* ── 터치 추적 (여러 손가락: 이동 + 시점 + 사격 동시) ── */
    const tt = new Map(), R = 54; let joy = null, ui = null, lastT = -1e9, audio = 0;
    const surface = e => e && (e.tagName === 'CANVAS' || e === document.body || e === document.documentElement || e === G.ui || e.id === 'tc');
    function tstart(e) {
      lastT = now(); let used = 0;
      for (const t of e.changedTouches) {
        const el = t.target, b = el.closest && el.closest('#tc [data-a]'), pk = el.closest && el.closest('#pr,#pa,#s2p,#s3p');
        const s = { x: t.clientX, y: t.clientY, role: '' };
        if (b) { s.role = 'btn'; s.a = b.dataset.a; b.classList.add('dn'); s.el = b; DOWN[s.a] && DOWN[s.a](); }
        else if (el.id === 'sk') { s.role = 'skip'; s.el = el; el.classList.add('dn'); key('Space', 0); key('Space', 1); } // 한 번 = 건너뛰기, 누르고 있으면 빨리 감기
        else if (pk && pk.dataset.k) { s.role = ctx().look ? 'look' : 'none'; s.pk = pk.dataset.k; s.t0 = now(); s.d = 0; } // 프롬프트: 짧게 톡 = 실행 · 밀면 시점 (화면 가운데에 있어 둘러보다 잘못 누르지 않게)
        else if (surface(el)) {
          ctx();
          if (C.move && !joy && t.clientX < innerWidth * .4) { s.role = 'joy'; joy = s; ui.joy.style.display = 'block'; ui.joy.style.transform = `translate(${s.x}px,${s.y}px)`; ui.knob.style.transform = ''; }
          else s.role = C.look ? 'look' : 'none';
        } else continue; // 메뉴 · 타이틀 버튼 등: 브라우저 기본 동작(click)에 맡김
        tt.set(t.identifier, s); used = 1;
      }
      if (used && e.cancelable) e.preventDefault();
    }
    function tmove(e) {
      let used = 0;
      for (const t of e.changedTouches) {
        const s = tt.get(t.identifier); if (!s) continue; used = 1;
        if (s.role === 'joy') {
          let dx = t.clientX - s.x, dy = t.clientY - s.y, len = Math.hypot(dx, dy);
          if (len > R * 1.35) { const k = (len - R * 1.35) / len; s.x += dx * k; s.y += dy * k; dx = t.clientX - s.x; dy = t.clientY - s.y; len = R * 1.35; ui.joy.style.transform = `translate(${s.x}px,${s.y}px)`; } // 손가락을 따라옴
          const c = Math.min(1, R / (len || 1)); ui.knob.style.transform = `translate(${dx * c}px,${dy * c}px)`;
          ctx().move ? stick(dx, dy, len) : stick(0, 0, 0);
        } else if (s.role === 'look' || s.role === 'btn' && DRAG[s.a]) { s.d = (s.d || 0) + Math.hypot(t.clientX - s.x, t.clientY - s.y); if (ctx().look) look(t.clientX - s.x, t.clientY - s.y); s.x = t.clientX; s.y = t.clientY; }
        else if (s.pk) { s.d += Math.hypot(t.clientX - s.x, t.clientY - s.y); s.x = t.clientX; s.y = t.clientY; }
      }
      if (used && e.cancelable) e.preventDefault();
    }
    function tend(e) {
      lastT = now(); let used = 0;
      // 첫 터치에 소리 켜기: touchend 처리 안에서 AudioContext 를 만들고 resume() (G.sfx.init) — Safari 는 사용자 제스처 안에서만 소리를 풀어 줌.
      //   그 뒤 끊김(전화 · 잠금 · 앱 전환)은 mod_audio 가 다음 touchend · click 에서 resume() 으로 다시 켬
      if (!audio && G.sfx && G.sfx.init) { audio = 1; try { G.sfx.init(); } catch (x) { audio = 0; } }
      for (const t of e.changedTouches) {
        const s = tt.get(t.identifier); if (!s) continue; tt.delete(t.identifier); used = 1;
        if (s.role === 'joy') { joy = null; ui.joy.style.display = 'none'; for (const k of MOVE) key(k, 0); }
        if (s.role === 'btn') { s.el.classList.remove('dn'); UP[s.a] && UP[s.a](); }
        if (s.role === 'skip') { s.el.classList.remove('dn'); key('Space', 0); }
        if (s.pk && e.type === 'touchend' && s.d < 14 && now() - s.t0 < 600 && !ctx().menu) tap(s.pk);
      }
      if (used && e.cancelable) e.preventDefault();
    }
    const opt = { capture: true, passive: false };
    addEventListener('touchstart', tstart, opt); addEventListener('touchmove', tmove, opt); addEventListener('touchend', tend, opt); addEventListener('touchcancel', tend, opt);
    // 터치 뒤에 브라우저가 만들어 보내는 마우스 이벤트(탭 = 좌클릭)는 게임에 닿지 않게 — 버튼의 click 은 그대로 동작
    for (const k of ['mousedown', 'mouseup', 'mousemove'])
      addEventListener(k, e => { if (e.isTrusted && (now() - lastT < 900 || e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents)) e.stopPropagation(); }, true);
    for (const k of ['contextmenu', 'gesturestart', 'dblclick']) addEventListener(k, e => e.preventDefault(), { capture: true, passive: false });
    addEventListener('blur', () => { for (const k in held) held[k] = false; tog.crouch = 0; }); // core 가 G.keys 를 비움 → 맞춰 둠
    document.addEventListener('visibilitychange', () => { if (document.hidden && G.desktop && ctx().n && !G.desktop.menu) { release(1); G.desktop.pause(); } }); // 앱이 뒤로 가면 일시정지

    /* ── 안드로이드 뒤로 가기 (앱이 호출): true = 게임이 처리함 · false = 처음 화면(앱이 종료 안내) ── */
    window.skwBack = () => {
      try {
        const d = G.desktop, m = d && d.menu; if (!d) return false;
        if (m === 'set') d.back(); else if (m === 'pause') d.resume(); else if (ctx().n) { release(1); d.pause(); } else return false;
        sync(); return true;
      } catch (e) { G.err('[touch] ' + e); return false; }
    };

    /* ── 화면 맞춤: 버튼 보이기/강조 · 프롬프트의 [E] 같은 키 표시 지우기 ── */
    let lastSet = null, lastMenu = 0, raiseT = 0, raised = 0;
    const KEYP = /\s*\[([A-Z])\]\s*/, strip = s => s.replace(KEYP, (m, k, i) => i && i + m.length < s.length ? ' ' : '');
    function prompts() {
      for (const id of ['pr', 'pa', 's2p', 's3p']) {
        const e = $(id), n = e && e.firstChild; if (!e) continue;
        const m = n && n.nodeType === 3 && n.nodeValue.match(KEYP);
        let k = '';
        if (m) { k = 'Key' + m[1]; n.nodeValue = strip(n.nodeValue); e._tv = n.nodeValue; e._tk = k; }
        else if (n && n.nodeType === 3 && n.nodeValue === e._tv) k = e._tk; // HUD 가 이번 프레임에 다시 쓰지 않았으면 이미 지운 글자 그대로 → 키 유지 (깜빡임 방지)
        if ((e.dataset.k || '') !== k) k ? e.dataset.k = k : delete e.dataset.k;
      }
    }
    /* ── 세로 화면: 웹(iPhone Safari · 안드로이드 Chrome)은 화면 방향을 고정할 수 없다 → "가로로 돌려 주세요" 화면으로 덮고,
          진행 중인 장면은 메뉴 없이 멈춤 (mod_desktop 의 같은 일시정지 경로 G.desktop.hold). 가로로 돌리면 그 자리에서 이어서.
          안드로이드 앱은 가로 고정이라 뜨지 않음 (앱에서는 아예 끔) ── */
    const rotOK = !(D && D.platform === 'android');
    let mqP = null, rotOn = false, ownHold = 0; try { mqP = matchMedia('(orientation: portrait)'); } catch (e) { }
    const portrait = () => rotOK && (mqP ? mqP.matches : innerHeight > innerWidth);
    function hold(v) {
      const d = G.desktop; if (d && d.hold) return d.hold(v);
      if (v && !G.paused && C.n) { ownHold = 1; G.paused = true; } else if (!v && ownHold) { ownHold = 0; G.paused = false; G.keys = {}; } // mod_desktop 이 없는 개발용 껍데기(?touch 만)
    }
    function rot() {
      const v = portrait();
      if (v !== rotOn) { rotOn = v; document.documentElement.classList.toggle('rot', v); v && release(1); }
      ctx(); hold(v); // 매번 확인: 세로 상태에서 장면이 시작되거나 메뉴가 닫혀도 다시 멈춤
    }
    function sync() {
      if (!ui) return; rot(); ctx();
      if (C.menu && !lastMenu || C.set !== lastSet) release(C.menu);
      lastMenu = C.menu;
      if (C.set !== lastSet) { lastSet = C.set; ui.root.dataset.s = C.set; for (const b of ui.b) b.classList.toggle('v', b.dataset.s.split(' ').includes(C.set)); }
      const rc = C.menu ? 'off' : C.move && !joy ? 'mv' : ''; if (ui.root.className !== rc) ui.root.className = rc;
      ui.pause.classList.toggle('v', !!(C.n && G.desktop && !C.menu));
      const pr = $('pr'), k = pr && C.set === 'fps' && $('fh').style.display !== 'none' ? pr.dataset.k : '', S = C.set === 'fps' ? G.fps.S : null;
      const cls = (a, c, v) => ui[a].classList.toggle(c, !!v);
      if (C.set === 'fps') { cls('use', 'v', k === 'KeyE'); cls('reload', 'hl', k === 'KeyR'); cls('plate', 'hl', S.plate <= 10 && S.spare > 0); cls('scope', 'on', S.scope && G.people && G.people.fp.gun !== 'pistol'); } // 권총에는 스코프가 없다 → 불 끔
      if (C.set === 's2') cls('act', 'v', shown($('s2p')));
      if (C.n === 3 && C.set) cls('grab', 'v', shown($('s3p')));
      cls('aim', 'on', tog.aim); cls('crouch', 'on', tog.crouch);
    }

    T.C = C; T.ctx = ctx; T.portrait = () => rotOn; T.held = held; T.tog = tog; T.release = release; T.look = look; T.tap = tap;
    Object.defineProperty(T, 'joy', { get: () => joy });

    G.register('touch', {
      init() {
        G.canvas.requestPointerLock = () => { };
        G.css(`html.touch{--sl:env(safe-area-inset-left,0px);--sr:env(safe-area-inset-right,0px);--st:env(safe-area-inset-top,0px);--sb:env(safe-area-inset-bottom,0px);touch-action:pan-y;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;overscroll-behavior:none}
html.touch,html.touch body,html.touch #ui *{-webkit-user-select:none;user-select:none}html.touch canvas{touch-action:none}
#tc{position:absolute;inset:0;z-index:6;pointer-events:none;font-family:system-ui,'Malgun Gothic',sans-serif}#tc.off{display:none}
#tc .b{position:absolute;display:none;place-items:center;box-sizing:border-box;border-radius:50%;border:2px solid #fff9;background:#0b101766;color:#fff;font:700 14px system-ui;letter-spacing:.04em;text-shadow:0 1px 3px #000;pointer-events:auto;touch-action:none;transition:background .12s,transform .08s}
#tc .b.v{display:grid}#tc .b.dn{background:#fff6;transform:scale(.93)}#tc .b.on{background:#ffffffe0;color:#0b0f14;text-shadow:none;border-color:#fff}
#tc .b.hl{border-color:#fb3;color:#fb3;box-shadow:0 0 14px #fb38;animation:tchl .5s infinite alternate}@keyframes tchl{to{background:#fb34}}
#tc .b[data-a=fire],#tc .b[data-a=stab],#tc .b[data-a=act]{font-size:17px;border-width:3px;background:#b3261e55;border-color:#ffb4a8}#tc .b[data-a=use],#tc .b[data-a=grab],#tc .b[data-a=act]{border-color:#fe9;color:#fe9}
html[lang=en] #tc .b{font-size:11px;letter-spacing:.02em}html[lang=en] #tc .b[data-a=fire],html[lang=en] #tc .b[data-a=stab],html[lang=en] #tc .b[data-a=act]{font-size:14px}
#tcp{left:calc(10px + var(--sl));top:calc(8px + var(--st));width:46px;height:46px;border-radius:10px!important;border-color:#fff5!important}#tcp:before,#tcp:after{content:'';position:absolute;top:13px;width:5px;height:16px;background:#fff;border-radius:1px}#tcp:before{left:13px}#tcp:after{right:13px}
#tcj{position:absolute;left:-58px;top:-58px;width:116px;height:116px;border-radius:50%;border:2px solid #fff7;background:#0b101744;display:none;will-change:transform}#tck{position:absolute;left:31px;top:31px;width:50px;height:50px;border-radius:50%;background:#fffb;box-shadow:0 2px 8px #0008}
#tch{position:absolute;left:calc(8vw + var(--sl));bottom:calc(11vh + var(--sb));width:96px;height:96px;border-radius:50%;border:2px dashed #fff4;display:none}#tch:after{content:'';position:absolute;inset:27px;border-radius:50%;background:#fff3}#tc.mv #tch{display:block}
html.touch #lk,html.touch #s2h,html.touch #s3h,html.touch #s4h,html.touch #s3n,html.touch #ov .k,html.touch #fd button+small,html.touch #s3d button+small,html.touch #s2c small{display:none!important}
html.touch #ov{grid-template-columns:auto minmax(0,1fr);column-gap:4vw;align-items:center;align-content:safe center;overflow-y:auto;padding:calc(36px + var(--st)) calc(5vw + var(--sr)) calc(10px + var(--sb)) calc(5vw + var(--sl));background:linear-gradient(90deg,#000d,#000a 60%,#0007)}
html.touch #ov .tb{grid-column:1;grid-row:1;margin:0 0 .9em;font-size:11px}html.touch #ov h1{grid-column:1;grid-row:2;font-size:clamp(32px,5.2vw,84px)}
html.touch #ov>button{grid-column:1;grid-row:3;margin:.8em 0 .1em;padding:.6em 2.2em;font-size:clamp(17px,2vw,26px)}html.touch #ov .dkb{grid-column:1;grid-row:4}html.touch #ov .dkb button{min-height:44px;padding:.6em 1.4em;font-size:clamp(13px,1.3vw,17px)}
html.touch #ov .tk{grid-column:1;grid-row:5;margin-top:.9em;max-width:42vw;font-size:clamp(11px,1.25vw,15px);line-height:1.6;color:#9fb1c4}html.touch #ov .tk b{color:#dfe8f2;font-weight:600}
html.touch #ov .ch{grid-column:2;grid-row:1/span 5;margin:0}html.touch #ov .ch>div{margin:.3em 0;padding:.45em 0 .45em .9em;min-height:44px;box-sizing:border-box}
html.touch #ov .ch p{margin:0;font-size:clamp(13px,1.6vw,19px);line-height:1.4}html.touch #ov .ch p+p{font-size:clamp(11px,1.25vw,15px)}
html.touch #ov .lng{position:static;grid-column:2;grid-row:6;justify-self:end;margin-top:.3em;font-size:13px}html.touch #ov .lng span{padding:.65em 1.2em}html.touch #ov .dkv{left:calc(5vw + var(--sl));right:auto;bottom:calc(6px + var(--sb))}
html.touch #perf{right:calc(10px + var(--sr));top:calc(8px + var(--st))}html.touch #perf button{padding:7px 12px;font-size:13px}
html.touch #dl{bottom:calc(max(10px,3vh) + var(--sb));width:min(620px,calc(100vw - 404px - var(--sl) - var(--sr)));min-width:220px;padding:.5em 1em .6em;font-size:clamp(14px,4.1vh,21px);line-height:1.4}
html.touch #cap{top:calc(max(34px,10vh) + var(--st));width:min(760px,74vw);font-size:clamp(14px,4.1vh,22px);line-height:1.5}
html.touch #ttl{left:calc(68px + var(--sl));top:calc(14px + var(--st));font-size:clamp(12px,3.2vh,18px)}
html.touch #sk{right:calc(12px + var(--sr));bottom:calc(10px + var(--sb));min-height:46px;box-sizing:border-box;padding:.8em 1.3em;font-size:15px;border-radius:9px;border-color:#fff7;touch-action:none}html.touch #sk.dn{background:#fff3}
html.touch #end{padding:0 var(--sr) 0 var(--sl);font-size:clamp(13px,3.6vh,19px)}html.touch #end h2{font-size:clamp(28px,5vw,64px)}html.touch #end button{margin:.8em .4em .2em;padding:.7em 1.8em;min-height:48px;font-size:clamp(15px,1.9vw,24px)}
html.touch #s2o,html.touch #s3o{left:calc(68px + var(--sl));top:calc(46px + var(--st));font-size:clamp(13px,3.6vh,18px)}
html.touch #s2p,html.touch #s3p,html.touch #pr,html.touch #pa{font-size:clamp(15px,4vh,20px)}html.touch #s2p,html.touch #s3p{padding:.6em 1.3em;border-radius:9px}html.touch #pr{top:66%;padding:.5em 1.1em;border-radius:9px}
html.touch #pr[data-k],html.touch #pa[data-k],html.touch #s2p[data-k],html.touch #s3p[data-k]{pointer-events:auto;touch-action:none;background:#000b;border:1px solid #fe9a}html.touch #pa[data-k]{border-width:2px}html.touch #pa{top:24%}
html.touch #s2m,html.touch #s3m{font-size:clamp(11px,2.8vh,14px)}
html.touch #s2c{bottom:calc(max(54px,15vh) + var(--sb));gap:8vw}html.touch #s2c button{min-width:160px;min-height:68px;padding:.5em 1.2em;white-space:nowrap;font-size:clamp(22px,6.4vh,34px)}
html.touch #s2t small,html.touch #s3t small,html.touch #s4t small{font-size:clamp(11px,3vh,16px)}html.touch #s2t b,html.touch #s3t b,html.touch #s4t b{font-size:clamp(22px,7vh,52px)}
html.touch #hp,html.touch #s3hp{left:calc(72px + var(--sl));top:calc(88px + var(--st));bottom:auto;width:128px}html.touch #hp b,html.touch #s3hp b{font-size:24px}
html.touch #am,html.touch #s3k{right:calc(12px + var(--sr));top:calc(40px + var(--st));bottom:auto;font-size:15px}html.touch #am b,html.touch #s3k b{font-size:30px}html.touch #am small,html.touch #s3k small{font-size:11px}html.touch #s3k s{height:18px}
html.touch #ct{top:calc(6px + var(--st));font-size:15px}html.touch #ct b{font-size:20px}html.touch #ct small{font-size:11px}
html.touch #fd,html.touch #s3d,html.touch #end{z-index:5}html.touch:has(#fd[style*=grid]) #dl,html.touch:has(#s3d[style*=grid]) #dl{visibility:hidden}html.touch #fd button,html.touch #s3d button{min-height:48px}html.touch #fd button.t,html.touch #s3d button.t{min-height:44px;padding:.6em 1.6em}
html.touch #dk{align-content:safe center;overflow-y:auto;padding:calc(10px + var(--st)) calc(6vw + var(--sr)) calc(10px + var(--sb)) calc(6vw + var(--sl));font-size:clamp(14px,1.5vw,20px);touch-action:pan-y}
html.touch #dk .h{display:none}html.touch #dk h2{font-size:clamp(28px,4.4vw,64px)}html.touch #dk .tb{margin-bottom:.7em;font-size:11px}
html.touch #dk .m{margin-top:.5em}html.touch #dk .m>div{display:flex;align-items:center;min-height:48px;box-sizing:border-box;margin:.15em 0;padding:.3em 2em .3em 1em;font-size:1.3em}
html.touch #dk .g{gap:.45em 1.4em;margin-top:.6em}html.touch #dk .g button{min-width:52px;min-height:40px;padding:.5em 1em}html.touch #dk input[type=range]{width:clamp(150px,24vw,300px);height:38px}
html.touch #dk .bk{position:absolute;top:calc(12px + var(--st));right:calc(6vw + var(--sr));min-height:46px;margin:0;padding:.6em 1.8em;font-size:1.05em}
@media(max-height:520px){html.touch #dk .tb{display:none}html.touch #ov .ch>div{margin:.15em 0;padding:.3em 0 .3em .9em}}
@media(max-height:380px){html.touch #ov{padding-top:calc(30px + var(--st))}html.touch #ov .ch p{font-size:12px;line-height:1.3}html.touch #ov .ch p+p{font-size:10px}html.touch #ov .tk{display:none}html.touch #ov h1{font-size:clamp(28px,4.6vw,40px)}}
#tc[data-s=s4] .b[data-a=aim]{right:calc(26px + var(--sr))!important;bottom:calc(66px + var(--sb))!important;width:68px!important;height:68px!important}
html.touch #dk{background:linear-gradient(90deg,#000f,#000f 50%,#000e)}
#rot{position:absolute;inset:0;z-index:60;display:none;place-content:center;justify-items:center;gap:12px;padding:24px calc(24px + var(--sr)) calc(24px + var(--sb)) calc(24px + var(--sl));background:#05080c;color:#dfe8f2;text-align:center;pointer-events:auto;touch-action:none;font:700 clamp(18px,5.4vw,26px)/1.35 system-ui,'Apple SD Gothic Neo','Malgun Gothic',sans-serif}html.rot #rot{display:grid}
#rot svg{width:min(30vw,112px);height:auto;margin-bottom:6px}#rot .ph{transform-box:fill-box;transform-origin:center;animation:tcrot 2.6s ease-in-out infinite}@keyframes tcrot{0%,22%{transform:rotate(0)}52%,100%{transform:rotate(-90deg)}}
#rot small{max-width:22em;font:400 clamp(12px,3.6vw,15px)/1.5 system-ui,'Apple SD Gothic Neo',sans-serif;color:#9fb1c4}`);
        const root = G.el('div', { id: 'tc' }), mk = (a, txt, s, css, id) => { const b = G.el('div', { className: 'b', textContent: txt }, root); b.dataset.a = a; b.dataset.s = s; b.style.cssText = css; id && (b.id = id); return b; };
        ui = { root, b: [] };
        for (const [a, txt, s, r, y, sz] of BTN) {
          const top = typeof y === 'string';
          ui.b.push(ui[a] = mk(a, txt, s, `right:calc(${r}px + var(--sr));${top ? `top:calc(${y.slice(1)}px + var(--st))` : `bottom:calc(${y}px + var(--sb))`};width:${sz}px;height:${sz}px`));
        }
        ui.pause = mk('pause', '', '', '', 'tcp');
        // "가로로 돌려 주세요" (영어는 mod_enui 사전)
        if (rotOK) G.el('div', { id: 'rot', innerHTML: '<svg viewBox="0 0 96 96" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><g class=ph><rect x="32" y="14" width="32" height="60" rx="6"/><path d="M44 66h8"/></g><path d="M74 26a32 32 0 0 1 8 22" stroke-width="3.5"/><path d="M82 49l-6-5m6 5l4-7" stroke-width="3.5"/></svg><b>휴대폰을 가로로 돌려 주세요</b><small>화면이 돌아가지 않으면 세로 화면 고정(자동 회전) 설정을 확인해 주세요</small>' });
        if (mqP) { const f = () => sync(); mqP.addEventListener ? mqP.addEventListener('change', f) : mqP.addListener && mqP.addListener(f); }
        addEventListener('resize', () => sync());
        ui.joy = G.el('div', { id: 'tcj', innerHTML: '<div id=tck></div>' }, root); ui.knob = ui.joy.firstChild; G.el('div', { id: 'tch' }, root);
        const sk = $('sk'); sk && (sk.textContent = '건너뛰기 ▸');
        const ov = $('ov');
        if (ov) G.el('div', { className: 'tk', innerHTML: '<b>조작</b> 화면 왼쪽을 밀어 이동 · 오른쪽을 밀어 둘러보기<br>오른쪽 버튼으로 사격 · 조준 · 줍기' }, ov);
        // 영어 사전: 키 표시([E] 등)를 뺀 글자도 찾을 수 있게
        const Dc = G.i18n && G.i18n.D; if (Dc) for (const [k, v] of [...Dc]) if (KEYP.test(k)) Dc.set(strip(k).trim(), typeof v === 'string' ? strip(v).trim() : v);
        setInterval(sync, 250); sync();
      },
      update(dt) {
        prompts();
        // 자동 등급: LOW 로 시작한 기기가 20초 동안 여유(해상도 100% · 목표 FPS 의 92% 이상)를 보이고 벤치마크도 받쳐 주면 한 번만 MEDIUM 으로 올려 봄 (무거우면 gpu 모듈이 다시 내림)
        //   목표 FPS = gpu 모듈이 찾은 프레임 상한 (보통 60 · iPhone 저전력 모드 / 첫 터치 전 iframe 등 30fps 상한이면 30 → 55 고정이면 영영 못 올림)
        const g = G.gpuInfo;
        if (!raised && g && g.mobile && !G.qManual && G.Q.level === 0 && g.benchTier !== 'LOW' && !G.params.has('step') && !G.params.get('q')) {
          const ft = G.gpu && G.gpu.fpsTarget || 60;
          raiseT = G.dyn > .99 && +G.fps >= ft * .92 ? raiseT + dt : 0;
          if (raiseT > 20) { raised = 1; g.tier = 'MEDIUM'; g.auto = '↑'; G.setQuality('MEDIUM', false); }
        }
      },
      prepare() {
        if (taps.length) { const f = G.frame, t = now(); taps = taps.filter(p => f >= p[1] && t >= p[2] ? (key(p[0], 0), 0) : 1); }
        sync();
      }
    }, 'story');
  }
}
