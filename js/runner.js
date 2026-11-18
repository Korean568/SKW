// ───────────────────────────────────────────────────────────────
//  runner.js — story.js 의 steps 를 순서대로 실행
// ───────────────────────────────────────────────────────────────
import { THREE, G, rand, spawnGround, groundNear, yawTo, DEG } from './core.js';
import { CHARACTERS } from './story.js';
import * as U from './units.js';
import * as UI from './ui.js';
import * as FX from './fx.js';
import { getGLTF, createProp, setCine, burnProp } from './world.js';

class Cancelled extends Error {}

// ── 프레임마다 확인되는 대기 조건 ─────────────────────────────
const waiters = [];
let token = null;
export function tickRunner() {
  for (let i = waiters.length - 1; i >= 0; i--) {
    const w = waiters[i];
    if (w.tok.cancelled) { waiters.splice(i, 1); w.rej(new Cancelled()); continue; }
    if (w.skip || w.cond()) { waiters.splice(i, 1); w.res(); }
  }
}
function waitUntil(cond) {
  const tok = token;
  if (tok.cancelled) return Promise.reject(new Cancelled());
  return new Promise((res, rej) => waiters.push({ cond, res, rej, tok }));
}
const waitTime = s => { const t = G.time + s; return waitUntil(() => G.time >= t); };
/** 일반 Promise 를 챕터 취소 가능하게 감싸기 */
function guard(promise) {
  const tok = token;
  let w;
  const cancelP = new Promise((res, rej) => { w = { cond: () => false, res, rej, tok }; waiters.push(w); });
  const done = promise.finally(() => { const i = waiters.indexOf(w); if (i >= 0) waiters.splice(i, 1); });
  return Promise.race([done, cancelP]);
}
/** 디버그: 현재 대기 건너뛰기 */
export function skipWait() { for (const w of waiters) w.skip = true; UI.skipDialogue(); }
export function cancelRunner() {
  if (token) token.cancelled = true;
  UI.skipDialogue();
  UI.endDialogue();
  tickRunner();
}
const check = tok => { if (tok.cancelled) throw new Cancelled(); };

// ── 실행 ─────────────────────────────────────────────────────
export async function runChapter(ch, from, onComplete) {
  const tok = token = { cancelled: false };
  const steps = ch.steps || [];
  try {
    for (let i = from; i < steps.length; i++) {
      check(tok);
      G.stepIndex = i;
      const s = steps[i];
      if (s.type === 'end') break;
      await exec(s, i, tok);
    }
    check(tok);
    onComplete && onComplete();
  } catch (e) {
    if (!(e instanceof Cancelled)) { console.error('[스토리 오류]', e); UI.toast('스토리 오류: ' + e.message); }
  }
}

