// Улов — живая 3D-сцена (three.js). Управляется из React Native командами window.game.cmd({...}).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import FISHP from './fishparams.json';
import CATP from './catparams.json';

// ---------- связь с приложением ----------
function post(msg) {
  const s = JSON.stringify(msg);
  try {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(s);
    else if (window.parent && window.parent !== window) window.parent.postMessage(s, '*');
  } catch (e) {}
}
window.addEventListener('error', (e) => post({ type: 'error', msg: String(e.message || e) }));
window.addEventListener('unhandledrejection', (e) => post({ type: 'error', msg: String((e.reason && e.reason.message) || e.reason) }));

// Blender (x, y, z) -> three (x, z, -y)
const B = (x, y, z) => new THREE.Vector3(x, z, -y);

// ---------- палитры времени суток (как в рендерах) ----------
const TOD = {
  sunset: { top: '#5d5aa3', mid: '#ff9a6b', low: '#ffc79a', sun: '#ffb066', sunI: 2.6, sunDir: [-0.55, 0.32, -0.75], hemi: 0.9,
    water: '#33b2b6', water2: '#1f8da3', cloud: '#ffd2c4', disc: '#ffe3b0', discPos: [-18, 95, 12.5], lamp: 0, stars: 0 },
  night: { top: '#070b2a', mid: '#1c2466', low: '#3b3f95', sun: '#9db4ff', sunI: 0.7, sunDir: [-0.6, 0.6, -0.5], hemi: 0.35,
    water: '#10405c', water2: '#0a2a44', cloud: '#4a50a0', disc: '#e8eeff', discPos: [-24, 95, 23], lamp: 1, stars: 1 },
  dawn: { top: '#7b9fe0', mid: '#ffcbbd', low: '#fff0dd', sun: '#fff0c8', sunI: 2.2, sunDir: [0.55, 0.32, -0.75], hemi: 1.1,
    water: '#58c6c9', water2: '#3fa6bf', cloud: '#fff1ec', disc: '#fffbe0', discPos: [22, 95, 12], lamp: 0.2, stars: 0 },
  storm: { top: '#232a38', mid: '#4d5868', low: '#6e7a89', sun: '#9fb0c4', sunI: 0.9, sunDir: [-0.3, 0.7, -0.4], hemi: 0.6,
    water: '#2a5568', water2: '#1b3b4d', cloud: '#4a5361', disc: null, discPos: null, lamp: 0.7, stars: 0, rain: 1 },
};
const PLACE_WATER = {
  pier: { amp: 0.07 }, bay: { amp: 0.05, sunset: ['#5fd3cf', '#2ea9b8'], dawn: ['#5fd3cf', '#2ea9b8'] },
  sea: { amp: 0.16 }, trench: { amp: 0.1, all: ['#16285a', '#0b1233'], storm: ['#18243a', '#0b121e'] },
};
const RARITY_COLOR = { common: '#9AA5B1', uncommon: '#5BBF72', rare: '#4A8DF0', epic: '#A05BF0', legendary: '#F2B631' };
const ROD_STYLE = {
  bamboo: ['#D9BB6C', '#9C7A34', '#7A4A2A'], ocean: ['#3F95DE', '#B4E6FF', '#1F4A7A'], galaxy: ['#4B2B8F', '#FFE9A0', '#1C1244'],
  royal: ['#FFC83A', '#FFF0A8', '#8A1F2F'], sakura: ['#F7A8C4', '#FFFFFF', '#B0507A'], spooky: ['#2D2147', '#FF8A2A', '#1A1228'],
};

// ---------- рендерер ----------
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 600);
const CAM_POS = B(2.0, -6.0, 2.3), CAM_TGT = B(2.0, 0.96, -1.63);
const HFOV = 2 * Math.atan(18 / 38);

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(HFOV / 2) / camera.aspect));
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ---------- шейдерные шумы ----------
const NOISE = `
vec3 h3(vec3 p){ p=vec3(dot(p,vec3(127.1,311.7,74.7)),dot(p,vec3(269.5,183.3,246.1)),dot(p,vec3(113.5,271.9,124.6))); return fract(sin(p)*43758.5453); }
float h1(vec3 p){ p=fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float vnoise(vec3 x){ vec3 i=floor(x); vec3 f=fract(x); f=f*f*(3.0-2.0*f);
 return mix(mix(mix(h1(i),h1(i+vec3(1,0,0)),f.x),mix(h1(i+vec3(0,1,0)),h1(i+vec3(1,1,0)),f.x),f.y),
            mix(mix(h1(i+vec3(0,0,1)),h1(i+vec3(1,0,1)),f.x),mix(h1(i+vec3(0,1,1)),h1(i+vec3(1,1,1)),f.x),f.y),f.z); }
float fbm(vec3 p){ float a=0.5,s=0.0; for(int i=0;i<3;i++){ s+=a*vnoise(p); p*=2.0; a*=0.5; } return s; }
float vor(vec3 x){ vec3 p=floor(x); vec3 f=fract(x); float d=8.0;
 for(int k=-1;k<=1;k++) for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){ vec3 b=vec3(float(i),float(j),float(k)); vec3 r=b-f+h3(p+b); d=min(d,dot(r,r)); }
 return sqrt(d); }
`;

