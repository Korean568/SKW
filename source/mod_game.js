'use strict';
{ /* ═══ GAME — 플레이어 함 · 무장 · 적 AI · 시나리오 실행기 · HUD ═══
  시나리오 (위→아래 실행 · 실제 시나리오가 정해지면 이 표만 교체):
   ['msg', 화자, 대사] ['obj', 목표] ['wait', 초] ['env', {G.setEnv 값}] ['music', 'calm'|'combat'|'off'] ['island', 메시, x, z, yaw] ['win', 문구]
   ['spawn', 종류, {n, brg, dist, spread, isl}] 종류: ssm·jet·boat·frigate·battery / brg = 함수 기준 시계방향(도) / isl = 섬 번호
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
  function boom(p, kind, size = 1) { // 폭발 묶음: 파티클 + 조명 + 소리 + 물결 + 화면 섬광
    G.fx.burst(kind, p, { size });
    const d = V3.dist(p, G.cam.pos), near = G.clamp(1 - d / 1500, 0, 1) * size;
    if (kind === 'splash') { G.ocean.ripple(p[0], p[2], 30 * size); G.sfx.play('splash', { pos: p, gain: size }); return; }
    G.addLight(p, kind === 'flash' ? [1, .9, .7] : [1, .55, .25], 45 * size, 600 * size, .45);
    G.sfx.play(kind === 'flash' ? 'intercept' : 'explosion', { pos: p, gain: size });
    if (p[1] < 25) G.ocean.ripple(p[0], p[2], 40 * size);
    if (near > .05) { G.post && G.post.flash(near * .6); shake = Math.max(shake, near * .8); }
  }
  function shipMat(e) { // 파도 위에 얹기: 높이 + 기울기 (+ 침몰 자세)
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
    if (k.Space && air && inb(sel)) { // 교전 중이면 미교전 공중 위협으로 자동 전환 (Space 유지 = 연속 교전)
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
    // CIWS: 1.5km 안의 공중 위협 자동 교전
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
      while (c.t > .04) { c.t -= .04; G.fx.tracer(mz, dir(c.yaw + P.yaw + rnd(-.012, .012), c.pit + rnd(-.012, .012)), 1100); }
      if (Math.random() < dt * .13 * (1 - bd / 1600)) kill(best); else if (Math.random() < dt * 2) G.fx.burst('hit', best.p, { size: .4 });
    });
    G.sfx.loop('ciws', firing, { gain: .8 });
  }
  function pick(next) { // 표적 선택: next=1 다음 표적, 0 가장 위협적인 표적
    const H = E.filter(e => e.side && live(e)).map(e => [V3.dist(e.p, P.p) * (e.k === 'msl' ? .3 : 1), e]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
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
    // 본함 운동
    if (!P.dead) { P.spd += (P.thr * 17 - P.spd) * dt * .22; P.yaw += (P.rud || 0) * dt * .11 * G.clamp(P.spd / 9, -.6, 1.3); P.heel = G.lerp(P.heel || 0, -(P.rud || 0) * P.spd * .006, dt); }
    else { P.dead += dt; P.spd *= 1 - dt * .5; P.tip = 1; G.fx.trail(M4.point(P.m, [0, 10, 0]), [0, 4, 0], 'fire', dt); }
    P.v = V3.mul(dir(P.yaw), P.spd); P.p[0] += P.v[0] * dt; P.p[2] += P.v[2] * dt;
    for (const I of S.isl) { const dx = P.p[0] - I.p[0], dz = P.p[2] - I.p[2], d = Math.hypot(dx, dz), m = I.r * .9; if (d < m) { P.p[0] = I.p[0] + dx / d * m; P.p[2] = I.p[2] + dz / d * m; P.spd *= .96; } G.draw(I.name, I.m); }
    shipMat(P); G.draw('aegis', P.m, [1, 1, 1, P.fire > 6.5 ? 1 : 0]); G.ocean.wake(P.p[0], P.p[2], P.yaw, Math.abs(P.spd), P.len);
    for (const s of HP('aegis').stack) G.fx.trail(M4.point(P.m, s), [P.v[0] * .3, 3, P.v[2] * .3], 'stack', dt * (.3 + Math.abs(P.thr)));
    if (P.fire > 0) { P.fire -= dt; G.fx.trail(P.firePos || P.p, [0, 3, 0], 'fire', dt); }
    if (!P.dead) weapons(dt); else G.sfx.loop('ciws', 0);
    // 적·발사체
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
    // 소리
    const warn = state === 'play' && inc < 4500;
    G.sfx.listener(G.cam.pos, V3.norm(V3.sub(c, G.cam.pos))); G.sfx.loop('siren', warn, { gain: .5 }); G.sfx.loop('missile', inc < 900, { gain: 1 - inc / 900 });
    G.sfx.loop('engine', state === 'play', { rate: Math.abs(P.thr), gain: .5 }); G.sfx.loop('sea', 1, { gain: .6 });
    if (state === 'play' && T % 2.86 < dt) G.sfx.play('ping', { gain: .35 });
    hud(dt, warn);
  }
  /* ── HUD: 2D 캔버스(표식·레이더) + DOM 패널(0.2초마다) ──
     색: 청록 = 아군·HUD / 주황빨강 = 적(종류는 모양) / 호박색 = 최우선 위협 / 흰색 = 선택·교전 중 */
  const OWN = '#6ef', HOS = '#ff5a3c', WARM = '#fdb', AMB = '#fb3', lab = [];
  // 표식: 미사일 ◇ · 항공기 △ · 함정 ⬟ · 지상 □ · 아군 ➤
  const SH = { msl: [0, -1, 1, 0, 0, 1, -1, 0], jet: [0, -1, 1, .8, -1, .8], ship: [0, -1.1, 1, -.1, .7, .8, -.7, .8, -1, -.1], site: [-1, -1, 1, -1, 1, 1, -1, 1], own: [0, -1.3, .8, .9, 0, .4, -.8, .9] };
  const ink = (col, fill) => { X.strokeStyle = '#000c'; X.lineWidth = fill ? 3 : 4.5; X.stroke(); X.strokeStyle = X.fillStyle = col; X.lineWidth = 2; fill ? X.fill() : X.stroke(); }; // 어두운 테두리 + 색
  const mark = (k, sx, sy, r, fill) => { const s = SH[k]; X.beginPath(); for (let i = 0; i < s.length; i += 2) X.lineTo(sx + s[i] * r, sy + s[i + 1] * r); X.closePath(); ink(k === 'own' ? OWN : HOS, fill); };
  const txt = (s, sx, sy, col) => { X.strokeStyle = '#000d'; X.lineWidth = 3.5; X.strokeText(s, sx, sy); X.fillStyle = col; X.fillText(s, sx, sy); };
  const put = (e, h) => { if (e.h !== h) e.innerHTML = e.h = h; };
  const deg = a => ('00' + Math.round((a * R2D % 360 + 360) % 360) % 360).slice(-3), brg = e => deg(Math.atan2(P.p[0] - e.p[0], e.p[2] - P.p[2]));
  function hud(dt, warn) {
    const W = innerWidth, H = innerHeight, cv = X.canvas, on = state === 'play', o = ui.hit.style; if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    X.clearRect(0, 0, W, H); if (o.opacity > .01) o.opacity *= .94;
    if (ui.on !== on) ui.box.hidden = !(ui.on = on);
    if (!on) return;
    // 선택 표적 명중·격파 알림 — 기존 상태(hp · S.kills)만 읽음
    if (sel && sel === ui.s0 && (live(sel) ? sel.hp < ui.h0 : S.kills > ui.k0)) { ui.ft = T; ui.fx = sel.sx; ui.fy = sel.sy; ui.fm = live(sel) ? '명중 −' + (ui.h0 - sel.hp) : sel.name + ' 격파'; hudT = 1; }
    ui.s0 = sel; ui.h0 = sel && sel.hp; ui.k0 = S.kills;
    const tick = (hudT += dt) >= .2, fs = G.clamp(H * .019, 11, 16), f = dir(P.yaw), fr = G.frame; if (tick) hudT = 0;
    X.font = `600 ${fs}px system-ui`; X.textAlign = 'center'; X.lineJoin = 'round';
    let nm = null, nd = 1e9, cnt = 0; lab.length = 0;
    for (const m of E) if (m.k === 'msl') { // 최근접 적 미사일 · 교전 중인 표적
      if (m.side) { cnt++; const d = V3.dist(m.p, P.p); if (d < nd) { nd = d; nm = m; } } else if (live(m.tgt)) m.tgt.ef = fr;
    }
    for (const e of E) {
      if (e.k === 'shell' || !live(e)) continue;
      const gnd = !isAir(e), s = G.project([e.p[0], e.p[1] + (gnd ? 8 : 0), e.p[2]]), d = V3.dist(e.p, P.p), eng = e.ef === fr, top = e === nm, col = top ? AMB : WARM;
      let sx = s[0], sy = s[1]; if (s[2] <= 0) { sx = W - sx; sy = H * 2; }
      if (!e.side) { mark('own', sx, sy, 5, 1); continue; }
      if (tick || !e.lb) e.lb = (d / 1000).toFixed(1) + 'km' + (e.k === 'msl' ? ' ' + Math.ceil(d / Math.max(e.spd, 150)) + '초' : ''); // 적 미사일마다 충돌까지 남은 시간
      const a = Math.atan2(sy - H / 2, sx - W / 2), off = sx < 30 || sx > W - 30 || sy < 56 || sy > H * .79;
      e.sx = sx = G.clamp(sx, 30, W - 30); e.sy = sy = G.clamp(sy, 56, H * .79);
      if (off) { // 화면 밖: 화살표 + 거리
        X.beginPath(); for (let i = -1; i < 2; i++) X.lineTo(sx + Math.cos(a + i * 2.5) * 11, sy + Math.sin(a + i * 2.5) * 11); X.closePath(); ink(HOS, 1);
        txt(e.lb, sx - Math.cos(a) * (fs * 2 + 14), sy - Math.sin(a) * 24 + fs * .35, col); continue;
      }
      // ext = 화면상 선체 반길이(px). 큰 표적은 표식을 선체 위로 올리고 괄호를 선체 크기에 맞춤 (표적을 가리지 않게)
      const ext = gnd ? G.modelData[e.model].radius * H * 1.07 / s[2] : 0, r = (e === sel ? 12 : 9) + (top ? 3 + Math.sin(T * 10) * 2 : 0), q = Math.max(r + 8, ext), qh = Math.max(r + 8, ext * .4),
        up = G.clamp(ext / 8 - 1, 0, 1), iy = Math.max(70, sy - up * (ext * .4 + r + fs + 22)), pu = T * 1.5 % 1;
      let ly = iy + r + fs + (e === sel ? 12 - up * 8 : 4);
      mark(e.k, sx, iy, r);
      if (top) { X.globalAlpha = 1 - pu; X.beginPath(); X.arc(sx, iy, r + 5 + pu * 12, 0, 7); ink(AMB); X.globalAlpha = 1; } // 최우선 위협: 퍼지는 호박색 고리
      if (eng) { X.setLineDash([3, 7]); X.lineDashOffset = -T * 30; X.beginPath(); X.arc(sx, iy, r + 5, 0, 7); ink('#fff'); X.setLineDash([]); } // 아군 미사일 추적 중: 흰 회전 눈금
      if (e === sel) { // 선택: 모서리 괄호 + 이름
        X.setLineDash([14, q * 2 - 14, 14, qh * 2 - 14]); X.lineDashOffset = 7; X.beginPath(); X.rect(sx - q, sy - qh, q * 2, qh * 2); ink('#fff'); X.setLineDash([]);
        txt(e.name + (eng ? ' · 교전 중' : ''), sx, iy - r - 15, '#fff');
      }
      for (let i = 0; i < lab.length; i += 2) if (Math.abs(lab[i] - sx) < fs * 4 && Math.abs(lab[i + 1] - ly) < fs + 1) { ly = lab[i + 1] + fs + 2; i = -2; } // 겹치면 아래로
      lab.push(sx, ly); txt(e.lb, sx, ly, col);
      if (gnd && (e === sel || e.hp < TYPES[e.model].hp)) { X.fillStyle = '#000b'; X.fillRect(sx - 21, ly + 4, 42, 5); X.fillStyle = HOS; X.fillRect(sx - 20, ly + 5, 40 * e.hp / TYPES[e.model].hp, 3); } // 적 선체 막대
    }
    X.textAlign = 'left';
    if (T - ui.ft < 1.5) { X.globalAlpha = Math.min(1, (ui.ft + 1.5 - T) * 3); txt('✦ ' + ui.fm, ui.fx + 30, ui.fy - (T - ui.ft) * 16, AMB); X.globalAlpha = 1; }
    // 레이더: 함수가 위 · 8km(그 밖은 테두리에) · 고리 = CIWS 1.5km(점선)/4/8km · 쐐기 = 카메라 방향 · N
    const R = G.clamp(H * .15, 84, 140), cx = R + 14, cy = H - R - 14, cd = V3.sub(G.cam.target, G.cam.pos), ca = Math.atan2(-cd[0] * f[0] - cd[2] * f[2], cd[2] * f[0] - cd[0] * f[2]);
    let bx, by; const at = p => { const dx = p[0] - P.p[0], dz = p[2] - P.p[2], u = (dz * f[0] - dx * f[2]) / 8000, v = (dx * f[0] + dz * f[2]) / 8000, l = Math.max(1, Math.hypot(u, v)); bx = cx + u / l * R; by = cy - v / l * R; return l; };
    X.beginPath(); X.arc(cx, cy, R, 0, 7); X.fillStyle = '#011a'; X.fill(); ink('#8dfa'); X.save(); X.clip();
    X.beginPath(); X.moveTo(cx, cy); X.arc(cx, cy, R, ca - .45, ca + .45); X.fillStyle = '#8df2'; X.fill();
    for (const I of S.isl) if (at(I.p) === 1) { X.beginPath(); X.arc(bx, by, I.r / 8000 * R, 0, 7); X.fillStyle = '#9ab7'; X.fill(); } // 섬 = 축척에 맞춘 흐린 땅
    X.restore(); X.lineWidth = 1; X.strokeStyle = '#8df5'; X.beginPath(); X.arc(cx, cy, R / 2, 0, 7); X.moveTo(cx - R, cy); X.lineTo(cx + R, cy); X.moveTo(cx, cy - R); X.lineTo(cx, cy + R); X.stroke();
    X.setLineDash([3, 4]); X.beginPath(); X.arc(cx, cy, R * .1875, 0, 7); X.stroke(); X.setLineDash([]);
    X.font = `600 ${Math.max(11, fs * .8)}px system-ui`; ['CIWS', 4, '8km'].forEach((k, i) => txt(k, cx + 4, cy + R * [.31, .5, 1][i] - 4, '#bdf')); X.textAlign = 'center';
    txt('N', cx + Math.sin(P.yaw) * (R - 9), cy - Math.cos(P.yaw) * (R - 9) + 4, '#fff');
    lab.length = 0; // 겹친 적 표식은 하나로 묶고 ×n
    for (const e of E) if (e.k !== 'shell' && live(e)) {
      at(e.p); let i = 0;
      if (e.side) { while (i < lab.length && Math.abs(lab[i] - bx) + Math.abs(lab[i + 1] - by) > 8) i += 3; if (i < lab.length) { lab[i + 2]++; continue; } lab.push(bx, by, 1); }
      mark(e.side ? e.k : 'own', bx, by, e.side ? e === sel ? 6.5 : 4.5 : 2.5, 1);
    }
    for (let i = 0; i < lab.length; i += 3) if (lab[i + 2] > 1) txt('×' + lab[i + 2], lab[i] + 13, lab[i + 1] + 4, WARM);
    mark('own', cx, cy, 6, 1);
    if (!tick) return;
    const hp = Math.max(0, P.hp | 0), ok = live(sel), sa = ok && isAir(sel), mx = ok && !sa && TYPES[sel.model].hp, eh = mx && Math.ceil(sel.hp / mx * 100), pr = S.i / G.SCENARIO.steps.length * 100 | 0;
    put(ui.warn, warn && nm ? `⚠ 대함미사일 <b>${cnt}</b>발 접근 · 방위 <b>${brg(nm)}</b>° <b>${nm.lb.replace(' ', '</b> · 충돌 <u>')}</u>` : '');
    put(ui.obj, `<label>임무</label><h4>${S.obj}</h4><div class="rw"><span>격파 <b>${S.kills}</b> · 잔여 위협 <b>${E.filter(e => e.side && live(e)).length}</b></span><label>작전 진행 ${pr}%</label></div><div class="br"><i style="width:${pr}%"></i></div>`
      + log.filter(l => T - l[2] < 14).map(l => `<div style="opacity:${Math.min(1, (14 - T + l[2]) / 3).toFixed(1)}"><i>${l[0]}</i> ${l[1]}</div>`).join('') + '<s><kbd>H</kbd> 도움말</s>');
    put(ui.st.firstChild, `<label>선체</label> <b>${hp}</b>%<div class="br"><i style="width:${hp}%;color:${hp > 50 ? '#8f9' : hp > 25 ? '#fd6' : '#f65'}"></i></div><div class="rw"><span><label>속력</label> <b>${(Math.abs(P.spd) * 1.94).toFixed(0)}</b>kn</span><span><label>침로</label> <b>${deg(-P.yaw)}</b>°</span><span><label>추력</label> <b>${(P.thr * 100).toFixed(0)}</b>%</span></div>`);
    [P.sam, P.ssm, P.gun].forEach((a, i) => { // 무장: 잔탄 · 상태 · 재장전 막대. 강조 = 지금 표적에 쓸 수 있는 무장(키 표시), 나머지는 흐리게
      const w = ui.st.children[i + 1], use = a && ok && !i == sa && (i < 2 || V3.dist(sel.p, P.p) < 7000);
      put(w.children[1], a + '<small>발</small>'); put(w.children[2], !a ? '소진' : !use ? ok && !i == sa ? '사거리 밖' : (i ? '수상' : '공중') + ' 표적용' : P.cd[i] > 0 ? '재장전' : `<kbd>${i > 1 ? 'F' : 'Space'}</kbd> 발사`);
      w.lastChild.firstChild.style.width = G.clamp(1 - P.cd[i] / [.9, 3.5, 1.1][i], 0, 1) * 100 + '%'; w.className = use ? 'w on' : 'w no'; });
    put(ui.tg, (T - ui.ft < 3 ? `<u>✦ ${ui.fm}</u>` : '') + (ok ? `<label>표적 <kbd>Tab</kbd></label><br><b style="color:${HOS}">${sel.name}</b>` + (mx ? ` 선체 <b>${eh}</b>%<div class="br"><i style="width:${eh}%;color:${HOS}"></i></div>` : '<br>')
      + `거리 <b>${sel.lb.replace(' ', '</b> · 충돌 <b>')}</b> · 방위 <b>${brg(sel)}</b>°<br>` + (sel.ef === fr ? `<span>◎ 교전 중 — ${sa ? 'SAM' : 'SSM'} 추적</span>` : '<kbd>Space</kbd> ' + (sa ? 'SAM 발사' : 'SSM · <kbd>F</kbd> 함포')) : '<label>표적</label> 없음'));
  }
  function over(text, col) { G.canvas.className = 'bl'; ui.ov.className = ''; ui.ov.style.display = ''; ui.ov.innerHTML = `<div><h1 style="color:${col}">${text}</h1><h2>격파 ${S.kills} · 선체 ${Math.max(0, P.hp | 0)}%</h2><button>다시 출격 <kbd>Enter</kbd></button></div>`; G.sfx.loop('siren', 0); }
  function start() { reset(); state = 'play'; paused = 0; ui.ov.style.display = 'none'; G.canvas.className = ''; G.sfx.init(); G.sfx.music('calm'); }
  G.game = { start, spawn, fireMsl, boom, kill, damage, cam, get P() { return P; }, get E() { return E; }, get S() { return S; }, sel: t => sel = t }; // 검증·디버그용

  G.register('game', {
    init() {
      G.canvas.className = 'bl'; // 메뉴 뒤로 실제 장면을 흐리게 보여 줌
      G.css(`#c{transition:filter .9s,transform .9s}#c.bl{filter:blur(7px) brightness(.62);transform:scale(1.04)}#hud,#hit,#ov{position:absolute;inset:0}#hud{width:100%;height:100%}#hit{box-shadow:inset 0 0 160px 40px #f20a;opacity:0}
.pn{position:absolute;padding:.6em .85em;background:#012e;border:1px solid #48b5;border-radius:8px;font-size:clamp(12px,1.7vh,17px);color:#cef}
.pn b{color:#fff;font:700 1.2em ui-monospace,monospace}.pn label,.kg h3,small{margin:0;font:400 max(11px,.8em) system-ui;letter-spacing:.05em;color:#ace}.pn i{font-style:normal;color:#6ef}.pn span{color:#fff}
kbd{margin:0 .15em;padding:0 .45em;border:1px solid #48a;border-radius:4px;background:#123;color:#eff;font:600 .8em ui-monospace,monospace;letter-spacing:0}
#obj{left:12px;top:12px;width:min(29vw,27em);border-left:3px solid #8df}#obj h4{margin:0;font-size:1.12em;color:#fff;word-break:keep-all}#obj div{margin-top:.3em;font-size:.88em;transition:opacity .4s}#obj s{position:absolute;left:0;top:100%;margin-top:7px;text-decoration:none}
#st,#warn,#help{left:50%;transform:translateX(-50%);white-space:nowrap}#st{bottom:12px;display:flex;gap:.55em}.rw{display:flex;gap:.9em;justify-content:space-between;align-items:baseline}
.br{height:.4em;margin:.3em 0;border-radius:3px;background:#fff2}.br i{display:block;height:100%;background:currentColor;transition:width .2s linear}
.w{padding:.15em .5em 0;border:1px solid #48b4;border-radius:6px;font-size:.85em;text-align:center}.w b{display:block}.on.w{border-color:#8df;background:#146}.no{opacity:.5}
#tg{right:12px;bottom:12px}#tg u,#warn u{display:block;color:#fb3;font-weight:700;text-decoration:none}
#warn{left:max(50%,29vw + 14em + 60px);top:12px;padding:.1em 1.2em;border:2px solid #f54;border-radius:2em;background:#500e;font-size:clamp(13px,2vh,20px);animation:pu .6s infinite alternate}#warn:empty{display:none}#warn u{display:inline;color:#fff;font:800 1.4em ui-monospace,monospace}@keyframes pu{to{box-shadow:0 0 20px 3px #f54}}
#help{top:24%}.kg{display:grid;grid-template-columns:auto auto;gap:.45em 2.2em}.kg i{display:inline-block;min-width:4.4em;margin-right:.7em;text-align:right}
#ov{display:grid;place-items:center;text-align:center;background:radial-gradient(#0123 30%,#001c);pointer-events:auto;font-size:clamp(14px,1.45vw,21px)}#ov.t{place-items:center start;padding-left:7vw;text-align:left;background:radial-gradient(85% 130% at 0 55%,#001e 35%,#0000)}
#ov h1{margin:0;font:900 3.9em/1.04 system-ui;letter-spacing:.06em;color:#fff;text-shadow:0 4px 18px #000c}#ov h1 b{color:#6cf}
#ov h2{margin:.5em 0 .9em;font-size:1em;font-weight:400;letter-spacing:.14em;color:#9ce}#ov p{margin:0 0 1.5em;max-width:32em;color:#fff;word-break:keep-all}
#ov button{padding:.6em 1.5em .6em 1.9em;border:1px solid #8df;border-radius:6px;background:#0a3050d0;box-shadow:0 0 24px #4bf6,inset 0 0 20px #4bf4;color:#fff;font:800 1.2em system-ui;letter-spacing:.35em;cursor:pointer}#ov button:hover{background:#158}
#ov .pn{position:static;display:table;margin-top:1.8em;font-size:.8em}#ov small{position:absolute;left:7vw;bottom:14px;opacity:.6}`);
      X = G.el('canvas', { id: 'hud' }).getContext('2d'); ui.hit = G.el('div', { id: 'hit' });
      ui.box = G.el('div'); for (const k of ['obj', 'st', 'tg', 'warn', 'help']) ui[k] = G.el('div', { id: k, className: 'pn' }, ui.box);
      ui.st.innerHTML = '<div style="min-width:10em"></div>' + ['대공 SAM', '대함 SSM', '함포', 'CIWS'].map((n, i) => `<div class="w"><label>${n}</label><b>자동</b><span>1.5km 방어</span>${i > 2 ? '' : '<div class="br"><i></i></div>'}</div>`).join('');
      const KEYS = '<div class="kg"><h3>기동</h3><h3>교전</h3>' + [['W S', '추력'], ['Tab', '다음 표적'], ['A D', '조타'], ['Q', '최대 위협'], ['드래그', '시점'], ['Space', '미사일 — 공중 SAM · 수상 SSM'], ['휠', '줌'], ['F', '함포 — 수상·지상 표적']]
        .map(k => `<span><i>${k[0].replace(/\S+/g, '<kbd>$&</kbd>')}</i>${k[1]}</span>`).join('') + '</div>';
      ui.help.hidden = 1; ui.help.innerHTML = KEYS + '<br>' + 'P 일시정지 M 음소거 F2 그래픽 H 닫기'.replace(/\w+/g, '<kbd>$&</kbd>');
      ui.ov = G.el('div', { id: 'ov', className: 't' });
      ui.ov.innerHTML = `<div><h1>SECOND<br><b>KOREAN WARS</b></h1><h2>해상 반격 — ${G.SCENARIO.title}</h2><p>날아오는 대함미사일을 요격하고 적 함대와 해안포대를 격파하라.</p><button>출 격 <kbd>Enter</kbd></button><div class="pn">${KEYS}</div><small><kbd>F2</kbd> 그래픽 설정 · ${G.gpuInfo.name}</small></div>`;
      ui.ov.onclick = e => { if (e.target.tagName === 'BUTTON') start(); };
      addEventListener('keydown', e => {
        if (state !== 'play') { if (e.code === 'Enter') start(); return; }
        if (e.code === 'Tab' || e.code === 'KeyE') pick(1); if (e.code === 'KeyQ') pick(0);
        if (e.code === 'KeyP' || e.code === 'Escape') paused ^= 1; if (e.code === 'KeyM') G.sfx.volume((muted ^= 1) ? 0 : 1); if (e.code === 'KeyH') ui.help.hidden ^= 1;
      });
      let drag = 0, mv = 0;
      addEventListener('pointerdown', e => { if (e.target.tagName === 'CANVAS') { drag = 1; mv = 0; } });
      addEventListener('pointermove', e => { if (drag) { cam.az -= e.movementX * .005; cam.el += e.movementY * .004; mv += Math.abs(e.movementX) + Math.abs(e.movementY); } });
      addEventListener('pointerup', e => { // 클릭(드래그 아님) → 가까운 표적 마커 선택
        if (drag && mv < 6 && state === 'play') { let b = null, bd = 40; for (const t of E) if (t.side && live(t)) { const d = Math.hypot(t.sx - e.clientX, t.sy - e.clientY); if (d < bd) { bd = d; b = t; } } if (b) { sel = b; G.sfx.play('lock'); } }
        drag = 0; });
      addEventListener('wheel', e => { cam.d *= Math.exp(e.deltaY * .0012); }, { passive: true });
      if (G.params.has('nohud')) G.ui.style.display = 'none'; // 검증용: HUD 없이 장면만
      reset(); if (G.params.has('autostart')) start();
    },
    update
  });
}
