// Sheep grazing grass — an independent, from-scratch reimplementation of the
// scene shown in areadne's (@AreadneMaria) video. No original code was available.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { LAYOUT } from './layout.js';

const W = 27, D = 18.7;                 // board size in metres (x, z)
const TEXW = 2048, TEXH = Math.round(TEXW * D / W);
const uv2w = (u, v) => new THREE.Vector3((u - 0.5) * W, 0, (v - 0.5) * D);
const rand = mulberry(7);
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const R = (a, b) => a + (b - a) * rand();
const clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp;

// ---------- renderer / scene / camera ----------
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NoToneMapping;
renderer.toneMappingExposure = 1.0;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(47, 1, 0.5, 300);
const HOME = { target: new THREE.Vector3(0, 0, 1.0), dir: new THREE.Vector3(0, 0.88, 0.475).normalize(), dist: 27 };

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.minDistance = 10; controls.maxDistance = 110;
controls.minPolarAngle = 0.12; controls.maxPolarAngle = 1.2;

controls.rotateSpeed = 0.55; controls.zoomSpeed = 0.8; controls.panSpeed = 0.8;
controls.screenSpacePanning = false;
controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
function portrait(){ return innerWidth / innerHeight < 0.8; }
function fitDist(){ const a = innerWidth / innerHeight, span = portrait() ? D : W; const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  return clamp(Math.max(HOME.dist, span * 0.56 / (t * a), (portrait() ? W : D) * 0.62 / t), HOME.dist, 95); }
function homeView(){ controls.target.copy(HOME.target); const dir = HOME.dir.clone();
  if (portrait()){ dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2); controls.target.set(-0.8, 0, 0); }
  camera.position.copy(controls.target).addScaledVector(dir, fitDist()); controls.update(); }

// lights: warm key from the left/front, soft sky fill
const hemi = new THREE.HemisphereLight(0xfffaf0, 0xb4bc90, 1.95); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff3e0, 1.9);
sun.position.set(-28, 21, 7); sun.target.position.set(0, 0, 0);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 17, bottom: -17, near: 5, far: 90 });
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03; sun.shadow.radius = 6; sun.shadow.blurSamples = 16;
scene.add(sun, sun.target);

// ---------- helpers for the 2D layout ----------
const P = a => a.map(([u, v]) => [u * TEXW, v * TEXH]);
function smoothPath(ctx, pts){ ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++){ const mx = (pts[i][0] + pts[i+1][0]) / 2, my = (pts[i][1] + pts[i+1][1]) / 2; ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my); }
  const l = pts[pts.length - 1]; ctx.lineTo(l[0], l[1]); }
function polyPath(ctx, pts){ ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); }
function inPoly(x, y, pts){ let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++){ const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) != (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
// dense, smoothed river centre line in world coords for collision + ribbon
const riverCurve = new THREE.CatmullRomCurve3(LAYOUT.river.map(([u, v]) => uv2w(u, v)), false, 'centripetal');
const riverPts = riverCurve.getSpacedPoints(160);
const pathCurve = new THREE.CatmullRomCurve3(LAYOUT.path.map(([u, v]) => uv2w(u, v)), false, 'centripetal');
const RIVER_HALF = 0.5;
function riverDist(x, z){ let best = 1e9, bi = 0; for (let i = 0; i < riverPts.length; i++){ const p = riverPts[i], d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < best){ best = d; bi = i; } } return { d: Math.sqrt(best), i: bi }; }

