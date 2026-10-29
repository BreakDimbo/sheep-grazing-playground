// Sheep grazing grass — an independent, from-scratch reimplementation of the
// scene in areadne's (@AreadneMaria) video. No original code or art is used:
// layout and colours were measured from the video, everything is re-drawn.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { LAYOUT } from './layout.js';

const Q = new URLSearchParams(location.search);
const CLEAN = Q.has('clean'), FREEZE = Q.has('freeze');
const MOBILE = matchMedia('(pointer:coarse)').matches || Math.min(innerWidth, innerHeight) < 600;
if (CLEAN) document.body.classList.add('clean');
const CAM = LAYOUT.cam, COL = LAYOUT.colors;
const rand = mulberry(Q.get('seed') ? +Q.get('seed') : 7);
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const R = (a, b) => a + (b - a) * rand();
const clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp;

// ---------- board geometry: uv (0..1 across the painted board) <-> world metres ----------
const Gm = CAM.G;
function inv3(m){ const [a,b,c,d,e,f,g,h,i] = m; const A = e*i-f*h, B = -(d*i-f*g), C = d*h-e*g, det = a*A + b*B + c*C;
  return [A, -(b*i-c*h), b*f-c*e, B, a*i-c*g, -(a*f-c*d), C, -(a*h-b*g), a*e-b*d].map(v => v / det); }
const Gi = inv3(Gm);
const hom = (M, a, b) => { const w = M[6]*a + M[7]*b + M[8]; return [(M[0]*a + M[1]*b + M[2]) / w, (M[3]*a + M[4]*b + M[5]) / w]; };
const uv2w = (u, v) => { const [x, z] = hom(Gm, u, v); return new THREE.Vector3(x, 0, z); };
const w2uv = (x, z) => hom(Gi, x, z);
const cw = CAM.corners_world;
const W = (Math.hypot(cw[1][0]-cw[0][0], cw[1][1]-cw[0][1]) + Math.hypot(cw[3][0]-cw[2][0], cw[3][1]-cw[2][1])) / 2;
const D = (Math.hypot(cw[2][0]-cw[0][0], cw[2][1]-cw[0][1]) + Math.hypot(cw[3][0]-cw[1][0], cw[3][1]-cw[1][1])) / 2;
const E = 0.05;                                   // texture margin around the board, in uv
const TEXW = MOBILE ? 1536 : 2048, TEXH = Math.round(TEXW * 1.27);
const KU = TEXW / (1 + 2 * E), KV = TEXH / (1 + 2 * E);
const SHEEP_SCALE = +(Q.get('ss') || 0.95);

// ---------- painted sprites (generated art, see README) ----------
const SPR = await (await fetch('sprites/meta.json')).json();
const texLoader = new THREE.TextureLoader();
async function loadTex(u){ const t = await texLoader.loadAsync(u); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; return t; }
const [TEX_SHEEP, TEX_TREES, TEX_CLOUDS] = await Promise.all(['sheep', 'trees', 'clouds'].map(n => SPR[n] ? loadTex(`sprites/${n}.webp`) : null));
const loadImg = async u => { try { const r = await fetch(u); if (!r.ok) return null; return await createImageBitmap(await r.blob()); } catch (e) { return null; } };
const [IMG_GRASS, IMG_WHEAT] = Q.has('notile') ? [null, null] : await Promise.all(['grass', 'wheat'].map(n => loadImg(`sprites/${n}.webp`)));
const TILE_A = +(Q.get('ga') || 0), TILE_S = +(Q.get('ts') || 0.5);
function paintTile(g, img, s, alpha){ if (!img) return; g.save(); g.globalCompositeOperation = 'overlay'; g.globalAlpha = alpha;
  const pt = g.createPattern(img, 'repeat'); pt.setTransform(new DOMMatrix().scale(TILE_S * s)); g.fillStyle = pt; g.fillRect(0, 0, TEXW, TEXH); g.restore(); }
const shadowOnly = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
const GRADE = { value: new THREE.Vector3(1, 1, 1) }, CLOUD_GRADE = { value: new THREE.Vector3(1, 1, 1) };   // global light grade (1 = the replica; the /plus/ edition animates it)
const BB_VS = `uniform vec4 uRect; uniform vec2 uSize; uniform float uSway; uniform vec2 uCenter; uniform float uBias; varying vec2 vUv; varying vec2 vL;
  void main(){ vUv = uRect.xy + uv * uRect.zw; vL = uv;
    vec4 mv = modelViewMatrix * vec4(0., 0., 0., 1.); float k = 1. - uBias / length(mv.xyz); mv.xyz *= k;   // pulled toward the eye so the card never cuts into the ground
    mv.xy += (uv - uCenter) * uSize * k; mv.x += uSway * uSize.y * k * max(uv.y - uCenter.y, 0.) * max(uv.y - uCenter.y, 0.); gl_Position = projectionMatrix * mv; }`;
const BB_FS = `uniform vec3 uGrade; uniform sampler2D map; uniform float uReveal; uniform vec3 uTint; uniform float uAlpha; uniform float uSeed; uniform float uSat; uniform vec3 uShade; uniform vec3 uMid; uniform float uMidB; uniform vec2 uSharp; uniform vec4 uFade; uniform float uSolid; uniform float uRim; varying vec2 vUv; varying vec2 vL;
  float hh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed) * 43758.5453); }
  float nn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(hh(i), hh(i + vec2(1, 0)), f.x), mix(hh(i + vec2(0, 1)), hh(i + 1.), f.x), f.y); }
  void main(){ vec4 c = texture2D(map, vUv); if (uSolid > 0.){ vec2 o = uRim * vec2(1. / 3072., 1. / 1536.); float m = 1.;   // interior (all ring taps inside the sprite) -> opaque; outer rim keeps a soft ramp
      for (int k = 0; k < 8; k++){ float an = float(k) * .785398; m = min(m, texture2D(map, vUv + o * vec2(cos(an), sin(an))).a); }
      c.a = mix(smoothstep(0.02, uSolid, c.a), 1., smoothstep(0.02, 0.1, m) * step(0.02, c.a)); } c.a *= uAlpha;
    if (uReveal < 1.){ float n = nn(vL * 9.) * 0.65 + nn(vL * 23.) * 0.35; if (n * 0.75 + vL.x * 0.45 > uReveal * 1.2) discard; }
    c.a *= clamp(uFade.x + uFade.y * vL.x + uFade.z * vL.y, uFade.w, 1.);
    if (c.a < 0.02) discard;
    if (uSharp.x > 0.){ vec3 bl = vec3(0.); float o = uSharp.y / 1024.; for (int k = 0; k < 8; k++){ float an = float(k) * .785398; vec4 t = texture2D(map, vUv + o * vec2(cos(an), sin(an))); bl += mix(c.rgb, t.rgb, step(0.3, t.a)); } vec3 W = vec3(.2126, .7152, .0722); float dd = dot(c.rgb - bl / 8., W); c.rgb = clamp(c.rgb + uSharp.x * dd * (dd < 0. ? vec3(1.05, 1.1, .8) : vec3(1.)), 0., 1.); }   // local contrast (cloud folds)
    float lu = dot(c.rgb, vec3(.2126, .7152, .0722)); c.rgb = mix(vec3(lu), c.rgb, uSat);
    c.rgb *= mix(vec3(1.), uShade, smoothstep(0.45, 0.04, lu)); c.rgb *= mix(vec3(1.), uMid, smoothstep(uMidB, uMidB - 0.33, lu) * smoothstep(0.3, 0.55, lu));
    gl_FragColor = vec4(c.rgb * uTint * uGrade, c.a);
    #include <colorspace_fragment>
  }`;
const BB_GEO = new THREE.PlaneGeometry(1, 1).translate(0.5, 0.5, 0);
function billboard(tex, rect, size, center, opts = {}){
  const m = new THREE.ShaderMaterial({ vertexShader: BB_VS, fragmentShader: BB_FS, transparent: true, depthWrite: opts.depthWrite ?? true,
    uniforms: { map: { value: tex }, uRect: { value: new THREE.Vector4(...rect) }, uSize: { value: new THREE.Vector2(...size) }, uCenter: { value: new THREE.Vector2(...center) },
      uReveal: { value: 1 }, uBias: { value: opts.bias ?? 0 }, uSolid: { value: opts.solid ?? 0 }, uRim: { value: +(Q.get('trim') ?? 5) }, uTint: { value: new THREE.Color(opts.tint ?? 0xffffff) }, uAlpha: { value: opts.alpha ?? 1 }, uSat: { value: opts.sat ?? 1 }, uShade: { value: new THREE.Vector3(...(opts.shade ?? [1, 1, 1])) }, uMid: { value: new THREE.Vector3(...(opts.mid ?? [1, 1, 1])) }, uMidB: { value: opts.midB ?? 0.95 }, uSharp: { value: new THREE.Vector2(...(opts.sharp ?? [0, 0])) }, uFade: { value: new THREE.Vector4(...(opts.fade ?? [1, 0, 0, 1])) }, uSeed: { value: Math.random() * 10 }, uSway: { value: 0 }, uGrade: opts.grade ?? GRADE } });
  const b = new THREE.Mesh(BB_GEO, m); b.frustumCulled = false; return b;
}
// atlas rect for (col,row) of a grid; v flipped for GL
function atlasRect(cols, rows, c, r){ return [c / cols, 1 - (r + 1) / rows, 1 / cols, 1 / rows]; }
const SHEEP_CELL_W = +(Q.get('sw') || 1.9);      // world size of one sheep atlas cell (per unit sheep scale)
const SHEEP_HEAD = (Q.get('shd') || '2.6,0.8,4').split(',').map(Number);   // multiplier on the sprite's dark pixels (plum head)
const SHEEP_MID = (Q.get('smd') || '0.92,0.85,1.04').split(',').map(Number);    // multiplier on wool mid-tones (lavender shading)
const SHEEP_SHO = (Q.get('sso') || '0.45,-1.1').split(',').map(Number);     // world x,z offset of the shadow-casting rig relative to the sprite
const SHEEP_TINT = new THREE.Color(...(Q.get('st') || '0.91,0.875,0.95').split(',').map(Number));
const DIR_SQ = +(Q.get('dq') || 0.6);          // favour side views (sprites were painted from higher up than the board camera)

// ---------- renderer / scene / camera ----------
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: CLEAN });
renderer.setPixelRatio(Math.min(devicePixelRatio, MOBILE ? 2 : 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;
renderer.toneMapping = THREE.NoToneMapping;
const scene = new THREE.Scene();
const REF_ASPECT = CAM.img[0] / CAM.img[1];
const camera = new THREE.PerspectiveCamera(CAM.vfov, REF_ASPECT, 5, 400);
const HOME = { pos: new THREE.Vector3(...CAM.pos), target: new THREE.Vector3(...CAM.target) };
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.minDistance = 22; controls.maxDistance = 120;
controls.minPolarAngle = 0.15; controls.maxPolarAngle = 1.35;
controls.rotateSpeed = 0.45; controls.zoomSpeed = 0.7; controls.panSpeed = 0.7;
controls.screenSpacePanning = true;
controls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
controls.touches = { ONE: null, TWO: THREE.TOUCH.DOLLY_ROTATE };
const refCam = new THREE.PerspectiveCamera(CAM.vfov, REF_ASPECT, 1, 500); refCam.position.copy(HOME.pos); refCam.lookAt(HOME.target); refCam.updateMatrixWorld();
const FPX = CAM.img[1] / 2 / Math.tan(THREE.MathUtils.degToRad(CAM.vfov / 2));     // focal length in reference pixels
function pixRay(px, py){ return new THREE.Vector3(px / CAM.img[0] * 2 - 1, -(py / CAM.img[1] * 2 - 1), 0.5).unproject(refCam).sub(refCam.position).normalize(); }
function rayAtY(px, py, y){ const d = pixRay(px, py), t = (y - refCam.position.y) / d.y; return refCam.position.clone().addScaledVector(d, t); }
// object of pixel width wpx whose centre sits at height y(size): solve for size and position
function placeByPixel(px, py, wpx, yOf){ let size = 2, p; for (let k = 0; k < 8; k++){ p = rayAtY(px, py, yOf(size)); const dist = p.distanceTo(refCam.position); size = wpx * dist / FPX; } return { p, size }; }
function fitFov(){ const a = innerWidth / innerHeight; const t = Math.tan(THREE.MathUtils.degToRad(CAM.vfov / 2));
  // keep the reference horizontal field of view on narrow screens (same framing, letterboxed vertically)
  const tt = a < REF_ASPECT ? t * REF_ASPECT / a * (a < 1 ? 1.04 : 1) : t;
  camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(tt)); }
function homeView(){ controls.target.copy(HOME.target); camera.position.copy(HOME.pos); camera.up.set(0, 1, 0); camera.lookAt(HOME.target); controls.update(); }

// lights — numbers chosen so that lit flat ground shows the albedo and shadowed ground ~0.66× with a cool tint
const PI = Math.PI;
const lin = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.LinearSRGBColorSpace);
const hemi = new THREE.HemisphereLight(lin(0.40 * PI, 0.43 * PI, 0.72 * PI), lin(0.30 * PI, 0.34 * PI, 0.42 * PI), 1); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1);
const SUN_DIR = new THREE.Vector3(-13, 15, 1.5).normalize();
const sunCos = SUN_DIR.y;
sun.color.copy(lin(0.60 * PI / sunCos, 0.57 * PI / sunCos, 0.28 * PI / sunCos));
sun.position.copy(SUN_DIR).multiplyScalar(40); sun.target.position.set(0, 0, 0);
sun.castShadow = true; sun.shadow.mapSize.set(MOBILE ? 1024 : 2048, MOBILE ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -19, right: 19, top: 19, bottom: -19, near: 10, far: 80 });
sun.shadow.bias = -0.0004; sun.shadow.radius = MOBILE ? 7 : 11; sun.shadow.blurSamples = MOBILE ? 10 : 16;
scene.add(sun, sun.target);