async function exec(s, i, tok) {
  switch (s.type) {
    case 'fade':
      UI.fade(s.out !== false, s.duration ?? 1);
      if (s.duration) await waitTime(s.duration);
      break;

    case 'title':
      UI.titleCard(s.text, s.sub, s.duration || 4);
      if (s.wait) await waitTime(s.duration || 4);
      break;

    case 'dialogue':
      await dialogue(s.lines || [], tok);
      break;

    case 'radio': {
      const p = UI.radio(s.lines || [], () => tok.cancelled);
      if (s.wait) await p;
      break;
    }

    case 'camera': {
      if (s.off) { endCutscene(); break; }
      G.mode = 'cutscene';
      UI.letterbox(true);
      if (s.follow) {
        const pr = G.props.get(s.follow) || U.findUnit(s.follow);
        const root = pr && (pr.root || pr.char.root);
        if (root) setCine({ follow: root, offset: new THREE.Vector3(...(s.offset || [0, 2, -6])), lookOffset: new THREE.Vector3(...(s.lookOffset || [0, 1, 0])) });
        break;
      }
      const dur = s.duration ?? 4;
      const v = a => a ? new THREE.Vector3(a[0], a[1], a[2]) : null;
      const cine = { from: v(s.from), to: v(s.to || s.from), look: v(s.lookAt), lookTo: v(s.lookAtTo || s.lookAt), t0: G.time, dur };
      cine.dur = Math.max(0.001, dur);
      setCine(cine);
      if (dur > 0 && s.wait !== false) await waitTime(dur);
      break;
    }

    case 'objective':
      UI.objective(s.text, s.sub);
      break;

    case 'spawn':
      await spawnEnemies(s.enemies || []);
      UI.enemyCount();
      break;

    case 'eliminate': {
      endCutscene();
      if (s.text) UI.objective(s.text);
      UI.enemyCount();
      await waitUntil(() => U.enemiesAlive(s.group) === 0);
      UI.enemyCount();
      FX.sfxBlip();
      break;
    }

    case 'goto': {
      endCutscene();
      if (s.text) UI.objective(s.text);
      const [x, z] = s.pos, r = s.radius || 3;
      UI.waypoint([x, z, spawnGround(x, z)]);
      await waitUntil(() => G.player && Math.hypot(G.player.pos.x - x, G.player.pos.z - z) < r);
      UI.waypoint(null);
      FX.sfxBlip();
      break;
    }

    case 'survive': {
      endCutscene();
      UI.objective(s.text || '버텨라');
      const t0 = G.time, dur = s.seconds || 60;
      const waves = (s.waves || []).slice().sort((a, b) => a.at - b.at);
      let wi = 0;
      await waitUntil(() => {
        const el = G.time - t0;
        while (wi < waves.length && el >= waves[wi].at) spawnEnemies(waves[wi++].enemies || []).then(UI.enemyCount);
        const left = Math.max(0, dur - el);
        UI.objectiveSub(`남은 시간 ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`);
        return el >= dur;
      });
      UI.objectiveSub('');
      FX.sfxBlip();
      break;
    }

    case 'wait':
      await waitTime(s.seconds || 1);
      break;

    case 'ally':
    case 'actor': {
      const id = s.id || s.who;
      let u = U.findUnit(id);
      if (!u) {
        let pos = s.pos;
        if (!pos) { // 위치가 없으면 플레이어 근처
          const p = G.player.pos;
          pos = [p.x + rand(-2, 2), p.z + rand(-2, 2)];
        }
        const gltf = await getGLTF(s.who);
        check(tok);
        u = U.createUnit(s.type, s.who, CHARACTERS[s.who], gltf, { ...s, id, pos });
      } else {
        u.kind = s.type;
        if (s.pos) { u.pos.set(s.pos[0], s.y != null ? groundNear(s.pos[0], s.pos[1], s.y) : spawnGround(s.pos[0], s.pos[1]), s.pos[1]); u.moveTarget = null; }
        if (s.rot != null) u.yaw = s.rot * DEG;
        if (s.anim !== undefined) { u.anim = s.anim; if (s.anim) u.char.play(s.anim); }
      }
      if (s.type === 'ally') {
        u.follow = s.follow !== false;
        u.invulnerable = s.invulnerable !== false;
        u.slot = G.units.filter(o => o.kind === 'ally' && o !== u).length;
        if (u.follow) u.anim = null;
      }
      break;
    }

    case 'move': {
      const u = U.findUnit(s.id);
      if (!u) break;
      const p = U.moveUnit(u, s.to, s.run, s.face);
      if (s.wait) await guard(p);
      break;
    }

    case 'anim': {
      const u = U.findUnit(s.id);
      if (u) { u.anim = s.anim; u.char.play(s.anim); }
      break;
    }

    case 'face': {
      const u = U.findUnit(s.id);
      if (!u) break;
      if (s.to === 'player') u.yaw = yawTo(u.pos, G.player.pos);
      else if (Array.isArray(s.to)) u.yaw = yawTo(u.pos, { x: s.to[0], z: s.to[1] });
      else u.yaw = (+s.to || 0) * DEG;
      break;
    }

    case 'remove': {
      const u = U.findUnit(s.id);
      if (u) U.removeUnit(u);
      const pr = G.props.get(s.id);
      if (pr) { pr.root.removeFromParent(); G.colliders = G.colliders.filter(c => !pr.colliders.includes(c)); G.props.delete(s.id); }
      break;
    }

    case 'teleport':
      G.player.place(s.pos, s.rot ?? G.player.yaw / DEG);
      break;

    case 'prop': {
      const pr = await createProp(s.model, s);
      check(tok);
      G.props.set(s.id || s.model, pr);
      break;
    }

    case 'propMove': {
      const pr = G.props.get(s.id);
      if (!pr) break;
      const tw = {
        from: pr.root.position.clone(), to: new THREE.Vector3(...s.to),
        r0: pr.root.rotation.y, r1: s.rot != null ? s.rot * DEG : pr.root.rotation.y,
        t0: G.time, dur: s.duration || 4,
      };
      pr.tween = tw;
      if (s.wait !== false) await waitUntil(() => !pr.tween);
      break;
    }

    case 'rotor': {
      const pr = G.props.get(s.id);
      if (pr) pr.rotorOn = s.on !== false;
      break;
    }

    case 'checkpoint':
      G.checkpoint = {
        index: i + 1, pos: [G.player.pos.x, G.player.pos.z], rot: G.player.yaw / DEG,
        enemies: G.units.filter(u => u.kind === 'enemy' && u.alive).map(u => ({
          ...u.spec, para: false, count: 1, area: null, who: u.key, id: u.id, pos: [u.pos.x, u.pos.z], rot: u.yaw / DEG, hp: u.hp, alert: true,
        })),
      };
      UI.toast('체크포인트');
      break;

    case 'player': {
      const p = G.player;
      if (s.visible !== undefined) p.hidden = !s.visible;
      if (s.pos) p.place(s.pos, s.rot ?? p.yaw / DEG, s.y);
      else if (s.rot != null) { p.yaw = p.camYaw = s.rot * DEG; p.char.root.rotation.y = p.yaw; }
      if (s.down) p.char.fall();
      if (s.up) p.char.revive();
      if (s.anim) p.char.play(s.anim);
      break;
    }

    case 'kill': {
      for (const id of [].concat(s.id)) {
        if (id === 'player') { G.player.char.fall(); continue; }
        U.scriptedKill(U.findUnit(id));
      }
      break;
    }

    case 'missile': {
      const v = a => new THREE.Vector3(a[0], a[1] ?? 0, a[2] ?? 0);
      await guard(FX.missile(v(s.from), v(s.to), s.duration || 1.5, s.size || 1));
      if (s.burn) { const pr = G.props.get(s.burn); if (pr) burnProp(pr); }
      break;
    }

    case 'explosion': {
      FX.explosion(new THREE.Vector3(s.pos[0], s.pos[1] ?? 0, s.pos[2] ?? 0), s.size || 1);
      if (s.burn) { const pr = G.props.get(s.burn); if (pr) burnProp(pr); }
      break;
    }

    case 'sound':
      FX.playSound(s.name);
      if (s.shake) G.shake = Math.min(2, (G.shake || 0) + s.shake);
      break;

    case 'blackout': {
      if (s.flash !== false) UI.flash();
      if (s.sound) FX.playSound(s.sound);
      if ((s.ring ?? 4.5) > 0) FX.sfxRing(s.ring ?? 4.5);
      UI.fade(true, s.fade ?? 0.6);
      await waitTime((s.fade ?? 0.6) + (s.seconds ?? 3));
      if (s.wake !== false) {
        UI.blur(8, 0);
        UI.fade(false, 2.5);
        UI.blur(0, s.blur ?? 4);
      }
      break;
    }

    case 'waitLanding':
      await waitUntil(() => !U.parasInAir());
      break;

    default:
      console.warn('알 수 없는 step type:', s.type);
  }
}