// ---------- value noise ----------
const perm = new Uint8Array(512); { const p = [...Array(256).keys()]; for (let i = 255; i > 0; i--){ const j = (rand() * (i + 1)) | 0; [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) perm[i] = p[i & 255]; }
function vnoise(x, y){ const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi; const h = (a, b) => perm[(perm[a & 255] + b) & 255] / 255;
  const s = t => t * t * (3 - 2 * t), u = s(xf), v = s(yf);
  return lerp(lerp(h(xi, yi), h(xi + 1, yi), u), lerp(h(xi, yi + 1), h(xi + 1, yi + 1), u), v); }
const fbm = (x, y) => vnoise(x, y) * 0.55 + vnoise(x * 2.1, y * 2.1) * 0.28 + vnoise(x * 4.3, y * 4.3) * 0.17;

// ---------- ground painting ----------
function paintGround(){
  const cv = document.createElement('canvas'); cv.width = TEXW; cv.height = TEXH;
  const g = cv.getContext('2d');
  const L = { dark: P(LAYOUT.dark), wheat: P(LAYOUT.wheat), central: P(LAYOUT.central) };
  // base meadow
  g.fillStyle = '#a5cd4a'; g.fillRect(0, 0, TEXW, TEXH);
  // field tones (soft edged)
  g.filter = 'blur(10px)';
  g.fillStyle = '#78bd34'; polyPath(g, L.central); g.fill();
  g.fillStyle = '#8ab54a'; polyPath(g, L.dark); g.fill();
  // right-of-path upper fields slightly deeper
  g.fillStyle = 'rgba(120,178,52,.55)'; polyPath(g, P([[0.6,0],[0.79,0],[0.83,0.38],[0.64,0.3],[0.61,0.2]])); g.fill();
  g.filter = 'none';
  // big soft tonal blotches, like pigment pooling
  for (let i = 0; i < 160; i++){ const x = R(0, TEXW), y = R(0, TEXH), r = R(60, 220);
    const gr = g.createRadialGradient(x, y, 0, x, y, r); const dark = rand() < 0.5;
    gr.addColorStop(0, dark ? 'rgba(60,110,20,.06)' : 'rgba(235,245,150,.09)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  // wheat field
  g.save(); polyPath(g, L.wheat); g.clip();
  g.fillStyle = '#d2b452'; g.fillRect(0, 0, TEXW, TEXH);
  for (let i = 0; i < 9000; i++){ const x = R(TEXW * 0.45, TEXW), y = R(TEXH * 0.6, TEXH); const l = R(5, 12);
    g.strokeStyle = rand() < 0.5 ? 'rgba(170,135,40,.35)' : 'rgba(240,215,120,.45)'; g.lineWidth = R(1, 2);
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + R(-2, 2), y - l); g.stroke(); }
  g.restore();
  // grass strokes — short vertical ticks, the "pencil" texture of the meadow
  const wheatPoly = L.wheat;
  for (let i = 0; i < 140000; i++){
    const x = R(0, TEXW), y = R(0, TEXH);
    if (inPoly(x, y, wheatPoly)) continue;
    const l = R(4, 11), t = rand();
    g.strokeStyle = t < 0.5 ? `rgba(60,130,25,${R(.08,.2).toFixed(2)})` : t < 0.85 ? `rgba(200,235,110,${R(.1,.22).toFixed(2)})` : `rgba(40,100,20,${R(.1,.22).toFixed(2)})`;
    g.lineWidth = R(0.9, 1.8); g.beginPath(); g.moveTo(x, y); g.lineTo(x + R(-1.5, 1.5), y - l); g.stroke();
  }
  // hedgerows — dark, soft, slightly raised bands (shadow + body + top light)
  const hedges = LAYOUT.hedges.map(P);
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.filter = 'blur(12px)'; g.strokeStyle = 'rgba(30,70,15,.5)'; g.lineWidth = 50;
  hedges.forEach(h => { smoothPath(g, h.map(([x, y]) => [x + 14, y + 4])); g.stroke(); });
  g.filter = 'blur(3px)'; g.strokeStyle = '#2f6c1d'; g.lineWidth = 30;
  hedges.forEach(h => { smoothPath(g, h); g.stroke(); });
  g.filter = 'blur(3px)'; g.strokeStyle = 'rgba(80,145,45,.45)'; g.lineWidth = 8;
  hedges.forEach(h => { smoothPath(g, h.map(([x, y]) => [x - 3, y - 3])); g.stroke(); });
  g.filter = 'none';
  // hedge leaf speckle
  hedges.forEach(h => { for (let k = 0; k < h.length - 1; k++){ const [x0, y0] = h[k], [x1, y1] = h[k+1]; const n = Math.hypot(x1 - x0, y1 - y0) / 2;
    for (let j = 0; j < n; j++){ const t = rand(); g.fillStyle = rand() < .5 ? 'rgba(30,70,15,.35)' : 'rgba(110,170,60,.3)'; g.beginPath(); g.arc(lerp(x0, x1, t) + R(-9, 9), lerp(y0, y1, t) + R(-9, 9), R(1, 2.6), 0, 7); g.fill(); } } });
  // dirt path
  const path = P(LAYOUT.path);
  g.filter = 'blur(3px)'; g.strokeStyle = 'rgba(150,120,60,.35)'; g.lineWidth = 70; smoothPath(g, path); g.stroke();
  g.filter = 'blur(1.5px)'; g.strokeStyle = '#e3c88f'; g.lineWidth = 60; smoothPath(g, path); g.stroke();
  g.filter = 'blur(4px)'; g.strokeStyle = 'rgba(245,226,180,.7)'; g.lineWidth = 20; smoothPath(g, path.map(([x, y]) => [x - 3, y])); g.stroke();
  g.filter = 'none';
  // river: sandy banks, deep blue water, lighter channel
  const river = P(LAYOUT.river);
  g.filter = 'blur(2px)';
  g.strokeStyle = '#dcc286'; g.lineWidth = 94; smoothPath(g, river); g.stroke();
  g.strokeStyle = '#2251c4'; g.lineWidth = 76; smoothPath(g, river); g.stroke();
  g.filter = 'blur(8px)'; g.strokeStyle = 'rgba(70,130,235,.85)'; g.lineWidth = 30; smoothPath(g, river.map(([x, y]) => [x - 4, y])); g.stroke();
  g.filter = 'none';
  // wildflowers: clustered yellow / orange / cream dots
  for (let c = 0; c < 110; c++){ const cx = R(0, TEXW), cy = R(0, TEXH), cr = R(30, 120), n = (R(8, 40)) | 0;
    for (let i = 0; i < n; i++){ const a = R(0, 6.283), r = cr * Math.sqrt(rand()); const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      if (inPoly(x, y, wheatPoly)) continue;
      const t = rand(); g.fillStyle = t < 0.5 ? '#f3c531' : t < 0.82 ? '#ef9b2c' : '#fff3d2';
      g.beginPath(); g.arc(x, y, R(1.6, 2.8), 0, 7); g.fill(); } }
  // re-cover flowers that landed in water / path
  g.filter = 'blur(1.5px)'; g.strokeStyle = '#2a5ccc'; g.lineWidth = 62; smoothPath(g, river); g.stroke();
  g.filter = 'blur(9px)'; g.strokeStyle = 'rgba(80,140,240,.75)'; g.lineWidth = 26; smoothPath(g, river.map(([x, y]) => [x - 4, y])); g.stroke();
  g.filter = 'blur(1.5px)'; g.strokeStyle = 'rgba(227,200,143,.9)'; g.lineWidth = 50; smoothPath(g, path); g.stroke();
  g.filter = 'none';

  // ragged, bleeding paper edge -> alpha (dithered, used with alphaTest)
  const img = g.getImageData(0, 0, TEXW, TEXH), d = img.data;
  const inset = 26;
  for (let y = 0; y < TEXH; y++){
    for (let x = 0; x < TEXW; x++){
      const e = Math.min(x, y, TEXW - 1 - x, TEXH - 1 - y);
      if (e > 160) continue;
      const i = (y * TEXW + x) * 4;
      const n = fbm(x * 0.02, y * 0.02), n2 = vnoise(x * 0.25, y * 0.25);
      const edge = inset + n * 46 + n2 * 10;
      const k = (e - edge) / 22;             // <0 outside, >1 solid
      let a;
      if (k >= 1) a = 1; else if (k <= -0.9) a = 0; else a = (Math.random() < (k + 0.9) / 1.9) ? 1 : 0;
      d[i + 3] = a ? 255 : 0;
      // fade colour toward a pale wash near the rim
      const f = clamp(1 - (e - edge) / 70, 0, 1) * 0.35;
      if (f > 0){ d[i] = lerp(d[i], 205, f); d[i + 1] = lerp(d[i + 1], 222, f); d[i + 2] = lerp(d[i + 2], 140, f); }
    }
  }
  g.putImageData(img, 0, 0);
  return cv;
}

const groundTex = new THREE.CanvasTexture(paintGround());
groundTex.colorSpace = THREE.SRGBColorSpace;
groundTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
const ground = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: groundTex, alphaTest: 0.5, roughness: 1, metalness: 0 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

// ---------- grazed-grass wear map ----------
const WEAR_W = 216, WEAR_H = Math.round(WEAR_W * D / W);
const wear = new Float32Array(WEAR_W * WEAR_H);
const wearData = new Uint8Array(WEAR_W * WEAR_H * 4);
const wearTex = new THREE.DataTexture(wearData, WEAR_W, WEAR_H, THREE.RGBAFormat);
wearTex.magFilter = THREE.LinearFilter; wearTex.minFilter = THREE.LinearFilter; wearTex.flipY = true;
const wearMesh = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({
  color: 0xcdd07c, alphaMap: wearTex, transparent: true, opacity: 0.7, roughness: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
wearMesh.rotation.x = -Math.PI / 2; wearMesh.position.y = 0.01; wearMesh.receiveShadow = true; scene.add(wearMesh);
function wearAt(x, z){ const i = Math.floor((x / W + 0.5) * WEAR_W), j = Math.floor((z / D + 0.5) * WEAR_H); if (i < 0 || j < 0 || i >= WEAR_W || j >= WEAR_H) return 1; return wear[j * WEAR_W + i]; }
function addWear(x, z, r, amt){ const ci = (x / W + 0.5) * WEAR_W, cj = (z / D + 0.5) * WEAR_H, rr = r / W * WEAR_W;
  for (let j = Math.floor(cj - rr); j <= cj + rr; j++) for (let i = Math.floor(ci - rr); i <= ci + rr; i++){
    if (i < 0 || j < 0 || i >= WEAR_W || j >= WEAR_H) continue; const dd = Math.hypot(i - ci, j - cj) / rr; if (dd > 1) continue;
    const k = j * WEAR_W + i; wear[k] = clamp(wear[k] + amt * (1 - dd * dd), 0, 1); } }
let wearDirty = 0;
function flushWear(dt){
  for (let k = 0; k < wear.length; k++){ if (wear[k] > 0) wear[k] = Math.max(0, wear[k] - dt * 0.012); const v = (wear[k] * 255) | 0; wearData[k*4] = wearData[k*4+1] = wearData[k*4+2] = v; wearData[k*4+3] = 255; }
  wearTex.needsUpdate = true; }

// ---------- river ribbon with drifting light streaks ----------
{
  const N = riverPts.length, pos = [], uvs = [], idx = [];
  let acc = 0;
  for (let i = 0; i < N; i++){
    const p = riverPts[i], q = riverPts[Math.min(i + 1, N - 1)], o = riverPts[Math.max(i - 1, 0)];
    const t = new THREE.Vector3().subVectors(q, o).normalize(), n = new THREE.Vector3(-t.z, 0, t.x);
    if (i) acc += p.distanceTo(riverPts[i - 1]);
    for (const s of [-1, 1]){ pos.push(p.x + n.x * s * 0.46, 0.02, p.z + n.z * s * 0.46); uvs.push((s + 1) / 2, acc); }
    if (i < N - 1){ const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geo.setIndex(idx);
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uTime: { value: 0 }, uLen: { value: acc } },
    vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv=uv; vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform float uTime; uniform float uLen; varying vec2 vUv; varying vec3 vW;
      float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y); }
      void main(){
        float x=vUv.x, s=vUv.y;
        float edge=smoothstep(0.,.18,x)*smoothstep(1.,.82,x);
        float ends=smoothstep(0.2,1.2,s)*smoothstep(uLen-0.2,uLen-1.2,s);
        vec2 p=vec2(x*3.,s*.9-uTime*.55);
        float st=smoothstep(.78,.92,n(p*vec2(3.,1.6)))*(.55+.45*sin(uTime*1.3+s));
        float ripple=n(vec2(x*6.,s*2.5-uTime*.8))*.18;
        vec3 col=vec3(1.);
        float a=(st*.32+ripple*.22)*edge*ends;
        gl_FragColor=vec4(col,a);
        #include <colorspace_fragment>
      }` });
  const ribbon = new THREE.Mesh(geo, mat); ribbon.renderOrder = 1; scene.add(ribbon);
  scene.userData.riverMat = mat;
}

// ---------- shared geometry utils ----------
function mergeGeos(list){
  let n = 0; const parts = list.map(g => { const gg = g.index ? g.toNonIndexed() : g; n += gg.attributes.position.count; return gg; });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3); let o = 0;
  for (const g of parts){ pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.color) col.set(g.attributes.color.array, o * 3); else col.fill(1, o * 3, (o + g.attributes.position.count) * 3); o += g.attributes.position.count; }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingBox(); out.computeBoundingSphere(); return out; }
function blob(r, detail, jitter, seed){ const g = new THREE.IcosahedronGeometry(r, detail); const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++){ v.fromBufferAttribute(p, i); const k = 1 + (vnoise(v.x * 3 + seed, v.y * 3 + v.z * 2 + seed) - 0.5) * jitter; v.multiplyScalar(k); p.setXYZ(i, v.x, v.y, v.z); }
  // smooth normals from the sphere direction, nudged by the bumps
  const nn = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++){ v.fromBufferAttribute(p, i).normalize(); nn[i*3] = v.x; nn[i*3+1] = v.y; nn[i*3+2] = v.z; }
  g.setAttribute('normal', new THREE.BufferAttribute(nn, 3)); return g; }
function tint(g, c){ const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++){ a[i*3] = c.r; a[i*3+1] = c.g; a[i*3+2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; }

// ---------- trees: soft puffball crowns ----------
const trees = [];
function makeTree(u, v, s, kind){
  const grp = new THREE.Group(); const pos = uv2w(u, v); grp.position.copy(pos); grp.scale.setScalar(s);
  const base = new THREE.Color(kind === 'p' ? 0xe48c9c : 0x58b032), dark = new THREE.Color(kind === 'p' ? 0xc56a80 : 0x3f8e22), lite = new THREE.Color(kind === 'p' ? 0xf4aab6 : 0x7cc645);
  const parts = []; const cy = 2.35, rx = 1.45, ry = 1.25;
  parts.push(tint(blob(1.15, 2, 0.15, R(0, 9)).translate(0, cy, 0), dark));
  for (let i = 0; i < 46; i++){ const th = R(0, 6.283), ph = Math.acos(R(-0.75, 1)); const dir = new THREE.Vector3(Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th));
    const r = R(0.36, 0.6); const c = dark.clone().lerp(base, clamp(0.4 + dir.y * 0.6, 0, 1)).lerp(lite, rand() * 0.25);
    parts.push(tint(blob(r, 1, 0.25, R(0, 9)).translate(dir.x * rx, cy + dir.y * ry * 0.95, dir.z * rx), c)); }
  const crown = new THREE.Mesh(mergeGeos(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, flatShading: false }));
  crown.castShadow = true; crown.receiveShadow = true; grp.add(crown);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 1.4, 8).translate(0, 0.7, 0), new THREE.MeshStandardMaterial({ color: 0x6b4428, roughness: 1 }));
  trunk.castShadow = true; grp.add(trunk);
  grp.rotation.y = R(0, 6.28); scene.add(grp);
  trees.push({ grp, crown, x: pos.x, z: pos.z, r: 1.6 * s, phase: R(0, 6) });
}
LAYOUT.trees.forEach(([u, v, s, k]) => makeTree(clamp(u, 0.035, 0.965), clamp(v, 0.02, 0.97), s * 0.52, k));

// ---------- clouds ----------
const clouds = [];
function makeCloud(x, y, z, s){
  const parts = []; const top = new THREE.Color(0xfffaf2), under = new THREE.Color(0xcac2e6);
  const spots = [[0,0,0,1],[1.1,0.15,0.1,0.85],[-1.05,0.05,-0.05,0.8],[0.45,0.7,0,0.8],[-0.45,0.6,0.1,0.75],[1.9,-0.1,0,0.55],[-1.8,-0.15,0.05,0.55],[0.2,0.05,0.6,0.7],[-0.2,0,-0.6,0.7],[0.9,0.5,-0.3,0.55],[-1.2,0.45,-0.2,0.5]];
  for (const [px, py, pz, r] of spots){ const g = blob(r, 2, 0.12, R(0, 9)); const p = g.attributes.position, c = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++){ const yy = (p.getY(i) + py + 0.6) / 1.8; const col = under.clone().lerp(top, clamp(yy, 0, 1)); c[i*3] = col.r; c[i*3+1] = col.g; c[i*3+2] = col.b; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.translate(px, py, pz); parts.push(g); }
  const m = new THREE.Mesh(mergeGeos(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, emissive: 0xf0eaf4, emissiveIntensity: 0.12 }));
  m.position.set(x, y, z); m.scale.setScalar(s); scene.add(m); clouds.push({ m, x, y, z, ph: R(0, 6) });
}
makeCloud(1.7, 2.1, -9.7, 0.72);
makeCloud(-9.9, 3.9, -10.4, 0.2);

// ---------- sheep ----------
const woolMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
const faceMat = new THREE.MeshStandardMaterial({ color: 0x2b211d, roughness: 0.75 });
const earMat = new THREE.MeshStandardMaterial({ color: 0x3a2b26, roughness: 0.8 });
const pinkMat = new THREE.MeshStandardMaterial({ color: 0xd99a92, roughness: 0.9 });
const legGeo = new THREE.CylinderGeometry(0.055, 0.045, 0.5, 6).translate(0, -0.25, 0);
const WOOL_VARIANTS = [0, 1, 2, 3].map(seed => {
  const parts = []; const cream = new THREE.Color(0xf4ecdd), shade = new THREE.Color(0xd9cbb4);
  const core = blob(0.52, 2, 0.1, seed).scale(1.25, 0.95, 0.95).translate(0, 0.92, 0); parts.push(tint(core, shade));
  const rr = mulberry(100 + seed);
  for (let i = 0; i < 64; i++){
    const th = rr() * 6.283, ph = Math.acos(rr() * 1.7 - 0.7);
    const dx = Math.sin(ph) * Math.cos(th), dy = Math.cos(ph), dz = Math.sin(ph) * Math.sin(th);
    const r = 0.17 + rr() * 0.11;
    const c = shade.clone().lerp(cream, clamp(0.35 + dy * 0.7, 0, 1));
    parts.push(tint(blob(r, 1, 0.3, seed * 10 + i).translate(dx * 0.66, 0.92 + dy * 0.47, dz * 0.48), c)); }
  return mergeGeos(parts); });

const sheep = [];
const TMPV = new THREE.Vector3();
class Sheep {
  constructor(x, z, opts = {}){
    this.root = new THREE.Group(); this.body = new THREE.Group(); this.root.add(this.body);
    const wool = new THREE.Mesh(WOOL_VARIANTS[(rand() * 4) | 0], woolMat); wool.castShadow = true; wool.receiveShadow = true; this.body.add(wool); this.wool = wool;
    // head on a neck pivot
    this.neck = new THREE.Group(); this.neck.position.set(0.62, 1.0, 0); this.body.add(this.neck);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10).scale(1.25, 0.95, 0.9), faceMat); head.position.set(0.24, -0.05, 0); head.castShadow = true;
    const snout = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8).scale(1.1, 0.85, 0.95), faceMat); snout.position.set(0.44, -0.12, 0);
    this.neck.add(head, snout);
    for (const s of [-1, 1]){ const ear = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 6).scale(1.2, 0.35, 0.55), earMat); ear.position.set(0.16, 0.06, s * 0.22); ear.rotation.set(s * 0.5, 0, -0.25);
      const inner = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 5).scale(1.1, 0.25, 0.5), pinkMat); inner.position.set(0.01, 0.03, 0); ear.add(inner); this.neck.add(ear); this['ear' + s] = ear; }
    const tuft = new THREE.Mesh(blob(0.15, 1, 0.3, 3), woolMat); tuft.geometry = tint(tuft.geometry, new THREE.Color(0xf4efe4)); tuft.position.set(0.12, 0.17, 0); this.neck.add(tuft);
    this.legs = [];
    for (const [lx, lz] of [[0.36, 0.2], [0.36, -0.2], [-0.36, 0.2], [-0.36, -0.2]]){ const l = new THREE.Mesh(legGeo, faceMat); l.position.set(lx, 0.5, lz); l.castShadow = true; this.body.add(l); this.legs.push(l); }
    this.hit = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.5, 1.2).translate(0.15, 0.78, 0), new THREE.MeshBasicMaterial({ visible: false })); this.root.add(this.hit); this.hit.userData.sheep = this;
    this.root.position.set(x, 0, z);
    this.heading = opts.heading ?? R(-Math.PI, Math.PI); this.root.rotation.y = this.heading; this.targetHeading = this.heading;
    this.size = opts.size ?? R(0.88, 1.0); this.root.scale.setScalar(this.size);
    this.state = 'graze'; this.t = R(2, 10); this.phase = R(0, 10); this.speed = 0; this.vy = 0; this.y = 0;
    this.lock = null; this.lockT = 0; this.goal = null; this.jumps = 0; this.flee = 0; this.alive = 1; this.spawnT = opts.drop ? 0 : 1; this.dying = false;
    this.headPitch = 0; this.headYaw = 0; this.nibble = 0; this.lookT = 0; this.gait = 0; this.squash = 0;
    if (opts.drop){ this.y = 3.2; this.vy = 0; }
    scene.add(this.root); sheep.push(this);
  }
  get x(){ return this.root.position.x; } get z(){ return this.root.position.z; }
  fwd(){ return TMPV.set(Math.cos(this.heading), 0, -Math.sin(this.heading)); }
  setMode(m, persist = true){
    if (m === 'jump'){ if (this.state !== 'jump') this.prev = this.lock || this.state; this.jumps = 3; this.state = 'jump'; return; }
    this.lock = persist ? m : null; this.state = m; this.goal = null; this.t = m === 'walk' ? 0 : R(4, 9);
  }
  pickGoal(r0 = 2.5, r1 = 7){
    let best = null, bs = -1e9;
    for (let k = 0; k < 10; k++){
      const a = R(-Math.PI, Math.PI), r = R(r0, r1); const gx = this.x + Math.cos(a) * r, gz = this.z + Math.sin(a) * r;
      if (!walkable(gx, gz, 1.3)) continue;
      const lush = 1 - wearAt(gx, gz); let crowd = 0;
      for (const o of sheep) if (o !== this){ const dd = Math.hypot(o.x - gx, o.z - gz); if (dd < 2.2) crowd += 1; else if (dd < 7) crowd -= 0.08; }
      const turn = Math.abs(angDiff(Math.atan2(-(gz - this.z), gx - this.x), this.heading));
      const s = lush * 2 - crowd - turn * 0.25 + rand() * 0.6; if (s > bs){ bs = s; best = [gx, gz]; }
    }
    return best;
  }
  think(dt){
    if (this.lock){ this.lockT -= dt; if (this.lockT < 0 && this.lockT > -1e8 && selected !== this){ this.lock = null; } }
    if (this.state === 'jump') return;
    if (this.flee > 0) return;
    this.t -= dt;
    const st = this.lock || this.state;
    if (this.lock && st !== this.state){ this.state = st; }
    if (this.state === 'walk'){
      if (!this.goal) this.goal = this.pickGoal(this.lock ? 4 : 2.5, this.lock ? 9 : 7);
      if (!this.goal){ this.heading += Math.PI * 0.5; return; }
      const dx = this.goal[0] - this.x, dz = this.goal[1] - this.z;
      if (Math.hypot(dx, dz) < 0.5){ this.goal = null; if (!this.lock){ this.state = rand() < 0.75 ? 'graze' : 'idle'; this.t = this.state === 'graze' ? R(5, 14) : R(1.5, 4); } }
    } else if (this.t < 0 && !this.lock){
      if (this.state === 'graze'){ this.state = rand() < 0.35 ? 'idle' : 'walk'; this.t = R(1.5, 4.5); }
      else { const r = rand(); this.state = r < 0.06 ? 'jump' : r < 0.55 ? 'walk' : 'graze'; if (this.state === 'jump'){ this.prev = 'graze'; this.jumps = 1 + (rand() * 2 | 0); } this.t = R(5, 12); }
      this.goal = null;
    } else if (this.lock && this.t < 0){ this.t = R(3, 7); }
  }
  update(dt, time){
    // spawn drop / despawn
    if (this.dying){ this.alive -= dt * 4; this.root.scale.setScalar(Math.max(0.001, this.alive) * this.size); if (this.alive <= 0){ scene.remove(this.root); sheep.splice(sheep.indexOf(this), 1); } return; }
    this.think(dt);
    let want = 0, run = false;
    if (this.flee > 0){
      this.flee -= dt; run = true; want = 3.4;
      this.targetHeading = Math.atan2(-(this.z - this.fleeFrom[1]), this.x - this.fleeFrom[0]);
      if (this.flee <= 0){ this.state = 'walk'; this.goal = null; this.t = R(2, 4); }
    } else if (this.state === 'walk' && this.goal){
      want = this.lock === 'walk' ? 1.05 : this.called ? 1.6 : 0.9;
      this.targetHeading = Math.atan2(-(this.goal[1] - this.z), this.goal[0] - this.x);
    } else if (this.state === 'graze'){
      // shuffle slowly forward now and then while munching
      want = (Math.sin(this.phase * 0.31 + time * 0.23) > 0.6) ? 0.12 : 0;
      if (this.lookT <= 0 && rand() < dt * 0.15){ this.targetHeading = this.heading + R(-0.7, 0.7); this.lookT = 2; }
    } else if (this.state === 'idle'){
      if (rand() < dt * 0.25) this.lookYaw = R(-0.7, 0.7);
    }
    this.lookT -= dt;
    // steering: separation + obstacle avoidance, applied to heading
    let ax = 0, az = 0;
    for (const o of sheep){ if (o === this || o.dying) continue; const dx = this.x - o.x, dz = this.z - o.z, d2 = dx * dx + dz * dz, rr = 1.55 * (this.size + o.size) / 2;
      if (d2 < rr * rr * 1.6 && d2 > 1e-6){ const d = Math.sqrt(d2), f = (rr * 1.26 - d) / rr; ax += dx / d * f; az += dz / d * f; } }
    for (const t of trees){ const dx = this.x - t.x, dz = this.z - t.z, d = Math.hypot(dx, dz), rr = t.r * 0.9 + 0.7; if (d < rr){ ax += dx / d * (rr - d); az += dz / d * (rr - d); } }
    // push straight out (no tunnelling) for overlaps
    if (this.y < 0.05){ this.root.position.x += ax * dt * 1.6; this.root.position.z += az * dt * 1.6; }
    // look ahead for water / board edge
    if (want > 0){
      const f = this.fwd(); const lx = this.x + f.x * 1.4, lz = this.z + f.z * 1.4;
      if (!walkable(lx, lz, 0.9)){
        const left = this.heading + 0.9, right = this.heading - 0.9;
        const okL = walkable(this.x + Math.cos(left) * 1.4, this.z - Math.sin(left) * 1.4, 0.9);
        this.targetHeading = okL ? left : right; if (!this.flee) this.goal = null; want *= 0.4;
      }
    }
    // turn toward target heading
    const dh = angDiff(this.targetHeading, this.heading);
    const turnRate = run ? 5 : this.state === 'walk' ? 2.2 : 0.9;
    this.heading += clamp(dh, -turnRate * dt, turnRate * dt);
    if (Math.abs(dh) > 1.2 && !run) want *= 0.35;
    this.speed = lerp(this.speed, want, 1 - Math.exp(-dt * 4));
    const f = this.fwd();
    const nx = this.x + f.x * this.speed * dt, nz = this.z + f.z * this.speed * dt;
    if (walkable(nx, nz, 0.75) || !walkable(this.x, this.z, 0.75)){ this.root.position.x = nx; this.root.position.z = nz; }
    // keep inside board
    this.root.position.x = clamp(this.x, -W / 2 + 1.2, W / 2 - 1.2); this.root.position.z = clamp(this.z, -D / 2 + 1.1, D / 2 - 1.1);
    // vertical: drop-in and jumps
    if (this.state === 'jump' && this.y <= 0 && this.vy <= 0 && this.jumps > 0){ this.vy = 5.2; this.jumps--; this.squash = 0.6; }
    if (this.y > 0 || this.vy > 0){ this.vy -= 16 * dt; this.y += this.vy * dt; if (this.y <= 0){ this.y = 0; this.vy = 0; this.squash = 1;
        if (this.state === 'jump' && this.jumps <= 0){ this.state = this.prev || 'graze'; if (this.lock === 'jump') this.lock = null; this.t = R(3, 8); } } }
    this.squash = Math.max(0, this.squash - dt * 4);
    // ---------- pose ----------
    this.gait += this.speed * dt * (run ? 4.2 : 5.2);
    const swing = Math.min(1, this.speed * 1.6) * 0.55;
    const s = Math.sin(this.gait * 2);
    this.legs[0].rotation.z = s * swing; this.legs[3].rotation.z = s * swing; this.legs[1].rotation.z = -s * swing; this.legs[2].rotation.z = -s * swing;
    if (this.y > 0.05){ const tuck = clamp(this.y, 0, 0.6); this.legs[0].rotation.z = this.legs[1].rotation.z = -tuck; this.legs[2].rotation.z = this.legs[3].rotation.z = tuck; }
    const bob = Math.abs(Math.cos(this.gait * 2)) * swing * 0.09;
    const breathe = Math.sin(time * 1.6 + this.phase) * 0.012;
    const sq = Math.sin(this.squash * Math.PI) * 0.12;
    this.body.position.y = this.y + bob - sq * 0.5;
    this.body.scale.set(1 + sq * 0.5, 1 - sq + breathe, 1 + sq * 0.5);
    this.body.rotation.z = this.vy * 0.03 + (this.state === 'walk' ? Math.sin(this.gait * 2) * 0.02 : 0);
    // head
    let pitch = 0, yaw = 0;
    if (this.state === 'graze' && this.speed < 0.3){ pitch = -0.95; this.nibble += dt * 7; pitch += Math.sin(this.nibble) * 0.06 * (Math.sin(time * 0.7 + this.phase) > -0.3 ? 1 : 0);
      // eating: wear the grass at the muzzle
      const mx = this.x + f.x * 1.0 * this.size, mz = this.z + f.z * 1.0 * this.size; addWear(mx, mz, 0.55, dt * 0.09); }
    else if (this.state === 'idle'){ pitch = 0.08; yaw = this.lookYaw || 0; }
    else if (run){ pitch = 0.2; }
    else if (this.state === 'walk'){ pitch = -0.12 + Math.sin(this.gait * 2) * 0.05; }
    this.headPitch = lerp(this.headPitch, pitch, 1 - Math.exp(-dt * 5)); this.headYaw = lerp(this.headYaw, yaw, 1 - Math.exp(-dt * 3));
    this.neck.rotation.set(0, this.headYaw, this.headPitch);
    this.neck.position.y = 1.0 + (this.headPitch < -0.3 ? -0.12 : 0) * (-this.headPitch);
    this.ear1.rotation.x = 0.5 + Math.sin(time * 3 + this.phase) * 0.05; this['ear-1'].rotation.x = -0.5 - Math.sin(time * 2.6 + this.phase) * 0.05;
    this.root.rotation.y = this.heading;
    this.phase += dt;
  }
}
function angDiff(a, b){ let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }
function walkable(x, z, m = 1){
  if (x < -W / 2 + m || x > W / 2 - m || z < -D / 2 + m || z > D / 2 - m) return false;
  if (riverDist(x, z).d < RIVER_HALF + 0.35 + m * 0.4) return false;
  for (const t of trees) if (Math.hypot(x - t.x, z - t.z) < t.r * 0.85 + 0.4) return false;
  return true;
}

// initial flock, following the reference frame
const START = LAYOUT.sheep.map(([u, v], i) => ({ u, v, h: [2.9, -0.3, -0.2, 1.5, 0.3, -1.2, 1.6, 1.7, -0.2][i] ?? 0 }));
const EXTRA = [[0.36, 0.42], [0.44, 0.75], [0.3, 0.82]];
function populate(){
  START.forEach(s => { const p = uv2w(s.u, s.v); new Sheep(p.x, p.z, { heading: s.h }); });
  EXTRA.forEach(([u, v]) => { const p = uv2w(u, v); if (walkable(p.x, p.z)) new Sheep(p.x, p.z); });
}

// ---------- selection UI ----------
const selEl = document.getElementById('sel'), boxEl = selEl.querySelector('.box'), dimEl = selEl.querySelector('.dim');
const barEl = document.getElementById('bar');
let selected = null;
function select(s){ selected = s; selEl.hidden = barEl.hidden = !s; if (s){ s.lockT = -1e9; } refreshBar(); }
function deselect(){ if (selected){ selected.lockT = 10; } select(null); }
function refreshBar(){ if (!selected) return; const m = selected.state === 'jump' ? 'jump' : (selected.lock || (selected.flee > 0 ? 'walk' : selected.state));
  barEl.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === m)); }
barEl.addEventListener('pointerdown', e => e.stopPropagation());
let barHover = false; barEl.addEventListener('pointerenter', () => barHover = true); barEl.addEventListener('pointerleave', () => barHover = false);
barEl.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || !selected) return;
  if (b.dataset.mode){ selected.setMode(b.dataset.mode); }
  else if (b.dataset.act === 'rotl'){ selected.targetHeading = selected.heading + Math.PI / 4; selected.heading = selected.targetHeading; }
  else if (b.dataset.act === 'rotr'){ selected.targetHeading = selected.heading - Math.PI / 4; selected.heading = selected.targetHeading; }
  else if (b.dataset.act === 'dup'){ const f = selected.fwd(); const side = new THREE.Vector3(-f.z, 0, f.x);
    let x = selected.x + side.x * 1.8, z = selected.z + side.z * 1.8; if (!walkable(x, z, 0.8)){ x = selected.x - side.x * 1.8; z = selected.z - side.z * 1.8; }
    const c = new Sheep(x, z, { heading: selected.heading, size: selected.size, drop: true }); c.y = 1.2; c.setMode(selected.lock || selected.state); c.lockT = 10; select(c); }
  else if (b.dataset.act === 'del'){ const s = selected; select(null); s.dying = true; }
  refreshBar(); updateCount();
});
const corners = [...Array(8)].map(() => new THREE.Vector3());
function placeSelection(){
  if (!selected) return;
  if (selected.dying || !sheep.includes(selected)){ select(null); return; }
  const s = selected; s.root.updateMatrixWorld();
  const bb = new THREE.Box3(new THREE.Vector3(-0.72, 0.12, -0.55), new THREE.Vector3(1.05, 1.45, 0.55));
  let i = 0; for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) corners[i++].set(x, y + s.body.position.y, z).applyMatrix4(s.root.matrixWorld);
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
  let r0 = 1e9, r1 = -1e9, u0 = 1e9, u1 = -1e9;
  for (const c of corners){ const pr = right.dot(c), pu = up.dot(c); r0 = Math.min(r0, pr); r1 = Math.max(r1, pr); u0 = Math.min(u0, pu); u1 = Math.max(u1, pu);
    const p = c.clone().project(camera); const sx = (p.x + 1) / 2 * innerWidth, sy = (1 - p.y) / 2 * innerHeight; x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy); }
  const pad = 6; x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
  Object.assign(boxEl.style, { left: x0 + 'px', top: y0 + 'px', width: (x1 - x0) + 'px', height: (y1 - y0) + 'px' });
  const dist = camera.position.distanceTo(s.root.position);
  dimEl.textContent = `${(r1 - r0).toFixed(2)} × ${(u1 - u0).toFixed(2)} m  ·  ${Math.round(dist)} m away`;
  const dw = dimEl.offsetWidth; dimEl.style.left = clamp((x0 + x1) / 2, dw / 2 + 6, innerWidth - dw / 2 - 6) + 'px'; dimEl.style.top = (y1 + 7) + 'px';
  const bw = barEl.offsetWidth, bh = barEl.offsetHeight; let bx = clamp((x0 + x1) / 2, bw / 2 + 8, innerWidth - bw / 2 - 8), by = y1 + 34;
  const panelTop = document.getElementById('panel').getBoundingClientRect().top;
  if (by + bh > panelTop - 8) by = y0 - bh - 12;
  if (!barHover || barEl._fresh !== s){ barEl.style.left = bx + 'px'; barEl.style.top = by + 'px'; barEl._fresh = s; }
}

// ---------- input ----------
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
let tool = 'place', down = null, dragSheep = null, scaleDrag = null, painting = false;
function setRay(e){ ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera); }
function pickSheep(e){ setRay(e); const hits = ray.intersectObjects(sheep.filter(s => !s.dying).map(s => s.hit), false); return hits.length ? hits[0].object.userData.sheep : null; }
function pickGround(e){ setRay(e); const p = new THREE.Vector3(); if (!ray.ray.intersectPlane(groundPlane, p)) return null; if (Math.abs(p.x) > W / 2 - 0.6 || Math.abs(p.z) > D / 2 - 0.6) return null; return p; }
function interact(p, strong){
  if (tool === 'shoo'){ for (const s of sheep){ const d = Math.hypot(s.x - p.x, s.z - p.z); if (d < 6.5){ s.flee = R(1.2, 2.2) * (strong ? 1 : 0.6); s.fleeFrom = [p.x, p.z]; if (s.y <= 0 && d < 3 && rand() < 0.5){ s.vy = 3.5; s.y = 0.001; } } } }
  if (tool === 'call'){ for (const s of sheep){ const d = Math.hypot(s.x - p.x, s.z - p.z); if (d < 14 && d > 1.5){ const a = R(0, 6.283), r = R(0.8, 2.6); const gx = p.x + Math.cos(a) * r, gz = p.z + Math.sin(a) * r; if (walkable(gx, gz, 0.8)){ s.goal = [gx, gz]; s.state = 'walk'; s.called = 1; if (s.lock && s !== selected) s.lock = null; } } } }
  if (tool === 'grass'){ addWear(p.x, p.z, 1.8, -1); lures.push({ x: p.x, z: p.z, t: 25 }); }
}
const lures = [];
canvas.addEventListener('pointerdown', e => {
  hint.classList.add('off');
  down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId, moved: false };
  if (e.button !== 0 && e.pointerType === 'mouse') return;
  const s = pickSheep(e);
  if (s && (tool === 'place')){ dragSheep = { s, ox: 0, oz: 0, active: false }; controls.enabled = false; canvas.setPointerCapture(e.pointerId);
    const g = pickGround(e); if (g){ dragSheep.ox = s.x - g.x; dragSheep.oz = s.z - g.z; } }
  else if (tool !== 'place'){ const g = pickGround(e); if (g){ controls.enabled = false; painting = true; canvas.setPointerCapture(e.pointerId); interact(g, true); } }
});
canvas.addEventListener('pointermove', e => {
  if (down && e.pointerId === down.id && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) down.moved = true;
  if (dragSheep && down && down.moved){ const g = pickGround(e); if (g){ if (!dragSheep.active){ dragSheep.active = true; select(dragSheep.s); }
      const s = dragSheep.s; const nx = g.x + dragSheep.ox, nz = g.z + dragSheep.oz; if (walkable(nx, nz, 0.6)){ s.root.position.x = nx; s.root.position.z = nz; } s.y = Math.max(s.y, 0.35); s.vy = 0; s.goal = null; s.speed = 0; } canvas.className = 'move'; return; }
  if (painting){ const g = pickGround(e); if (g && (tool === 'grass' || rand() < 0.35)) interact(g, false); return; }
  if (!down && e.pointerType === 'mouse'){ const s = pickSheep(e); canvas.className = s && tool === 'place' ? 'pointer' : tool === 'place' ? 'grab' : 'cross'; }
});
function endPointer(e){
  if (!down || e.pointerId !== down.id) return;
  const click = !down.moved && performance.now() - down.t < 600;
  if (dragSheep){ const s = dragSheep.s; if (!dragSheep.active && click){ selected === s ? null : select(s); } else { s.vy = 0; } if (s.y > 0) s.vy = 0.1; dragSheep = null; controls.enabled = true; }
  else if (painting){ painting = false; controls.enabled = true; }
  else if (click && (e.button === 0 || e.pointerType !== 'mouse')){
    const s = pickSheep(e);
    if (s) select(s);
    else if (selected) deselect();
    else { const g = pickGround(e); if (g && tool === 'place'){ if (walkable(g.x, g.z, 0.5) && sheep.length < 80){ const n = new Sheep(g.x, g.z, { drop: true, heading: R(-Math.PI, Math.PI) }); n.state = 'idle'; n.t = R(1.5, 3); updateCount(); } } }
  }
  down = null;
}
canvas.addEventListener('pointerup', endPointer); canvas.addEventListener('pointercancel', e => { dragSheep = null; painting = false; controls.enabled = true; down = null; });
canvas.addEventListener('contextmenu', e => e.preventDefault());
// corner handles: drag to resize the selected sheep
selEl.querySelectorAll('.h').forEach(h => {
  h.addEventListener('pointerdown', e => { if (!selected) return; e.stopPropagation(); e.preventDefault(); h.setPointerCapture(e.pointerId);
    const r = boxEl.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    scaleDrag = { s: selected, cx, cy, d0: Math.hypot(e.clientX - cx, e.clientY - cy), s0: selected.size }; controls.enabled = false; });
  h.addEventListener('pointermove', e => { if (!scaleDrag) return; const d = Math.hypot(e.clientX - scaleDrag.cx, e.clientY - scaleDrag.cy); scaleDrag.s.size = clamp(scaleDrag.s0 * d / scaleDrag.d0, 0.5, 2.2); scaleDrag.s.root.scale.setScalar(scaleDrag.s.size); });
  const end = () => { scaleDrag = null; controls.enabled = true; }; h.addEventListener('pointerup', end); h.addEventListener('pointercancel', end);
});
addEventListener('keydown', e => {
  if (e.target.closest && e.target.closest('input,textarea')) return;
  if (!selected) return;
  const map = { '1': 'idle', '2': 'graze', '3': 'walk', '4': 'jump', ' ': 'jump' };
  if (map[e.key]){ selected.setMode(map[e.key]); refreshBar(); e.preventDefault(); }
  if (e.key === 'Escape') deselect();
  if (e.key === 'Delete' || e.key === 'Backspace'){ const s = selected; select(null); s.dying = true; updateCount(); }
});

// ---------- control panel ----------
const hint = document.getElementById('hint');
let timeScale = 1;
const nEl = document.getElementById('n');
function updateCount(){ const n = sheep.filter(s => !s.dying).length; nEl.textContent = `${n} sheep`; }
document.getElementById('tools').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; tool = b.dataset.tool;
  document.querySelectorAll('#tools button').forEach(x => x.classList.toggle('on', x === b)); if (tool !== 'place') select(null);
  hint.textContent = { place: 'Tap the grass to place a sheep · tap a sheep to select · drag to orbit', call: 'Tap or drag to call the flock over', shoo: 'Tap or drag near sheep to scare them off', grass: 'Paint over grazed patches to regrow lush grass' }[tool]; hint.classList.remove('off'); clearTimeout(hint._t); hint._t = setTimeout(() => hint.classList.add('off'), 3500); });
document.getElementById('speed').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; timeScale = +b.dataset.s; document.querySelectorAll('#speed button').forEach(x => x.classList.toggle('on', x === b)); });
function randomSpot(){ for (let k = 0; k < 60; k++){ const x = R(-W / 2 + 2, W / 2 - 2), z = R(-D / 2 + 2, D / 2 - 2); if (walkable(x, z, 1) && sheep.every(s => Math.hypot(s.x - x, s.z - z) > 2)) return [x, z]; } return null; }
document.getElementById('plus').addEventListener('click', () => { if (sheep.length >= 80) return; const p = randomSpot(); if (p){ new Sheep(p[0], p[1], { drop: true }); updateCount(); } });
document.getElementById('minus').addEventListener('click', () => { const live = sheep.filter(s => !s.dying); if (!live.length) return; const s = live.includes(selected) && live.length ? live[live.length - 1] === selected ? selected : live[live.length - 1] : live[live.length - 1]; if (s === selected) select(null); s.dying = true; updateCount(); });
document.getElementById('reset').addEventListener('click', resetAll);
function resetAll(){ select(null); for (const s of [...sheep]){ scene.remove(s.root); } sheep.length = 0; wear.fill(0); lures.length = 0; populate(); updateCount(); homeView(); }

// ---------- loop ----------
function resize(){ renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', () => { resize(); homeView(); });
resize(); homeView(); populate(); updateCount();
setTimeout(() => hint.classList.add('off'), 6000);
const clock = new THREE.Clock(); let time = 0, wearAcc = 0;
renderer.setAnimationLoop(() => {
  const raw = Math.min(clock.getDelta(), 0.05), dt = raw * timeScale; time += dt;
  // lures from fresh grass gently attract nearby idle grazers
  for (let i = lures.length - 1; i >= 0; i--){ const l = lures[i]; l.t -= dt; if (l.t < 0){ lures.splice(i, 1); continue; }
    if (rand() < dt * 0.6) for (const s of sheep){ if (s.lock || s.state === 'walk' || s.flee > 0) continue; const d = Math.hypot(s.x - l.x, s.z - l.z); if (d < 10 && d > 1.5 && rand() < 0.3){ s.goal = [l.x + R(-1, 1), l.z + R(-1, 1)]; if (walkable(s.goal[0], s.goal[1], 0.8)){ s.state = 'walk'; } else s.goal = null; } } }
  for (const s of [...sheep]){ s.update(dt, time); if (s.state !== 'walk') s.called = 0; }
  for (const t of trees){ t.crown.rotation.z = Math.sin(time * 0.8 + t.phase) * 0.012; t.crown.rotation.x = Math.cos(time * 0.6 + t.phase) * 0.01; }
  for (const c of clouds){ c.m.position.x = c.x + Math.sin(time * 0.05 + c.ph) * 1.2; c.m.position.y = c.y + Math.sin(time * 0.4 + c.ph) * 0.12; }
  scene.userData.riverMat.uniforms.uTime.value = time;
  wearAcc += dt; if (wearAcc > 0.25){ flushWear(wearAcc); wearAcc = 0; }
  controls.update();
  renderer.render(scene, camera);
  placeSelection(); if (selected) refreshBar();
});
window.__sheep = { sheep, select, camera, controls, homeView };
