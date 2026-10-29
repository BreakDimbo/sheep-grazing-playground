// Plus edition: a passing shower on the paper. Overcast greys the light, the ground soaks up the rain in spots
// until it is evenly dark, rain falls through the lens as thin motion-blurred streaks (drawn in camera.js),
// drops ring the river, the flock bunches up in the lee of a tree. When it passes the paper dries from its
// edges inward, unevenly, leaving a darker tide line at the drying front until the last wet patch is gone.
// Occasional on its own (daytime), the cloud button in the clock bar starts or ends one; ?rain=1 starts at once.
const S = window.__sheep, { THREE, scene } = S, L = S.light, Q = new URLSearchParams(location.search);
const rnd = (a, b) => a + Math.random() * (b - a), ss = THREE.MathUtils.smoothstep;
const R = { k: 0, oc: 0, A: 0, D: 0, T: 0, hold: 0, next: Q.get('rain') === '0' ? 1e9 : rnd(110, 220), t: 0, col: new THREE.Vector3(.8, .82, .85) };
S.rain = R;
const NOISE = `float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + 1.), f.x), f.y); }
  float fbm(vec2 p){ return .5 * n(p) + .3 * n(p * 2.13 + 5.2) + .2 * n(p * 4.37 + 1.7); }`;
// 1) wet ground: a multiply layer over the board (2*src*dst, 0.5 = untouched), like the cloud shadows
const GU = { uA: { value: 0 }, uD: { value: 0 }, uDry: { value: 0 }, uG: { value: S.groundTex } };
const gmat = new THREE.ShaderMaterial({ uniforms: GU, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4,
  blending: THREE.CustomBlending, blendSrc: THREE.DstColorFactor, blendDst: THREE.SrcColorFactor, blendEquation: THREE.AddEquation,
  vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `uniform float uA, uD, uDry; uniform sampler2D uG; varying vec2 vUv; varying vec3 vW; ${NOISE}
    void main(){ vec4 gt = texture2D(uG, vUv); if (gt.a < .5) discard;
      vec2 p = vW.xz;
      // soaking: first drops darken small spots, they merge, then the whole field is dark
      float soak = smoothstep(0., .45, uA * 1.6 - (.35 * fbm(p * 1.6 + 9.) + .65 * fbm(p * .6)));
      // drying order: the edges of the sheet first, then inward along a ragged front; hollows hold water longest
      vec2 e2 = min(vUv, 1. - vUv); float e = 1. - 2. * min(e2.x, e2.y);
      float o = clamp(.06 + .78 * pow(e, 1.3) + .42 * (fbm(p * .28 + 3.1) - .5) + .07 * (n(p * 2.2) - .5), .02, 1.);
      float f = uD * 1.12 - .04;
      float wetF = smoothstep(o - .018, o + .018, f) * (.86 + .14 * smoothstep(o, o + .25, f));
      float water = smoothstep(.04, .14, gt.b - gt.r);
      float wet = soak * wetF * (1. - water);
      float tide = exp(-pow((f - o - .026) / .016, 2.)) * uDry * soak * (1. - water);   // the darker rim where the water draws back
      vec3 col = mix(vec3(1.), vec3(.62, .68, .64), wet) * (1. - .13 * tide);
      gl_FragColor = vec4(col * .5, 1.); }` });