// ---------- 2D helpers in texture space ----------
const P = a => a.map(([u, v]) => [(u + E) * KU, (v + E) * KV]);
function smoothPath(ctx, pts){ ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++){ const mx = (pts[i][0] + pts[i+1][0]) / 2, my = (pts[i][1] + pts[i+1][1]) / 2; ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my); }
  const l = pts[pts.length - 1]; ctx.lineTo(l[0], l[1]); }
function polyPath(ctx, pts){ ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); }
function inPoly(x, y, pts){ let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++){ const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) != (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }

// ---------- value noise ----------
const perm = new Uint8Array(512); { const p = [...Array(256).keys()]; for (let i = 255; i > 0; i--){ const j = (rand() * (i + 1)) | 0; [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) perm[i] = p[i & 255]; }
function vnoise(x, y){ const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi; const h = (a, b) => perm[(perm[a & 255] + b) & 255] / 255;
  const s = t => t * t * (3 - 2 * t), u = s(xf), v = s(yf);
  return lerp(lerp(h(xi, yi), h(xi + 1, yi), u), lerp(h(xi, yi + 1), h(xi + 1, yi + 1), u), v); }
const fbm = (x, y) => vnoise(x, y) * 0.55 + vnoise(x * 2.1, y * 2.1) * 0.28 + vnoise(x * 4.3, y * 4.3) * 0.17;
const hash2 = (x, y) => { let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

// ---------- ground painting ----------
const EF = (k, t) => { const c = LAYOUT.edgeFit && LAYOUT.edgeFit[k]; if (!c) return 0; let r = 0; for (let i = c.length - 1; i >= 0; i--) r = r * t + c[i]; return r; };
const ED = (k, t) => { const c = LAYOUT.edgeDet && !Q.has('nodet') && LAYOUT.edgeDet[k]; if (!c) return 0; const f = clamp((t + 0.1) / 1.2, 0, 1) * (c.length - 1), i = Math.min(c.length - 2, Math.floor(f)); return lerp(c[i], c[i + 1], f - i); };   // measured edge detail (edet.py)
const EDGE_W = +(Q.get('ew') || 0.45), EDGE_O = +(Q.get('eo') ?? -0.12), EBJ = +(Q.get('ebj') ?? 1);   // EBJ scales the large-scale bay noise
const river = LAYOUT.river, pathL = LAYOUT.path;
function paintGround(){
  const cv = document.createElement('canvas'); cv.width = TEXW; cv.height = TEXH;
  const g = cv.getContext('2d', { willReadFrequently: true });
  const s = KU / 1862;                              // stroke-size scale relative to the 2048 texture
  const wheat = P(LAYOUT.wheat);
  g.fillStyle = COL.light; g.fillRect(0, 0, TEXW, TEXH);
  g.filter = `blur(${5 * s}px)`;
  g.fillStyle = COL.bright; polyPath(g, P(LAYOUT.bright)); g.fill();
  g.filter = `blur(${8 * s}px)`;
  g.fillStyle = COL.dark; polyPath(g, P(LAYOUT.dark)); g.fill();
  if (LAYOUT.lime && !Q.has('nolime')){ g.filter = `blur(${6 * s}px)`; g.globalAlpha = +(Q.get('la') || 1); g.fillStyle = Q.get('lc') ? '#' + Q.get('lc') : (COL.lime || '#70ac37'); polyPath(g, P(LAYOUT.lime)); g.fill(); g.globalAlpha = 1; }
  g.filter = 'none';
  // gentle pigment pooling
  for (let i = 0; i < 260; i++){ const x = R(0, TEXW), y = R(0, TEXH), r = R(40, 200) * s;
    const gr = g.createRadialGradient(x, y, 0, x, y, r); const dk = rand() < 0.5;
    gr.addColorStop(0, dk ? 'rgba(70,110,30,.045)' : 'rgba(225,240,160,.06)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  // wheat
  g.save(); polyPath(g, wheat); g.clip();
  g.filter = `blur(${3 * s}px)`; g.fillStyle = COL.wheat; polyPath(g, wheat); g.fill(); g.filter = 'none';
  for (let i = 0; i < 26000 * s * s; i++){ const x = R(TEXW * 0.4, TEXW), y = R(TEXH * 0.6, TEXH); const l = R(5, 11) * s;
    g.strokeStyle = rand() < 0.5 ? 'rgba(160,130,45,.22)' : 'rgba(240,222,130,.3)'; g.lineWidth = R(1, 1.8) * s;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + R(-1.5, 1.5) * s, y - l); g.stroke(); }
  paintTile(g, IMG_WHEAT, s, TILE_A);
  g.restore();
  // grass: fine short vertical ticks
  const N = (MOBILE ? 120000 : 220000) * s * s * +(Q.get("gt") ?? 0.12), GM = +(Q.get("gm") ?? 0), GL = +(Q.get("gl") ?? 0.6), GWD = +(Q.get("gw") ?? 0.8), GK = +(Q.get("gk") ?? 1.8), GDK = +(Q.get("gdk") ?? 0.5);
  for (let i = 0; i < N; i++){
    const x = R(0, TEXW), y = R(0, TEXH);
    const l = R(3, 8) * s, t = rand();
    g.strokeStyle = t < GDK ? `rgba(55,115,25,${(R(.07,.16) * GK).toFixed(3)})` : t < 0.9 ? `rgba(215,240,140,${(R(.07,.17) * GK).toFixed(3)})` : `rgba(40,90,20,${(R(.1,.18) * GK).toFixed(3)})`;
    g.lineWidth = R(0.9, 1.6) * s * GWD; g.beginPath(); g.moveTo(x, y); if (GM){ const a = R(-GM, GM); g.lineTo(x + Math.cos(a) * l * GL, y + Math.sin(a) * l * GL); } else g.lineTo(x + R(-1, 1) * s, y - l); g.stroke();
  }
  { g.save(); polyPath(g, wheat); g.rect(TEXW, 0, -TEXW, TEXH); g.clip('evenodd'); paintTile(g, IMG_GRASS, s, TILE_A); g.restore(); }
  { const NP = (MOBILE ? 6000 : 11000) * s * s * +(Q.get('gp') ?? 0.12), GPR = +(Q.get('gpr') ?? 1.6), GPA = +(Q.get('gpa') ?? 1.2); if (NP > 0){
    const pc = document.createElement('canvas'); pc.width = TEXW; pc.height = TEXH; const p = pc.getContext('2d');
    for (let i = 0; i < NP; i++){ const x = R(0, TEXW), y = R(0, TEXH); p.fillStyle = `rgba(205,238,150,${(R(.12, .3) * GPA).toFixed(3)})`; p.beginPath(); p.ellipse(x, y, R(1.4, 2.6) * s * GPR, R(2.2, 3.8) * s * GPR, 0, 0, 7); p.fill(); }
    g.save(); polyPath(g, wheat); g.rect(TEXW, 0, -TEXW, TEXH); g.clip('evenodd'); g.filter = `blur(${0.8 * s}px)`; g.drawImage(pc, 0, 0); g.filter = 'none'; g.restore(); } }

  { const TU = +(Q.get('tu') ?? 0.7); if (TU > 0){                                   // sparse dark grass tufts (2-3 fanned strokes), own PRNG so later content is unchanged
    let sd = 9127; const r2 = () => { sd = (sd + 0x6D2B79F5) | 0; let t = Math.imul(sd ^ (sd >>> 15), 1 | sd); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const NT = 9000 * s * s * TU, TA = +(Q.get('ta') ?? 0.55), TL = +(Q.get('tl') ?? 1.4), TK = +(Q.get('tuk') ?? 0.5), TF = +(Q.get('tf') ?? 0.25), TW = +(Q.get('tw') ?? 1);
    g.save(); polyPath(g, wheat); g.rect(TEXW, 0, -TEXW, TEXH); g.clip('evenodd'); g.lineCap = 'round';
    for (let i = 0; i < NT; i++){ const x = r2() * TEXW, y = r2() * TEXH, k = 1 + (r2() < TK ? 1 : 0), dark = r2() < 0.85;
      g.strokeStyle = dark ? `rgba(58,108,28,${(TA * (0.6 + 0.4 * r2())).toFixed(3)})` : `rgba(200,232,130,${(TA * 0.8).toFixed(3)})`; g.lineWidth = (0.7 + 0.4 * r2()) * s * TW;
      for (let j = 0; j < k; j++){ const a = -Math.PI / 2 + (j - (k - 1) / 2) * TF + (r2() - 0.5) * 0.25, l = (3 + 4 * r2()) * s * TL;
        g.beginPath(); g.moveTo(x + (j - 1) * 0.8 * s, y); g.lineTo(x + (j - 1) * 0.8 * s + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); } }
    g.restore(); } }

  // fitted low-frequency colour correction per field (quadratic in board uv; see fieldfit.py)
  if (LAYOUT.fieldFix && !Q.has('nofix')){
    const F = LAYOUT.fieldFix, q = 4, mw = Math.ceil(TEXW / q), mh = Math.ceil(TEXH / q);
    const mc = document.createElement('canvas'); mc.width = mw; mc.height = mh; const m = mc.getContext('2d', { willReadFrequently: true });
    const lay = (pts, col, bl) => { m.save(); m.scale(1 / q, 1 / q); m.filter = `blur(${bl * s / q}px)`; m.fillStyle = col; polyPath(m, P(pts)); m.fill(); m.restore(); };
    const LM = LAYOUT.lime && !Q.has('nolime') ? LAYOUT.lime : null;
    const ch = (col, pts, bl, add, sub) => { m.globalCompositeOperation = 'source-over'; m.fillStyle = '#000'; m.fillRect(0, 0, mw, mh); lay(pts, col, bl); if (add) lay(add, '#fff', 6); if (sub) lay(sub, '#000', 6); return m.getImageData(0, 0, mw, mh).data; };
    const mB = ch('#fff', LAYOUT.bright, 5, LM), mD = ch('#fff', LAYOUT.dark, 8, null, LM), mW = ch('#fff', LAYOUT.wheat, 3);
    const corr = new Float32Array(mw * mh * 3), ev = (c, u, v) => c[0] + c[1] * u + c[2] * v + c[3] * u * u + c[4] * u * v + c[5] * v * v;
    for (let j = 0; j < mh; j++) for (let i = 0; i < mw; i++){
      const k = j * mw + i, u = (i + 0.5) * q / KU - E, v = (j + 0.5) * q / KV - E;
      const ww = mW[k * 4] / 255, wd = mD[k * 4] / 255 * (1 - ww), wb = mB[k * 4] / 255 * (1 - mD[k * 4] / 255) * (1 - ww), wl = Math.max(0, 1 - ww - wd - wb);
      for (let c = 0; c < 3; c++) corr[k * 3 + c] = (F.light ? ev(F.light[c], u, v) * wl : 0) + (F.bright ? ev(F.bright[c], u, v) * wb : 0) + (F.dark ? ev(F.dark[c], u, v) * wd : 0) + (F.wheat ? ev(F.wheat[c], u, v) * ww : 0);
    }
    const im = g.getImageData(0, 0, TEXW, TEXH), d = im.data;
    for (let y = 0; y < TEXH; y++){ const jr = ((y / q) | 0) * mw; for (let x = 0; x < TEXW; x++){ const k = (jr + ((x / q) | 0)) * 3, o = (y * TEXW + x) * 4;
      d[o] += corr[k]; d[o + 1] += corr[k + 1]; d[o + 2] += corr[k + 2]; } }
    g.putImageData(im, 0, 0);
  }
  // faint broad brush streaks across the fields (own PRNG so the rest of the board is unchanged)
  const BST = +(Q.get('bst') ?? 0.07), BSN = +(Q.get('bsn') ?? 260), BSA = +(Q.get('bsa') ?? -0.35), BSJ = +(Q.get('bsj') ?? 0.25);
  if (BST > 0){ const br = mulberry(+(Q.get('bseed') ?? 53)); const sc = document.createElement('canvas'); sc.width = TEXW; sc.height = TEXH; const g0 = g; { const g = sc.getContext('2d'); g.lineCap = 'round';   // strokes drawn unfiltered offscreen, then blurred once (a per-stroke blur cost ~70 s)
    for (let k = 0; k < BSN; k++){ const x = br() * TEXW, y = br() * TEXH, L = (120 + 220 * br()) * s, an = BSA + (br() - .5) * BSJ, lt = br() < .5;
      g.strokeStyle = lt ? `rgba(235,240,170,${BST})` : `rgba(40,90,20,${BST * .8})`; g.lineWidth = (14 + 22 * br()) * s;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(an) * L * .5 + (br() - .5) * 30 * s, y + Math.sin(an) * L * .5 + (br() - .5) * 30 * s, x + Math.cos(an) * L, y + Math.sin(an) * L); g.stroke(); } }
    g0.save(); g0.filter = `blur(${5 * s}px)`; g0.drawImage(sc, 0, 0); g0.restore(); }
  if (LAYOUT.colCorr && !Q.has('nocc')){                                         // low-frequency colour match to the ref fields (colfit.py, 24x30 RGB offsets, bilinear)
    const CC = LAYOUT.colCorr, CG = +(Q.get('ccg') ?? 1), im = g.getImageData(0, 0, TEXW, TEXH), dd = im.data, GW = 24, GH = 30;
    for (let y = 0; y < TEXH; y++){ const fy = clamp(y / TEXH * GH - 0.5, 0, GH - 1.001), y0 = fy | 0, ty = fy - y0;
      for (let x = 0; x < TEXW; x++){ const fx = clamp(x / TEXW * GW - 0.5, 0, GW - 1.001), x0 = fx | 0, tx = fx - x0, i = (y * TEXW + x) * 4;
        if (!dd[i + 3]) continue; const a = (y0 * GW + x0) * 3, b = a + 3, c = a + GW * 3, e2 = c + 3;
        for (let k = 0; k < 3; k++) dd[i + k] += CG * ((CC[a + k] * (1 - tx) + CC[b + k] * tx) * (1 - ty) + (CC[c + k] * (1 - tx) + CC[e2 + k] * tx) * ty); } }
    g.putImageData(im, 0, 0); }
  // hedgerows: soft dark bands
  const hedges = LAYOUT.hedges.map(P); const HW = i => (LAYOUT.hedgeW ? LAYOUT.hedgeW[i] : 1) * +(Q.get('hw') || 1);
  g.lineCap = 'round'; g.lineJoin = 'round';
  const HF = +(Q.get('hf') ?? 1), HA = +(Q.get('ha') ?? 0.6), HC = +(Q.get('hc') ?? 1.1), HB = +(Q.get('hb') ?? 0.8), HWB = +(Q.get('hwb') ?? 0.35);
  const HDB = +(Q.get('hdb') ?? 2.5);                                                 // soft hedge edges (dabs on an offscreen layer, one blur)
  const HSG = Q.has('nohseg') ? null : LAYOUT.hedgeSeg;                                 // per-vertex width fitted from the ref (hedgeseg.py)
  const HTP = +(Q.get('htp') ?? 2), HLA = +(Q.get('hla') ?? 0), HLW = +(Q.get('hlw') ?? 1.6);   // tapered ends (length in core widths), pale halo alpha / width
  const hLen = hedges.map(h => { const c = [0]; for (let k = 1; k < h.length; k++) c.push(c[k-1] + Math.hypot(h[k][0] - h[k-1][0], h[k][1] - h[k-1][1])); return c; });
  if (HLA > 0){ g.filter = `blur(${10 * s}px)`; g.strokeStyle = `rgba(214,226,140,${HLA})`; hedges.forEach((h, i) => { g.lineWidth = 34 * s * HW(i) * HLW; smoothPath(g, h); g.stroke(); }); }
  g.save(); g.translate(7 * s, 3 * s); g.filter = `blur(${7 * s * HF}px)`; g.strokeStyle = `rgba(40,85,25,${.22 * HA})`; 
  hedges.forEach((h, i) => { g.lineWidth = 34 * s * HW(i) * HF; smoothPath(g, h); g.stroke(); }); g.restore();
  g.filter = `blur(${4 * s * HF}px)`; g.strokeStyle = `rgba(52,100,30,${.35 * HA})`; 
  hedges.forEach((h, i) => { g.lineWidth = 29 * s * HW(i) * (HF + 2) / 3; smoothPath(g, h); g.stroke(); });
  g.filter = `blur(${1.6 * s * HB}px)`; g.strokeStyle = COL.hedge; 
  if (!(HTP > 0 && HWB > 0)) hedges.forEach((h, i) => { g.lineWidth = 22 * s * HW(i) * HC; smoothPath(g, h); g.stroke(); });
  if (HWB > 0){ const hc = HDB > 0 ? document.createElement('canvas') : null, g0 = g; if (hc){ hc.width = TEXW; hc.height = TEXH; } { const g = hc ? hc.getContext('2d') : g0; g.filter = 'none'; g.fillStyle = COL.hedge; hedges.forEach((h, i) => { for (let k = 0; k < h.length - 1; k++){ const [x0, y0] = h[k], [x1, y1] = h[k+1]; const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (2 * s));
    for (let j = 0; j < n; j++){ const t = j / n, x = lerp(x0, x1, t), y = lerp(y0, y1, t), L = hLen[i], ds = Math.min(lerp(L[k], L[k+1], t), L[L.length-1] - lerp(L[k], L[k+1], t)); const tp = HTP > 0 ? Math.sqrt(Math.min(1, ds / (HTP * 22 * s * HW(i)))) : 1; const SG = HSG ? lerp(HSG[i][k], HSG[i][k+1], t) : 1, r = tp * 11 * s * HW(i) * SG * HC * (1 + HWB * (vnoise(x * 0.02 / s + i * 7, y * 0.02 / s) - 0.5) * 2) ; if (r > 0){ g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); } } } }); } if (hc){ g0.filter = `blur(${HDB * s}px)`; g0.drawImage(hc, 0, 0); } }
  g.filter = 'none';
  hedges.forEach(h => { for (let k = 0; k < h.length - 1; k++){ const [x0, y0] = h[k], [x1, y1] = h[k+1]; const n = Math.hypot(x1 - x0, y1 - y0) / (3 * s);
    for (let j = 0; j < n; j++){ const t = rand(); g.fillStyle = rand() < .5 ? 'rgba(35,80,20,.28)' : 'rgba(95,150,55,.22)'; g.beginPath(); g.arc(lerp(x0, x1, t) + R(-7, 7) * s, lerp(y0, y1, t) + R(-7, 7) * s, R(1, 2.2) * s, 0, 7); g.fill(); } } });
  // dirt path
  const path = P(pathL), pw = LAYOUT.pathW * KU;
  g.filter = `blur(${4 * s}px)`; g.strokeStyle = 'rgba(200,180,120,.6)'; g.lineWidth = pw * 1.25; smoothPath(g, path); g.stroke();
  g.filter = `blur(${2 * s}px)`; g.strokeStyle = COL.path; g.lineWidth = pw * 0.95; smoothPath(g, path); g.stroke();
  g.filter = `blur(${4 * s}px)`; g.strokeStyle = 'rgba(240,222,176,.55)'; g.lineWidth = pw * 0.4; smoothPath(g, path); g.stroke();
  g.filter = 'none';
  // flowers, placed with the density measured from the reference
  const [FW, FH] = LAYOUT.flowerGrid, fl = LAYOUT.flowers;
  const dg = new Float32Array(FW * FH); for (let i = 0; i < fl.length; i += 3) dg[fl[i+1] * FW + fl[i]] = fl[i+2] / 100;
  const dgs = new Float32Array(FW * FH), RR = +(Q.get('fr') ?? 4);                 // box-blur the measured density so dots sprinkle evenly
  for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++){ let t = 0, c = 0; for (let j = -RR; j <= RR; j++) for (let i = -RR; i <= RR; i++){ const xx = x + i, yy = y + j; if (xx < 0 || yy < 0 || xx >= FW || yy >= FH) continue; t += dg[yy * FW + xx]; c++; } dgs[y * FW + x] = t / c; }
  const cellW = TEXW / FW, cellH = TEXH / FH, FD = +(Q.get('fd') ?? 0.85), FWH = +(Q.get('fw') ?? 0.015), FWT = +(Q.get('fwt') ?? 0), FOR = +(Q.get('fo') ?? 0.05), FYC = '#' + (Q.get('fy') || 'd9c455'), FOC = '#' + (Q.get('fc') || 'e3a24a');
  const FLB = +(Q.get('flb') ?? 1), fBr = P(LAYOUT.bright), fDk = P(LAYOUT.dark);   // extra flower density in the light (background) field
  const FMU = Q.has('nofmul') ? null : LAYOUT.flowerMul;                                // local density multiplier fitted to the ref dot counts (flfit.py)
  const FAD = Q.has('nofadd') ? null : LAYOUT.flowerAdd, FAG = +(Q.get('fag') ?? 1.8), FAWH = +(Q.get('faw') ?? 0.35);   // extra dots where the ref has a cluster we lack (flfit.py)
  const frand = mulberry(+(Q.get('fseed') ?? 31));                                  // own PRNG: flower tweaks must not reshuffle the rest of the board
  for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++){
    const cx = (x + .5) * cellW, cy = (y + .5) * cellH, lit = FLB !== 1 && !inPoly(cx, cy, fBr) && !inPoly(cx, cy, fDk) && !inPoly(cx, cy, wheat);
    const dens = Math.min(0.5, dgs[y * FW + x]) * 30 * (cellW * cellH) / 64 * FD * (lit ? FLB : 1) * (FMU ? FMU[Math.min(39, (y / FH * 40) | 0) * 32 + Math.min(31, (x / FW * 32) | 0)] : 1); let n = Math.floor(dens); if (frand() < dens - n) n++;
    const ad = FAD ? FAD[Math.min(39, (y / FH * 40) | 0) * 32 + Math.min(31, (x / FW * 32) | 0)] * FAG * 1024 / (FW * FH) : 0; let na = Math.floor(ad); if (frand() < ad - na) na++;
    for (let k = 0; k < n + na; k++){
      const px = (x + frand()) * cellW, py = (y + frand()) * cellH; if (inPoly(px, py, wheat) && (FWT <= 0 || frand() > FWT)) continue;
      const wh = k < n ? FWH : FAWH, t = frand(); g.fillStyle = t < 1 - wh - FOR ? FYC : t < 1 - wh ? FOC : '#fbf3df';
      g.beginPath(); g.arc(px, py, (1.1 + 1.4 * frand()) * s * +(Q.get('fs') || 1.9), 0, 7); g.fill();
    }
  }
  // river: thin sandy banks, light edges, deep middle
  const rv = P(river), rw = LAYOUT.riverW * KU;
  g.filter = `blur(${1.5 * s}px)`;
  const RWA = +(Q.get('rwa') ?? 0), RWF = +(Q.get('rwf') ?? 1), wob = (hw, k) => {        // river outline with independent wobble per side (the reference's banks are hand-drawn)
    const L = [], Rr = []; let acc = 0;
    for (let i = 0; i < rv.length; i++){ const p = rv[i], q = rv[Math.min(i + 1, rv.length - 1)], o = rv[Math.max(i - 1, 0)]; if (i) acc += Math.hypot(p[0] - rv[i-1][0], p[1] - rv[i-1][1]);
      let tx = q[0] - o[0], ty = q[1] - o[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl; const t = acc / (rw * 1.6) * RWF;
      const BW = LAYOUT.riverBank && !Q.has('nobank') ? LAYOUT.riverBank : null, fl = BW ? BW.L[i] : 1, fr = BW ? BW.R[i] : 1;   // measured half-width profile (bankfit.py)
      const wl = hw * fl * (1 + RWA * (vnoise(t, 11 + k) - 0.5) * 4), wr = hw * fr * (1 + RWA * (vnoise(t, 37 + k) - 0.5) * 4);
      L.push([p[0] - ty * wl, p[1] + tx * wl]); Rr.push([p[0] + ty * wr, p[1] - tx * wr]); }
    return L.concat(Rr.reverse()); };
  g.fillStyle = COL.bank; polyPath(g, wob(rw * 0.62, 0)); g.fill();
  g.fillStyle = COL.waterEdge; polyPath(g, wob(rw * 0.51, 5)); g.fill();
  const RB = +(Q.get('rb') || 0.12), RD = +(Q.get('rd') || 0.52), RM = +(Q.get('rm') || 0.68);
  g.filter = `blur(${rw * RB}px)`;
  g.strokeStyle = '#4f84bb'; g.lineWidth = rw * RM; smoothPath(g, rv); g.stroke();
  g.strokeStyle = COL.waterDeep; g.lineWidth = rw * RD; smoothPath(g, rv); g.stroke();
  g.filter = 'none';
  // path re-cover (flowers), keep crisp
  g.filter = `blur(${2 * s}px)`; g.strokeStyle = 'rgba(227,201,147,.85)'; g.lineWidth = pw * 0.75; smoothPath(g, path); g.stroke(); g.filter = 'none';

  // ragged paper edge -> alpha (block-dithered, used with alphaTest), with a pale wash toward the rim
  const img = g.getImageData(0, 0, TEXW, TEXH), d = img.data;
  const blk = Math.max(2, Math.round(3.2 * s * +(Q.get('eb') || 1)));
  const wash = [166, 204, 104], CR = 2.6;
  const SOFT = +(Q.get('es') ?? 1), SG = +(Q.get('sg') ?? 0.1), SP = +(Q.get('sp') || 0.5), PC = (Q.get('pc') || '228,221,208').split(',').map(Number), FK = +(Q.get('fk') ?? 1.3), FP = +(Q.get('fp') ?? 2), FB = +(Q.get('fb') ?? 3), FT = +(Q.get('ft') ?? 0), FA = +(Q.get('fa') ?? 1.8), WF = +(Q.get('wf') ?? 0.08), EF0 = +(Q.get('ef0') ?? 0.8), FLK = +(Q.get('flk') ?? 1), FV = +(Q.get('fv') ?? 0.2), A0 = +(Q.get('a0') ?? -0.05), RKP = +(Q.get('rkp') ?? 1);
  const BA = +(Q.get('ba') ?? 0), BF = +(Q.get('bf') ?? 6), BS = +(Q.get('bs') ?? 0.25), FKT = +(Q.get('fkt') ?? 1.8), FSQ = +(Q.get('fsq') ?? 1), PZ = +(Q.get('pz') ?? 1), EMD = +(Q.get('emd') ?? 1), HZ = +(Q.get('hz') ?? 0.3), PW = +(Q.get('pw') ?? 1.1), CM0 = +(Q.get('cm0') ?? 0), EBL = +(Q.get('ebl') ?? 0), EBR = +(Q.get('ebr') ?? 0.8), EBK = +(Q.get('ebk') ?? 1);
  const bay = (t, sd) => { if (!BA) return 0; const q = t * BF + sd * 0.37, i0 = Math.floor(q), f = q - i0, w = clamp((f - (1 - BS)) / BS, 0, 1), ww = w * w * (3 - 2 * w);
    return BA * (lerp(hash2(i0, sd * 91 + 5), hash2(i0 + 1, sd * 91 + 5), ww) - 0.5) * 2; };            // stepped bays: piecewise-flat offsets with short ramps
  let EK = 0;
  const eAt = (x, y) => { const u = x / KU - E, v = y / KV - E;                                       // metres from the nominal edge (EK = 2 when the top side is nearest)
    const l = (u - EF('left', v) - ED('left', v)) * W + bay(v, 0), r = (1 - u - EF('right', v) - ED('right', v)) * W + bay(v, 1), t = (v - EF('top', u) - ED('top', u)) * D + bay(u, 2), b = (1 - v - EF('bottom', u) - ED('bottom', u)) * D + bay(u, 3);
    const eu = Math.min(l, r), ev = Math.min(t, b); let e = Math.min(eu, ev);
    if (u > 0.5 && v > 0.5 && eu < CR && ev < CR) e = Math.min(e, CR - Math.hypot(CR - eu, CR - ev));   // the reference's worn bottom-right corner
    EK = e === t ? 2 : 0; return e; };
  const kAt = (x, y, e) => (e + (fbm(x * 0.012 / s, y * 0.012 / s) - 0.5) * 0.55 * EBJ + (vnoise(x * 0.06 / s, y * 0.06 / s) - 0.5) * 0.12 + EDGE_O) / EDGE_W;
  const RBF = +(Q.get('rbf') ?? 1.15), BPL = +(Q.get('bpl') ?? 0), RBP = +(Q.get('rbp') ?? 0.6), RBO = +(Q.get('rbo') ?? 0.6);   // RBO pulls the river's paint end back toward the board                          // river blocks survive more (blue flecks); outer blocks paler
  const PZA = +(Q.get('pza') ?? 60);   // alpha of discarded texels: >0 keeps their paper RGB through the canvas's premultiplied storage (no dark block outlines after filtering)
  const PWT = +(Q.get('pwt') ?? 1.5);   // top-side block density exponent
  let cBK = -1, cKB = 0, cTop = false; const band = EBL > 0 ? new Uint8Array(TEXW * TEXH) : null;
  for (let y = 0; y < TEXH; y++){
    for (let x = 0; x < TEXW; x++){
      const e = eAt(x, y), top = EK === 2;
      if (e > 1.6) continue;
      if (band && e < EBR) band[y * TEXW + x] = 1;
      const i = (y * TEXW + x) * 4, bl = d[i + 2] - d[i] > 25 ? RKP : 0;
      const n = fbm(x * 0.012 / s, y * 0.012 / s) - 0.5, n2 = vnoise(x * 0.06 / s, y * 0.06 / s) - 0.5;
      const ee = e + n * 0.55 * EBJ + n2 * 0.12;                                  // jittered edge distance
      const k = (ee + EDGE_O) / EDGE_W;                                        // 0 = fully paper, 1 = fully paint
      let a;
      if (SOFT){
        const kk = k + (vnoise(x * 0.35 / s, y * 0.35 / s) - 0.5) * SG;          // dry-brush grain
        const t = clamp(kk, 0, 1), sm = Math.pow(t * t * (3 - 2 * t), SP);
        a = kk > A0 ? 1 : 0;
        const fb = Math.max(1, Math.round(FB * s)), hx = Math.floor(x / fb), hy = Math.floor(y / (fb * FA));
        let kf = kk, FKs = FK * (top ? FKT : 1);
        if (EMD){                                                                // block dissolve: each block is paint or paper, paint odds ramp across the edge zone
          const key = hy * 100000 + hx; if (key !== cBK){ cBK = key; const cx = (hx + 0.5) * fb, cy = (hy + 0.5) * fb * FA, eb = eAt(cx, cy); cTop = EK === 2; cKB = kAt(cx, cy, eb); }
          const FKb = FK * (cTop ? FKT : 1), kB = cKB - (bl ? RBO : 0); let p = clamp((kB + FKb) / (FKb + HZ), 0, 1); p = Math.pow(p, cTop ? PWT : PW) * (0.7 + 0.6 * vnoise(hx * 0.4, hy * 0.4)); if (bl) p = Math.min(1, p * RBF);
          if (kB >= HZ) a = 1; else { a = hash2(hx + 7, hy + 3) < p ? 1 : 0; if (a){ const c = clamp((CM0 + (1 - CM0) * p + (hash2(hx, hy + 11) - 0.5) * FV) * (1 - BPL * (1 - p)), 0, 1) + (1 - CM0) * bl * 0; const cc = bl ? 1 - RBP * (1 - p) : c; d[i] = lerp(PC[0], d[i], cc); d[i + 1] = lerp(PC[1], d[i + 1], cc); d[i + 2] = lerp(PC[2], d[i + 2], cc); } }
          if (a && sm < 1){ let sf = EF0 + (1 - EF0) * sm; sf += (1 - sf) * bl; d[i] = lerp(PC[0], d[i], sf); d[i + 1] = lerp(PC[1], d[i + 1], sf); d[i + 2] = lerp(PC[2], d[i + 2], sf); }
        } else {
        if (!a && FSQ){ const key = hy * 100000 + hx; if (key !== cBK){ cBK = key; const cx = (hx + 0.5) * fb, cy = (hy + 0.5) * fb * FA, eb = eAt(cx, cy); cTop = EK === 2; cKB = kAt(cx, cy, eb); } kf = cKB; FKs = FK * (cTop ? FKT : 1); }   // whole square blocks
        if (!a && kf > -FKs){                                                   // dry-brush flecks beyond the wash
          const pr = Math.pow(1 + Math.min(kf, 0) / FKs, 2.2) * FP * (0.4 + vnoise(hx * fb * 0.05 / s, hy * fb * FA * 0.05 / s) * 1.2);
          if (hash2(hx + 7, hy + 3) < pr){ a = 1; let tf = FT + hash2(hx, hy + 11) * FV; tf += (1 - tf) * bl; d[i] = lerp(PC[0], d[i], tf); d[i + 1] = lerp(PC[1], d[i + 1], tf); d[i + 2] = lerp(PC[2], d[i + 2], tf); }
        }
        if (a && sm < 1){ let sf = kk >= A0 ? EF0 + (1 - EF0) * sm : FLK; sf += (1 - sf) * bl; d[i] = lerp(PC[0], d[i], sf); d[i + 1] = lerp(PC[1], d[i + 1], sf); d[i + 2] = lerp(PC[2], d[i + 2], sf); } }
      } else if (k >= 1) a = 1; else if (k <= 0) a = 0; else a = hash2(Math.floor(x / blk), Math.floor(y / blk)) < k * k * (3 - 2 * k) ? 1 : 0;
      d[i + 3] = a ? 255 : PZA; if (!a && PZ){ d[i] = PC[0]; d[i + 1] = PC[1]; d[i + 2] = PC[2]; }   // paper colour under discarded texels (no dark fringe from filtering)
      const f = clamp(1 - (ee - 0.05) / 0.9, 0, 1) * WF * (1 - bl);
      if (f > 0 && a){ d[i] = lerp(d[i], wash[0], f); d[i + 1] = lerp(d[i + 1], wash[1], f); d[i + 2] = lerp(d[i + 2], wash[2], f); }
    }
  }
  if (band){                                                                     // soften the dissolve band (the reference's edge blocks are slightly blurred)
    const src = new Uint8ClampedArray(d), r = Math.max(1, Math.round(EBK * s));
    for (let y = r; y < TEXH - r; y++) for (let x = r; x < TEXW - r; x++){ const j = y * TEXW + x; if (!band[j]) continue; const o = j * 4;
      let R0 = 0, G0 = 0, B0 = 0, nn = 0; for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++){ const q = o + (yy * TEXW + xx) * 4; R0 += src[q]; G0 += src[q + 1]; B0 += src[q + 2]; nn++; }
      d[o] = lerp(src[o], R0 / nn, EBL); d[o + 1] = lerp(src[o + 1], G0 / nn, EBL); d[o + 2] = lerp(src[o + 2], B0 / nn, EBL); } }
  g.putImageData(img, 0, 0);
  return cv;
}

