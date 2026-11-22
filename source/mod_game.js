'use strict';
{ /* ═══ GAME — 플레이어 함 · 무장 · 적 AI · 시나리오 실행기 · HUD ═══
  시나리오 (위→아래 실행 · 이 표만 교체하면 됨):
   ['msg', 화자, 대사] ['obj', 목표] ['wait', 초] ['env', {G.setEnv 값}] ['music', 'calm'|'combat'|'off'] ['island', 메시, x, z, yaw] ['win', 문구]
   ['spawn', 종류, {n, brg, dist, spread, isl}] 종류: ssm·jet·boat·frigate·battery / brg = 함수 기준 시계방향(도)
   ['clear', 'msl'|'jet'|'ship'|'site'|'all'] 해당 적이 사라질 때까지 대기 */
  G.SCENARIO = { title: '훈련 교전 · 동해 차단선', steps: [
    ['island', 'island0', 2600, 7800, .5], ['island', 'island1', -3400, 4600, 2], ['music', 'calm'], ['obj', '전투 배치 — 대기'], ['wait', 3],
    ['msg', '전투정보실', '함장님, 북동쪽에서 대함미사일 3발 탐지. 본함으로 접근 중입니다.'],
    ['obj', '대함미사일을 요격하라 — Tab 표적 선택 · Space 발사'], ['music', 'combat'],
    ['spawn', 'ssm', { n: 3, brg: 35, dist: 5600, spread: 18 }], ['clear', 'msl'],
    ['msg', '전투정보실', '전탄 요격. 이어서 적 전투기 편대가 접근합니다.'], ['obj', '적 전투기를 격추하라'],
    ['spawn', 'jet', { n: 2, brg: -55, dist: 7500, spread: 14 }], ['clear', 'jet'], ['clear', 'msl'],
    ['msg', '함장', '이제 우리가 칠 차례다. 적 수상 전투단을 격침하라.'], ['obj', '적 고속정·호위함을 격침하라 — Space 대함미사일 · F 함포'],
    ['spawn', 'boat', { n: 3, brg: 8, dist: 5200, spread: 42 }], ['spawn', 'frigate', { n: 1, brg: -22, dist: 6600 }], ['clear', 'ship'],
    ['msg', '전투정보실', '섬의 해안 미사일 포대가 본함을 조준하고 있습니다.'], ['obj', '섬의 해안포대를 제압하라'],
    ['spawn', 'battery', { isl: 0 }], ['spawn', 'jet', { n: 2, brg: 150, dist: 8000, spread: 20 }], ['clear', 'all'],
    ['music', 'calm'], ['win', '작전 해역 확보 — 임무 완료'] ] };

  const rnd = (a, b) => a + Math.random() * (b - a), wrap = a => Math.atan2(Math.sin(a), Math.cos(a)), R2D = 180 / Math.PI;
  const dir = (yaw, pit = 0) => [Math.sin(yaw) * Math.cos(pit), Math.sin(pit), Math.cos(yaw) * Math.cos(pit)];
  const steer = (cur, want, max) => cur + G.clamp(wrap(want - cur), -max, max);
  const HP = n => G.modelData[n].hp, live = e => e && e.alive && !e.dead, isAir = e => e.k === 'msl' || e.k === 'jet';
  const TYPES = { // 적 제원
    boat: { k: 'ship', model: 'boat', name: '고속정', hp: 35, spd: 17, keep: 3200, range: 5200, rate: [14, 22], ammo: 4, r: 22, len: 18 },
    frigate: { k: 'ship', model: 'frigate', name: '호위함', hp: 110, spd: 11, keep: 4300, range: 6500, rate: [16, 24], salvo: 2, ammo: 8, gun: 1, r: 50, len: 40 },
    battery: { k: 'site', model: 'battery', name: '해안포대', hp: 45, range: 9000, rate: [12, 18], ammo: 8, r: 14 },
    jet: { k: 'jet', model: 'jet', name: '전투기', hp: 1, spd: 170, r: 14, ammo: 2 } };
  const cam = { az: 2.6, el: .2, d: 340 }, ui = {};
  let P, E, S, T, X, state = 'title', sel, shake = 0, hudT = 0, paused = 0, muted = 0, log;

  function reset() {
    P = { k: 'ship', side: 0, model: 'aegis', name: '본함', p: [0, 0, 0], v: [0, 0, 0], yaw: 0, spd: 8, thr: .5, hp: 100, r: 70, len: 60, alive: 1,
      sam: 32, ssm: 8, gun: 120, cd: [0, 0, 0], gunYaw: 0, ciws: [{ yaw: 0, pit: .15, t: 0 }, { yaw: Math.PI, pit: .15, t: 0 }], vls: 0, fire: 0 };
    E = []; S = { i: 0, wait: 0, obj: '', isl: [], kills: 0 }; T = 0; sel = null; log = []; shake = 0;
    G.setEnv(Object.assign({ sunAz: 40, sunEl: 26, cloud: .45, haze: .35, sea: .55 }, G.SCENARIO.env));
  }
  function say(who, text) { log.push([who, text, T]); if (log.length > 4) log.shift(); G.sfx.play('click'); hudT = 1; }
  function boom(p, kind, size = 1) { // 폭발 묶음: 파티클·조명·소리·물결·섬광
    G.fx.burst(kind, p, { size });
    const d = V3.dist(p, G.cam.pos), near = G.clamp(1 - d / 1500, 0, 1) * size;
    if (kind === 'splash') { G.ocean.ripple(p[0], p[2], 30 * size); G.sfx.play('splash', { pos: p, gain: size }); return; }
    G.addLight(p, kind === 'flash' ? [1, .9, .7] : [1, .55, .25], 45 * size, 600 * size, .45);
    G.sfx.play(kind === 'flash' ? 'intercept' : 'explosion', { pos: p, gain: size });
    if (p[1] < 25) G.ocean.ripple(p[0], p[2], 40 * size);
    if (near > .05) { G.post && G.post.flash(near * .6); shake = Math.max(shake, near * .8); }
  }
  function shipMat(e) { // 파도 위 자세 (+ 침몰)
    const x = e.p[0], z = e.p[2], f = dir(e.yaw), L = e.len, s = e.dead ? Math.min(e.dead / 14, 1) : 0;
    const pt = Math.atan2(G.waveAt(x + f[0] * L, z + f[2] * L) - G.waveAt(x - f[0] * L, z - f[2] * L), L * 2) * .5;
    const rl = Math.atan2(G.waveAt(x + f[2] * 9, z - f[0] * 9) - G.waveAt(x - f[2] * 9, z + f[0] * 9), 18) * .6;
    e.p[1] = G.waveAt(x, z) * .45 - s * s * (e.r * .5 + 8);
    return e.m = M4.trs(e.p, e.yaw, pt - s * .35 * (e.tip || 1), rl + (e.heel || 0) + s * .9 * (e.tip || 1));
  }
  function fireMsl(o, kind, tgt, from, d0) {
    const sam = kind === 'sam';
    E.push({ k: 'msl', kind, name: sam ? '대공미사일' : '대함미사일', side: o.side, tgt, p: [...from], dir: V3.norm(d0), v: [0, 0, 0], spd: sam ? 70 : 90, max: sam ? 330 : o.side ? 165 : 235,
      turn: sam ? 1.6 : .75, t: 0, life: sam ? 24 : 80, r: 4, alive: 1, dmg: o.side ? 20 : 55 });
    G.fx.burst('launch', from, { dir: d0, size: sam ? 1 : .8 }); G.sfx.play('launch', { pos: from });
  }
  function kill(t) {
    if (!live(t)) return;
    if (t === P) { P.dead = .01; state = 'lost'; boom(P.p, 'explosion', 2.5); return over('함 침몰 — 작전 실패', '#ff6b5c'); }
    if (t.side) S.kills++;
    if (t.k === 'msl') { t.alive = 0; return boom(t.p, 'flash', 1); }
    if (t.k === 'jet') { t.alive = 0; boom(t.p, 'explosion', 1.1); return say('전투정보실', '적기 격추.'); }
    t.dead = .01; t.tip = Math.random() < .5 ? -1 : 1; boom([t.p[0], t.p[1] + 8, t.p[2]], 'explosion', t.r > 30 ? 2 : 1.3);
    say('전투정보실', t.name + (t.k === 'site' ? ' 파괴.' : ' 격침.'));
  }
  function damage(t, dmg, at) {
    boom(at, 'explosion', dmg > 30 ? 1.2 : .7); G.sfx.play('hit', { pos: at });
    if (t === P) { if (G.params.has('god')) return; shake = 1; P.fire = 7; P.firePos = at; ui.hit.style.opacity = 1; }
    t.fire = Math.max(t.fire || 0, 6); if ((t.hp -= dmg) <= 0) kill(t);
  }
  function mslStep(m, dt) {
    m.t += dt; const t = m.tgt, ok = live(t); let want = m.dir, d = 1e9;
    if (ok) {
      const aim = [t.p[0], t.p[1] + (t.k === 'ship' ? 6 : 0), t.p[2]]; d = V3.dist(aim, m.p);
      const tt = Math.min(d / m.spd, 6) * .9; for (let i = 0; i < 3; i++) aim[i] += t.v[i] * tt; // 예측 요격
      want = V3.norm(V3.sub(aim, m.p));
      if (m.kind === 'ssm' && d > 550) want = V3.norm([want[0], G.clamp((10 - m.p[1]) * .02, -.4, .4), want[2]]); // 해면 밀착 비행
      if (m.kind === 'sam' && m.t < .8) want = [0, 1, 0]; // 수직 발사 구간
    } else m.life = Math.min(m.life, m.t + 1.2);
    const ang = Math.acos(G.clamp(V3.dot(m.dir, want), -1, 1));
    if (ang > 1e-4) m.dir = V3.norm(V3.lerp(m.dir, want, Math.min(1, m.turn * dt / ang)));
    m.spd = Math.min(m.max, m.spd + 150 * dt); m.v = V3.mul(m.dir, m.spd); m.p = V3.add(m.p, V3.mul(m.v, dt));
    G.draw(m.kind, M4.fromDir(m.p, m.dir, 0, 1.5), m.side ? [1, .7, .6, 0] : [1, 1, 1, 0]);
    G.fx.trail(V3.sub(m.p, V3.mul(m.dir, 4)), m.v, 'missile', dt);
    if (ok && d < (isAir(t) ? 18 : t.r * .4) + m.spd * dt) {
      m.alive = 0;
      if (isAir(t)) Math.random() < .88 ? kill(t) : boom(m.p, 'flash', .4); else damage(t, m.dmg, m.p);
    } else if (m.p[1] < G.waveAt(m.p[0], m.p[2]) - 1) { m.alive = 0; boom(m.p, 'splash', .7); }
    else if (m.t > m.life) { m.alive = 0; boom(m.p, 'flash', .4); }
  }
  function enemyFire(e, from) {
    const to = V3.sub(P.p, from); fireMsl(e, 'ssm', P, from, [to[0], Math.hypot(to[0], to[2]) * .35, to[2]]);
    if (!S.warned || T - S.warned > 12) { S.warned = T; G.sfx.play('alert'); }
  }
  function shipStep(e, dt) { // 적 함정 · 해안포대
    if (e.dead) { if ((e.dead += dt) > 14) e.alive = 0; if (e.k === 'site') { G.draw(e.model, e.m, [.25, .22, .2, 0]); G.fx.trail(e.p, [0, 2, 0], 'fire', dt); return; } }
    const to = V3.sub(P.p, e.p), d = Math.hypot(to[0], to[2]), brg = Math.atan2(to[0], to[2]);
    if (e.k === 'ship') {
      if (!e.dead) {
        const want = d > e.keep + 600 ? brg : d < e.keep - 600 ? brg + Math.PI : brg + e.orb * 1.45;
        e.yaw = steer(e.yaw, want, .1 * dt); e.v = V3.mul(dir(e.yaw), e.spd); e.p[0] += e.v[0] * dt; e.p[2] += e.v[2] * dt;
        G.ocean.wake(e.p[0], e.p[2], e.yaw, e.spd, e.len);
      } else e.v = [0, 0, 0];
      shipMat(e);
    }
    G.draw(e.model, e.m, [1, 1, 1, e.fire > 5.5 ? 1 : 0]);
    if (e.dead || e.fire > 0) { e.fire -= dt; G.fx.trail(M4.point(e.m, [0, 7, 0]), [0, 3, 0], 'fire', dt); }
    if (e.dead || !live(P)) return;
    if ((e.cd -= dt) < 0 && d < e.range && e.ammo > 0) { e.cd = rnd(...e.rate); for (let i = 0; i < (e.salvo || 1); i++, e.ammo--) enemyFire(e, M4.point(e.m, [i * 3 - 1, HP(e.model).ssm[1], HP(e.model).ssm[2]])); }
    if (e.gun && d < 4200 && (e.gcd = (e.gcd || 3) - dt) < 0) { // 호위함 함포: 대부분 지근탄
      e.gcd = rnd(2.5, 4); const mz = M4.point(e.m, HP(e.model).gun); G.fx.burst('muzzle', mz, { dir: V3.norm(to) }); G.sfx.play('gun', { pos: mz, gain: .6 });
      Math.random() < .22 ? damage(P, 3, M4.point(P.m, [rnd(-6, 6), 9, rnd(-60, 60)])) : boom([P.p[0] + rnd(-90, 90), 0, P.p[2] + rnd(-90, 90)], 'splash', .5);
    }
  }
  function jetStep(e, dt) { // 접근 → 2.6km 에서 대함미사일 발사 → 이탈 → 재접근
    const to = V3.sub(P.p, e.p), d = Math.hypot(to[0], to[2]); let want;
    if (e.mode === 'in') {
      want = V3.norm([to[0], (190 - e.p[1]) * 3, to[2]]);
      if (d < 2600) { if (e.ammo-- > 0 && live(P)) enemyFire(e, V3.add(e.p, [0, -4, 0])); e.mode = 'out'; const a = Math.atan2(e.dir[0], e.dir[2]) + e.orb * 1.9; e.brk = [Math.sin(a), .12, Math.cos(a)]; }
    } else { want = V3.norm(e.brk); if (d > 6200) { if (e.ammo <= 0) { e.alive = 0; return say('전투정보실', '적기 이탈.'); } e.mode = 'in'; } }
    const y0 = Math.atan2(e.dir[0], e.dir[2]), ang = Math.acos(G.clamp(V3.dot(e.dir, want), -1, 1));
    if (ang > 1e-4) e.dir = V3.norm(V3.lerp(e.dir, want, Math.min(1, .55 * dt / ang)));
    e.roll = G.lerp(e.roll || 0, G.clamp(-wrap(Math.atan2(e.dir[0], e.dir[2]) - y0) / Math.max(dt, 1e-3) * 2.2, -1.3, 1.3), .08);
    e.v = V3.mul(e.dir, e.spd); e.p = V3.add(e.p, V3.mul(e.v, dt)); e.p[1] = Math.max(e.p[1], 40);
    const m = M4.fromDir(e.p, e.dir, e.roll, 1.7); G.draw('jet', m); G.fx.trail(M4.point(m, HP('jet').nozzle), e.v, 'jet', dt);
  }
  function spawn(kind, o = {}) {
    const f = dir(P.yaw), rt = [-f[2], 0, f[0]];
    for (let i = 0; i < (o.n || 1); i++) {
      const b = ((o.brg || 0) + ((o.n || 1) > 1 ? (i / ((o.n || 1) - 1) - .5) * (o.spread || 0) : 0)) / R2D, D = (o.dist || 5000) * rnd(.92, 1.08);
      const p = [P.p[0] + (f[0] * Math.cos(b) + rt[0] * Math.sin(b)) * D, 0, P.p[2] + (f[2] * Math.cos(b) + rt[2] * Math.sin(b)) * D], back = V3.norm(V3.sub(P.p, p));
      if (kind === 'ssm') { p[1] = 30; fireMsl({ side: 1 }, 'ssm', P, p, back); E[E.length - 1].spd = 165; continue; }
      const t = TYPES[kind], e = Object.assign({ side: 1, alive: 1, p, v: [0, 0, 0], yaw: Math.atan2(back[0], back[2]), cd: rnd(3, 8), orb: Math.random() < .5 ? -1 : 1, fire: 0 }, t);
      if (kind === 'jet') { p[1] = rnd(180, 320); e.dir = back; e.mode = 'in'; }
      if (kind === 'battery') { const I = S.isl[o.isl || 0]; if (!I) return; e.p = M4.point(I.m, HP(I.name).site); e.m = M4.trs(e.p, Math.atan2(P.p[0] - e.p[0], P.p[2] - e.p[2])); }
      E.push(e);
    }
  }
  function story(dt) { // 시나리오 실행기
    if ((S.wait -= dt) > 0) return;
    const s = G.SCENARIO.steps[S.i]; if (!s) return;
    const [c, a, b, x, y] = s;
    if (c === 'clear') { if (E.some(e => e.side && live(e) && (a === 'all' || e.k === a))) return; S.wait = 1.5; }
    else if (c === 'msg') { say(a, b); S.wait = 2.2; }
    else if (c === 'obj') { S.obj = a; hudT = 1; }
    else if (c === 'wait') S.wait = a;
    else if (c === 'env') G.setEnv(a);
    else if (c === 'music') G.sfx.music(a);
    else if (c === 'island') { if (G.modelData[a]) S.isl.push({ name: a, p: [b, 0, x], r: G.modelData[a].radius, m: M4.trs([b, 0, x], y || 0) }); }
    else if (c === 'spawn') spawn(a, b);
    else if (c === 'win') { state = 'won'; over(a, '#8dff9a'); }
    S.i++;
  }
  function weapons(dt) {
    const k = G.keys, hp = HP('aegis'), air = live(sel) && isAir(sel);
    for (let i = 0; i < 3; i++) P.cd[i] -= dt;
    const inb = t => E.reduce((n, m) => n + (m.k === 'msl' && !m.side && m.tgt === t ? 1 : 0), 0); // 표적을 쫓는 아군 미사일 수
    if (k.Space && air && inb(sel)) { // Space 유지 = 미교전 공중 위협으로 자동 전환
      let b = null, bd = 1e9; for (const e of E) if (e.side && live(e) && isAir(e) && !inb(e)) { const d = V3.dist(e.p, P.p) * (e.k === 'msl' ? .3 : 1); if (d < bd) { bd = d; b = e; } }
      if (b) sel = b;
    }
    if (k.Space && live(sel) && (air ? !inb(sel) : inb(sel) * 55 < sel.hp)) {
      if (air && P.sam > 0 && P.cd[0] < 0) { P.cd[0] = .9; P.sam--; fireMsl(P, 'sam', sel, M4.point(P.m, (P.vls ^= 1) ? hp.vlsA : hp.vlsF), [0, 1, 0]); }
      if (!air && P.ssm > 0 && P.cd[1] < 0) { P.cd[1] = 3.5; P.ssm--; const f = dir(P.yaw + (P.vls ^= 1 ? .9 : -.9), .5); fireMsl(P, 'ssm', sel, M4.point(P.m, hp.ssm), f); }
    }
    // 함포: 수상·지상 표적, 사거리 7km
    const gb = M4.point(P.m, hp.gun), gt = live(sel) && !air ? V3.sub(sel.p, gb) : null, gd = gt ? V3.len(gt) : 0;
    P.gunYaw = steer(P.gunYaw, gt ? Math.atan2(gt[0], gt[2]) - P.yaw : 0, 1.2 * dt);
    const gm = M4.mul(P.m, M4.trs(hp.gun, P.gunYaw, gt ? .06 + gd / 30000 : 0)); G.draw('gun', gm);
    if (k.KeyF && gt && gd < 7000 && P.gun > 0 && P.cd[2] < 0 && Math.abs(wrap(Math.atan2(gt[0], gt[2]) - P.yaw - P.gunYaw)) < .06) {
      P.cd[2] = 1.1; P.gun--; const mz = M4.point(gm, HP('gun').muzzle), d0 = V3.norm(V3.sub(mz, M4.point(gm, [0, HP('gun').muzzle[1], 0])));
      G.fx.burst('muzzle', mz, { dir: d0 }); G.fx.tracer(mz, d0, 800); G.sfx.play('gun', { pos: mz }); shake = Math.max(shake, .15);
      E.push({ k: 'shell', side: 0, alive: 1, t: gd / 800, tgt: sel, hit: Math.random() < G.clamp(1.1 - gd / 6500, .25, .95), p: mz, v: [0, 0, 0] });
    }
    // CIWS: 1.5km 자동 교전
    let firing = 0;
    P.ciws.forEach((c, i) => {
      const base = M4.point(P.m, hp.ciws[i]); let best = null, bd = 1500;
      for (const e of E) if (e.side && live(e) && isAir(e)) { const d = V3.dist(e.p, base); if (d < bd) { bd = d; best = e; } }
      let wy = i ? Math.PI : 0, wp = .15;
      if (best) { const v = V3.sub(V3.add(best.p, V3.mul(best.v, bd / 1100)), base); wy = Math.atan2(v[0], v[2]) - P.yaw; wp = Math.atan2(v[1], Math.hypot(v[0], v[2])); }
      c.yaw = steer(c.yaw, wy, 3.5 * dt); c.pit += G.clamp(wp - c.pit, -2.5 * dt, 2.5 * dt);
      const m = M4.mul(P.m, M4.trs(hp.ciws[i], c.yaw, c.pit)); G.draw('ciws', m);
      if (!best || Math.abs(wrap(wy - c.yaw)) > .08) return;
      firing = 1; c.t += dt; const mz = M4.point(m, HP('ciws').muzzle);
      while (c.t > .04) { c.t -= .04; G.fx.tracer(mz, dir(c.yaw + P.yaw + rnd(-.012, .012), c.pit + rnd(-.012, .012)), 1100, c.t); } // 4번째 = 이미 날아간 시간
      if (Math.random() < dt * .13 * (1 - bd / 1600)) kill(best); else if (Math.random() < dt * 2) G.fx.burst('hit', best.p, { size: .4 });
    });
    G.sfx.loop('ciws', firing, { gain: .8 });
  }
  function pick(next) { // next = 1 다음 표적 / 0 최우선 위협 (날아오는 미사일이 항상 먼저 = HUD 의 '최우선' 표식과 같은 기준)
    const H = E.filter(e => e.side && live(e)).map(e => [V3.dist(e.p, P.p) - (e.k === 'msl' ? 1e6 : 0), e]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
    if (!H.length) return sel = null;
    sel = next ? H[(H.indexOf(sel) + 1) % H.length] : H[0]; G.sfx.play('lock');
  }
  function update(dt) {
    const k = G.keys, play = state === 'play' && !paused; if (!play) dt = state === 'play' ? 0 : dt * .4;
    T += dt;
    if (state === 'play') {
      P.thr = G.clamp(P.thr + ((k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0)) * dt * .5, -.3, 1);
      const rud = (k.KeyA ? 1 : 0) - (k.KeyD ? 1 : 0); P.rud = G.lerp(P.rud || 0, rud, Math.min(1, dt * 2));
      story(dt); if (!live(sel)) pick(0);
    } else cam.az += dt * .12;
    if (!P.dead) { P.spd += (P.thr * 17 - P.spd) * dt * .22; P.yaw += (P.rud || 0) * dt * .11 * G.clamp(P.spd / 9, -.6, 1.3); P.heel = G.lerp(P.heel || 0, -(P.rud || 0) * P.spd * .006, dt); }
    else { P.dead += dt; P.spd *= 1 - dt * .5; P.tip = 1; G.fx.trail(M4.point(P.m, [0, 10, 0]), [0, 4, 0], 'fire', dt); }
    P.v = V3.mul(dir(P.yaw), P.spd); P.p[0] += P.v[0] * dt; P.p[2] += P.v[2] * dt;
    for (const I of S.isl) { const dx = P.p[0] - I.p[0], dz = P.p[2] - I.p[2], d = Math.hypot(dx, dz), m = I.r * .9; if (d < m) { P.p[0] = I.p[0] + dx / d * m; P.p[2] = I.p[2] + dz / d * m; P.spd *= .96; } G.draw(I.name, I.m); }
    shipMat(P); G.draw('aegis', P.m, [1, 1, 1, P.fire > 6.5 ? 1 : 0]); G.ocean.wake(P.p[0], P.p[2], P.yaw, Math.abs(P.spd), P.len);
    for (const s of HP('aegis').stack) G.fx.trail(M4.point(P.m, s), [P.v[0] * .3, 3, P.v[2] * .3], 'stack', dt * (.3 + Math.abs(P.thr)));
    if (P.fire > 0) { P.fire -= dt; G.fx.trail(P.firePos || P.p, [0, 3, 0], 'fire', dt); }
    if (!P.dead) weapons(dt); else G.sfx.loop('ciws', 0);
    let inc = 1e9;
    for (const e of E) {
      if (!e.alive) continue;
      if (e.k === 'msl') { mslStep(e, dt); if (e.side && e.alive) inc = Math.min(inc, V3.dist(e.p, P.p)); }
      else if (e.k === 'jet') jetStep(e, dt);
      else if (e.k === 'shell') { if ((e.t -= dt) < 0) { e.alive = 0; const t = e.tgt; if (live(t)) e.hit ? damage(t, 9, [t.p[0] + rnd(-5, 5), t.p[1] + 6, t.p[2] + rnd(-5, 5)]) : boom([t.p[0] + rnd(-60, 60), 0, t.p[2] + rnd(-60, 60)], 'splash', .5); } }
      else shipStep(e, dt);
    }
    E = E.filter(e => e.alive);
    // 카메라
    cam.el = G.clamp(cam.el, .02, 1.45); cam.d = G.clamp(cam.d, 90, 5000); shake = Math.max(0, shake - dt * 1.6);
    const c = [P.p[0] + rnd(-1, 1) * shake * 5, 14 + rnd(-1, 1) * shake * 5, P.p[2]], o = dir(cam.az, cam.el);
    if (state === 'title') { c[0] -= o[2] * 150; c[2] += o[0] * 150; c[1] = 55; } // 타이틀: 함을 오른쪽 아래로
    G.cam.target = c; G.cam.pos = [c[0] + o[0] * cam.d, Math.max(c[1] + o[1] * cam.d, G.waveAt(c[0] + o[0] * cam.d, c[2] + o[2] * cam.d) + 3), c[2] + o[2] * cam.d];
    if (cam.free) { G.cam.pos = cam.free[0]; G.cam.target = cam.free[1]; } // 검증용 고정 시점
    G.shadowFocus = P.p;
    const warn = state === 'play' && inc < 4500;
    G.sfx.listener(G.cam.pos, V3.norm(V3.sub(c, G.cam.pos))); G.sfx.loop('siren', warn, { gain: .5 }); G.sfx.loop('missile', inc < 900, { gain: 1 - inc / 900 });
    G.sfx.loop('engine', state === 'play', { rate: Math.abs(P.thr), gain: .5 }); G.sfx.loop('sea', 1, { gain: .6 });
    if (state === 'play' && T % 2.86 < dt) G.sfx.play('ping', { gain: .35 });
    hud(dt, warn);
  }
  /* ── HUD: 캔버스(표식·레이더) + DOM 패널(0.2초마다) · 청록 = 아군 / 주황빨강 = 적 / 호박색 = 최우선만 / 흰색 = 선택 ── */
  const OWN = '#6ef', HOS = '#ff5a3c', AMB = '#fb3', lab = [];
  let fz;
  // 표식: 미사일 ◇ · 항공기 △ · 함정 ⬟ · 지상 □ · 본함 ➤
  const SH = { msl: [0, -1, 1, 0, 0, 1, -1, 0], jet: [0, -1, 1, .8, -1, .8], ship: [0, -1.1, 1, -.1, .7, .8, -.7, .8, -1, -.1], site: [-1, -1, 1, -1, 1, 1, -1, 1], own: [0, -1.3, .8, .9, 0, .4, -.8, .9] };
  const ink = (col, fill, w = 2) => { X.strokeStyle = '#000c'; X.lineWidth = fill ? 3 : w + 2.5; X.stroke(); X.strokeStyle = X.fillStyle = col; X.lineWidth = w; fill ? X.fill() : X.stroke(); };
  const ring = (x, y, r, col) => { X.beginPath(); X.arc(x, y, r, 0, 7); col && ink(col); };
  const mark = (k, sx, sy, r, fill) => { const s = SH[k]; X.beginPath(); for (let i = 0; i < s.length; i += 2) X.lineTo(sx + s[i] * r, sy + s[i + 1] * r); X.closePath(); ink(k === 'own' ? OWN : HOS, fill); };
  const font = px => X.font = `600 ${fz = px}px system-ui`, tw = s => X.measureText(s).width / 2 + fz * .4;
  // 글자 + 어두운 알약 (bg = 밝은 꼬리표)
  const txt = (s, x, y, col, bg) => { const w = tw(s); X.beginPath(); X.roundRect(x - w, y - fz, w * 2, fz * 1.36, 4); X.fillStyle = bg || '#012b'; X.fill(); X.fillStyle = bg ? '#012' : col; X.fillText(s, x, y); };
  // 겹치는 글자는 위(-1)·아래(1)로
  const slot = (x, y, w, s) => { for (let i = 0; i < lab.length; i += 3) if (Math.abs(lab[i] - x) < lab[i + 2] + w + 2 && Math.abs(lab[i + 1] - y) < fz * 1.4) { y = lab[i + 1] + s * fz * 1.5; i = -3; } lab.push(x, y, w); return y; };
  const put = (e, h) => { if (e.h !== h) e.innerHTML = e.h = h; }, bar = (w, c, o = 1) => `<div class="br" style="opacity:${o}"><i style="width:${w}%;color:${c}"></i></div>`;
  const pct = (e, h = e.hp) => Math.ceil(h / TYPES[e.model].hp * 100);
  const deg = a => ('00' + Math.round((a * R2D % 360 + 360) % 360) % 360).slice(-3), brg = e => deg(Math.atan2(P.p[0] - e.p[0], e.p[2] - P.p[2]));
  function hud(dt, warn) {
    const W = innerWidth, H = innerHeight, cv = X.canvas, on = state === 'play', o = ui.hit.style; if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    X.clearRect(0, 0, W, H); if (o.opacity > .01) o.opacity *= .94;
    if (ui.on !== on) ui.box.hidden = !(ui.on = on);
    if (!on) return;
    // 선택 표적 명중·격파 감지
    if (sel && sel === ui.s0 && (live(sel) ? sel.hp < ui.h0 : S.kills > ui.k0)) { ui.ft = T; ui.fe = sel; ui.fh = ui.h0; ui.fm = live(sel) ? '명중 −' + (pct(sel, ui.h0) - pct(sel)) + '%' : sel.name + ' 격파'; hudT = 1; }
    ui.s0 = sel; ui.h0 = sel && sel.hp; ui.k0 = S.kills;
    const tick = (hudT += dt) >= .2, fs = G.clamp(H * .019, 11.5, 16), f = dir(P.yaw), fr = G.frame, ht = T - ui.ft; if (tick) hudT = 0;
    font(fs); X.textAlign = 'center'; X.lineJoin = 'round';
    let nm = null, nd = 1e9, cnt = 0; lab.length = 0;
    for (const m of E) if (m.k === 'msl') { // 최근접 적 미사일 · 교전 표시
      if (m.side) { cnt++; const d = V3.dist(m.p, P.p); if (d < nd) { nd = d; nm = m; } } else if (live(m.tgt)) m.tgt.ef = fr;
    }
    for (const e of E) {
      if (e.k === 'shell' || !live(e)) continue;
      const gnd = !isAir(e), s = G.project([e.p[0], e.p[1] + (gnd ? 8 : 0), e.p[2]]), d = V3.dist(e.p, P.p), eng = e.ef === fr, top = e === nm, me = e === sel, col = top ? AMB : '#fdb';
      let sx = s[0], sy = s[1]; if (s[2] <= 0) { sx = W - sx; sy = H * 2; }
      if (!e.side) { ring(sx, sy, 3.5, OWN); continue; }
      if (tick || !e.lb) { e.lt = Math.ceil(d / Math.max(e.spd, 150)) + '초'; e.lb = (d / 1000).toFixed(1) + 'km' + (e.k === 'msl' ? ' ' + e.lt : ''); }
      const a = Math.atan2(sy - H / 2, sx - W / 2), x0 = sx, y0 = sy;
      e.bx = e.sx = sx = G.clamp(sx, 30, W - 30); e.sy = sy = G.clamp(sy, 56, H * .79);
      if (sx !== x0 || sy !== y0) { // 화면 밖
        X.beginPath(); for (let i = -1; i < 2; i++) X.lineTo(sx + Math.cos(a + i * 2.5) * 11, sy + Math.sin(a + i * 2.5) * 11); X.closePath(); ink(HOS, 1);
        txt(e.lb, sx - Math.cos(a) * (fs * 2 + 22), sy - Math.sin(a) * 26 + fs * .35, col); continue;
      }
      // ext = 화면상 선체 반길이 (큰 표적: 선택 = 괄호만 / 그 밖 = 표식을 선체 위로)
      const mx = gnd && TYPES[e.model].hp, ext = gnd ? G.modelData[e.model].radius * H * 1.07 / s[2] : 0, r0 = me ? 12 : 9, r = r0 + (top ? 3 + Math.sin(T * 10) * 2 : 0), q = Math.max(r0 + 11, ext), qh = Math.max(r0 + 11, ext * .4),
        up = G.clamp(ext / 8 - 1, 0, 1), ic = !me || up < 1, iy = me ? sy : Math.max(70, sy - up * (ext * .4 + r + fs + 22)), pu = T * 1.5 % 1, g = Math.min(q, 30) * 1.2;
      e.bx = sx + q;
      if (ic) mark(e.k, sx, iy, r);
      if (top) { X.globalAlpha = 1 - pu; ring(sx, iy, r + 5 + pu * 12, AMB); X.globalAlpha = 1; }
      if (eng && ic) { X.setLineDash([3, 7]); X.lineDashOffset = -T * 30; ring(sx, iy, r + 5, OWN); X.setLineDash([]); }
      if (me) { X.setLineDash([g, q * 2 - g, g, qh * 2 - g]); X.lineDashOffset = g / 2; X.beginPath(); X.rect(sx - q, sy - qh, q * 2, qh * 2); ink(e === ui.fe && ht < .5 ? HOS : '#fff', 0, 3); X.setLineDash([]); }
      let px = sx, w = 34, ly;
      if (me || top) { // 꼬리표 한 줄 (공중: 위 / 수상·지상: 괄호 왼쪽 아래)
        const tg = (top ? '최우선' : '') + (me ? (top ? ' · ' : '') + '선택' : ' [Q]'), n = (me ? e.name + ' ' : '') + e.lb, w1 = tw(tg), w2 = tw(n);
        w = w1 + w2; px -= Math.max(0, q - w); ly = slot(px, gnd ? Math.min(sy + qh + fs + 7, H * .83) : sy - qh - 9, w, gnd ? 1 : -1);
        txt(tg, px - w2, ly, 0, top ? AMB : '#fff'); txt(n, px + w1, ly, me ? '#fff' : col);
      } else { const l = e.k === 'msl' ? e.lt : e.lb; ly = slot(sx, iy + r + fs + 5, tw(l), 1); txt(l, sx, ly, col); }
      if (mx && (me || e.hp < mx)) { // 선체 막대 (흰색 = 방금 깎인 양)
        const x = px - w + 1, y = ly + fs * .36 + 2, k = (w * 2 - 2) / mx;
        X.fillStyle = '#000d'; X.fillRect(x - 1, y - 1, w * 2, 8);
        if (e === ui.fe) { X.fillStyle = '#fff'; X.fillRect(x, y, k * (e.hp + (ui.fh - e.hp) * G.clamp(2 - ht, 0, 1)), 6); }
        X.fillStyle = HOS; X.fillRect(x, y, k * e.hp, 6);
      }
    }
    if (ht < 2.6) { // 명중 표시 (괄호 오른쪽)
      const e = ui.fe, t = '✦ ' + ui.fm; font(fs * 1.3); X.globalAlpha = Math.min(1, (2.6 - ht) * 2);
      txt(t, Math.min(e.bx + 12 + tw(t), W - tw(t) - 8), e.sy + 5 - Math.min(ht, 1) * 18, '#fff'); X.strokeStyle = HOS; X.lineWidth = 1.5; X.stroke(); X.globalAlpha = 1;
    }
    // 레이더: 함수가 위 · 고리 1.5(CIWS)/4/8km (반지름 ∝ √거리) · 부채꼴 = 시야
    const R = G.clamp(H * .15, 84, 140), cx = R + 14, cy = H - R - 14;
    let bx, by; const at = p => { const dx = p[0] - P.p[0], dz = p[2] - P.p[2], u = (dz * f[0] - dx * f[2]) / 8000, v = (dx * f[0] + dz * f[2]) / 8000, l = Math.hypot(u, v) + 1e-9, k = R / Math.sqrt(Math.max(l, l * l)); bx = cx + u * k; by = cy - v * k; return l < 1; };
    font(Math.max(11, fs * .8)); ring(cx, cy, R); X.fillStyle = '#011a'; X.fill(); ink('#8dfa'); X.save(); X.clip();
    const va = 1.57 + P.yaw - cam.az; X.beginPath(); X.moveTo(cx, cy); X.arc(cx, cy, R, va - .7, va + .7); X.fillStyle = '#8df3'; X.fill();
    for (const I of S.isl) if (at(I.p)) {
      const r = Math.max(7, I.r / 8000 * R); X.beginPath(); X.ellipse(I.lx = bx, by, r * 1.25, r * .8, .5, 0, 7); X.fillStyle = '#586'; X.fill(); X.strokeStyle = X.fillStyle = '#ad9'; X.lineWidth = 1; X.stroke(); X.fillText('섬', bx, I.ly = by + r + fz);
    }
    X.restore(); X.lineWidth = 1; X.strokeStyle = '#8df5'; ring(cx, cy, R * .707); X.moveTo(cx - R, cy); X.lineTo(cx + R, cy); X.moveTo(cx, cy - R); X.lineTo(cx, cy + R); X.stroke();
    X.setLineDash([3, 4]); ring(cx, cy, R * .433); X.stroke(); X.setLineDash([]);
    const rl = (s, k, j = k) => txt(s, cx + R * j, cy + R * k + 4, '#bdf'); rl('CIWS', .3, -.31); rl('4', .5); rl('8 km', .86, .3);
    txt('N', cx + Math.sin(P.yaw) * (R - 9), cy - Math.cos(P.yaw) * (R - 9) + 4, '#fff');
    lab.length = 0; // 겹친 같은 종류는 한 표식 + ×n (lab: x합, y합, 수, 종류, 선택)
    for (const e of E) if (e.k !== 'shell' && live(e)) {
      at(e.p); if (!e.side) { ring(bx, by, 1.5, OWN); continue; }
      let i = 0; while (i < lab.length && (lab[i + 3] !== e.k || Math.hypot(lab[i] / lab[i + 2] - bx, lab[i + 1] / lab[i + 2] - by) > 5)) i += 5;
      if (i === lab.length) lab.push(0, 0, 0, e.k, 0);
      lab[i] += bx; lab[i + 1] += by; lab[i + 2]++; if (e === sel) lab[i + 4] = 2;
    }
    for (let i = 0; i < lab.length; i += 5) { const n = lab[i + 2], x = lab[i] / n, y = lab[i + 1] / n; mark(lab[i + 3], x, y, 4.5 + lab[i + 4], 1); if (n > 1) txt('×' + n, x + (S.isl.some(I => Math.hypot(I.lx - x - 18, I.ly - y) < 22) ? -18 : 18), y + 4, 0, '#fff'); }
    mark('own', cx, cy, 7, 1);
    if (!tick) return;
    const hp = Math.max(0, P.hp | 0), ok = live(sel), sa = ok && isAir(sel), mx = ok && !sa, eh = mx && pct(sel), pr = S.i / G.SCENARIO.steps.length * 100 | 0, wp = sa ? 'SAM' : 'SSM',
      // a1 = Space 가 선택 표적에 하는 일 · a2 = Q 안내 (경보 밑 · 표적 카드 공통)
      a1 = !ok ? '없음' : sel.ef === fr ? `◎ 선택 표적 ${sa ? '요격' : '교전'} 중 — ${wp} 비행 중` : `<kbd>Space</kbd> 선택 표적에 ${wp} 발사`, a2 = nm && nm !== sel ? '<em><kbd>Q</kbd> 최우선으로 전환</em>' : '',
      inf = e => `<b>${e.lb.replace(' ', '</b> · 충돌 <b>')}</b> · 방위 <b>${brg(e)}</b>°`;
    put(ui.warn, warn && nm ? `⚠ 대함미사일 <b>${cnt}</b>발 접근 · ${inf(nm)}<s>${a1}${a2 && ' · ' + a2}</s>` : '');
    put(ui.obj, `<div class="rw"><label>임무</label><s><kbd>H</kbd> 도움말</s></div><h4>${S.obj}</h4><div class="rw"><span>격파 <b>${S.kills}</b> · 잔여 위협 <b>${E.filter(e => e.side && live(e)).length}</b></span><label>작전 진행 ${pr}%</label></div>${bar(pr)}`
      + log.filter(l => T - l[2] < 14).map(l => `<div style="opacity:${Math.min(1, (14 - T + l[2]) / 3).toFixed(1)}"><i>${l[0]}</i> ${l[1]}</div>`).join(''));
    put(ui.st.firstChild, `<label>선체</label> <b>${hp}</b>%${bar(hp, hp > 50 ? '#8f9' : hp > 25 ? '#fa6' : '#f65')}<div class="rw"><span><label>속력</label> <b>${(Math.abs(P.spd) * 1.94).toFixed(0)}</b>kn</span><span><label>침로</label> <b>${deg(-P.yaw)}</b>°</span><span><label>추력</label> <b>${(P.thr * 100).toFixed(0)}</b>%</span></div>`);
    [P.sam, P.ssm, P.gun].forEach((a, i) => { // 무장 카드: on 발사 가능 · rl 재장전 · no 지금 표적에 못 씀
      const w = ui.st.children[i + 1], fit = ok && !i == sa, use = a && fit && (i < 2 || V3.dist(sel.p, P.p) < 7000), rl = use && P.cd[i] > 0;
      put(w.children[1], `<kbd>${i > 1 ? 'F' : 'Space'}</kbd>${a}<small>발</small>`); put(w.children[2], !a ? '<i style="color:#f65">소진</i>' : !use ? fit ? '사거리 밖' : (i ? '수상' : '공중') + ' 표적용' : rl ? '장전 ' + P.cd[i].toFixed(1) + '초' : '발사 가능');
      w.lastChild.firstChild.style.width = G.clamp(1 - P.cd[i] / [.9, 3.5, 1.1][i], 0, 1) * 100 + '%'; w.className = 'w ' + (!use ? 'no' : rl ? 'rl' : 'on'); });
    put(ui.tg, '<label>표적 <kbd>Tab</kbd></label><br>' + (ok ? `<b style="color:${HOS}">${sel.name}</b>${mx ? ` 선체 <b>${eh}</b>%` : ''}${bar(eh, HOS, mx ? 1 : 0)}${inf(sel)}<br>` : '')
      + `<span>${a1}</span>` + (mx || a2 ? '<br>' + (mx ? '<kbd>F</kbd> 함포' + (a2 && ' · ') : '') + a2 : ''));
  }
  function over(text, col) { G.canvas.className = 'bl'; ui.ov.className = ''; ui.ov.style.display = ''; ui.ov.innerHTML = `<div><h1 style="color:${col}">${text}</h1><h2>격파 ${S.kills} · 선체 ${Math.max(0, P.hp | 0)}%</h2><button>다시 출격</button><kbd>Enter</kbd></div>`; G.sfx.loop('siren', 0); }
  function start() { reset(); state = 'play'; paused = 0; ui.ft = -9; ui.ov.style.display = 'none'; G.canvas.className = ''; G.sfx.init(); G.sfx.music('calm'); }
  G.game = { start, spawn, fireMsl, boom, kill, damage, cam, get P() { return P; }, get E() { return E; }, get S() { return S; }, sel: t => sel = t }; // 검증·디버그용

  G.register('game', {
    init() {
      G.css(`#c{transition:filter .9s,transform .9s}#c.bl{filter:blur(7px) brightness(.62);transform:scale(1.04)}#hud,#hit,#ov{position:absolute;inset:0}#hud{width:100%;height:100%}#hit{box-shadow:inset 0 0 160px 40px #f20a;opacity:0}
.pn{position:absolute;padding:.6em .85em;background:#012e;border:1px solid #48b5;border-radius:8px;font-size:clamp(12.5px,1.75vh,17px);color:#cef}
.pn b{color:#fff;font:700 1.2em ui-monospace,monospace}.pn label,.kg h3,small{margin:0;font:400 max(12px,.82em) system-ui;letter-spacing:.05em;color:#ace}.pn i,em{font-style:normal;color:#6ef}.pn span{color:#fff}s{text-decoration:none}.pn em{color:#fb3}
kbd{margin:0 .15em;padding:0 .45em;border:1px solid #48a;border-radius:4px;background:#123;color:#eff;font:600 max(11.5px,.85em) ui-monospace,monospace;letter-spacing:0}
#obj{left:12px;top:12px;width:min(29vw,27em);border-left:3px solid #8df}#obj h4{margin:0;font-size:1.12em;color:#fff;word-break:keep-all}#obj div{margin-top:.3em;font-size:.88em}
#st,#warn,#warn s,#help{left:50%;transform:translateX(-50%);white-space:nowrap}#st{left:49%;bottom:12px;display:flex;gap:.5em}.rw{display:flex;gap:.6em;justify-content:space-between;align-items:baseline}
.br{height:.4em;margin:.3em 0;border-radius:3px;background:#fff2}.br i{display:block;height:100%;background:currentColor;transition:width .2s linear}
.w{width:6.8em;padding:.15em .4em 0;border:1px solid #48b4;border-radius:6px;background:#0a1622;font-size:max(12.5px,.95em);text-align:center}.w b{display:block}.w span{color:#bdf}
.on{border-color:#8df;background:#146}.on span{font-weight:700;color:#fff}.rl{border-color:#8dfa}.no .br,.rl kbd,.no kbd{opacity:.45}@media(max-width:1100px){.w{width:5.6em}.w kbd,.w:last-child{display:none}#st{left:47%}}
#tg{right:12px;bottom:12px;min-width:15em}#warn s{color:#fff;font-weight:700}
#warn{left:max(50%,29vw + 14em + 60px);top:12px;padding:.1em 1.2em;border:2px solid #f54;border-radius:2em;background:#500e;font-size:clamp(13px,2vh,20px);animation:pu .6s infinite alternate}#warn:empty{display:none}#warn b:nth-child(3){font:800 1.4em ui-monospace,monospace}@keyframes pu{to{box-shadow:0 0 20px 3px #f54}}
#warn s{position:absolute;top:100%;margin-top:7px;padding:0 1em;border:1px solid;border-radius:2em;background:#012e;font-size:max(12.5px,.85em)}
#help{top:24%}.kg{display:grid;grid-template-columns:auto auto;gap:.45em 2.2em}.kg i{display:inline-block;min-width:4.6em;margin-right:.5em}.kg h3{padding-bottom:.2em;border-bottom:1px solid #48b7;color:#def}
#ov{display:grid;place-items:center;text-align:center;background:radial-gradient(#0123 30%,#001c);pointer-events:auto;font-size:clamp(14px,1.45vw,21px)}#ov.t{place-items:center start;padding-left:7vw;text-align:left;background:radial-gradient(85% 130% at 0 55%,#001e 35%,#0000)}
#ov h1{margin:0;font:900 3.9em/1.04 system-ui;letter-spacing:.06em;color:#fff;text-shadow:0 4px 18px #000c}#ov h1 b{color:#6cf}
#ov h2{margin:.5em 0 .9em;font-size:1em;font-weight:400;letter-spacing:.14em;color:#9ce}#ov p{margin:0 0 1.5em;max-width:32em;color:#fff;word-break:keep-all}
#ov button{margin-right:.6em;padding:.5em 2.7em .5em 3em;border:0;border-radius:8px;background:#5cf;box-shadow:0 0 30px #4bf9;color:#012;font:900 1.5em system-ui;letter-spacing:.3em;cursor:pointer}#ov button:hover{background:#aef}
#ov .pn{position:static;display:table;margin-top:1.8em;font-size:max(12.5px,.8em)}#ov small{position:absolute;left:7vw;bottom:14px}`);
      X = G.el('canvas', { id: 'hud' }).getContext('2d'); ui.hit = G.el('div', { id: 'hit' });
      ui.box = G.el('div'); for (const k of ['obj', 'st', 'tg', 'warn', 'help']) ui[k] = G.el('div', { id: k, className: 'pn' }, ui.box);
      ui.st.innerHTML = '<div style="min-width:10em"></div>' + ['대공 SAM', '대함 SSM', '함포', 'CIWS'].map((n, i) => `<div class="w"><label>${n}</label><b>자동</b><span>1.5km 방어</span>${i > 2 ? '' : '<div class="br"><i></i></div>'}</div>`).join('');
      const KEYS = '<div class="kg"><h3>기동</h3><h3>교전</h3>' + 'W S|추력|Tab|다음 표적|A D|조타|Q|최우선 위협 선택|드래그|시점|Space|미사일 — 공중 SAM · 수상 SSM|휠|줌|F|함포 — 수상·지상 표적|P|일시정지|H|도움말|'
        .replace(/(.+?)\|(.+?)\|/g, (m, k, t) => `<span><i>${k.replace(/\w+/g, '<kbd>$&</kbd>')}</i>${t}</span>`) + '</div>';
      ui.help.hidden = 1; ui.help.innerHTML = KEYS + '<br>' + 'M 음소거 F2 그래픽'.replace(/\w+/g, '<kbd>$&</kbd>');
      ui.ov = G.el('div', { id: 'ov', className: 't' });
      ui.ov.innerHTML = `<div><h1>SECOND<br><b>KOREAN WARS</b></h1><h2>해상 반격 — ${G.SCENARIO.title}</h2><p>날아오는 대함미사일을 요격하고 적 함대와 해안포대를 격파하라.</p><button>출 격</button><kbd>Enter</kbd><div class="pn">${KEYS}</div><small></small></div>`; ui.q = ui.ov.lastChild.lastChild;
      ui.ov.onclick = e => { if (e.target.tagName === 'BUTTON') start(); };
      addEventListener('keydown', e => {
        if (state !== 'play') { if (e.code === 'Enter') start(); return; }
        if (e.code === 'Tab' || e.code === 'KeyE') pick(1); if (e.code === 'KeyQ') pick(0);
        if (e.code === 'KeyP' || e.code === 'Escape') paused ^= 1; if (e.code === 'KeyM') G.sfx.volume((muted ^= 1) ? 0 : 1); if (e.code === 'KeyH') ui.help.hidden ^= 1;
      });
      let drag = 0, mv = 0;
      addEventListener('pointerdown', e => { if (e.target.tagName === 'CANVAS') { drag = 1; mv = 0; } });
      addEventListener('pointermove', e => { if (drag) { cam.az -= e.movementX * .005; cam.el += e.movementY * .004; mv += Math.abs(e.movementX) + Math.abs(e.movementY); } });
      addEventListener('pointerup', e => { // 클릭 = 표적 선택
        if (drag && mv < 6 && state === 'play') { let b = null, bd = 40; for (const t of E) if (t.side && live(t)) { const d = Math.hypot(t.sx - e.clientX, t.sy - e.clientY); if (d < bd) { bd = d; b = t; } } if (b) { sel = b; G.sfx.play('lock'); } }
        drag = 0; });
      addEventListener('wheel', e => { cam.d *= Math.exp(e.deltaY * .0012); }, { passive: true });
      if (G.params.has('nohud')) G.ui.style.display = 'none'; // 검증용
      reset(); if (G.params.has('autostart')) start();
    },
    onQuality(Q) { ui.q.innerHTML = `<kbd>F2</kbd> 그래픽 설정 · ${G.qManual ? '수동' : '자동 감지'}: ${Q.name}`; },
    update
  }, 'naval');
}
