'use strict';
/* ═══ AUDIO — Web Audio 실시간 합성 ═══ */
{
  const LPF = 'lowpass', BPF = 'bandpass', HPF = 'highpass', SAW = 'sawtooth', SIN = 'sine';
  let c, vol, mix, echo, NB, MB, V, LP, src, end, rt, mode, mt, mi, Lp = [0, 0, 0], Lf = Lp;
  const to = (n, dst) => (n.connect(dst), n);
  const gn = (gain, dst) => to(new GainNode(c, { gain }), dst);
  const bq = (type, frequency, Q, dst) => to(new BiquadFilterNode(c, { type, frequency, Q }), dst);
  const ws = (k, dst) => to(new WaveShaperNode(c, { curve: Float32Array.from({ length: 257 }, (_, i) => Math.tanh(k * (i / 128 - 1))) }), dst); // tanh 포화
  // 소스 (d = 0: 무한)
  const go = (s, dst, t, d, off) => { to(s, dst).start(t, off); if (d) { s.stop(t + d); end = Math.max(end, t + d); } src.push(s); return s; };
  const osc = (type, frequency, dst, t = 0, d = 0) => go(new OscillatorNode(c, { type, frequency }), dst, t, d);
  const nz = (dst, playbackRate = 1, t = 0, d = 0) => go(new AudioBufferSourceNode(c, { buffer: NB, loop: true, playbackRate }), dst, t, d, Math.random());
  // 파트 [타입, f0, 어택, 감쇠, 음량, Q, f1(스윕), 지연]: 필터 타입이면 잡음, 아니면 톤
  const part = ([type, f0, a, d, v, q = 1, f1, dt = 0], t, dst) => {
    const g = gn(0, dst), e = (t += dt) + a + d, flt = /pass/.test(type) && bq(type, f0 * rt, q, g), p = (flt || osc(type, f0 * rt, g, t, a + d)).frequency;
    flt && nz(flt, 1, t, a + d);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(v / 300, e); // 램프만 사용 (클릭 방지)
    if (f1) { p.setValueAtTime(f0 * rt, t); p.exponentialRampToValueAtTime(f1 * rt, e); }
  };
  const tgt = (p, v, k = .1) => p.setTargetAtTime(v, c.currentTime, k);
  const kill = (v, t) => { v.e = t; v.g = 9; for (const s of v.s) s.stop(t); };

  const SND = { // 원샷 = 파트 목록
    ping: [[SIN, 1320, .004, .45, .6]],
    lock: [[SIN, 880, .004, .07, .6], [SIN, 1320, .004, .18, .6, 1, 0, .08]],
    alert: [0, .15].map(t => ['square', 1040, .003, .1, .5, 1, 0, t]),
    click: [[BPF, 2600, .001, .025, 1.5, 3]],
    launch: [[HPF, 1500, .001, .09, 1, .7], [BPF, 1800, .08, 2.4, 1.6, .7, 300], [LPF, 600, .12, 2, 2.5, 1, 150]],
    explosion: [[SIN, 90, .004, 1, 1.2, 1, 30], [LPF, 4000, .002, 1.4, 1.6, .7, 100], [LPF, 220, .3, 2.8, 4, 1.2, 60, .08]],
    intercept: [[HPF, 1200, .001, .12, 1.2, .7], [BPF, 3000, .002, .6, 1, .7, 800], [SIN, 220, .002, .18, .6, 1, 80]],
    splash: [[BPF, 1400, .06, 1.2, 1.6, 1.2, 500], [HPF, 4000, .25, .7, .12, .5, 0, .1]],
    gun: [[SIN, 150, .002, .3, 1.1, 1, 45], [BPF, 2200, .001, .14, 2.5, .7, 700], [LPF, 900, .01, .8, 1, .7, 150]],
    hit: [[HPF, 3500, .001, .04, .6, .7], ...[523, 811, 1287, 1962, 3140].map((f, i) => [SIN, f, .001, .45 - i * .07, .3])],
    rifle: [[HPF, 2500, .001, .05, 1.4, .7], [BPF, 900, .001, .18, 2.2, .8, 300], [SIN, 120, .002, .16, 1, 1, 50], [LPF, 700, .01, .5, .6, .7, 150]], // 소총: 날카로운 파열음 + 몸통 + 꼬리
    pistol: [[HPF, 3000, .001, .04, 1.1, .7], [BPF, 1300, .001, .12, 1.6, .9, 400], [SIN, 160, .002, .1, .7, 1, 70]],
    reload: [[BPF, 2200, .001, .03, 1.2, 4], [BPF, 1500, .001, .05, 1, 4, 0, .35], [BPF, 3000, .001, .02, 1.3, 5, 0, .7]], // 탄창 빼고 · 끼우고 · 장전
    crash: [[SIN, 60, .005, 1.8, 1.5, 1, 25], [LPF, 2500, .002, 2.2, 2, .7, 80], [BPF, 600, .01, 1.5, 1.2, .5, 120, .1]],
    ring: [[SIN, 3400, .3, 4, .12]], // 충격 후 귀울림
  };
  const LOOP = { // 지속음: 출력 노드 → rate 함수
    ciws(d) { // 70Hz 톱니 + 임펄스열 게이트 잡음 → 왜곡
      const sat = ws(5, gn(.7, d)), o = osc(SAW, 70, bq(BPF, 500, .5, sat)), ng = gn(0, bq(BPF, 1800, .6, sat));
      nz(ng); o.connect(bq(HPF, 300, 1, gn(3, ng.gain)));
      return r => tgt(o.frequency, 70 * r);
    },
    cabin(d) { // 여객기 실내 웅웅거림
      const k = gn(.5, d); nz(bq(LPF, 320, .7, k)); osc(SAW, 110, bq(LPF, 300, 1, gn(.08, k)));
      return r => tgt(k.gain, .5 * r);
    },
    wind(d) { // 구멍으로 들이치는 바람 (느리게 흔들리는 대역 잡음)
      const b = bq(BPF, 700, .6, gn(.9, d)); nz(b); osc(SIN, .17, gn(250, b.frequency));
      return r => tgt(b.frequency, 700 * Math.max(r, .3));
    },
    siren(d) { // 520→1080Hz 반복 스윕
      const o = osc(SAW, 800, bq(BPF, 900, 1, gn(.8, d))), l = osc(SAW, 2.5, gn(280, o.frequency));
      return r => tgt(l.frequency, 2.5 * r);
    },
    engine(d) { // 저역 험 + 터빈 고음
      const k = gn(0, d), lp = bq(LPF, 400, 1, k), a = osc(SAW, 45, lp), b = osc(SAW, 68, gn(.5, lp)), w = bq(BPF, 3000, 14, gn(.1, k));
      nz(w);
      return r => [[a.frequency, 45], [b.frequency, 68], [w.frequency, 2600], [k.gain, .06]].forEach(([p, v]) => tgt(p, v * (1 + r)));
    },
    missile(d) { // 요동치는 분사음
      const b = bq(BPF, 500, .5, ws(3, d)), m = gn(.6, b);
      nz(m); nz(gn(.5, m.gain), .004);
      return r => tgt(b.frequency, 500 * r);
    },
    sea(d) { // 파도 + 바람 (느린 잡음 변조)
      const w = gn(.7, bq(LPF, 700, .3, d)), wd = bq(BPF, 700, 2.5, gn(.2, d));
      nz(w); nz(wd); nz(gn(.4, w.gain), 1e-5); nz(gn(250, wd.frequency), 1e-5);
      return r => tgt(wd.frequency, 700 * r);
    },
  };

  const use = x => { // mix → 컴프레서 → tanh 리미터 → 볼륨 (오프라인 컨텍스트 가능)
    c = x; V = []; LP = {}; mt = mi = mode = 0;
    NB = c.createBuffer(1, 2 * c.sampleRate, c.sampleRate); NB.getChannelData(0).forEach((_, i, d) => d[i] = Math.random() * 2 - 1);
    vol = gn(1, c.destination); mix = gn(.25, to(new DynamicsCompressorNode(c, { threshold: -14, knee: 8, ratio: 8 }), ws(1.5, vol)));
    const dl = new DelayNode(c, { delayTime: .31 }), mus = bq(LPF, 600, .7, mix); // 에코 · 음악 저역통과
    echo = gn(.5, dl); to(dl, gn(.45, dl)); to(dl, mix);
    MB = { calm: gn(0, mus), combat: gn(0, mus) };
  };
  const api = {
    init() { c || use(new AudioContext()); c.resume(); },
    play(name, o) {
      const f = SND[name], p = (o = o || {}).pos, now = c.currentTime; if (!f) return;
      let g = o.gain ?? 1, out, d = 0, dx, dz;
      if (p) { dx = p[0] - Lp[0]; dz = p[2] - Lp[2]; d = Math.hypot(dx, p[1] - Lp[1], dz); g *= (150 / Math.max(150, d)) ** .7; }
      if (V.length > 25) { // 보이스 상한: 조용한 것부터 탈락
        const q = V.reduce((a, b) => b.g < a.g ? b : a);
        if (V.length > 33 || q.g >= g) return;
        tgt(q.o.gain, 0, .01); kill(q, now + .06);
      }
      const v = out = gn(g, mix); src = []; end = 0; rt = (o.rate ?? 1) * (p ? .92 + Math.random() * .16 : 1); // 음높이 변주
      if (p) out = bq(LPF, 16000 / (1 + d / 500), .5, to(new StereoPannerNode(c, { pan: G.clamp((dz * Lf[0] - dx * Lf[2]) / (d + 30), -1, 1) * .85 }), v));
      name == 'ping' && v.connect(echo);
      for (const q of f) part(q, now + .01 + Math.min(d / 340, 2.5), out); // 음속 지연
      V.push({ o: v, g, e: end + .05, s: src });
    },
    loop(name, on, o) {
      let l = LP[name], f = LOOP[name];
      if (on && f) {
        if (!l) { src = []; l = gn(0, mix); l = LP[name] = { o: l, r: f(l), s: src }; }
        l.r((o = o || {}).rate ?? 1); tgt(l.o.gain, o.gain ?? 1, .01);
      } else if (l) { delete LP[name]; l.r(0); tgt(l.o.gain, 0, .15); kill(l, c.currentTime + .9); V.push(l); } // 끌 때 스핀다운
    },
    music(m) { if (m != mode) { mode = m; mt = mi = 0; for (const k in MB) tgt(MB[k].gain, k == m ? .4 : 0, .5); } }, // 크로스페이드
    listener(p, f) { Lp = p; Lf = f; },
    volume(v) { tgt(vol.gain, G.clamp(v, 0, 1), .02); },
    tick(dt, ahead = .3) { // 끝난 보이스 해제 + 음악 시퀀서(8분음표 · 110BPM)
      const now = c.currentTime; V = V.filter(v => v.e > now || v.o.disconnect());
      if (mt < now) mt = now + .05;
      for (; mt < now + ahead; mt += 3 / 11, mi++) {
        const b = MB[mode], i = mi % 16; if (!b) continue;
        const d = gn(1, b), P = (...a) => part(a, mt, d); src = []; end = 0; rt = 1;
        if (mode == 'combat') {
          P(SAW, 110 * 2 ** ([0, 0, 12, 0, 0, 10, 0, 3][i % 8] / 12), .01, .24, .7); // 오스티나토
          if (i % 2 == 0 || i == 15) P(SIN, 110, .003, .2, .9, 1, 38); // 킥
          if (!i) P(SAW, 155.6, 2, 2.3, .2); // 긴장 패드
        } else if (!i) for (const f of [55, 82.5, 110.23]) P(SAW, f, 4.36, 8, .22); // 드론
        else if (i % 4 == 2 && Math.random() < .4) { d.connect(echo); P(SIN, [220, 261.6, 329.6, 392, 440][Math.random() * 5 | 0], .03, 2.5, .2); } // 드문 음
        V.push({ o: d, g: 9, e: end + .1, s: src });
      }
    },
  };
  G.sfx = { use }; // init 전 no-op, 예외 → G.err
  for (const k in api) G.sfx[k] = (...a) => { try { return (c || k == 'init') && api[k](...a); } catch (e) { G.err('[audio] ' + e); } };
  G.register('audio', { update: G.sfx.tick });
}