function boardGeometry(nu, nv){
  const pos = [], uvs = [], nor = [], idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++){
    const u = -E + (1 + 2 * E) * i / nu, v = -E + (1 + 2 * E) * j / nv; const p = uv2w(u, v);
    pos.push(p.x, 0, p.z); nor.push(0, 1, 0); uvs.push(i / nu, 1 - j / nv); }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++){ const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geo.setIndex(idx); return geo;
}
const boardGeo = boardGeometry(48, 60);
const groundTex = new THREE.CanvasTexture(paintGround());
groundTex.colorSpace = THREE.SRGBColorSpace;
groundTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
const ground = new THREE.Mesh(boardGeo, new THREE.MeshLambertMaterial({ map: groundTex, alphaTest: 0.5 }));
ground.receiveShadow = true; scene.add(ground);

// ---------- grazed-grass wear map (in board uv) ----------
const WEAR_W = 150, WEAR_H = 190;
const wear = new Float32Array(WEAR_W * WEAR_H);
const wearData = new Uint8Array(WEAR_W * WEAR_H * 4);
const wearTex = new THREE.DataTexture(wearData, WEAR_W, WEAR_H, THREE.RGBAFormat);
wearTex.magFilter = THREE.LinearFilter; wearTex.minFilter = THREE.LinearFilter;
const wearMesh = new THREE.Mesh(boardGeo, new THREE.MeshLambertMaterial({ color: 0xc9cf7e, alphaMap: wearTex, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
wearMesh.position.y = 0.005; wearMesh.receiveShadow = true; scene.add(wearMesh);
const wearIJ = (x, z) => { const [u, v] = w2uv(x, z); return [(u + E) / (1 + 2 * E) * WEAR_W, (v + E) / (1 + 2 * E) * WEAR_H]; };
function wearAt(x, z){ const [i, j] = wearIJ(x, z).map(Math.floor); if (i < 0 || j < 0 || i >= WEAR_W || j >= WEAR_H) return 1; return wear[j * WEAR_W + i]; }
function addWear(x, z, r, amt){ const [ci, cj] = wearIJ(x, z), rr = r / W * WEAR_W / (1 + 2 * E) * 1.0;
  for (let j = Math.floor(cj - rr); j <= cj + rr; j++) for (let i = Math.floor(ci - rr); i <= ci + rr; i++){
    if (i < 0 || j < 0 || i >= WEAR_W || j >= WEAR_H) continue; const dd = Math.hypot(i - ci, j - cj) / rr; if (dd > 1) continue;
    const k = j * WEAR_W + i; wear[k] = clamp(wear[k] + amt * (1 - dd * dd), 0, 1); } }
function flushWear(dt){
  for (let j = 0; j < WEAR_H; j++){ const row = (WEAR_H - 1 - j) * WEAR_W; for (let i = 0; i < WEAR_W; i++){ const k = j * WEAR_W + i;
    if (wear[k] > 0) wear[k] = Math.max(0, wear[k] - dt * 0.01); const v = (wear[k] * 255) | 0, o = (row + i) * 4; wearData[o] = wearData[o+1] = wearData[o+2] = v; wearData[o+3] = 255; } }
  wearTex.needsUpdate = true; }

// ---------- river: centre line (world), ribbon with drifting light ----------
const riverCurve = new THREE.CatmullRomCurve3(river.map(([u, v]) => uv2w(u, v)), false, 'centripetal');
const riverPts = riverCurve.getSpacedPoints(220);
const RIVER_HALF = LAYOUT.riverW * W / 2;
function riverDist(x, z){ let best = 1e9; for (let i = 0; i < riverPts.length; i++){ const p = riverPts[i], d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < best) best = d; } return Math.sqrt(best); }
{
  const N = riverPts.length, pos = [], uvs = [], idx = [], tuv = []; let acc = 0;
  for (let i = 0; i < N; i++){
    const p = riverPts[i], q = riverPts[Math.min(i + 1, N - 1)], o = riverPts[Math.max(i - 1, 0)];
    const t = new THREE.Vector3().subVectors(q, o).normalize(), n = new THREE.Vector3(-t.z, 0, t.x);
    if (i) acc += p.distanceTo(riverPts[i - 1]);
    for (const s of [-1, 1]){ const X = p.x + n.x * s * RIVER_HALF * 0.95, Z = p.z + n.z * s * RIVER_HALF * 0.95, [bu, bv] = w2uv(X, Z); pos.push(X, 0.012, Z); uvs.push((s + 1) / 2, acc); tuv.push((bu + E) / (1 + 2 * E), 1 - (bv + E) / (1 + 2 * E)); }
    if (i < N - 1){ const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geo.setAttribute('tuv', new THREE.Float32BufferAttribute(tuv, 2)); geo.setIndex(idx);
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uTime: { value: 0 }, uLen: { value: acc }, uG: { value: groundTex }, uGrade: GRADE },
    vertexShader: `attribute vec2 tuv; varying vec2 vUv; varying vec2 vT; void main(){ vUv=uv; vT=tuv; gl_Position=projectionMatrix*viewMatrix*modelMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform vec3 uGrade; uniform float uTime; uniform float uLen; uniform sampler2D uG; varying vec2 vUv; varying vec2 vT;
      #define SX ${(+(Q.get('sx') ?? 14)).toFixed(3)}
      #define SY ${(+(Q.get('sy') ?? 0.25)).toFixed(3)}
      #define SA ${(+(Q.get('sa') ?? 0.09)).toFixed(3)}
      #define RS ${(+(Q.get('rs') ?? 2)).toFixed(1)}
      #define RW ${(+(Q.get('rw') ?? 0.35)).toFixed(3)}
      #define RN ${(+(Q.get('rn') ?? 0.45)).toFixed(3)}
      #define RK ${(+(Q.get('rk') ?? 0.1)).toFixed(3)}
      #define RF ${(+(Q.get('rf') ?? 0.7)).toFixed(3)}
      #define ST ${(+(Q.get('rst') ?? 0.84)).toFixed(3)}
      #define RA ${(+(Q.get('ra') ?? 0.25)).toFixed(3)}
      float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y); }
      void main(){
        float x=vUv.x, s=vUv.y;
        float edge=smoothstep(0.,.22,x)*smoothstep(1.,.78,x);
        float ends=smoothstep(0.3,1.5,s)*smoothstep(uLen-0.3,uLen-1.5,s);
        float st=smoothstep(ST,ST+.16,n(vec2(x*SX,s*SY-uTime*.45)));
        float rim=0.;
        for (int k=0;k<2;k++){ float xr=k==0?x:1.-x; float on=RS>1.5?1.:(RS>0.5?float(k):1.-float(k));
          rim=max(rim,on*smoothstep(.0,.12,xr)*smoothstep(RW,RW*.2,xr)*smoothstep(RN,RN+RK,n(vec2(s*RF-uTime*.1,3.+float(k)*17.)+vec2(xr*3.,0.)))); }
        vec4 gt=texture2D(uG,vT); float wet=step(.5,gt.a)*smoothstep(.04,.14,gt.b-gt.r);   // only over painted water (not paper / flecks)
        float a=st*SA*edge*ends*wet, ar=rim*RA*ends*wet;
        gl_FragColor=vec4(mix(vec3(.86,.93,1.),vec3(.55,.82,.95),ar/(a+ar+1e-4))*uGrade,a+ar*(1.-a));
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
  for (let i = 0; i < p.count; i++){ v.fromBufferAttribute(p, i); const k = 1 + (vnoise(v.x * 3 / r + seed, v.y * 3 / r + v.z * 2 / r + seed) - 0.5) * jitter; v.multiplyScalar(k); p.setXYZ(i, v.x, v.y, v.z); }
  const nn = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++){ v.fromBufferAttribute(p, i).normalize(); nn[i*3] = v.x; nn[i*3+1] = v.y; nn[i*3+2] = v.z; }
  g.setAttribute('normal', new THREE.BufferAttribute(nn, 3)); return g; }
function tint(g, c){ const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++){ a[i*3] = c.r; a[i*3+1] = c.g; a[i*3+2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; }

// ---------- trees: lumpy puffball crowns ----------
const trees = [];
const TREE_K = +(Q.get('tk') || 1.0);
function makeTree(px, py, wpx, kind, cell, tintC, tk = 1, fit = null){
  const pink = kind === 'p';
  if (fit){ fit = { ...fit }; if (pink){ fit.cell = +(Q.get('pcl') ?? 28); fit.s *= +(Q.get('pks') ?? 0.93); fit.dy += +(Q.get('pdy') ?? 0); fit.dx += +(Q.get('pdx') ?? 0); } cell = fit.cell; tk *= fit.s; }
  // crown is ~1 unit wide; centre height ~0.62 of the width (sits low, trunk hidden)
  const far = py < 300, cy = far ? 0.54 : 0.5;
  const { p, size } = placeByPixel(px, py, wpx * 0.96, sz => sz * cy);
  const grp = new THREE.Group(); grp.position.set(p.x, 0, p.z); grp.scale.setScalar(size);
  const base = new THREE.Color(pink ? 0xe485b4 : 0x80cc46), dark = new THREE.Color(pink ? 0xb85e98 : 0x58a837), lite = new THREE.Color(pink ? 0xf4a8cc : 0xb2e468);
  const parts = []; const rx = 0.42, ry = 0.41;
  parts.push(tint(blob(0.4, 3, 0.1, R(0, 9)).scale(1, ry / 0.42, 1).translate(0, cy, 0), dark));
  const n = pink ? 46 : 34;
  for (let i = 0; i < n; i++){ const th = R(0, 6.283), ph = Math.acos(R(-0.55, 1)); const dir = new THREE.Vector3(Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th));
    const r = pink ? R(0.1, 0.16) : R(0.13, 0.2); const c = dark.clone().lerp(base, clamp(0.35 + dir.y * 0.5 - dir.x * 0.2, 0, 1)).lerp(lite, rand() * 0.25);
    parts.push(tint(blob(r, 2, 0.15, R(0, 9)).translate(dir.x * rx * 0.86, cy + dir.y * ry * 0.86, dir.z * rx * 0.86), c)); }
  const crown = new THREE.Mesh(mergeGeos(parts), new THREE.MeshLambertMaterial({ vertexColors: true }));
  crown.castShadow = true; crown.receiveShadow = false; crown.material = shadowOnly; grp.add(crown);
  { const T = SPR.trees, c = T.cells[cell], cols = T.cols, rows = Math.ceil(T.cells.length / cols);
    const cw = 1 / 0.96 / c.w * TREE_K * tk;                                   // world size of one atlas cell (grp is scaled by size)
    const ccy = 6 / T.cell + c.h - c.w * 0.5;                             // crown centre inside the cell (round crown on top)
    const tc = new THREE.Color(tintC ?? 0xffffff); if (fit && fit.b) tc.multiplyScalar(fit.b); if (!pink) tc.multiplyScalar(+(Q.get('tgb') ?? 1.08)); if (!pink && (Q.get('ggm') || LAYOUT.greenMul)) tc.multiply(new THREE.Color().setRGB(...(Q.get('ggm') || LAYOUT.greenMul).toString().split(',').map(Number), THREE.LinearSRGBColorSpace)); if (fit && fit.g) tc.multiply(new THREE.Color().setRGB(...fit.g, THREE.LinearSRGBColorSpace));
    if (pink) tc.multiply(new THREE.Color().setRGB(...(Q.get('pt') || LAYOUT.pinkTint || '1.21,1.43,0.9').toString().split(',').map(Number), THREE.SRGBColorSpace));
    const cen = fit ? [0.5 - (fit.dx || 0) / fit.cpx, ccy + (fit.dy || 0) / fit.cpx] : [0.5, ccy];
    const b = billboard(TEX_TREES, atlasRect(cols, rows, cell % cols, (cell / cols) | 0), [cw * size, cw * size], cen, { tint: tc, bias: size * 0.7, solid: pink ? 0 : +(Q.get('tso') ?? 0.9), sat: pink ? +(Q.get('ps') ?? 0.55) : 0.78, shade: pink ? (Q.get('sh') || '0.88,0.6,2.3').split(',').map(Number) : (Q.get('gsh') || LAYOUT.greenShade || '1,1,1').toString().split(',').map(Number) });
    b.position.set(0, cy, 0); grp.add(b); if (Q.has('notree')) b.visible = false; grp.userData.bb = { b, cw: cw * size, ccy, cell, cy: cy * size }; }
  if (false && far){ const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.3, 7).translate(0, 0.15, 0), new THREE.MeshLambertMaterial({ color: 0x3a2a1c })); trunk.castShadow = true; grp.add(trunk); }
  grp.rotation.y = R(0, 6.28); scene.add(grp);
  trees.push({ grp, crown, x: p.x, z: p.z, r: size * 0.5, phase: R(0, 6) });
}
const TREE_CELLS = [0, 2, 3, 1, 6, 2, 1], TREE_SCALE = [1, 1, 1, 1, 1, 1, 1.18], TREE_TINT = [0xd8e4c8, 0xd8e4c8, 0xd8e4c8, 0xd8e4c8, 0xeac4e6, 0xd8e4c8, 0xd8e4c8];
const GCL = (Q.get('gcl') ?? LAYOUT.greenCells ?? '').toString().split(',');                   // per-tree atlas cell override (smooth-lobe crowns, cells 32-35)
LAYOUT.treesPx.forEach(([x, y, w, k], i) => { let f = LAYOUT.treesFit ? LAYOUT.treesFit[i] : null; if (f && GCL[i] !== undefined && GCL[i] !== '' && +GCL[i] >= 0) f = { ...f, cell: +GCL[i] }; if (f && Q.get('tf' + i)){ const [s1, dx1, dy1, b1] = Q.get('tf' + i).split(',').map(Number); f = { ...f, s: s1, dx: dx1, dy: dy1, b: b1 ?? f.b }; } makeTree(x, y, w, k, TREE_CELLS[i], TREE_TINT[i], TREE_SCALE[i], f); });

// ---------- clouds (placed on the rays of the reference pixels) ----------
const clouds = [];
function rayAtPixel(px, py, zPlane){ const v = new THREE.Vector3(px / CAM.img[0] * 2 - 1, -(py / CAM.img[1] * 2 - 1), 0.5).unproject(refCam).sub(refCam.position).normalize();
  const t = (zPlane - refCam.position.z) / v.z; return refCam.position.clone().addScaledVector(v, t); }
function makeCloud(p, s){
  const parts = []; const top = new THREE.Color(0xf7eee4), under = new THREE.Color(0xc2b4e2);
  const spots = [[0,0.1,0,0.95],[1.0,0.15,0.1,0.85],[-1.0,0.2,-0.05,0.8],[0.5,0.75,0,0.7],[-0.5,0.7,0.1,0.65],[1.6,0.45,0,0.6],[1.85,-0.15,0,0.55],[-1.75,0.05,0.05,0.55],[0.2,-0.45,0.3,0.55],[-0.7,-0.45,0.2,0.5],[1.1,-0.5,0.25,0.5],[1.5,-0.55,0.1,0.42],[0.6,-0.6,0.35,0.42],[-0.2,0,-0.6,0.7],[1.25,0.8,-0.2,0.45]];
  for (const [px, py, pz, r] of spots){ const g = blob(r, 3, 0.1, R(0, 9)); const pp = g.attributes.position, c = new Float32Array(pp.count * 3);
    for (let i = 0; i < pp.count; i++){ const yy = (pp.getY(i) + py + 0.75) / 1.6; const col = under.clone().lerp(top, clamp(yy, 0, 1)); c[i*3] = col.r; c[i*3+1] = col.g; c[i*3+2] = col.b; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.translate(px, py, pz); parts.push(g); }
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0xf2e4d4, emissiveIntensity: 0.5, transparent: true, depthWrite: false });
  mat.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vH; varying float vX;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvH = position.y; vX = position.x;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vH; varying float vX;').replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.a *= clamp(0.55 + vX * 0.26 - max(vH - 0.1, 0.0) * 0.5, 0.0, 1.0);'); };
  const m = new THREE.Mesh(mergeGeos(parts), mat);
  const pre = new THREE.Mesh(m.geometry, new THREE.MeshBasicMaterial({ colorWrite: false })); pre.renderOrder = 2; m.renderOrder = 3; m.add(pre);
  m.position.copy(p); m.scale.set(s, s * 1.2, s * 0.8); scene.add(m); clouds.push({ m, p: p.clone(), ph: R(0, 6) });
}
const CLOUD_LOOK = [[0, 1.0, 0.92], [2, 1.0, 0.8]];       // atlas cell, x stretch, opacity
LAYOUT.cloudsPx.forEach(([x, y, w], i) => { const p = rayAtPixel(x + w * 0.07 + (i ? 0 : +(Q.get('clx') ?? 11)), y + w * 0.05 + (i ? 0 : +(Q.get('cly') ?? -10)), -12.8); const ww = 1.1 * w * p.distanceTo(refCam.position) / FPX * (i ? 1 : +(Q.get('cls') ?? 1.08));
  const [cell, sx0, al] = CLOUD_LOOK[i] || CLOUD_LOOK[0], sx = sx0 * (i ? 1 : +(Q.get('clsx') ?? 0.93)), C = SPR.clouds, c = C.cells[cell], cs = ww / (c.w * sx);
  const m = billboard(TEX_CLOUDS, atlasRect(C.cols, Math.ceil(C.cells.length / C.cols), cell % C.cols, (cell / C.cols) | 0), [cs * sx, cs], [0.5, 0.5], { grade: CLOUD_GRADE, depthWrite: false, alpha: i ? al : Math.min(1, al * +(Q.get('cla') ?? 1.08)), fade: i ? [1, 0, 0, 1] : (Q.get('clf') || '0.55,0.75,-0.55,0.12').split(',').map(Number), mid: i ? [1, 1, 1] : (Q.get('clm') || '1.03,0.92,0.97').split(',').map(Number), shade: i ? [1, 1, 1] : (Q.get('clsh') || '1,1,1').split(',').map(Number), sharp: i ? [0, 0] : (Q.get('clk') || '1.2,14').split(',').map(Number) });   // clm/clsh deepen the main cloud's folds
  m.position.copy(p); m.renderOrder = 3; scene.add(m); clouds.push({ m, p: p.clone(), ph: 0 }); });

// ---------- sheep ----------
const woolMat = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x3c2e1e });
const faceMat = new THREE.MeshLambertMaterial({ color: 0x2a1e1c });
const earMat = new THREE.MeshLambertMaterial({ color: 0x2f2420 });
const pinkMat = new THREE.MeshLambertMaterial({ color: 0xd9978f });
const legGeo = new THREE.CylinderGeometry(0.045, 0.04, 0.38, 6).translate(0, -0.19, 0);
const BODY_Y = 0.74, BL = 0.76, BH = 0.45, BW = 0.46;       // wool ellipsoid half-sizes (length, height, width)
const WOOL_VARIANTS = [0, 1, 2, 3].map(seed => {
  const parts = []; const cream = new THREE.Color(0xfff6e6), shade = new THREE.Color(0xf0dcc6);
  const core = blob(1, 3, 0.05, seed).scale(BL * 0.94, BH * 0.94, BW * 0.94).translate(0, BODY_Y, 0); parts.push(tint(core, shade));
  const rr = mulberry(100 + seed);
  for (let i = 0; i < 96; i++){
    const th = rr() * 6.283, ph = Math.acos(rr() * 1.75 - 0.75);
    const dx = Math.sin(ph) * Math.cos(th), dy = Math.cos(ph), dz = Math.sin(ph) * Math.sin(th);
    const r = i < 26 ? 0.2 + rr() * 0.08 : 0.1 + rr() * 0.07;
    const c = shade.clone().lerp(cream, clamp(0.5 + dy * 0.5, 0, 1));
    parts.push(tint(blob(r, 1, 0.16, seed * 10 + i).translate(dx * (BL - r * 0.75), BODY_Y + dy * (BH - r * 0.75), dz * (BW - r * 0.75)), c)); }
  return mergeGeos(parts); });

// dissolve-in for freshly drawn sheep: per-sheep material clones with a reveal threshold
function dissolveMat(base){
  const m = base.clone(); m.userData.u = { uReveal: { value: 0 }, uC: { value: new THREE.Vector3() }, uDir: { value: new THREE.Vector3(1, 0, 0) } };
  m.onBeforeCompile = sh => { Object.assign(sh.uniforms, m.userData.u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <project_vertex>', '#include <project_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vWP; uniform float uReveal; uniform vec3 uC; uniform vec3 uDir;
      float dh(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453); }
      float dn(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
        return mix(mix(mix(dh(i), dh(i + vec3(1,0,0)), f.x), mix(dh(i + vec3(0,1,0)), dh(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(dh(i + vec3(0,0,1)), dh(i + vec3(1,0,1)), f.x), mix(dh(i + vec3(0,1,1)), dh(i + vec3(1,1,1)), f.x), f.y), f.z); }`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
      { float side = dot(vWP - uC, uDir) * 0.45 + 0.5; float nz = dn(vWP * 6.5) * 0.65 + dn(vWP * 17.) * 0.35;
        if (side * 0.55 + nz * 0.6 > uReveal * 1.25) discard; }`); };
  m.customProgramCacheKey = () => 'dissolve-' + base.type + (base.vertexColors ? 'vc' : '');
  return m;
}

const sheep = [];
const TMPV = new THREE.Vector3(), TMPV2 = new THREE.Vector3();
class Sheep {
  constructor(x, z, opts = {}){
    this.root = new THREE.Group(); this.body = new THREE.Group(); this.root.add(this.body);
    this.meshes = [];
    const wool = new THREE.Mesh(WOOL_VARIANTS[(rand() * 4) | 0], woolMat); this.body.add(wool); this.wool = wool; this.meshes.push(wool);
    this.neck = new THREE.Group(); this.neck.position.set(0.66, 0.8, 0); this.body.add(this.neck);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12).scale(1.3, 0.95, 0.9), faceMat); head.position.set(0.12, -0.04, 0);
    const snout = new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 8).scale(1.1, 0.85, 0.95), faceMat); snout.position.set(0.27, -0.08, 0);
    this.neck.add(head, snout); this.meshes.push(head, snout);
    for (const s of [-1, 1]){ const ear = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 6).scale(1.2, 0.35, 0.55), earMat); ear.position.set(0.1, 0.05, s * 0.17); ear.rotation.set(s * 0.5, 0, -0.25);
      const inner = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 5).scale(1.1, 0.25, 0.5), pinkMat); inner.position.set(0.01, 0.03, 0); ear.add(inner); this.neck.add(ear); this['ear' + s] = ear; this.meshes.push(ear, inner); }
    const tuft = new THREE.Mesh(tint(blob(0.11, 2, 0.25, 3), new THREE.Color(0xf6f1e8)), woolMat); tuft.position.set(0.05, 0.13, 0); this.neck.add(tuft); this.meshes.push(tuft);
    this.legs = [];
    for (const [lx, lz] of [[0.36, 0.2], [0.36, -0.2], [-0.36, 0.2], [-0.36, -0.2]]){ const l = new THREE.Mesh(legGeo, faceMat); l.position.set(lx * 1.2, 0.38, lz * 0.9); this.body.add(l); this.legs.push(l); this.meshes.push(l); }
    for (const m of this.meshes){ m.castShadow = true; m.receiveShadow = false; m.material = shadowOnly; }   // 3D rig only casts the shadow; the look is the painted sprite
    this.spr = billboard(TEX_SHEEP, atlasRect(8, 4, 0, 0), [1, 1], [0.5, 6 / 256], { bias: 0.9, tint: SHEEP_TINT, shade: SHEEP_HEAD, mid: SHEEP_MID, midB: +(Q.get('smb') ?? 0.9) }); this.root.add(this.spr); this.frame = -1; if (Q.has('nospr')) this.spr.visible = false;
    this.hit = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.25, 1.2).translate(0.15, 0.62, 0), new THREE.MeshBasicMaterial({ visible: false })); this.root.add(this.hit); this.hit.userData.sheep = this;
    this.root.position.set(x, 0, z);
    this.heading = opts.heading ?? R(-Math.PI, Math.PI); this.root.rotation.y = this.heading; this.targetHeading = this.heading;
    this.size = opts.size ?? R(0.92, 1.08); this.root.scale.setScalar(this.size * SHEEP_SCALE);
    this.state = opts.state || 'graze'; this.t = R(2, 10); this.phase = R(0, 10); this.speed = 0; this.vy = 0; this.y = 0;
    this.lock = null; this.lockT = 0; this.goal = null; this.jumps = 0; this.dying = false;
    this.headPitch = this.state === 'graze' ? -0.95 : 0; this.headYaw = 0; this.nibble = R(0, 6); this.lookT = 0; this.gait = 0; this.squash = 0;
    this.reveal = 1;
    if (opts.materialise) this.materialise(opts.dir);
    scene.add(this.root); sheep.push(this);
  }
  materialise(dir){
    this.reveal = 0; this.meshes.forEach(m => m.castShadow = false); this.spr.material.uniforms.uReveal.value = 0;
  }
  get x(){ return this.root.position.x; } get z(){ return this.root.position.z; }
  get sc(){ return this.size * SHEEP_SCALE; }
  fwd(){ return TMPV.set(Math.cos(this.heading), 0, -Math.sin(this.heading)); }
  setMode(m, persist = true){
    if (m === 'jump'){ if (this.state !== 'jump') this.prev = this.lock || this.state; this.jumps = 3; this.state = 'jump'; this.lock = persist ? 'jump' : this.lock; return; }
    this.lock = persist ? m : null; this.state = m; this.goal = null; this.t = m === 'walk' ? 0 : R(4, 9);
  }
  pickGoal(r0 = 2, r1 = 6){
    let best = null, bs = -1e9;
    for (let k = 0; k < 10; k++){
      const a = R(-Math.PI, Math.PI), r = R(r0, r1); const gx = this.x + Math.cos(a) * r, gz = this.z + Math.sin(a) * r;
      if (!walkable(gx, gz, 1.0)) continue;
      const lush = 1 - wearAt(gx, gz); let crowd = 0;
      for (const o of sheep) if (o !== this){ const dd = Math.hypot(o.x - gx, o.z - gz); if (dd < 1.8) crowd += 1; else if (dd < 6) crowd -= 0.08; }
      const turn = Math.abs(angDiff(Math.atan2(-(gz - this.z), gx - this.x), this.heading));
      const s = lush * 2 - crowd - turn * 0.3 + rand() * 0.6; if (s > bs){ bs = s; best = [gx, gz]; }
    }
    return best;
  }
  think(dt){
    if (this.lock){ this.lockT -= dt; if (this.lockT < 0 && this.lockT > -1e8 && selected !== this){ this.lock = null; } }
    if (this.state === 'jump') return;
    this.t -= dt;
    const st = this.lock || this.state;
    if (this.lock && st !== this.state){ this.state = st; }
    if (this.state === 'walk'){
      if (!this.goal) this.goal = this.pickGoal(this.lock ? 3 : 2, this.lock ? 8 : 6);
      if (!this.goal){ this.targetHeading = this.heading + Math.PI * 0.5; return; }
      const dx = this.goal[0] - this.x, dz = this.goal[1] - this.z;
      if (Math.hypot(dx, dz) < 0.4){ this.goal = null; if (!this.lock){ this.state = rand() < 0.75 ? 'graze' : 'idle'; this.t = this.state === 'graze' ? R(5, 14) : R(1.5, 4); } }
    } else if (this.t < 0 && !this.lock){
      if (this.state === 'graze'){ this.state = rand() < 0.35 ? 'idle' : 'walk'; this.t = R(1.5, 4.5); }
      else { const r = rand(); this.state = r < 0.05 ? 'jump' : r < 0.55 ? 'walk' : 'graze'; if (this.state === 'jump'){ this.prev = 'graze'; this.jumps = 1 + (rand() * 2 | 0); } this.t = R(5, 12); }
      this.goal = null;
    } else if (this.lock && this.t < 0){ this.t = R(3, 7); }
  }
  update(dt, time){
    if (this.dying){ this.alive = (this.alive ?? 1) - dt * 4; this.root.scale.setScalar(Math.max(0.001, this.alive) * this.sc); this.pickFrame(); if (this.alive <= 0){ scene.remove(this.root); sheep.splice(sheep.indexOf(this), 1); } return; }
    if (this.reveal < 1){
      this.reveal = Math.min(1, this.reveal + dt / 0.75); this.spr.material.uniforms.uReveal.value = this.reveal;
      if (this.reveal > 0.72) this.meshes.forEach(m => m.castShadow = true);
    }
    if (dt === 0){ this.pose(0, time, false); return; }
    if (this.reveal < 0.9){ this.pose(dt, time, false); return; }
    this.think(dt);
    let want = 0;
    if (this.state === 'walk' && this.goal){
      want = this.lock === 'walk' ? 0.85 : 0.7;
      this.targetHeading = Math.atan2(-(this.goal[1] - this.z), this.goal[0] - this.x);
    } else if (this.state === 'graze'){
      want = (Math.sin(this.phase * 0.31 + time * 0.23) > 0.65) ? 0.1 : 0;
      if (this.lookT <= 0 && rand() < dt * 0.15){ this.targetHeading = this.heading + R(-0.7, 0.7); this.lookT = 2; }
    } else if (this.state === 'idle'){
      if (rand() < dt * 0.25) this.lookYaw = R(-0.7, 0.7);
    }
    this.lookT -= dt;
    // separation + obstacle avoidance
    let ax = 0, az = 0;
    for (const o of sheep){ if (o === this || o.dying) continue; const dx = this.x - o.x, dz = this.z - o.z, d2 = dx * dx + dz * dz, rr = 1.25 * (this.sc + o.sc) / 2;
      if (d2 < rr * rr * 1.6 && d2 > 1e-6){ const d = Math.sqrt(d2), f = (rr * 1.26 - d) / rr; ax += dx / d * f; az += dz / d * f; } }
    for (const t of trees){ const dx = this.x - t.x, dz = this.z - t.z, d = Math.hypot(dx, dz), rr = t.r + 0.5; if (d < rr && d > 1e-6){ ax += dx / d * (rr - d); az += dz / d * (rr - d); } }
    if (this.y < 0.05 && dragSheep?.s !== this){ this.root.position.x += ax * dt * 1.4; this.root.position.z += az * dt * 1.4; }
    if (want > 0){
      const f = this.fwd(); const lx = this.x + f.x * 1.2, lz = this.z + f.z * 1.2;
      if (!walkable(lx, lz, 0.7)){
        const left = this.heading + 0.9, right = this.heading - 0.9;
        const okL = walkable(this.x + Math.cos(left) * 1.2, this.z - Math.sin(left) * 1.2, 0.7);
        this.targetHeading = okL ? left : right; this.goal = null; want *= 0.4;
      }
    }
    const dh = angDiff(this.targetHeading, this.heading);
    const turnRate = this.state === 'walk' ? 2.0 : 0.9;
    this.heading += clamp(dh, -turnRate * dt, turnRate * dt);
    if (Math.abs(dh) > 1.2) want *= 0.35;
    this.speed = lerp(this.speed, want, 1 - Math.exp(-dt * 4));
    const f = this.fwd();
    const nx = this.x + f.x * this.speed * dt, nz = this.z + f.z * this.speed * dt;
    if (walkable(nx, nz, 0.6) || !walkable(this.x, this.z, 0.6)){ this.root.position.x = nx; this.root.position.z = nz; }
    // keep on the board
    const [u, v] = w2uv(this.x, this.z); const mu = 0.7 / W, mv = 0.7 / D;
    if (u < mu || u > 1 - mu || v < mv || v > 1 - mv){ const p = uv2w(clamp(u, mu, 1 - mu), clamp(v, mv, 1 - mv)); this.root.position.x = p.x; this.root.position.z = p.z; }
    // jumps
    if (this.state === 'jump' && this.y <= 0 && this.vy <= 0 && this.jumps > 0){ this.vy = 4.6; this.jumps--; this.squash = 0.6; }
    if (this.y > 0 || this.vy > 0){ this.vy -= 15 * dt; this.y += this.vy * dt; if (this.y <= 0){ this.y = 0; this.vy = 0; this.squash = 1;
        if (this.state === 'jump' && this.jumps <= 0){ if (this.lock === 'jump') this.jumps = 3; else { this.state = this.prev || 'graze'; this.t = R(3, 8); } } } }
    this.squash = Math.max(0, this.squash - dt * 4);
    this.pose(dt, time, true);
  }
  pose(dt, time, live){
    this.gait += this.speed * dt * 6.5;
    const swing = Math.min(1, this.speed * 2) * 0.55;
    const s = Math.sin(this.gait * 2);
    this.legs[0].rotation.z = s * swing; this.legs[3].rotation.z = s * swing; this.legs[1].rotation.z = -s * swing; this.legs[2].rotation.z = -s * swing;
    if (this.y > 0.05){ const tuck = clamp(this.y, 0, 0.6); this.legs[0].rotation.z = this.legs[1].rotation.z = -tuck; this.legs[2].rotation.z = this.legs[3].rotation.z = tuck; }
    const bob = Math.abs(Math.cos(this.gait * 2)) * swing * 0.08;
    const breathe = Math.sin(time * 1.6 + this.phase) * 0.012;
    const sq = Math.sin(this.squash * Math.PI) * 0.12;
    const crouch = this.crouch = lerp(this.crouch ?? 1, (this.state === 'graze' && this.speed < 0.3) ? 1 : 0, dt === 0 ? 1 : 1 - Math.exp(-dt * 4));
    this.body.position.y = this.y / this.sc + bob - sq * 0.5 - crouch * 0.22;
    for (const l of this.legs) l.scale.y = 1 - crouch * 0.58;
    this.body.scale.set(1 + sq * 0.5, 1 - sq + breathe, 1 + sq * 0.5);
    this.body.rotation.z = this.vy * 0.03 + (this.state === 'walk' ? Math.sin(this.gait * 2) * 0.02 : 0);
    let pitch = 0, yaw = 0;
    if (this.state === 'graze' && this.speed < 0.3){ pitch = -0.95; this.nibble += dt * 7; pitch += Math.sin(this.nibble) * 0.06 * (Math.sin(time * 0.7 + this.phase) > -0.3 ? 1 : 0);
      if (live){ const f = this.fwd(); addWear(this.x + f.x * 0.8 * this.sc, this.z + f.z * 0.8 * this.sc, 0.45, dt * 0.08); } }
    else if (this.state === 'idle'){ pitch = 0.08; yaw = this.lookYaw || 0; }
    else if (this.state === 'walk'){ pitch = -0.12 + Math.sin(this.gait * 2) * 0.05; }
    const k = dt === 0 ? 1 : 1 - Math.exp(-dt * 5);
    this.headPitch = lerp(this.headPitch, pitch, k); this.headYaw = lerp(this.headYaw, yaw, dt === 0 ? 1 : 1 - Math.exp(-dt * 3));
    this.neck.rotation.set(0, this.headYaw, this.headPitch);
    this.neck.position.y = 0.8 + (this.headPitch < -0.3 ? -0.06 : 0) * (-this.headPitch);
    this.ear1.rotation.x = 0.5 + Math.sin(time * 3 + this.phase) * 0.05; this['ear-1'].rotation.x = -0.5 - Math.sin(time * 2.6 + this.phase) * 0.05;
    this.root.rotation.y = this.heading;
    if (SHEEP_SHO[0] || SHEEP_SHO[1]){ const a = this.heading, ca = Math.cos(a), sa = Math.sin(a); this.body.position.x = (SHEEP_SHO[0] * ca - SHEEP_SHO[1] * sa) / this.sc; this.body.position.z = (SHEEP_SHO[0] * sa + SHEEP_SHO[1] * ca) / this.sc; }
    this.phase += dt;
    this.pickFrame();
  }
  pickFrame(){
    // which painted view: heading relative to the camera, 8 directions
    const f = this.fwd(); camera.getWorldDirection(TMPV2); TMPV2.y = 0; TMPV2.normalize();
    const sz = f.x * TMPV2.x + f.z * TMPV2.z, sx = f.x * -TMPV2.z + f.z * TMPV2.x;     // away-from-camera, screen-right
    const th = Math.atan2(-sz * DIR_SQ, sx); const col = ((Math.round((Math.PI - th) / (Math.PI / 4)) % 8) + 8) % 8;
    let row = 1;
    if (this.y > 0.04 || this.vy > 0) row = 3;
    else if (this.speed > 0.2) row = Math.sin(this.gait * 2) > 0 ? 2 : 1;
    else if ((this.crouch ?? 0) > 0.5) row = 0;
    const id = row * 8 + col;
    const u = this.spr.material.uniforms;
    if (id !== this.frame){ this.frame = id; u.uRect.value.set(...atlasRect(8, 4, col, row)); }
    const k = SHEEP_CELL_W * this.root.scale.x; u.uSize.value.set(k, k);
    this.spr.position.y = this.y / this.root.scale.x - Math.sin(this.squash * Math.PI) * 0.06;
  }
}
function angDiff(a, b){ let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }
function onBoard(x, z, m){ const [u, v] = w2uv(x, z); return u > m / W && u < 1 - m / W && v > m / D && v < 1 - m / D; }
function walkable(x, z, m = 1){
  if (!onBoard(x, z, m)) return false;
  if (riverDist(x, z) < RIVER_HALF + 0.25 + m * 0.35) return false;
  for (const t of trees) if (Math.hypot(x - t.x, z - t.z) < t.r + 0.3) return false;
  return true;
}

// initial flock, as in the first frame of the reference
const SHEEP_CY = +(Q.get('scy') || 0.25);
function populate(){
  for (const sp of LAYOUT.sheep){
    const p = rayAtY(sp.px[0], sp.px[1], SHEEP_CY * SHEEP_SCALE); let h = Math.PI / 2;
    const d = sp.dir; const f = rayAtY(sp.px[0] + d[0] * 40, sp.px[1] + d[1] * 40, SHEEP_CY * SHEEP_SCALE); h = Math.atan2(-(f.z - p.z), f.x - p.x);
    const fit = sp.fit;
    if (fit){   // painted view fitted to the reference: pick the heading that shows that view, nudge position/size
      const q = rayAtY(sp.px[0] + fit.dx, sp.px[1] + fit.dy, SHEEP_CY * SHEEP_SCALE); p.x = q.x; p.z = q.z;
      const th = Math.PI - fit.col * Math.PI / 4, cf = refCam.getWorldDirection(new THREE.Vector3()); cf.y = 0; cf.normalize();
      const sx = Math.cos(th), sz = -Math.sin(th) / DIR_SQ, fx = sx * -cf.z + sz * cf.x, fz = sx * cf.x + sz * cf.z;
      h = Math.atan2(-fz, fx);
    }
    const s = new Sheep(p.x, p.z, { heading: h, state: fit && fit.row === 1 ? 'idle' : 'graze', size: fit ? fit.s : 1 });

  }
}

// ---------- selection UI ----------
const selEl = document.getElementById('sel'), boxEl = selEl.querySelector('.box'), dimEl = selEl.querySelector('.dim');
const barEl = document.getElementById('bar');
let selected = null;
function select(s){ selected = s; selEl.hidden = barEl.hidden = !s; if (s){ s.lockT = -1e9; } refreshBar(); placeSelection(true); }
function deselect(){ if (selected){ selected.lockT = 10; } select(null); }
function refreshBar(){ if (!selected) return; const m = selected.state === 'jump' ? 'jump' : (selected.lock || selected.state);
  barEl.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === m)); }
barEl.addEventListener('pointerdown', e => e.stopPropagation());
let barHover = false; barEl.addEventListener('pointerenter', () => barHover = true); barEl.addEventListener('pointerleave', () => barHover = false);
barEl.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || !selected) return;
  if (b.dataset.mode){ selected.setMode(b.dataset.mode); }
  else if (b.dataset.act === 'rotl'){ selected.heading += Math.PI / 4; selected.targetHeading = selected.heading; }
  else if (b.dataset.act === 'rotr'){ selected.heading -= Math.PI / 4; selected.targetHeading = selected.heading; }
  else if (b.dataset.act === 'dup'){ const f = selected.fwd(); const side = new THREE.Vector3(-f.z, 0, f.x);
    let x = selected.x + side.x * 1.4, z = selected.z + side.z * 1.4; if (!walkable(x, z, 0.6)){ x = selected.x - side.x * 1.4; z = selected.z - side.z * 1.4; }
    const c = new Sheep(x, z, { heading: selected.heading, size: selected.size, materialise: true, state: selected.lock || selected.state }); if (selected.lock) c.setMode(selected.lock); c.lockT = 10; select(c); }
  else if (b.dataset.act === 'del'){ const s = selected; select(null); s.dying = true; }
  refreshBar();
});
const corners = [...Array(8)].map(() => new THREE.Vector3());
let barPos = null;
function placeSelection(force){
  if (!selected) return;
  if (selected.dying || !sheep.includes(selected)){ select(null); return; }
  const s = selected; s.root.updateMatrixWorld(true);
  // generous bounding box around the sheep, like the reference gizmo
  const bb = new THREE.Box3(new THREE.Vector3(-0.95, 0.0, -0.78), new THREE.Vector3(1.2, 1.4, 0.78));
  let i = 0; for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) corners[i++].set(x, y + s.body.position.y, z).applyMatrix4(s.root.matrixWorld);
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
  let r0 = 1e9, r1 = -1e9, u0 = 1e9, u1 = -1e9;
  for (const c of corners){ const pr = right.dot(c), pu = up.dot(c); r0 = Math.min(r0, pr); r1 = Math.max(r1, pr); u0 = Math.min(u0, pu); u1 = Math.max(u1, pu);
    const p = c.clone().project(camera); const sx = (p.x + 1) / 2 * innerWidth, sy = (1 - p.y) / 2 * innerHeight; x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy); }
  Object.assign(boxEl.style, { left: x0 + 'px', top: y0 + 'px', width: (x1 - x0) + 'px', height: (y1 - y0) + 'px' });
  const dist = camera.position.distanceTo(s.root.position);
  dimEl.textContent = `${(r1 - r0).toFixed(2)} × ${(u1 - u0).toFixed(2)} m · ${Math.round(dist)} m away`;
  const dw = dimEl.offsetWidth; dimEl.style.left = clamp((x0 + x1) / 2, dw / 2 + 6, innerWidth - dw / 2 - 6) + 'px'; dimEl.style.top = (y1 + 6) + 'px';
  const bw = barEl.offsetWidth, bh = barEl.offsetHeight; let bx = clamp((x0 + x1) / 2, bw / 2 + 8, innerWidth - bw / 2 - 8), by = y1 + 6 + 17 + 8;
  if (by + bh > innerHeight - 8) by = y0 - bh - 10;
  if (force || !barHover || barPos !== s){ barEl.style.left = bx + 'px'; barEl.style.top = by + 'px'; barPos = s; }
}

// ---------- input: draw a loop to make a sheep, tap a sheep to select, drag to move ----------
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const strokeEl = document.getElementById('stroke');
let down = null, dragSheep = null, scaleDrag = null, loop = null, touches = 0;
function setRay(x, y){ ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera); }
function pickSheep(x, y){ setRay(x, y); const hits = ray.intersectObjects(sheep.filter(s => !s.dying).map(s => s.hit), false); return hits.length ? hits[0].object.userData.sheep : null; }
function pickGround(x, y, m = 0.4){ setRay(x, y); const p = new THREE.Vector3(); if (!ray.ray.intersectPlane(groundPlane, p)) return null; return onBoard(p.x, p.z, m) ? p : null; }
function drawStroke(){ if (!loop) return; strokeEl.setAttribute('d', 'M' + loop.pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L') + (loop.closed ? 'Z' : '')); }
function finishLoop(){
  const L = loop; loop = null; if (!L) return;
  const pts = L.pts; let len = 0; for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i-1][0], pts[i][1] - pts[i-1][1]);
  let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9; for (const [x, y] of pts){ minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y); }
  const diag = Math.hypot(maxx - minx, maxy - miny), gap = Math.hypot(pts[0][0] - pts[pts.length-1][0], pts[0][1] - pts[pts.length-1][1]);
  const closed = len > 50 && diag > 18 && gap < Math.max(30, diag * 0.55);
  if (closed){
    loop = null; strokeEl.setAttribute('d', strokeEl.getAttribute('d') + 'Z');
    // centroid of the drawn polygon
    let cx = 0, cy = 0, A = 0; for (let i = 0; i < pts.length; i++){ const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length]; const c = x0 * y1 - x1 * y0; A += c; cx += (x0 + x1) * c; cy += (y0 + y1) * c; }
    if (Math.abs(A) < 1){ cx = (minx + maxx) / 2; cy = (miny + maxy) / 2; } else { cx /= 3 * A; cy /= 3 * A; }
    const g = pickGround(cx, cy + (maxy - miny) * 0.18, 0.6) || pickGround(cx, cy, 0.6);
    if (g && sheep.length < 120){
      let p = g; if (!walkable(p.x, p.z, 0.5)){ for (let k = 0; k < 30; k++){ const a = R(0, 6.28), r = R(0.4, 2); const q = new THREE.Vector3(g.x + Math.cos(a) * r, 0, g.z + Math.sin(a) * r); if (walkable(q.x, q.z, 0.5)){ p = q; break; } } }
      // drawn size sets the sheep size a little
      const wpx = (maxx - minx) / innerWidth * 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect * camera.position.distanceTo(p);
      const size = clamp(wpx / 1.6, 0.8, 1.25);
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
      const ns = new Sheep(p.x, p.z, { heading: R(-Math.PI, Math.PI), size, state: 'idle', materialise: true, dir: right.multiplyScalar(rand() < 0.5 ? 1 : -1).add(new THREE.Vector3(0, 0.35, 0)) });
      ns.t = R(1.5, 3); hint.classList.add('off');
    }
  }
  strokeEl.classList.add('fade'); clearTimeout(strokeEl._t); strokeEl._t = setTimeout(() => { strokeEl.setAttribute('d', ''); strokeEl.classList.remove('fade'); }, 520);
}
canvas.addEventListener('pointerdown', e => {
  if (e.pointerType === 'touch'){ touches++; if (touches > 1){ if (loop){ loop = null; strokeEl.setAttribute('d', ''); } if (dragSheep){ dragSheep = null; } down = null; return; } }
  down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId, moved: false };
  if (e.button !== 0 && e.pointerType === 'mouse'){ down = null; return; }
  const s = pickSheep(e.clientX, e.clientY);
  if (s){ dragSheep = { s, ox: 0, oz: 0, active: false }; const g = pickGround(e.clientX, e.clientY, -5); if (g){ dragSheep.ox = s.x - g.x; dragSheep.oz = s.z - g.z; } }
  else { clearTimeout(strokeEl._t); strokeEl.classList.remove('fade'); loop = { pts: [[e.clientX, e.clientY]] }; drawStroke(); }
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', e => {
  if (down && e.pointerId === down.id && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) down.moved = true;
  if (dragSheep && down && down.moved){ const g = pickGround(e.clientX, e.clientY, -5); if (g){ if (!dragSheep.active){ dragSheep.active = true; select(dragSheep.s); }
      const s = dragSheep.s; const nx = g.x + dragSheep.ox, nz = g.z + dragSheep.oz; if (walkable(nx, nz, 0.5)){ s.root.position.x = nx; s.root.position.z = nz; } s.y = Math.max(s.y, 0.3); s.vy = 0; s.goal = null; s.speed = 0; } canvas.className = 'move'; return; }
  if (loop && down && e.pointerId === down.id){ const l = loop.pts[loop.pts.length - 1]; if (Math.hypot(e.clientX - l[0], e.clientY - l[1]) > 2.5){ loop.pts.push([e.clientX, e.clientY]); drawStroke(); } return; }
  if (!down && e.pointerType === 'mouse'){ const s = pickSheep(e.clientX, e.clientY); canvas.className = s ? 'pointer' : ''; }
});
function endPointer(e){
  if (e.pointerType === 'touch') touches = Math.max(0, touches - 1);
  if (!down || e.pointerId !== down.id) return;
  const click = !down.moved && performance.now() - down.t < 600;
  if (dragSheep){ const s = dragSheep.s; if (!dragSheep.active && click){ selected === s ? deselect() : select(s); } else if (s.y > 0) s.vy = 0.1; dragSheep = null; canvas.className = ''; }
  else if (loop){ if (click){ loop = null; strokeEl.setAttribute('d', ''); if (selected) deselect(); else { hint.classList.remove('off'); clearTimeout(hint._t); hint._t = setTimeout(() => hint.classList.add('off'), 2500); } } else finishLoop(); }
  down = null;
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', e => { if (e.pointerType === 'touch') touches = Math.max(0, touches - 1); dragSheep = null; loop = null; strokeEl.setAttribute('d', ''); down = null; });
canvas.addEventListener('contextmenu', e => e.preventDefault());
selEl.querySelectorAll('.h').forEach(h => {
  h.addEventListener('pointerdown', e => { if (!selected) return; e.stopPropagation(); e.preventDefault(); h.setPointerCapture(e.pointerId);
    const r = boxEl.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    scaleDrag = { s: selected, cx, cy, d0: Math.hypot(e.clientX - cx, e.clientY - cy), s0: selected.size }; controls.enabled = false; });
  h.addEventListener('pointermove', e => { if (!scaleDrag) return; const d = Math.hypot(e.clientX - scaleDrag.cx, e.clientY - scaleDrag.cy); scaleDrag.s.size = clamp(scaleDrag.s0 * d / scaleDrag.d0, 0.5, 2.4); scaleDrag.s.root.scale.setScalar(scaleDrag.s.sc); });
  const end = () => { scaleDrag = null; controls.enabled = true; }; h.addEventListener('pointerup', end); h.addEventListener('pointercancel', end);
});
addEventListener('keydown', e => {
  if (e.key === 'r' && !selected){ homeView(); return; }
  if (!selected) return;
  const map = { '1': 'idle', '2': 'graze', '3': 'walk', '4': 'jump', ' ': 'jump' };
  if (map[e.key]){ selected.setMode(map[e.key]); refreshBar(); e.preventDefault(); }
  if (e.key === 'Escape') deselect();
  if (e.key === 'Delete' || e.key === 'Backspace'){ const s = selected; select(null); s.dying = true; }
});
const hint = document.getElementById('hint');

// ---------- loop ----------
function resize(){ renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; fitFov(); camera.updateProjectionMatrix(); }
addEventListener('resize', () => { resize(); });
resize(); homeView(); populate();
setTimeout(() => hint.classList.add('off'), 7000);
const HOOKS = [], POST = {};
const clock = new THREE.Clock(); let time = 0, wearAcc = 0, frames = 0;
renderer.setAnimationLoop(() => {
  const raw = Math.min(clock.getDelta(), 0.05), dt = FREEZE ? 0 : raw; time += dt;
  for (const s of [...sheep]) s.update(dt, time);
  for (const t of trees){ t.crown.rotation.z = Math.sin(time * 0.8 + t.phase) * 0.01; t.crown.rotation.x = Math.cos(time * 0.6 + t.phase) * 0.008; }
  for (const c of clouds){ c.m.position.x = c.p.x + Math.sin(time * 0.05 + c.ph) * 0.8; c.m.position.y = c.p.y + Math.sin(time * 0.4 + c.ph) * 0.08; }
  scene.userData.riverMat.uniforms.uTime.value = time;
  wearAcc += dt; if (wearAcc > 0.25){ flushWear(wearAcc); wearAcc = 0; }
  for (const h of HOOKS) h(dt, time);
  controls.update();
  if (POST.render) POST.render(); else renderer.render(scene, camera);
  placeSelection(); if (selected) refreshBar();
  frames++; if (frames === 3) document.body.dataset.ready = '1';
});
window.__sheep = { sprInfo: () => sheep.map(s => { const v = s.root.position.clone().project(camera), d = -s.root.position.clone().applyMatrix4(camera.matrixWorldInverse).z;
    return { ax: (v.x + 1) / 2 * CAM.img[0], ay: (1 - v.y) / 2 * CAM.img[1], cell: SHEEP_CELL_W * s.root.scale.x * FPX / d, frame: s.frame }; }), treeInfo: () => trees.map(t => { const u = t.grp.userData.bb, w = new THREE.Vector3(t.grp.position.x, u.cy, t.grp.position.z), v = w.clone().project(camera), d = -w.clone().applyMatrix4(camera.matrixWorldInverse).z;
    return { ax: (v.x + 1) / 2 * CAM.img[0], ay: (1 - v.y) / 2 * CAM.img[1], cell: u.cw * FPX / d, ccy: u.ccy, idx: u.cell }; }), sheep, select, camera, controls, homeView, uv2w, w2uv, THREE, scene, renderer, sun, hemi, SUN_DIR, trees, clouds, ground, boardGeo, groundTex, GRADE, CLOUD_GRADE, woolMat, HOOKS, POST, CAM, MOBILE, E, W, D, wearMesh, canvas, get fps(){ return frames / Math.max(1e-3, clock.elapsedTime); } };
if (window.PLUS) import('./plus/plus.js');