function endCutscene() {
  if (G.mode === 'cutscene' || G.mode === 'dialogue') G.mode = 'play';
  setCine(null);
  UI.letterbox(false);
}

async function spawnEnemies(list) {
  const jobs = [];
  for (const spec of list) {
    const who = spec.who || 'nk_soldier';
    const n = spec.count || 1;
    for (let k = 0; k < n; k++) {
      let pos = spec.pos;
      if (spec.area) {
        const [x1, z1, x2, z2] = spec.area;
        pos = [rand(Math.min(x1, x2), Math.max(x1, x2)), rand(Math.min(z1, z2), Math.max(z1, z2))];
      }
      jobs.push(getGLTF(who).then(gltf => U.createUnit('enemy', who, CHARACTERS[who], gltf, { ...spec, pos, id: n > 1 ? undefined : spec.id })));
    }
  }
  await Promise.all(jobs);
}

// ── 대화 ─────────────────────────────────────────────────────
async function dialogue(lines, tok) {
  const prevMode = G.mode;
  const prevCine = G.cine;
  G.mode = 'dialogue';
  UI.letterbox(true);
  UI.beginDialogue();
  const restore = [];
  try {
    for (const l of lines) {
      check(tok);
      const who = l.who === 'narration' ? null : l.who;
      const sp = who ? speakerUnit(who) : null;
      if (sp && Array.isArray(l.face)) sp.yaw = yawTo(sp.pos, { x: l.face[0], z: l.face[1] });
      else if (sp && typeof l.face === 'string') { const t = U.findUnit(l.face); if (t) sp.yaw = yawTo(sp.pos, t.pos); }
      else if (sp && l.face !== false && sp !== G.player && G.player && sp.pos.distanceTo(G.player.pos) < 10 && !G.player.hidden) {
        sp.yaw = yawTo(sp.pos, G.player.pos);
        G.player.yaw = yawTo(G.player.pos, sp.pos);
        G.player.char.root.rotation.y = G.player.yaw;
      }
      if (sp && l.anim) {
        sp.char.play(l.anim, { fade: 0.25 });
        restore.push(sp);
      }
      if (sp && l.cam !== false && !l.radio) setCine({ speaker: sp });
      else if (!G.cine || G.cine.speaker) setCine(prevCine && !prevCine.speaker ? prevCine : null);
      await guard(UI.say({ who, name: l.name, text: l.text, radio: l.radio }));
      if (sp && l.anim && sp !== G.player) sp.char.play(sp.anim || (sp.char.hasRifle ? 'Idle_Rifle' : 'Idle'), { fade: 0.3 });
    }
  } finally {
    UI.endDialogue();
    for (const u of restore) if (u !== G.player && u.alive) u.char.play(u.anim || (u.char.hasRifle ? 'Idle_Rifle' : 'Idle'));
    if (G.cine && G.cine.speaker) setCine(prevCine && !prevCine.speaker ? prevCine : null);
    if (G.mode === 'dialogue') G.mode = prevMode === 'cutscene' ? 'cutscene' : 'play';
    if (G.mode !== 'cutscene') { setCine(null); UI.letterbox(false); }
  }
}

function speakerUnit(who) {
  const p = G.player;
  if (p && (p.char.key === who)) return p;
  return G.units.find(u => u.id === who && u.alive) || G.units.find(u => u.key === who && u.alive) || null;
}
