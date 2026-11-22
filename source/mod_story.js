'use strict';
/* STORY (미리보기판) — 스토리 1 기내 장면: 좌석 1인칭 시점 · 자동 대사 · 피격 연출. 추락·난입·총격전은 정식판에서 */
{
  const C = G.cabin, PP = G.people, R = Math.random;
  // 대본: [화자, 대사] = 대사 / ['*', 문구] = 해설 자막 / ['!', 행동] = 화면 연출 (대사창에 넣지 않음)
  G.STORY = [
    ['*', '주인공 김민철 하사는 마스크 대령과 박창원 중위, 이자용 병장, 신영호 상병, 김전부 이병과 함께 휴가를 내고 비행기를 탄다.'],
    ['!', 'in'],
    ['김민철', '아 드디어 휴가다!!'], ['마스크 대령', '그게 그렇게 좋냐?'], ['김민철', '뼈가 으스러지게 훈련하는 것보단 낫죠.'],
    ['마스크 대령', '야 그런데 그러고 보니 김전부는 오자마자 휴가냐'], ['김전부', '아닙니다! 전 군대에 온지 7개월이나 지났단 말입니다!'],
    ['마스크 대령', '하하하 그래.'], ['마스크 대령', '맞는말이긴 하지.'],
    ['박창원', '전 화장실 좀 다녀올게요.'], ['!', 'lav'], ['마스크 대령', '난 좀 자야겠군.'], ['!', 'sleep'], ['김전부', '저는 뉴스나 볼게요.'],
    ['!', 'missile'], ['!', 'hit'],
    ['!', 'back'], ['박창원', '무슨일입니까?'], ['마스크 대령', '나도 몰라!'], ['김민철', '아니 이게 무슨..'], ['신영호', '추락한다!'],
    ['김민철', '이제 어떻게합니까?'], ['박창원', '몰라!'], ['김민철', '이런 젠장 환장하겠네 시발!'],
    ['마스크 대령', '야 그래도 이륙한지 20분 밖에 안 지났으니 괜찮을 거야!'],
    ['*', '미리보기는 여기까지입니다 — 랜딩기어 이탈, 뉴스, 비상착륙, 북한군 난입과 총격전은 제작 중입니다.  [V] 외부 시점  [B] 추락 현장'],
  ];
  const S = { on: 0, i: 0, t: 0, nx: 0, view: 0, yaw: .5, pit: -.05, mv: 0, hit: 0, z: 0, y: 3200, sh: 0, oa: 0 }, W = {}, ui = {};
  const who = { '마스크 대령': 'col', '박창원': 'park', '김전부': 'jb', '이자용': 'lee', '신영호': 'shin' };
  const sit = (k, r, c, seed, pose = 'sit') => { const s = C.seat(r, c); return PP.add(k, { p: s.p.slice(), yaw: s.yaw, pose, M: C.M, seed }); };
  function stage() { // 좌석 배치: 플레이어 13D(오른쪽 통로) · 대령 13C · 박창원 12C · 김전부 12A(왼쪽 창가 = 피격 지점) · 이자용 14C · 신영호 14D
    PP.clear(); Object.assign(C.S, { hole: 0, masks: 0, power: 1, crash: 0, tv: 0, gear: 1 });
    W.col = sit('mask', 13, 'C', 3); W.park = sit('rok', 12, 'C', 5); W.jb = sit('rok', 12, 'A', 7); W.lee = sit('rok', 14, 'C', 9); W.shin = sit('rok', 14, 'D', 11);
    for (const [r, c, s] of [[9, 'B', 2], [9, 'E', 4], [7, 'A', 6], [6, 'D', 8], [16, 'F', 10], [17, 'B', 12], [19, 'C', 14], [20, 'E', 16], [4, 'C', 18], [22, 'A', 20]]) sit('civ', r, c, s);
    Object.assign(S, { i: 0, t: 0, nx: 0, hit: 0, z: 0, y: 3200, sh: 0, view: 0 });
  }
  function act(a) {
    if (a === 'in') ui.cap.style.opacity = 0;
    if (a === 'lav') { W.park.pose = 'walk'; W.park.go = 1; }                 // (화장실로 간다) — 통로를 따라 뒤쪽으로
    if (a === 'sleep') W.col.pose = 'sleep';
    if (a === 'missile') { C.S.tv = 1; S.nx = S.t + 2.5; }                    // (북한의 미사일이 날아온다)
    if (a === 'hit') {                                                         // (큰 폭발 · 김전부 자리의 벽이 폭발한다)
      S.hit = 1; S.sh = 1; C.S.masks = 1; PP.remove(W.jb); W.jb = 0;
      const h = C.w(C.K.hole); G.fx.burst('explosion', h, { size: 1.3 }); G.post.flash(3); G.sfx.play('explosion', { gain: 1.4 }); G.sfx.loop('siren', 1, { gain: .25 });
      for (const k of ['col', 'lee', 'shin']) W[k].pose = 'brace'; S.nx = S.t + 2.2;
    }
    if (a === 'back') { for (const k of ['col', 'lee', 'shin']) W[k].pose = 'sit'; const p = W.park; p.vis = true; p.go = 0; p.p = [0, 0, C.seat(16, 'C').p[2]]; p.yaw = 0; p.pose = 'stumble'; } // (넘어지며)
  }
  function say(l) {
    const d = l[0] === '*'; ui.dl.style.display = d ? 'none' : 'block'; ui.cap.style.opacity = d ? 1 : 0;
    if (d) ui.cap.textContent = l[1]; else ui.dl.innerHTML = `<b>${l[0]}</b>${l[1]}`;
    for (const k in W) if (W[k]) W[k].talk = +(who[l[0]] === k);
    S.nx = S.t + 1.3 + l[1].length * (d ? .075 : .1);
  }
  function update(dt) {
    if (!S.st) { S.st = 1; stage(); if (G.params.has('autostart')) start(); } // 첫 프레임에 배치 (다른 모듈 init 이후)
    if (!S.on) { C.place([0, 3200, 0], 0, 0, 0); view(dt); return; }
    S.t += dt; S.z += 215 * dt; if (S.hit) { S.y = Math.max(1700, S.y - 22 * dt); C.S.hole = Math.min(1, C.S.hole + dt * 4); C.S.power = .3 + .25 * (Math.sin(S.t * 23) > .2); S.sh = Math.max(.25, S.sh - dt * .4); }
    const k = S.sh * (S.hit ? 1 : 0);
    C.place([0, S.y, S.z], 0, S.hit ? -.07 - .02 * Math.sin(S.t * .7) : 0, S.hit ? .06 * Math.sin(S.t * .9) + k * .02 * Math.sin(S.t * 31) : .01 * Math.sin(S.t * .4));
    const p = W.park; if (p && p.go) { p.p[0] = 0; p.p[2] -= 1.1 * dt; p.yaw = Math.PI; if (p.p[2] < C.K.lavA[2] + .6) { p.vis = false; p.go = 0; } }
    if (S.t > S.nx && S.i < G.STORY.length) { const l = G.STORY[S.i++]; l[0] === '!' ? act(l[1]) : say(l); }
    view(dt);
  }
  function view(dt) {
    const e = C.seat(13, 'D').p, sh = S.sh * (S.hit ? .03 : 0), cy = Math.cos(S.pit);
    if (S.view === 0) { // 좌석 1인칭 (머리 돌리기 범위 제한). 조작이 없으면 말하는 사람 쪽으로 천천히 돌아봄
      S.mv -= dt; const sp = S.on && G.STORY[S.i - 1], w = sp && W[who[sp[0]]];
      if (S.mv < 0 && w && w.vis !== false) { const d = V3.sub(w.M ? w.p : C.l(w.p), e), ty = Math.atan2(d[0], d[2]); S.yaw += G.clamp(ty - S.yaw, -1, 1) * dt * 1.5; S.pit += (-.05 - S.pit) * dt; }
      const o = [e[0], e[1] + .68 + sh * Math.sin(S.t * 37), e[2] + .06];
      G.cam.pos = C.w(o); G.cam.target = C.w([o[0] + Math.sin(S.yaw) * cy, o[1] + Math.sin(S.pit), o[2] + Math.cos(S.yaw) * cy]);
      G.cam.up = V3.sub(C.w([0, 1, 0]), C.w([0, 0, 0])); G.cam.near = .08; G.cam.fov = 1.12; G.setEnv({ indoor: 1, exposure: 1.15 });
    } else { // 외부 궤도 시점 (V) · 추락 현장 (B)
      S.oa += dt * .12; const c = C.w([0, 1, 0]), d = S.view === 2 ? 46 : 62;
      G.cam.pos = [c[0] + Math.sin(S.oa + S.yaw) * d, c[1] + (S.view === 2 ? 9 : 12 + S.pit * 30), c[2] + Math.cos(S.oa + S.yaw) * d]; G.cam.target = c; G.cam.up = [0, 1, 0]; G.cam.near = .3; G.cam.fov = .8; G.setEnv({ indoor: 0, exposure: 1 });
    }
    G.shadowFocus = G.cam.pos; G.shadowRange = S.view ? 70 : 26;
    for (let k = -1; k < 2; k++) G.addLight(C.w([0, 1.95, e[2] + k * 3.2]), [1, .93, .82], 9 * C.S.power, 6, .05); // 천장 조명 → 인물에도
    if (S.hit && S.view < 2) { G.fx.trail(C.w(C.K.hole), [0, 0, 0], 'fire', dt); }
    G.sfx.listener(G.cam.pos, V3.norm(V3.sub(G.cam.target, G.cam.pos)));
  }
  function start() { ui.ov.style.display = 'none'; G.sfx.init(); G.sfx.loop('engine', 1, { gain: .35, rate: 1.6 }); G.sfx.music('calm'); stage(); S.on = 1; S.nx = .5; }
  function setView(v) {
    S.view = S.view === v ? 0 : v; if (!S.on) return;
    if (S.view === 2) { const s = C.K.site; C.S.crash = 1; C.S.hole = 1; C.place(s.pos, s.yaw, s.pitch, s.roll); S.on = 2; G.setEnv({ cloud: .5 }); ui.dl.style.display = 'none'; }
  }
  G.story = { S, go() { }, start };
  G.register('story', {
    init() {
      G.css(`#ov{position:absolute;inset:0;display:grid;align-content:center;justify-items:start;padding:0 7vw;background:linear-gradient(90deg,#000c,#0006 45%,#0000 75%);pointer-events:auto}
#ov h1{margin:0;font:800 clamp(34px,6.4vw,92px)/1 system-ui;letter-spacing:.04em;color:#fff}#ov h1 i{display:block;font-style:normal;color:#6cf}
#ov p{margin:.5em 0;font-size:clamp(14px,1.5vw,20px);color:#cde}#ov button{margin:1em 0;padding:.5em 2.4em;font:700 clamp(18px,2vw,28px) system-ui;letter-spacing:.3em;color:#012;background:#6cf;border:0;border-radius:8px;cursor:pointer;box-shadow:0 0 24px #6cf8}
#ov small{color:#9bd}#ov a{color:#9df}
#dl{position:absolute;left:50%;bottom:7vh;transform:translateX(-50%);max-width:min(880px,86vw);padding:.6em 1.2em;background:#000b;border-radius:10px;font-size:clamp(16px,2.3vh,26px);color:#fff;text-align:center;display:none;text-shadow:0 1px 3px #000}
#dl b{display:block;font-size:.72em;color:#8df;letter-spacing:.08em;margin-bottom:.15em}
#cap{position:absolute;left:50%;top:14vh;transform:translateX(-50%);width:min(900px,84vw);text-align:center;font:italic 500 clamp(15px,2.2vh,24px)/1.6 serif;color:#fff;text-shadow:0 0 12px #000,0 1px 3px #000;transition:opacity 1s;opacity:0}`);
      ui.ov = G.el('div', { id: 'ov', innerHTML: `<h1>SECOND<i>KOREAN WARS</i></h1><p>스토리 1 — 서강시 : 전쟁의 시작 · 대한민국편</p><p>플레이어: 김민철 하사 <small>(미리보기판 — 기내 장면만)</small></p><button>시 작</button><p><small>마우스: 둘러보기 · V: 외부 시점 · B: 추락 현장 · F2: 그래픽 설정<br><a href="?mode=naval">해상 반격 임무 (이전 게임)</a></small></p>` });
      ui.dl = G.el('div', { id: 'dl' }); ui.cap = G.el('div', { id: 'cap' });
      ui.ov.querySelector('button').onclick = start;
      addEventListener('keydown', e => { if (e.code === 'Enter' && !S.on) start(); if (e.code === 'KeyV') setView(1); if (e.code === 'KeyB') setView(2); });
      G.canvas.addEventListener('click', () => { S.on && G.canvas.requestPointerLock && G.canvas.requestPointerLock(); });
      addEventListener('mousemove', e => { if (document.pointerLockElement === G.canvas || e.buttons) { S.yaw -= e.movementX * .0025; S.pit = G.clamp(S.pit - e.movementY * .0025, -.7, .6); if (!S.view) S.yaw = G.clamp(S.yaw, -1.9, 1.9); S.mv = 3; } });
      G.setEnv({ cloud: .7, sunEl: 34, sunAz: 65, haze: .3 });
    },
    update
  }, 'story');
  G.mode === 'story' && G.order.unshift(G.order.pop()); // 스토리의 update 가 먼저 돌아야 기체 변환이 같은 프레임에 반영됨
}
