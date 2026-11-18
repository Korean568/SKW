// ───────────────────────────────────────────────────────────────
//  gfx.js — 고품질 렌더링 (PC 전용)
//   울트라: GTAO(주변광 차폐) + 블룸 + SMAA + 색보정 + 4096 그림자
//   높음  : 블룸 + SMAA + 색보정 + 2048 그림자
//   낮음  : 후처리 없음, 그림자 없음
// ───────────────────────────────────────────────────────────────
import { THREE, G } from './core.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

let composer = null, gtao = null, bloom = null, grade = null, smaa = null;

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    contrast: { value: 1.08 }, saturation: { value: 1.06 }, vignette: { value: 0.32 },
    tint: { value: new THREE.Color(1, 1, 1) }, time: { value: 0 }, grain: { value: 0.025 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float contrast, saturation, vignette, time, grain; uniform vec3 tint; varying vec2 vUv;
    float rnd(vec2 c){ return fract(sin(dot(c, vec2(12.9898,78.233)) + time) * 43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb * tint;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, saturation);
      col = (col - 0.18) * contrast + 0.18;
      float d = distance(vUv, vec2(0.5));
      col *= 1.0 - vignette * smoothstep(0.35, 0.85, d);
      col += (rnd(vUv * 1000.0) - 0.5) * grain * 0.3;
      gl_FragColor = vec4(max(col, 0.0), c.a);
    }`,
};

export function initGfx() {
  const r = G.renderer;
  // 반사용 환경맵
  const pm = new THREE.PMREMGenerator(r);
  G.envMap = pm.fromScene(new RoomEnvironment(r), 0.04).texture;
  pm.dispose();
  G.maxAniso = r.capabilities.getMaxAnisotropy();
  build();
  addEventListener('resize', resize);
}

function build() {
  const r = G.renderer;
  composer && composer.dispose && composer.dispose();
  composer = new EffectComposer(r);
  composer.addPass(new RenderPass(G.scene, G.camera));
  const w = innerWidth, h = innerHeight;
  gtao = new GTAOPass(G.scene, G.camera, w, h);
  gtao.output = GTAOPass.OUTPUT.Default;
  gtao.blendIntensity = 0.85;
  gtao.updateGtaoMaterial({ radius: 0.9, distanceExponent: 1.5, thickness: 2, scale: 1, samples: 16 });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
  composer.addPass(gtao);
  bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.35, 0.6, 0.92);
  composer.addPass(bloom);
  grade = new ShaderPass(GradeShader);
  composer.addPass(grade);
  composer.addPass(new OutputPass());
  smaa = new SMAAPass(w * r.getPixelRatio(), h * r.getPixelRatio());
  composer.addPass(smaa);
  applyGfx();
}

function resize() {
  if (!composer) return;
  composer.setPixelRatio(G.renderer.getPixelRatio());
  composer.setSize(innerWidth, innerHeight);
}

/** 설정(울트라/높음/낮음)에 맞게 켜고 끄기 */
export function applyGfx() {
  const q = G.settings.quality;
  if (!composer) return;
  gtao.enabled = q === 'ultra';
  bloom.enabled = q !== 'low';
  grade.enabled = q !== 'low';
  smaa.enabled = q !== 'low';
  G.scene.environment = q === 'low' ? null : G.envMap;
  resize();
}

/** 하늘 프리셋별 색보정 */
export function setGrade({ contrast = 1.08, saturation = 1.06, vignette = 0.32, tint = [1, 1, 1] } = {}) {
  if (!grade) return;
  const u = grade.uniforms;
  u.contrast.value = contrast; u.saturation.value = saturation; u.vignette.value = vignette;
  u.tint.value.setRGB(...tint);
}

/** 텍스처 선명하게 (비스듬히 볼 때) */
export function sharpen(root) {
  root.traverse(o => {
    if (!o.isMesh) return;
    for (const m of [].concat(o.material)) {
      for (const k of ['map', 'normalMap', 'roughnessMap', 'emissiveMap']) if (m[k]) { m[k].anisotropy = G.maxAniso || 8; m[k].needsUpdate = true; }
    }
  });
}

export function render(dt) {
  if (G.settings.quality === 'low' || !composer) { G.renderer.render(G.scene, G.camera); return; }
  grade.uniforms.time.value = (grade.uniforms.time.value + dt) % 100;
  composer.render(dt);
}