const wetM = new THREE.Mesh(S.boardGeo, gmat); wetM.position.y = 0.009; wetM.renderOrder = -1; wetM.visible = false; scene.add(wetM);
// 2) rings on the river: each drop a thin crest (sky reflected) with a darker trough inside, expanding and fading
let rib = null; scene.traverse(o => { if (o.material === scene.userData.riverMat) rib = o; });
const RU = { uT: { value: 0 }, uK: { value: 0 }, uSky: { value: new THREE.Vector3() }, uVis: { value: 1 }, uLen: { value: rib.material.uniforms.uLen.value }, uG: { value: S.groundTex } };
const rmat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: RU,
  blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
  vertexShader: `attribute vec2 tuv; varying vec2 vUv, vT; varying vec3 vW;
    void main(){ vUv = uv; vT = tuv; vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `uniform float uT, uK, uLen, uVis; uniform vec3 uSky; uniform sampler2D uG; varying vec2 vUv, vT; varying vec3 vW; ${NOISE}
    void main(){
      vec2 p = vW.xz; const float C = .2; vec2 b = floor(p / C); float cr = 0., tr = 0.;
      for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++){ vec2 id = b + vec2(i, j);
        float P = .7 + .8 * h(id + 2.3), ph = h(id + 7.1) * P, cyc = floor((uT + ph) / P), tau = uT + ph - cyc * P;
        if (h(id + cyc * .731) > .62 * uK) continue;                       // more drops the harder it rains
        vec2 c = (id + .15 + .7 * vec2(h(id + cyc * 1.37 + .4), h(id + cyc * 2.11 + .9))) * C;
        float lf = .55, a = pow(max(1. - tau / lf, 0.), 2.) * smoothstep(0., .04, tau), w = .006 + .008 * tau / lf, d = length(p - c) - tau * .2;
        cr += exp(-pow(d / w, 2.)) * a; tr += exp(-pow((d + 1.9 * w) / w, 2.)) * a; }
      float x = vUv.x, edge = smoothstep(0., .15, x) * smoothstep(1., .85, x), ends = smoothstep(.3, 1.2, vUv.y) * smoothstep(uLen - .3, uLen - 1.2, vUv.y);
      vec4 gt = texture2D(uG, vT); float m = step(.5, gt.a) * smoothstep(.04, .14, gt.b - gt.r) * edge * ends;
      m *= uVis; float lit = min(cr, 1.) * .085 * m, dk = min(tr, 1.) * .065 * m;
      gl_FragColor = vec4(uSky * lit, dk);
      #include <colorspace_fragment>
    }` });
const rings = new THREE.Mesh(rib.geometry, rmat); rings.renderOrder = 3; rings.visible = false; scene.add(rings);
// 3) overcast: the sun goes behind the rain cloud, the sky light turns grey (applied before the light is set each frame)
const G = new THREE.Vector3();
S.lightMod = (sc, sky, gnd) => { const o = R.oc; if (o < 1e-3) return;
  sc.multiplyScalar(1 - .80 * o);
  for (const v of [sky, gnd]){ const y = (v.x + v.y + v.z) / 3; v.lerp(G.set(y * .97, y * 1.0, y * 1.05), .6 * o).multiplyScalar(1 - .12 * o); } };
// 4) the flock: bunch up in the lee of the nearest tree (or just together in the open)
function huddle(){ const a = S.sheep.filter(s => !s.dying && !s.lamb); if (!a.length) return;
  let cx = 0, cz = 0; for (const s of a){ cx += s.x; cz += s.z; } cx /= a.length; cz /= a.length;
  let best = null, bd = 7; for (const t of S.trees){ const d = Math.hypot(t.x - cx, t.z - cz); if (d < bd){ bd = d; best = t; } }
  let x = cx, z = cz; if (best){ const d = Math.max(bd, 1e-3); x = best.x + (cx - best.x) / d * 1.1; z = best.z + (cz - best.z) / d * 1.1; }
  S.flock.huddle = { x, z, r: 1.3 + 0.1 * a.length };
  for (const s of S.sheep) if (!s.dying && !s.lock && s.state !== 'rest' && !s.flee) setTimeout(() => { if (s.state !== 'rest' && s.state !== 'walk'){ s.state = 'idle'; s.t = 0.5; } }, rnd(200, 3500)); }
// 5) control: start / end, the envelope, auto showers
const btn = document.createElement('button'); btn.id = 'rainbtn'; btn.setAttribute('aria-label', 'Rain'); btn.title = 'Rain';
btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M7 14.5h9.5a3.5 3.5 0 0 0 .4-7A5 5 0 0 0 7.3 9 2.8 2.8 0 0 0 7 14.5z"/><path class="w" d="M9 17l-.8 2.2M12.5 17l-.8 2.2M16 17l-.8 2.2"/></svg>';
const tod = document.getElementById('tod'); tod.insertBefore(btn, document.getElementById('snd'));
const start = () => { R.T = 1; R.hold = rnd(40, 60); if (S.flock) huddle(); btn.classList.add('on'); };
const stop = () => { R.T = 0; R.hold = 0; R.next = rnd(200, 420); btn.classList.remove('on'); };
btn.addEventListener('click', e => { e.stopPropagation(); R.T ? stop() : start(); });
R.start = start; R.stop = stop;
if (Q.get('rain') === '1') setTimeout(start, 600);
S.HOOKS.push(dt => {
  R.t += dt;
  if (!R.T){ R.next -= dt; if (R.next <= 0){ if (L.h > 6.5 && L.h < 19.2 && R.A < .01) start(); else R.next = 30; } }
  else { R.hold -= dt * ss(R.k, .8, .95); if (R.hold <= 0) stop(); }
  R.k += (R.T - R.k) * Math.min(1, dt / (R.T ? 6 : 8));                 // ~15 s to full rain, ~20 s to ease off
  R.oc += ((R.T ? 1 : 0) - R.oc) * Math.min(1, dt / (R.T ? 7 : 14));    // the cloud lingers a little after the rain
  if (R.k > .03){ R.A = Math.min(1, R.A + dt * R.k / 16); R.D = Math.min(1, R.D + dt * R.k / 1.5); }
  if (!R.T && R.k < .35 && R.A > 0){ R.D -= dt / 55; if (R.D <= 0){ R.D = 0; R.A = 0; } }
  if (S.flock && S.flock.huddle && !R.T && R.k < .3) S.flock.huddle = null;
  wetM.visible = R.A > 0.002; GU.uA.value = R.A; GU.uD.value = R.D; GU.uDry.value = R.T ? 0 : ss(R.k, .35, 0);
  // a ring is ~0.1 m across: on a small board that is a couple of pixels, a speck, so they fade out below ~60% board size
  const bs = Math.min(innerWidth / 1440, innerHeight / 900); RU.uVis.value = ss(bs, .5, .8);
  rings.visible = R.k > 0.01 && RU.uVis.value > 0.01; RU.uT.value = R.t; RU.uK.value = R.k;
  const sk = S.hemi.color; RU.uSky.value.set(sk.r, sk.g, sk.b).multiplyScalar(.45 / Math.PI * 3);
  R.col.set(sk.r, sk.g, sk.b).multiplyScalar(1 / Math.PI).addScalar(.06);
});
