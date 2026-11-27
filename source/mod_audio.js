'use strict';
/* ═══ AUDIO — Web Audio 실시간 합성 ═══ */
{
  const LPF = 'lowpass', BPF = 'bandpass', HPF = 'highpass', SAW = 'sawtooth', SIN = 'sine';
  let c, vol, mix, echo, NB, MB, BB, V, LP, src, end, rt, mode, mt, mi, Lp = [0, 0, 0], Lf = Lp;
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
    // ── 총기 11종 (모두 {pos} 로 NPC 용 위치음 가능) ──
    // 5.56: 파열음(HPF) + 몸통(BPF 스윕) + 저역 쿵 + 꼬리 + 노리쇠 소리 + 지형 반사
    r556: [[HPF, 2800, .001, .045, 1.5, .7], [BPF, 1000, .001, .16, 2.3, .8, 320], [SIN, 110, .002, .15, 1.05, 1, 48], [LPF, 800, .008, .55, .65, .7, 140], [BPF, 3600, .001, .012, .35, 5, 0, .028], [LPF, 1500, .015, .35, .22, .7, 250, .085]], // K2 · K2A · K2C1
    r556c: [[HPF, 3200, .001, .05, 1.7, .7], [BPF, 1250, .001, .14, 2.5, .7, 380], [SIN, 125, .002, .13, 1, 1, 55], [LPF, 950, .008, .5, .7, .7, 150], [BPF, 3800, .001, .012, .35, 5, 0, .026], [LPF, 1600, .015, .32, .22, .7, 260, .08]], // K2C 카빈: 짧은 총열 → 더 날카롭고 시끄러움
    r556l: [[HPF, 2600, .001, .045, 1.4, .7], [BPF, 950, .001, .18, 2.2, .8, 300], [SIN, 105, .002, .17, 1.1, 1, 45], [LPF, 750, .008, .6, .7, .7, 130], [BPF, 2200, .001, .09, .12, 14, 1900, .03], [LPF, 1400, .015, .38, .22, .7, 240, .09]], // M16: 긴 총열 + 완충 스프링 '띠잉'
    r556b: [[HPF, 2700, .001, .045, 1.4, .7], [BPF, 1050, .001, .17, 2.2, .8, 330], [SIN, 115, .002, .16, 1.1, 1, 50], [LPF, 800, .008, .55, .65, .7, 140], [BPF, 2400, .001, .02, .5, 4, 0, .025], [BPF, 480, .002, .07, .6, 1.5, 0, .02], [LPF, 1500, .015, .35, .22, .7, 250, .085]], // AUG 불펍: 기관부가 귀 옆
    r762: [[HPF, 2300, .001, .05, 1.3, .7], [BPF, 700, .001, .22, 2.5, .8, 220], [SIN, 90, .002, .22, 1.25, 1, 40], [LPF, 620, .012, .8, .8, .7, 110], [BPF, 2600, .001, .02, .45, 4, 0, .035], [BPF, 1700, .001, .02, .3, 4, 0, .06], [LPF, 1200, .02, .45, .25, .7, 200, .1]], // AKM 7.62×39: 낮고 굵게, 노리쇠 덜컥
    smg9s: [[BPF, 1800, .001, .035, 1.4, 1.2, 900], [LPF, 400, .002, .12, 1.1, .8, 150], [SIN, 160, .001, .05, .5, 1, 80], [BPF, 3200, .001, .01, .45, 6, 0, .012], [BPF, 2100, .001, .015, .35, 5, 0, .04]], // K7 소음기: '툭' + 노리쇠, 파열음 없음 (이미 r556 의 ≈ 1/3)
    k14: [[HPF, 3500, .001, .02, .9, .7, 0, .004], [LPF, 500, .002, .35, 1.4, .9, 120], [SIN, 60, .002, .3, 1.1, 1, 32], [BPF, 1100, .001, .06, .8, 1, 500], [LPF, 900, .03, .9, .3, .7, 150, .12]], // K14 소음기 7.62 NATO: 둔한 쿵 + 초음속 탄의 짧은 딱
    bolt: [[BPF, 2800, .001, .02, .9, 6], [BPF, 1400, .015, .1, .35, 2, 2200, .12], [BPF, 3400, .001, .025, 1.1, 7, 0, .25], [SIN, 1900, .001, .06, .08, 1, 0, .25], [SIN, 5200, .001, .12, .05, 1, 0, .4], [BPF, 1800, .015, .1, .35, 2, 1200, .33], [BPF, 2600, .001, .03, 1.1, 6, 0, .5], [BPF, 3100, .001, .02, .8, 7, 0, .64]], // 노리쇠: 올림 · 후퇴(탄피 '팅') · 전진 · 잠금 (.7 초)
    rpgl: [[HPF, 1500, .001, .08, 1.8, .7], [LPF, 2200, .002, .4, 2.2, .7, 200], [SIN, 75, .003, .35, 1.4, 1, 30], [BPF, 400, .1, .8, 1.8, .7, 1600, .12], [HPF, 3000, .05, .6, .4, .7, 0, .12], [LPF, 500, .1, 1.5, .5, 1, 120, .2]], // RPG-7 발사: 장약 펑 + .12 초 뒤 로켓 점화 '쉬익'
    boom: [[HPF, 2000, .001, .06, 1.8, .7], [SIN, 70, .003, 1.1, 1.6, 1, 26], [LPF, 5000, .001, 1.2, 2, .7, 120], [LPF, 240, .25, 2.6, 3.5, 1.2, 55, .06], [BPF, 3000, .05, 1.6, .25, .7, 1200, .25]], // 가까운 폭발 (탄두): 딱 + 쿵 + 굉음 + 파편
    boomf: [[LPF, 700, .03, 1.8, 1.3, .8, 90], [SIN, 55, .03, 1.2, .8, 1, 25], [LPF, 180, .4, 3.5, 2, 1, 45, .15], [LPF, 400, .2, 2, .5, .8, 80, .5]], // 먼 폭발: 먹먹한 굉음 + 산 메아리
    dry: [[BPF, 3200, .001, .012, 2.4, 4], [BPF, 1800, .001, .03, 1.8, 3, 0, .015]], // 빈 탄창 공이 '딸깍'
    mode: [[BPF, 4200, .001, .012, 1.5, 5], [BPF, 2600, .001, .02, .9, 4, 0, .03]], // 조정간
    swap: [[BPF, 700, .03, .2, .5, .8, 400], [BPF, 2600, .001, .03, .7, 5, 0, .16], [BPF, 1300, .001, .05, .8, 3, 0, .3], [LPF, 300, .005, .08, .6, 1, 0, .3]], // 무기 교체: 천 스침 + 금속 + 철컥
    pick: [[BPF, 900, .04, .25, .55, .8, 500], [BPF, 3000, .001, .025, .6, 6, 0, .12], [SIN, 2400, .001, .15, .06, 1, 0, .12], [BPF, 1600, .001, .04, .7, 3, 0, .22], [LPF, 260, .004, .1, .6, 1, 0, .22]], // 줍기
    rlb: [[BPF, 2600, .001, .03, 1, 5, 0, .2], [BPF, 1400, .002, .06, .8, 3, 0, .32], [BPF, 2500, .05, .6, .25, 1.5, 0, .8], ...[.8, .88, .97, 1.05, 1.12, 1.22, 1.3, 3.2, 3.3, 3.38, 3.5, 3.6, 3.72, 3.85].map(t => [BPF, 3500, .001, .015, .5, 6, 0, t]), [BPF, 1900, .001, .04, .9, 4, 0, 2], [LPF, 300, .004, .15, 1.2, 1, 0, 2.6], [BPF, 2400, .001, .03, 1, 5, 0, 2.75], [BPF, 2200, .05, .7, .2, 1.5, 0, 3.2], [LPF, 600, .002, .15, 1.2, .8, 0, 4.6], [BPF, 2000, .001, .05, 1.1, 3, 0, 4.6], [BPF, 1200, .002, .06, .6, 2, 0, 5.2]], // M134 탄띠 교체 (≈5.4 초): 덮개 · 탄띠 빼기 · 탄통 교체 · 탄띠 걸기 · 덮개 쾅
    rlr: [[BPF, 800, .05, .35, .5, .8, 450, .15], [BPF, 700, .2, .8, .5, 2, 1100, .8], [BPF, 2200, .1, .7, .15, 3, 1500, .85], [LPF, 400, .003, .2, 1.4, 1, 0, 1.9], [BPF, 1500, .001, .06, .8, 3, 0, 1.9], [BPF, 2800, .001, .03, .8, 5, 0, 2.5], [BPF, 3000, .001, .025, 1, 6, 0, 3.15], [BPF, 1800, .001, .04, .9, 4, 0, 3.25]], // RPG 로켓 장전 (≈3.3 초): 꺼내기 · 밀어 넣기 · 쿵 · 공이치기
  };
  // 총 id 로도 부를 수 있게 (G.sfx.play(id)). M134 는 원샷 없음 → 지속음 m134s / m134f
  for (const [k, v] of Object.entries({ k2: 'r556', k2a: 'r556', k2c1: 'r556', k2c: 'r556c', m16: 'r556l', aug: 'r556b', akm: 'r762', k7: 'smg9s', rpg7: 'rpgl', k5: 'pistol' })) SND[k] = SND[v];
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
    // ── 총기 지속음 (탄 하나하나를 원샷으로 내면 보이스 상한을 넘으므로) ──
    m134s(d) { // M134 모터·총열 회전 (r = 회전 0..1, 무기 모듈이 매 프레임): 톱니 40→110 Hz + 전기 모터 고음 + 총열 6개가 지나가는 바람 (300 Hz × r 진폭변조)
      const k = gn(0, d), m = osc(SAW, 40, bq(LPF, 700, 1, k)), w = osc('triangle', 280, bq(BPF, 1200, 3, gn(.35, k))),
        a = gn(.5, bq(BPF, 1600, 1.1, gn(.9, k))), am = osc(SIN, 1, gn(.5, a.gain));
      nz(a);
      return r => { tgt(m.frequency, 40 + 70 * r); tgt(w.frequency, 280 + 1100 * r); tgt(am.frequency, 1 + 300 * r); tgt(k.gain, .4 * Math.min(1, 1.6 * r) ** 1.3, .06); };
    },
    m134f(d) { // M134 사격 '부르르르' (gain = 사격 중): 한 발씩 합성한 20 ms 간격 탄띠 버퍼 반복 (3,000 rpm, r = 발사속도 배율) + 포화 톱니 몸통 + 저역
      const s = go(new AudioBufferSourceNode(c, { buffer: BB, loop: true }), bq(LPF, 5000, .5, ws(1.6, gn(.8, d))), 0, 0, 0),
        o = osc(SAW, 50, bq(LPF, 260, .9, ws(3, gn(.22, d))));
      s.connect(bq(LPF, 180, .8, gn(1.2, d)));
      return r => { r = r || 1; tgt(s.playbackRate, r); tgt(o.frequency, 50 * r); }; // 끌 때(r=0)는 음높이를 내리지 않음: 사격만 멈추고 회전음(m134s)이 스핀다운
    },
    rocket(d) { // RPG 로켓 모터 분사 (r = 거리 감쇠: 1 가까이 → 0 멀리, 끄면 먹먹해지며 사라짐): 대역 잡음 + 저역 + 떨림
      const k = gn(1, d), b = bq(BPF, 1400, .6, ws(2, k)), m = gn(.8, b), l = bq(LPF, 260, .8, gn(.9, k));
      nz(m); nz(l); nz(gn(.45, m.gain), .004);
      return r => { tgt(b.frequency, 350 + 1300 * r); tgt(k.gain, .25 + .75 * r); };
    },
  };
  // M134 탄띠 버퍼: 16발 × 20 ms (반복 주기 .32 초: 발마다 조금씩 달라 기계적인 떨림이 덜 들림), 발마다 파열(잡음) + 몸통(저역통과 잡음) + 쿵(사인) + 기관부 딸깍, 꼬리를 앞쪽으로 감아 넣어 이음매 없이 반복
  const belt = () => {
    const sr = c.sampleRate, n = Math.round(sr / 50), L = 16 * n, b = c.createBuffer(1, L, sr), d = b.getChannelData(0);
    for (let i = 0; i < 16; i++) {
      const s0 = i * n + (Math.random() * 40 | 0), f = 120 + Math.random() * 40, a = .9 + Math.random() * .15; let y = 0;
      for (let j = 0; j < 1.4 * n; j++) {
        const t = j / sr, w = Math.random() * 2 - 1; y += .3 * (w - y);
        d[(s0 + j) % L] += a * (w * Math.exp(-t / .0012) + 1.8 * y * Math.exp(-t / .005) + .9 * Math.sin(6.283 * f * t) * Math.exp(-t / .007) + (t > .004 ? .3 * Math.sin(19478 * t) * Math.exp((.004 - t) / .0008) : 0));
      }
    }
    const m = d.reduce((m, v) => Math.max(m, Math.abs(v)), 0); d.forEach((v, i) => d[i] = v / m * .9); return b;
  };

  const use = x => { // mix → 컴프레서 → tanh 리미터 → 볼륨 (오프라인 컨텍스트 가능)
    c = x; V = []; LP = {}; mt = mi = mode = 0;
    NB = c.createBuffer(1, 2 * c.sampleRate, c.sampleRate); NB.getChannelData(0).forEach((_, i, d) => d[i] = Math.random() * 2 - 1); BB = belt();
    vol = gn(1, c.destination); mix = gn(.25, to(new DynamicsCompressorNode(c, { threshold: -14, knee: 8, ratio: 8 }), ws(1.5, vol)));
    const dl = new DelayNode(c, { delayTime: .31 }), mus = bq(LPF, 600, .7, mix); // 에코 · 음악 저역통과
    echo = gn(.5, dl); to(dl, gn(.45, dl)); to(dl, mix);
    MB = { calm: gn(0, mus), combat: gn(0, mus) };
  };
  // 다시 켜기: iOS 는 전화·Siri·알람·잠금·앱 전환 뒤 'suspended' 또는 'interrupted' 로 남고, 사용자 제스처 안에서 resume() 해야 돌아옴
  let off = 0; // 화면이 숨겨져서 우리가 멈춘 상태
  const kick = () => { if (c && c.state !== 'running' && c.state !== 'closed' && !document.hidden && c instanceof AudioContext) { off = 0; c.resume().catch(() => { }); } };
  for (const t of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) addEventListener(t, kick, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => { // 숨겨지면 멈추고 (뒤 탭에서 배경음이 계속 나지 않게), 보이면 다시
    if (!(c instanceof AudioContext)) return;
    if (document.hidden) { if (c.state === 'running') { off = 1; c.suspend().catch(() => { }); } } else kick();
  });
  const api = {
    init() {
      // iOS: Web Audio 만 쓰면 '주변 소리(ambient)' 로 분류돼 무음 스위치에 묶임 → 'playback' 이면 무음 모드에서도 소리가 남 (Safari 16.4+, 없으면 건너뜀)
      try { const s = navigator.audioSession; if (s && s.type !== 'playback') s.type = 'playback'; } catch (e) { }
      if (!c) { use(new AudioContext()); c.onstatechange = () => { c.state !== 'running' && !off && kick(); }; } // 끊긴 뒤 스스로 돌아오지 않으면 다음 제스처에서
      kick();
    },
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
      } else if (l) { const k = (o && o.fade) || .15; delete LP[name]; l.r(0); tgt(l.o.gain, 0, k); kill(l, c.currentTime + Math.max(.3, 9 * k)); V.push(l); } // 끌 때 스핀다운 · {fade} = 감쇠 시상수 (소스는 e^-9 ≈ -78 dB 에서 멈춤 → 딸깍 없음)
    },
    music(m) { if (m != mode) { mode = m; mt = mi = 0; for (const k in MB) tgt(MB[k].gain, k == m ? .4 : 0, .5); } }, // 크로스페이드
    listener(p, f) { Lp = p; Lf = f; },
    voices() { return V.length; }, // 시험용: 살아 있는 보이스 수 (상한 25)
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