/** Процедурный материал как в Blender (брюшко, полосы, пятна, чешуя, свечение) */
function patternMat(src, o) {
  const m = new THREE.MeshStandardMaterial({ roughness: o.rough ?? 0.62, metalness: 0, transparent: (o.alpha ?? 1) < 1, opacity: o.alpha ?? 1 });
  const U = {
    uBase: { value: new THREE.Color(o.base) }, uBelly: { value: new THREE.Color(o.belly || o.base) },
    uStripe: { value: new THREE.Color(o.stripe || '#000') }, uSpot: { value: new THREE.Color(o.spot || '#000') },
    uGlow: { value: new THREE.Color(o.glow || '#000') },
    uP: { value: new THREE.Vector4(o.cut ?? -0.33, o.stripeN || 0, o.distort ?? 1.5, o.spotN || 0) },
    uF: { value: new THREE.Vector4(o.stripe ? 1 : 0, o.axis === 'Z' ? 1 : 0, o.spot ? 1 : 0, o.scales || 0) },
    uG: { value: new THREE.Vector4(o.glowS || 0, o.spotGlow ? 1 : 0, o.detail || 1, 0) },
  };
  m.userData.U = U;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vPb;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPb = vec3(position.x, -position.z, position.y);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vPb; uniform vec3 uBase,uBelly,uStripe,uSpot,uGlow; uniform vec4 uP,uF,uG;
${NOISE}`).replace('vec4 diffuseColor = vec4( diffuse, opacity );', `
float mask = clamp((vPb.z - (uP.x - 0.22)) / 0.44, 0.0, 1.0);
vec3 col = mix(uBelly, uBase, mask);
if (uF.x > 0.5) {
  vec3 c = vPb * uP.y;
  float n = (uF.y > 0.5 ? c.z : c.x) * 20.0;
  n += uP.z * (fbm(c * uG.z) * 2.0 - 1.0);
  float fac = 0.5 + 0.5 * sin(n - 1.5708);
  col = mix(col, uStripe, step(0.62, fac) * mask);
}
float spotRaw = 0.0;
if (uF.z > 0.5) {
  spotRaw = 1.0 - step(0.2, vor(vPb * uP.w));
  col = mix(col, uSpot, spotRaw * mask);
}
if (uF.w > 0.0) col *= 1.0 - 0.16 * vor(vPb * uF.w);
vec4 diffuseColor = vec4(col, opacity);`)
      .replace('vec3 totalEmissiveRadiance = emissive;', `vec3 totalEmissiveRadiance = emissive + (uG.y > 0.5 ? uSpot * spotRaw * 1.2 : uGlow * uG.x);`);
  };
  m.customProgramCacheKey = () => 'pat';
  return m;
}

// ---------- небо ----------
const skyUni = { top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, low: { value: new THREE.Color() } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(450, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyUni,
  vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `uniform vec3 top,mid,low; varying vec3 vD;
    void main(){ float y=vD.y; vec3 c = y<0.0 ? low : (y<0.12 ? mix(low, mid, y/0.12) : mix(mid, top, clamp((y-0.12)/0.5,0.0,1.0)));
    gl_FragColor = vec4(c,1.0);
    #include <colorspace_fragment>
    }`,
}));
sky.renderOrder = -10;
scene.add(sky);

function glowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, inner); gr.addColorStop(0.35, inner); gr.addColorStop(0.5, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, outer);
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const GLOW_TEX = glowTexture();
const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_TEX, depthWrite: false, fog: false, transparent: true }));
sunSprite.scale.set(34, 34, 1);
scene.add(sunSprite);

// звёзды
const starGeo = new THREE.BufferGeometry();
{
  const p = [];
  for (let i = 0; i < 400; i++) {
    const a = Math.random() * Math.PI * 2, e = 0.12 + Math.random() * 0.8;
    p.push(Math.cos(a) * Math.cos(e) * 300, Math.sin(e) * 220 + 10, -Math.abs(Math.sin(a)) * Math.cos(e) * 300 - 30);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
}
const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xfff6e0, size: 1.6, sizeAttenuation: false, fog: false, transparent: true }));
scene.add(stars);

// облака
const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, emissive: 0xffffff, emissiveIntensity: 0.18, fog: false });
const clouds = new THREE.Group();
scene.add(clouds);
{
  const sg = new THREE.SphereGeometry(1, 16, 10);
  for (let i = 0; i < 9; i++) {
    const g = new THREE.Group();
    const w = 5 + Math.random() * 4;
    const base = new THREE.Mesh(sg, cloudMat);
    base.scale.set(w * 0.62, 0.75, 2.2);
    g.add(base);
    for (let k = 0; k < 6; k++) {
      const s = (1 + Math.random() * 1.1) * (k === 2 || k === 3 ? 1.2 : 1);
      const m = new THREE.Mesh(sg, cloudMat);
      m.position.set(((k - 2.5) / 2.5) * w * 0.5, s * 0.45 + Math.random() * 0.4, (Math.random() - 0.5) * 1.6);
      m.scale.set(s, s * 0.85, s * 0.9);
      g.add(m);
    }
    g.position.copy(B(-40 + Math.random() * 80, 55 + Math.random() * 30, 9 + Math.random() * 10));
    g.userData.v = 0.4 + Math.random() * 0.6;
    clouds.add(g);
  }
}

// чайки — силуэт-«галочка» на спрайте, машут крыльями
function gullTexture() {
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 64;
  const g = cv.getContext('2d');
  g.strokeStyle = '#fff'; g.lineWidth = 7; g.lineCap = 'round';
  g.beginPath(); g.moveTo(6, 22); g.quadraticCurveTo(36, 4, 64, 34); g.quadraticCurveTo(92, 4, 122, 22); g.stroke();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const gulls = new THREE.Group();
scene.add(gulls);
{
  const tex = gullTexture();
  for (let i = 0; i < 6; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
    sp.userData = { ph: Math.random() * 6, rad: 5 + Math.random() * 8, cx: Math.random() * 10 - 3, cz: -(16 + Math.random() * 14), y: 6.5 + Math.random() * 3, sp: 0.12 + Math.random() * 0.1, s: 0.7 + Math.random() * 0.5 };
    gulls.add(sp);
  }
}

// дождь
const rainGeo = new THREE.BufferGeometry();
const RAIN_N = 700;
{
  const p = new Float32Array(RAIN_N * 6);
  for (let i = 0; i < RAIN_N; i++) {
    const x = Math.random() * 22 - 8, y = Math.random() * 9, z = -(Math.random() * 20 - 5);
    p.set([x, y, z, x - 0.12, y - 0.7, z], i * 6);
  }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(p, 3));
}
const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0.35 }));
scene.add(rain);

// дальние острова
const farMat = new THREE.MeshStandardMaterial({ color: 0x9a90b0, roughness: 1 });
const farIslands = new THREE.Group();
scene.add(farIslands);
for (const [x, y, sx, sz] of [[-30, 85, 14, 3.2], [-12, 95, 9, 2.0], [26, 90, 16, 4.0], [40, 100, 10, 2.4]]) {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), farMat);
  m.scale.set(sx, sz, 4);
  m.position.copy(B(x, y, -0.5));
  farIslands.add(m);
}

// ---------- вода ----------
const waterU = { uT: { value: 0 }, uAmp: { value: 0.07 }, uNear: { value: new THREE.Color() }, uFar: { value: new THREE.Color() }, uHaze: { value: new THREE.Color() } };
const WAVE_GLSL = `
uniform float uT; uniform float uAmp;
float wh(vec2 p){ float x=p.x, y=-p.y;
  return uAmp*(sin(x*0.55+uT*1.1+y*0.08)+0.6*sin(x*0.23-y*0.31+uT*0.7)+0.4*sin(y*0.9+uT*1.6)+0.25*sin(x*1.7+y*0.6+uT*2.1)); }
`;
function waveH(x, z, t) {
  const y = -z, A = waterU.uAmp.value;
  return A * (Math.sin(x * 0.55 + t * 1.1 + y * 0.08) + 0.6 * Math.sin(x * 0.23 - y * 0.31 + t * 0.7) + 0.4 * Math.sin(y * 0.9 + t * 1.6) + 0.25 * Math.sin(x * 1.7 + y * 0.6 + t * 2.1));
}
const waterGeo = new THREE.PlaneGeometry(240, 240, 180, 180);
waterGeo.rotateX(-Math.PI / 2);
waterGeo.translate(0, 0, -70);
const waterMat = new THREE.MeshStandardMaterial({ roughness: 0.14, metalness: 0.0, envMapIntensity: 1.0 });
waterMat.onBeforeCompile = (sh) => {
  Object.assign(sh.uniforms, waterU);
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;\n' + WAVE_GLSL)
    .replace('#include <beginnormal_vertex>', `vec2 pp = position.xz; float e=0.08;
      float h0=wh(pp), hx=wh(pp+vec2(e,0.0)), hz=wh(pp+vec2(0.0,e));
      vec3 objectNormal = normalize(vec3(-(hx-h0)/e, 1.0, -(hz-h0)/e));`)
    .replace('#include <begin_vertex>', 'vec3 transformed = vec3(position.x, position.y + h0, position.z); vW = (modelMatrix*vec4(transformed,1.0)).xyz;');
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vW; uniform vec3 uNear,uFar,uHaze; uniform float uT;\n' + NOISE)
    .replace('vec4 diffuseColor = vec4( diffuse, opacity );', `
      float by = -vW.z;
      vec3 col = mix(uNear, uFar, smoothstep(-2.0, 30.0, by));
      col = mix(col, uHaze, smoothstep(30.0, 110.0, by));
      float sp = vnoise(vec3(vW.xz*2.2, uT*0.6));
      col += vec3(0.05) * smoothstep(0.78, 0.95, sp) * (1.0 - smoothstep(5.0, 25.0, by));
      vec4 diffuseColor = vec4(col, 1.0);`)
    .replace('vec3 totalEmissiveRadiance = emissive;', 'vec3 totalEmissiveRadiance = emissive + diffuseColor.rgb*0.18;');
};
const water = new THREE.Mesh(waterGeo, waterMat);
water.receiveShadow = false;
scene.add(water);

// ---------- свет ----------
const hemi = new THREE.HemisphereLight(0xffffff, 0x336666, 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 2.5);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -10; sun.shadow.camera.right = 10; sun.shadow.camera.top = 10; sun.shadow.camera.bottom = -10;
sun.shadow.camera.near = 1; sun.shadow.camera.far = 60;
sun.shadow.bias = -0.0008;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);
const lamps = [];
const pmrem = new THREE.PMREMGenerator(renderer);

// ---------- состояние ----------
const S = {
  place: 'pier', tod: 'sunset', outfit: 'sailor', rod: 'bamboo', bobber: 'classic', helpers: [], paused: false,
  phase: 'idle', t: 0, castT: 0, fightM: 0.5, fightTen: 0, fightFish: null, biteRarity: null,
  shake: 0, zoom: 0, zoomT: 0, jump: null, ready: false,
};
const G = { fish: null, cats: null, env: null, items: null };
const world = new THREE.Group();
scene.add(world);
let envRoot = null, boat = null, player = null, playerParts = null, bobberObj = null, fightObj = null;
const helperObjs = [];
const SPOT_CAT = B(3.0, 2.0, 0.95);
const SPOT_BOB = B(4.4, 0.6, 0.0);

function b64ToBuf(b64) {
  const bin = atob(b64);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u.buffer;
}
const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);
function loadGLB(id) {
  const el = document.getElementById('m_' + id);
  return new Promise((res, rej) => loader.parse(b64ToBuf(el.textContent.trim()), '', res, rej));
}

function ancestorName(o, prefix) {
  let p = o;
  while (p) { if (p.name && p.name.startsWith(prefix)) return p.name; p = p.parent; }
  return null;
}
const isMat = (m, base) => m && m.name && (m.name === base || m.name.startsWith(base + '.') || m.name.startsWith(base + '_'));

/** Замена материалов на процедурные (как в Blender) */
function dressFish(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    const id = (ancestorName(o, 'fish_') || '').slice(5);
    const p = FISHP[id];
    if (!p) return;
    const nm = o.material && o.material.name || '';
    if (nm.startsWith('body_')) {
      const flat = p.arch === 'flat' || p.arch === 'ray';
      o.material = patternMat(o.material, {
        base: p.base, belly: p.belly, stripe: p.stripe, stripeN: (p.stripe_n || 0) * 0.42, axis: p.stripe_axis, distort: 1.5,
        spot: p.spot, spotN: p.spot_n || 7, cut: flat ? -4 : -0.33, scales: p.arch === 'eel' || p.ghost ? 0 : (flat ? 16 : 24),
        glow: p.spot_glow ? p.spot : p.glow, glowS: p.spot_glow ? 0 : (p.glow_s || 0) + (p.ghost ? 0.6 : 0), spotGlow: !!p.spot_glow,
      });
    } else if (nm.startsWith('fin_')) {
      const fc = new THREE.Color(p.fin);
      o.material = patternMat(o.material, { base: p.fin, belly: p.fin, stripe: '#' + fc.clone().multiplyScalar(0.62).getHexString(), stripeN: 5.5, axis: 'X',
        distort: 0.4, cut: -4, alpha: 0.9, rough: 0.5, glow: p.glow, glowS: (p.glow_s || 0) * 0.5 });
    }
  });
}
function dressCat(root, furKey, outfitKey) {
  const fu = CATP.fur[furKey], ou = CATP.outfits[outfitKey];
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    if (isMat(o.material, 'fur')) {
      o.material = patternMat(o.material, { base: fu.base, belly: fu.belly, stripe: fu.stripe, stripeN: 1.15, distort: 5, detail: 2.5, axis: 'X', cut: -0.5, rough: 0.85 });
    } else if (isMat(o.material, 'shirt') && ou.stripe) {
      o.material = patternMat(o.material, { base: ou.shirt, belly: ou.shirt, stripe: ou.stripe, stripeN: 2.4, axis: 'Z', cut: -4, distort: 1.5, rough: 0.85 });
    }
  });
}

function catParts(root) {
  const parts = { root };
  root.traverse((o) => {
    const n = o.name || '';
    for (const k of ['armL', 'armR', 'tail', 'head', 'body', 'acc1', 'acc2', 'paw']) if (n.endsWith('_' + k)) parts[k] = o;
  });
  parts.eyes = [];
  root.traverse((o) => { if (o.userData && o.userData.eye) parts.eyes.push(o); });
  for (const k of ['armL', 'armR', 'tail', 'head', 'body']) if (parts[k]) { parts[k].userData.r0 = parts[k].rotation.clone(); parts[k].userData.p0 = parts[k].position.clone(); parts[k].userData.s0 = parts[k].scale.clone(); }
  parts.blink = 2 + Math.random() * 3;
  parts.ph = Math.random() * 6;
  return parts;
}

// ---------- удочка, леска, поплавок ----------
const rodGroup = new THREE.Group();
scene.add(rodGroup);
const ROD_SEG = 12;
const rodSegs = [];
const segGeo = new THREE.CylinderGeometry(1, 1, 1, 8, 1);
const rodMats = [new THREE.MeshStandardMaterial({ roughness: 0.5 }), new THREE.MeshStandardMaterial({ roughness: 0.5 }), new THREE.MeshStandardMaterial({ roughness: 0.7 })];
for (let i = 0; i < ROD_SEG; i++) {
  const m = new THREE.Mesh(segGeo, i < 3 ? rodMats[2] : rodMats[i % 2]);
  m.castShadow = true;
  rodSegs.push(m);
  rodGroup.add(m);
}
const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.07, 16), new THREE.MeshStandardMaterial({ color: 0xcfd3da, metalness: 0.7, roughness: 0.3 }));
rodGroup.add(reel);
const LINE_N = 24;
const lineGeo = new THREE.BufferGeometry();
lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(LINE_N * 3), 3));
const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }));
scene.add(line);
const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);

function setRodStyle(key) {
  const st = ROD_STYLE[key] || ROD_STYLE.bamboo;
  rodMats[0].color.set(st[0]); rodMats[1].color.set(st[1]); rodMats[2].color.set(st[2]);
  const glow = key === 'galaxy' || key === 'royal' || key === 'spooky';
  rodMats[1].emissive.set(glow ? st[1] : '#000'); rodMats[1].emissiveIntensity = glow ? 0.35 : 0;
}

let tipPos = new THREE.Vector3();
function updateRod(dt, bend, bendDir) {
  if (!playerParts || !playerParts.paw) return;
  const paw = playerParts.paw.getWorldPosition(tmpV);
  const dir = new THREE.Vector3(0.62, 0.78, 0.12).normalize();
  // замах при забросе
  if (S.phase === 'casting') {
    const k = Math.min(1, S.castT / 0.65);
    const a = k < 0.35 ? -k / 0.35 * 0.9 : -0.9 + (k - 0.35) / 0.65 * 1.25;
    dir.applyAxisAngle(new THREE.Vector3(0, 0, 1), a * 0.6);
  }
  const L = 2.0;
  const p0 = paw.clone().addScaledVector(dir, -0.35);
  const p2 = paw.clone().addScaledVector(dir, L);
  p2.addScaledVector(bendDir, bend * 0.9);
  p2.y -= bend * 0.5;
  const p1 = paw.clone().addScaledVector(dir, L * 0.55);
  const curve = new THREE.QuadraticBezierCurve3(p0, p1, p2);
  for (let i = 0; i < ROD_SEG; i++) {
    const a = curve.getPoint(i / ROD_SEG), b = curve.getPoint((i + 1) / ROD_SEG);
    const m = rodSegs[i];
    m.position.copy(a).add(b).multiplyScalar(0.5);
    const d = tmpV2.copy(b).sub(a);
    const len = d.length();
    m.quaternion.setFromUnitVectors(up, d.normalize());
    const r = THREE.MathUtils.lerp(0.055, 0.016, i / ROD_SEG) * (i < 3 ? 1.25 : 1);
    m.scale.set(r, len * 1.02, r);
  }
  reel.position.copy(curve.getPoint(0.2)).add(new THREE.Vector3(0, -0.1, 0.12));
  reel.quaternion.setFromUnitVectors(up, new THREE.Vector3(0, 0, 1));
  tipPos.copy(p2);
}

function setLine(from, to, sag) {
  const a = lineGeo.attributes.position.array;
  for (let i = 0; i < LINE_N; i++) {
    const t = i / (LINE_N - 1);
    const x = from.x + (to.x - from.x) * t, z = from.z + (to.z - from.z) * t;
    const y = from.y + (to.y - from.y) * t - sag * 4 * t * (1 - t);
    a.set([x, y, z], i * 3);
  }
  lineGeo.attributes.position.needsUpdate = true;
  lineGeo.computeBoundingSphere();
}

// рябь и брызги
const rippleMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide });
const ripples = [];
function ripple(pos, n = 2, size = 1) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 40), rippleMat.clone());
    m.rotation.x = -Math.PI / 2;
    m.position.set(pos.x, waveH(pos.x, pos.z, S.t) + 0.03, pos.z);
    m.userData = { t: -i * 0.22, size };
    m.scale.setScalar(0.01);
    scene.add(m);
    ripples.push(m);
  }
}
const drops = [];
const dropGeo = new THREE.SphereGeometry(1, 6, 4);
const dropMat = new THREE.MeshStandardMaterial({ color: 0xeaffff, emissive: 0x99ddee, emissiveIntensity: 0.4, roughness: 0.2, transparent: true });
function splash(pos, n = 18, power = 1) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(dropGeo, dropMat);
    const s = 0.03 + Math.random() * 0.05;
    m.scale.setScalar(s);
    m.position.copy(pos);
    const a = Math.random() * Math.PI * 2;
    m.userData = { v: new THREE.Vector3(Math.cos(a) * (0.8 + Math.random()) * power, (2 + Math.random() * 2.5) * power, Math.sin(a) * (0.8 + Math.random()) * power), life: 1.2 };
    scene.add(m);
    drops.push(m);
  }
}

// «!» над котом
function excTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#FFD23A'; g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#3B2A1E'; g.font = 'bold 90px -apple-system, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('!', 64, 70);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const exc = new THREE.Sprite(new THREE.SpriteMaterial({ map: excTexture(), depthTest: false, transparent: true }));
exc.scale.setScalar(0);
exc.renderOrder = 10;
scene.add(exc);
let excK = 0;
// свечение редкой рыбы под водой
const hint = new THREE.Mesh(new THREE.CircleGeometry(0.8, 32), new THREE.MeshBasicMaterial({ map: GLOW_TEX, transparent: true, opacity: 0, depthWrite: false, color: 0xffffff }));
hint.rotation.x = -Math.PI / 2;
scene.add(hint);

// ---------- сборка сцены ----------
function clearObj(o) { if (o && o.parent) o.parent.remove(o); }

function buildPlace() {
  clearObj(envRoot); clearObj(boat);
  envRoot = null; boat = null;
  const src = G.env.scene.getObjectByName('env_' + S.place);
  if (src) { envRoot = src.clone(true); world.add(envRoot); }
  if (S.place !== 'pier') {
    const b = G.env.scene.getObjectByName('boat');
    if (b) { boat = b.clone(true); world.add(boat); }
  }
  [envRoot, boat].forEach((r) => r && r.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }));
  // фонари
  lamps.forEach((l) => scene.remove(l));
  lamps.length = 0;
  const lampMeshes = [];
  [envRoot, boat].forEach((r) => r && r.traverse((o) => { if (o.isMesh && o.material && /^lamp/.test(o.material.name || '')) lampMeshes.push(o); }));
  if (S.place !== 'pier' && S.place !== 'trench') {
    // фонарь в лодке
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1, 6), new THREE.MeshStandardMaterial({ color: 0x7a5233 }));
    post.position.copy(B(SPOT_CAT.x + 1.25, 2.85, 0.85));
    post.position.set(SPOT_CAT.x + 1.25, 0.85, SPOT_CAT.z - 0.85);
    const bulb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.15, 2), new THREE.MeshStandardMaterial({ color: 0xffe2a0, emissive: 0xffb347, emissiveIntensity: 0 }));
    bulb.position.set(SPOT_CAT.x + 1.25, 1.38, SPOT_CAT.z - 0.85);
    bulb.material.name = 'lamp';
    (boat || world).attach(post); (boat || world).attach(bulb);
    lampMeshes.push(bulb);
  }
  for (const m of lampMeshes) {
    const l = new THREE.PointLight(0xffb868, 0, 9, 1.6);
    m.getWorldPosition(l.position);
    l.position.y += 0.2;
    l.userData.mesh = m;
    scene.add(l);
    lamps.push(l);
  }
  placePlayer();
  placeHelpers();
}

function placePlayer() {
  clearObj(player);
  const src = G.cats.scene.getObjectByName('cat_player_' + S.outfit);
  if (!src) return;
  player = src.clone(true);
  dressCat(player, 'orange', S.outfit);
  player.scale.setScalar(0.72);
  const parent = boat || world;
  parent.add(player);
  if (boat) player.position.set(0, -0.4, 0.05); else player.position.copy(SPOT_CAT);
  player.rotation.y = -0.25;
  playerParts = catParts(player);
  if (playerParts.acc1) playerParts.acc1.visible = false;
  if (playerParts.acc2) playerParts.acc2.visible = false;
}

function placeHelpers() {
  helperObjs.forEach((h) => clearObj(h.root));
  helperObjs.length = 0;
  const slots = S.place === 'pier' ? [B(1.5, 2.15, 0.95), B(0.15, 2.15, 0.95)] : [new THREE.Vector3(-1.15, -0.42, 0.05), new THREE.Vector3(1.0, -0.42, 0.05)];
  S.helpers.slice(0, 2).forEach((h, i) => {
    const src = G.cats.scene.getObjectByName('cat_helper_' + h.id);
    if (!src) return;
    const r = src.clone(true);
    const hp = (CATP.helpers.find((x) => x[0] === h.id) || [h.id, 'orange', 'sailor']);
    dressCat(r, hp[1], hp[2]);
    r.scale.setScalar(0.48);
    const parent = boat || world;
    parent.add(r);
    if (boat) r.position.set(slots[i].x, slots[i].y, slots[i].z); else r.position.copy(slots[i]);
    r.rotation.y = 0.15 + i * 0.2;
    const parts = catParts(r);
    if (parts.acc1) parts.acc1.visible = h.tier >= 1;
    if (parts.acc2) parts.acc2.visible = h.tier >= 2;
    // маленькая удочка
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.025, 1.6, 6), new THREE.MeshStandardMaterial({ color: 0xc9a25d }));
    scene.add(rod);
    const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }));
    scene.add(ln);
    const bob = G.items.scene.getObjectByName('bobber_classic').clone(true);
    bob.scale.setScalar(0.13);
    scene.add(bob);
    helperObjs.push({ root: r, parts, rod, ln, bob, ph: Math.random() * 6 });
  });
}

function setBobber() {
  clearObj(bobberObj);
  const src = G.items.scene.getObjectByName('bobber_' + S.bobber) || G.items.scene.getObjectByName('bobber_classic');
  bobberObj = src.clone(true);
  bobberObj.scale.setScalar(0.24);
  bobberObj.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  scene.add(bobberObj);
}

function applyTod() {
  const P = TOD[S.tod];
  skyUni.top.value.set(P.top); skyUni.mid.value.set(P.mid); skyUni.low.value.set(P.low);
  const pw = PLACE_WATER[S.place];
  let w1 = P.water, w2 = P.water2;
  if (pw.all) [w1, w2] = pw[S.tod] || pw.all;
  else if (pw[S.tod]) [w1, w2] = pw[S.tod];
  waterU.uNear.value.set(w1); waterU.uFar.value.set(w2);
  const haze = new THREE.Color(P.low).lerp(new THREE.Color(w2), 0.45);
  waterU.uHaze.value.copy(haze);
  waterU.uAmp.value = pw.amp * (S.tod === 'storm' ? 1.8 : 1);
  scene.fog = new THREE.Fog(haze, 40, 170);
  farMat.color.copy(haze).lerp(new THREE.Color(P.mid), 0.2);
  farMat.emissive.copy(haze); farMat.emissiveIntensity = 0.5;
  farIslands.visible = S.place !== 'trench';
  hemi.color.set(P.top).lerp(new THREE.Color('#ffffff'), 0.55);
  hemi.groundColor.set(w2);
  hemi.intensity = P.hemi;
  sun.color.set(P.sun); sun.intensity = P.sunI;
  const d = new THREE.Vector3(...P.sunDir).normalize();
  sun.position.copy(SPOT_CAT).addScaledVector(d, 25);
  sun.target.position.copy(SPOT_CAT);
  cloudMat.color.set(P.cloud); cloudMat.emissive.set(P.cloud);
  cloudMat.emissiveIntensity = S.tod === 'night' ? 0.35 : S.tod === 'storm' ? 0.25 : 0.45;
  stars.visible = !!P.stars;
  rain.visible = !!P.rain;
  gulls.visible = (S.tod === 'sunset' || S.tod === 'dawn' || S.tod === 'storm') && S.place !== 'trench';
  gulls.children.forEach((g) => g.material.color.set(S.tod === 'storm' ? '#2b2f3a' : '#ffffff'));
  if (P.disc) {
    sunSprite.visible = true;
    sunSprite.material.color.set(P.disc);
    sunSprite.position.copy(B(...P.discPos)).sub(CAM_POS).normalize().multiplyScalar(380).add(CAM_POS);
    sunSprite.scale.setScalar(S.tod === 'night' ? 34 : 52);
  } else sunSprite.visible = false;
  // окружение для отражений
  const envScene = new THREE.Scene();
  envScene.add(sky.clone());
  const tex = pmrem.fromScene(envScene, 0.02).texture;
  scene.environment = tex;
  waterMat.envMap = tex;
  waterMat.needsUpdate = true;
  lamps.forEach((l) => { l.userData.base = P.lamp; });
  scene.traverse((o) => {
    if (o.isMesh && o.material && /^lamp/.test(o.material.name || '')) { o.material.emissiveIntensity = 0.3 + P.lamp * 6; }
  });
}

// ---------- команды ----------
const api = {
  cmd(m) {
    try { handle(m); } catch (e) { post({ type: 'error', msg: String(e.message || e) }); }
  },
};
window.game = api;

function handle(m) {
  switch (m.type) {
    case 'state': {
      const placeChanged = m.place !== S.place, todChanged = m.tod !== S.tod;
      const outfitChanged = m.outfit !== S.outfit;
      const helpersChanged = JSON.stringify(m.helpers || []) !== JSON.stringify(S.helpers);
      Object.assign(S, { place: m.place, tod: m.tod, outfit: m.outfit, rod: m.rod, bobber: m.bobber, helpers: m.helpers || [] });
      if (!S.ready) return;
      if (placeChanged) buildPlace();
      else {
        if (outfitChanged) placePlayer();
        if (helpersChanged) placeHelpers();
      }
      setRodStyle(S.rod);
      setBobber();
      if (placeChanged || todChanged) applyTod();
      break;
    }
    case 'pause': S.paused = !!m.on; break;
    case 'cast': S.phase = 'casting'; S.castT = 0; break;
    case 'land': S.phase = 'waiting'; ripple(SPOT_BOB, 2, 0.8); splash(new THREE.Vector3(SPOT_BOB.x, 0.05, SPOT_BOB.z), 8, 0.5); break;
    case 'twitch': S.twitch = 0.35; break;
    case 'bite':
      S.phase = 'bite'; S.biteRarity = m.rarity; S.biteT = 0; excK = 1; S.zoomT = 1;
      ripple(SPOT_BOB, 3, 1.1); splash(new THREE.Vector3(SPOT_BOB.x, 0.05, SPOT_BOB.z), 10, 0.6);
      hint.material.color.set(RARITY_COLOR[m.rarity] || '#fff');
      S.hintOn = ['rare', 'epic', 'legendary'].includes(m.rarity);
      break;
    case 'hook': S.shake = 0.5; excK = 0; break;
    case 'fight': startFight(m.fish); break;
    case 'fightM': S.fightM = m.m; S.fightTen = m.ten || 0; break;
    case 'catch': catchFish(m.fish); break;
    case 'lost': loseFish(); break;
    case 'reel': S.phase = 'idle'; S.zoomT = 0; excK = 0; S.hintOn = false; endFightObj(); break;
    default: break;
  }
}

function fishModel(id) {
  const src = G.fish.scene.getObjectByName('fish_' + id);
  if (!src) return null;
  const f = src.clone(true);
  // нормализуем размер
  const box = new THREE.Box3().setFromObject(f);
  const size = box.getSize(new THREE.Vector3());
  const k = 1 / Math.max(size.x, size.y, size.z);
  const g = new THREE.Group();
  const c = box.getCenter(new THREE.Vector3());
  f.position.sub(c);
  g.add(f);
  g.userData.k = k;
  return g;
}

function startFight(fish) {
  endFightObj();
  S.phase = 'fight';
  S.zoomT = 1;
  excK = 0;
  const g = fishModel(fish.id);
  if (!g) return;
  const r = fish.rarity;
  const sz = { uncommon: 1.0, rare: 1.25, epic: 1.5, legendary: 1.9 }[r] || 1;
  g.scale.setScalar(g.userData.k * sz);
  g.userData.base = g.userData.k * sz;
  scene.add(g);
  fightObj = g;
  S.fightFish = fish;
  S.fightM = 0.5;
  S.splashT = 0;
}
function endFightObj() { clearObj(fightObj); fightObj = null; S.fightFish = null; }

function catchFish(fish) {
  const g = fightObj || (() => { const x = fishModel(fish.id); if (x) { x.scale.setScalar(x.userData.k * 0.9); x.position.copy(SPOT_BOB); scene.add(x); } return x; })();
  fightObj = null;
  S.fightFish = null;
  if (!g) return;
  const from = g.position.clone();
  splash(new THREE.Vector3(from.x, 0.05, from.z), 26, 1.1);
  ripple(from, 3, 1.4);
  S.jump = { g, t: 0, from, s0: g.scale.x };
  S.phase = 'idle';
  S.shake = 0.25;
}
function loseFish() {
  if (fightObj) {
    splash(new THREE.Vector3(fightObj.position.x, 0.05, fightObj.position.z), 14, 0.8);
    ripple(fightObj.position, 2, 1);
  }
  endFightObj();
  S.phase = 'idle';
  S.zoomT = 0;
}

// ---------- анимация ----------
let last = performance.now();
const bobPos = new THREE.Vector3();
const camPos = CAM_POS.clone(), camTgt = CAM_TGT.clone();

function animCat(parts, t, dt, hero) {
  if (!parts) return;
  const ph = parts.ph;
  const breath = Math.sin(t * 2.1 + ph);
  if (parts.body) { const s0 = parts.body.userData.s0; parts.body.scale.set(s0.x * (1 + breath * 0.012), s0.y * (1 + breath * 0.018), s0.z * (1 + breath * 0.012)); }
  if (parts.head) {
    parts.head.rotation.z = parts.head.userData.r0.z + Math.sin(t * 0.7 + ph) * 0.06;
    parts.head.rotation.x = parts.head.userData.r0.x + Math.sin(t * 0.9 + ph) * 0.03 + (hero && S.phase === 'bite' ? -0.12 : 0);
    parts.head.position.y = parts.head.userData.p0.y + Math.sin(t * 2.1 + ph) * 0.012;
  }
  if (parts.tail) {
    parts.tail.rotation.y = parts.tail.userData.r0.y + Math.sin(t * 1.6 + ph) * 0.25;
    parts.tail.rotation.x = parts.tail.userData.r0.x + Math.sin(t * 1.1 + ph) * 0.08;
  }
  // моргание
  parts.blink -= dt;
  let eyeK = 1;
  if (parts.blink < 0) {
    const k = -parts.blink / 0.16;
    eyeK = k < 0.5 ? 1 - k * 2 * 0.9 : 0.1 + (k - 0.5) * 2 * 0.9;
    if (parts.blink < -0.16) parts.blink = 2.5 + Math.random() * 3.5;
  }
  parts.eyes.forEach((e) => { e.scale.y = (e.userData.sy || (e.userData.sy = e.scale.y)) * Math.max(0.08, eyeK); });
  // руки
  if (parts.armR && parts.armL) {
    let ar = 0, al = 0;
    if (hero) {
      if (S.phase === 'casting') {
        const k = Math.min(1, S.castT / 0.65);
        ar = k < 0.35 ? -k / 0.35 * 0.7 : -0.7 + (k - 0.35) / 0.65 * 0.9;
        al = ar * 0.6;
      } else if (S.phase === 'fight') {
        ar = 0.25 + Math.sin(t * 14) * 0.06 * (0.5 + S.fightTen);
        al = ar;
      } else if (S.phase === 'bite') {
        ar = Math.sin(t * 22) * 0.05;
      }
    }
    parts.armR.rotation.x = parts.armR.userData.r0.x + ar;
    parts.armL.rotation.x = parts.armL.userData.r0.x + al;
  }
  if (hero) {
    const lean = S.phase === 'fight' ? -0.12 - S.fightTen * 0.08 + Math.sin(t * 9) * 0.02 : 0;
    parts.root.rotation.x += (lean - parts.root.rotation.x) * Math.min(1, dt * 6);
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (S.paused || !S.ready) return;
  S.t += dt;
  const t = S.t;
  waterU.uT.value = t;

  // облака, чайки, дождь
  clouds.children.forEach((c) => { c.position.x += c.userData.v * dt * 0.6; if (c.position.x > 45) c.position.x = -45; });
  if (gulls.visible) gulls.children.forEach((g) => {
    const u = g.userData;
    const a = t * u.sp + u.ph;
    g.position.set(u.cx + Math.cos(a) * u.rad, u.y + Math.sin(a * 2) * 0.4, u.cz + Math.sin(a) * u.rad * 0.4);
    const fl = 0.55 + Math.sin(t * 6 + u.ph) * 0.35;
    g.scale.set(u.s, u.s * 0.5 * fl, 1);
  });
  if (rain.visible) {
    const a = rainGeo.attributes.position.array;
    for (let i = 0; i < RAIN_N; i++) {
      let y = a[i * 6 + 1] - dt * 12;
      let x = a[i * 6] - dt * 2;
      if (y < -0.5) { y = 9; x = Math.random() * 22 - 8; }
      a[i * 6] = x; a[i * 6 + 1] = y; a[i * 6 + 3] = x - 0.12; a[i * 6 + 4] = y - 0.7;
    }
    rainGeo.attributes.position.needsUpdate = true;
  }
  stars.material.opacity = 0.75 + Math.sin(t * 3) * 0.15;
  // фонари мерцают
  lamps.forEach((l, i) => { l.intensity = (l.userData.base || 0) * (14 + Math.sin(t * 9 + i) * 1.2 + Math.sin(t * 23 + i) * 0.8); });
  // кристаллы в жёлобе
  if (envRoot && S.place === 'trench') envRoot.traverse((o) => { if (o.isMesh && o.material && o.material.emissive && /^(crys|orb)/.test(o.material.name || '')) { o.material.emissiveIntensity = 3 + Math.sin(t * 2 + o.id) * 1.5; } });

  // лодка качается
  if (boat) {
    const h = waveH(SPOT_CAT.x, SPOT_CAT.z, t);
    boat.position.y = SPOT_CAT.y - 0.95 + 0.95 + h * 0.8;
    boat.rotation.z = Math.sin(t * 1.3) * 0.035 + (waveH(SPOT_CAT.x + 1, SPOT_CAT.z, t) - waveH(SPOT_CAT.x - 1, SPOT_CAT.z, t)) * 0.3;
    boat.rotation.x = Math.sin(t * 0.9) * 0.025;
  }

  // кот
  animCat(playerParts, t, dt, true);
  helperObjs.forEach((h) => {
    animCat(h.parts, t, dt, false);
    const pw = (h.parts.paw || h.root).getWorldPosition(tmpV);
    const dir = new THREE.Vector3(0.5, 0.8, 0.2).normalize();
    const tip = pw.clone().addScaledVector(dir, 1.6);
    h.rod.position.copy(pw).addScaledVector(dir, 0.75);
    h.rod.quaternion.setFromUnitVectors(up, dir);
    const bp = new THREE.Vector3(tip.x + 0.5, 0, tip.z + 1.2);
    bp.y = waveH(bp.x, bp.z, t) + 0.02;
    h.bob.position.copy(bp);
    h.ln.geometry.setFromPoints([tip, bp]);
  });

  // поклёвка, бой
  let bend = 0;
  const bendDir = new THREE.Vector3(1, 0, 0.3).normalize();
  const target = new THREE.Vector3();
  if (S.phase === 'casting') S.castT += dt;
  if (S.phase === 'fight') bend = 0.35 + S.fightTen * 0.5 + Math.sin(t * 13) * 0.05;
  else if (S.phase === 'bite') bend = 0.12 + Math.sin(t * 25) * 0.04;
  updateRod(dt, bend, bendDir);

  if (bobberObj) {
    const wy = waveH(SPOT_BOB.x, SPOT_BOB.z, t);
    if (S.phase === 'idle') {
      // висит на кончике и покачивается
      bobPos.set(tipPos.x + Math.sin(t * 1.7) * 0.05, tipPos.y - 0.75, tipPos.z + Math.cos(t * 1.3) * 0.04);
      bobberObj.visible = true;
    } else if (S.phase === 'casting') {
      const k = Math.min(1, S.castT / 0.65);
      const k2 = Math.max(0, (k - 0.25) / 0.75);
      bobPos.lerpVectors(new THREE.Vector3(tipPos.x, tipPos.y - 0.6, tipPos.z), new THREE.Vector3(SPOT_BOB.x, wy, SPOT_BOB.z), k2);
      bobPos.y += Math.sin(k2 * Math.PI) * 1.6;
      bobberObj.rotation.z = k2 * 8;
      bobberObj.visible = true;
    } else if (S.phase === 'waiting' || S.phase === 'bite') {
      let dip = 0;
      if (S.twitch) { dip = S.twitch; S.twitch = Math.max(0, S.twitch - dt * 1.5); }
      if (S.phase === 'bite') { S.biteT += dt; dip = 0.32 + Math.sin(S.biteT * 18) * 0.06; }
      bobPos.set(SPOT_BOB.x + Math.sin(t * 0.8) * 0.03, wy - dip * 0.5 + Math.sin(t * 2.2) * 0.012, SPOT_BOB.z);
      bobberObj.rotation.z = Math.sin(t * 1.9) * 0.08 + (S.phase === 'bite' ? Math.sin(S.biteT * 20) * 0.3 : 0);
      bobberObj.visible = true;
    } else if (S.phase === 'fight') {
      bobberObj.visible = false;
    }
    bobberObj.position.copy(bobPos);
    if (S.phase !== 'casting' && S.phase !== 'bite' && S.phase !== 'waiting') bobberObj.rotation.z *= 0.9;
  }
  // рыба в бою
  if (fightObj && S.phase === 'fight') {
    const x = SPOT_BOB.x - 0.9 + S.fightM * 2.2;
    const z = SPOT_BOB.z + Math.sin(t * 1.3) * 0.35;
    const wy = waveH(x, z, t);
    fightObj.position.set(x, wy - 0.05 + Math.abs(Math.sin(t * 7)) * 0.18, z);
    fightObj.rotation.set(Math.sin(t * 11) * 0.5, Math.PI * 0.5 + Math.sin(t * 6) * 0.6, Math.sin(t * 9) * 0.35);
    S.splashT -= dt;
    if (S.splashT <= 0) { splash(new THREE.Vector3(x, wy + 0.05, z), 6, 0.55); ripple(fightObj.position, 1, 0.8); S.splashT = 0.22 + Math.random() * 0.25; }
    target.copy(fightObj.position);
  } else target.copy(bobPos).add(new THREE.Vector3(0, 0.14, 0));
  // леска
  const sag = S.phase === 'fight' ? 0.02 : S.phase === 'idle' ? 0.0 : S.phase === 'casting' ? 0.1 : 0.32;
  setLine(tipPos, target, sag);
  line.visible = !(S.jump && S.jump.t < 0.4);

  // прыжок пойманной рыбы
  if (S.jump) {
    const J = S.jump;
    J.t += dt;
    const k = Math.min(1, J.t / 1.25);
    const to = new THREE.Vector3(SPOT_CAT.x - 1.6, 0.4, SPOT_CAT.z + 2.5);
    const p = new THREE.Vector3().lerpVectors(J.from, to, k);
    p.y += Math.sin(k * Math.PI) * 2.6;
    J.g.position.copy(p);
    J.g.rotation.set(k * 9, Math.PI * 0.5, Math.sin(k * 12) * 0.6);
    const s = J.s0 * (k < 0.7 ? 1 + k * 0.4 : (1 - (k - 0.7) / 0.3) * 1.28);
    J.g.scale.setScalar(Math.max(0.001, s));
    if (k >= 1) { clearObj(J.g); S.jump = null; post({ type: 'jumpDone' }); }
  }

  // «!» и свечение
  if (playerParts && playerParts.head) {
    const hp = playerParts.head.getWorldPosition(tmpV);
    exc.position.set(hp.x - 0.15, hp.y + 1.25, hp.z + 0.2);
  }
  const ek = excK ? 0.75 + Math.sin(t * 10) * 0.05 : 0;
  exc.scale.setScalar(THREE.MathUtils.lerp(exc.scale.x, ek, Math.min(1, dt * 14)));
  hint.position.set(SPOT_BOB.x, waveH(SPOT_BOB.x, SPOT_BOB.z, t) - 0.04, SPOT_BOB.z);
  hint.material.opacity += ((S.hintOn ? 0.55 + Math.sin(t * 6) * 0.15 : 0) - hint.material.opacity) * Math.min(1, dt * 5);
  hint.scale.setScalar(1.4 + Math.sin(t * 3) * 0.1);

  // рябь и брызги
  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i];
    r.userData.t += dt;
    const k = r.userData.t / 1.2;
    if (k < 0) continue;
    r.scale.setScalar(0.05 + k * 1.3 * r.userData.size);
    r.material.opacity = 0.75 * (1 - k);
    if (k >= 1) { scene.remove(r); r.geometry.dispose(); ripples.splice(i, 1); }
  }
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];
    d.userData.v.y -= 9.8 * dt;
    d.position.addScaledVector(d.userData.v, dt);
    d.userData.life -= dt;
    if (d.userData.life <= 0 || d.position.y < -0.3) { scene.remove(d); drops.splice(i, 1); }
  }

  // камера: лёгкое дыхание + приближение при поклёвке/бое + тряска
  S.zoom += (S.zoomT - S.zoom) * Math.min(1, dt * 2.5);
  const focus = S.phase === 'fight' && fightObj ? fightObj.position : SPOT_BOB;
  camPos.copy(CAM_POS).lerp(new THREE.Vector3(focus.x * 0.4 + CAM_POS.x * 0.6, CAM_POS.y - 0.35, CAM_POS.z - 1.4), S.zoom * 0.5);
  camPos.x += Math.sin(t * 0.25) * 0.06;
  camPos.y += Math.sin(t * 0.33) * 0.04;
  camTgt.copy(CAM_TGT).lerp(new THREE.Vector3(focus.x, CAM_TGT.y, CAM_TGT.z), S.zoom * 0.25);
  if (S.shake > 0) {
    S.shake = Math.max(0, S.shake - dt);
    camPos.x += (Math.random() - 0.5) * S.shake * 0.25;
    camPos.y += (Math.random() - 0.5) * S.shake * 0.25;
  }
  camera.position.copy(camPos);
  camera.lookAt(camTgt);
  renderer.render(scene, camera);
}

// ---------- старт ----------
(async function start() {
  try {
    const [fish, cats, env, items] = await Promise.all([loadGLB('fish'), loadGLB('cats'), loadGLB('env'), loadGLB('items')]);
    G.fish = fish; G.cats = cats; G.env = env; G.items = items;
    dressFish(G.fish.scene);
    G.env.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    S.ready = true;
    buildPlace();
    setRodStyle(S.rod);
    setBobber();
    applyTod();
    requestAnimationFrame(frame);
    post({ type: 'ready' });
  } catch (e) {
    post({ type: 'error', msg: 'load: ' + String(e && e.message || e) });
  }
})();
