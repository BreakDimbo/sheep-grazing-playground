// Plus edition: wind and moving light. Soft cloud shadows drift over the fields (projected along the sun),
// a gust field travels through the grass as a value ripple, crowns lean with the gusts.
const S = window.__sheep, { THREE } = S, L = S.light;
// tileable fbm value noise, shared by the shader (texture) and the CPU (sprite shading, tree sway)
const N = 256, NZ = new Float32Array(N * N);
{ let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let o = 0, amp = 1, tot = 0; o < 5; o++, amp *= 0.5){ const g = 4 << o, G = new Float32Array(g * g).map(rnd); tot += amp;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++){ const fx = x / N * g, fy = y / N * g, ix = fx | 0, iy = fy | 0, tx = fx - ix, ty = fy - iy, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const a = G[(iy % g) * g + ix % g], b = G[(iy % g) * g + (ix + 1) % g], c = G[((iy + 1) % g) * g + ix % g], d = G[((iy + 1) % g) * g + (ix + 1) % g];
      NZ[y * N + x] += amp * (a + (b - a) * sx + (c - a + (a - b + d - c) * sx) * sy); }
    if (o === 4) for (let i = 0; i < N * N; i++) NZ[i] /= tot; } }
const data = new Uint8Array(N * N * 4); for (let i = 0; i < N * N; i++){ data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = NZ[i] * 255; data[i * 4 + 3] = 255; }
const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
const nz = (u, v) => { u = (u % 1 + 1) % 1 * N - 0.5; v = (v % 1 + 1) % 1 * N - 0.5; const x = Math.floor(u), y = Math.floor(v), tx = u - x, ty = v - y, X = (x + N) % N, Y = (y + N) % N, X1 = (X + 1) % N, Y1 = (Y + 1) % N;
  return (NZ[Y * N + X] * (1 - tx) + NZ[Y * N + X1] * tx) * (1 - ty) + (NZ[Y1 * N + X] * (1 - tx) + NZ[Y1 * N + X1] * tx) * ty; };
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const WD = new THREE.Vector2(0.94, 0.34).normalize(), CS = 70, CV = 0.55, CH = 9;       // wind dir, cloud-shadow period (m), drift (m/s), cloud height (m)
const cloudAt = (x, z, t, sd) => { const px = x + sd.x / sd.y * CH - WD.x * CV * t, pz = z + sd.z / sd.y * CH - WD.y * CV * t; return sstep(0.47, 0.66, nz(px / CS, pz / CS)); };
const gustAt = (x, z, t) => { const a = x * WD.x + z * WD.y, b = -x * WD.y + z * WD.x; return sstep(0.42, 0.75, nz((a - 2.6 * t) / 34, b / 90 + 0.37)); };
const U = { uN: { value: tex }, uG: { value: S.groundTex }, uT: { value: 0 }, uSd: { value: new THREE.Vector3(0, 1, 0) }, uK: { value: 0 }, uTint: { value: new THREE.Vector3(1, 1, 1) }, uGust: { value: 1 } };
const mat = new THREE.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3,
  blending: THREE.CustomBlending, blendSrc: THREE.DstColorFactor, blendDst: THREE.SrcColorFactor, blendEquation: THREE.AddEquation,
  vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `uniform sampler2D uN; uniform sampler2D uG; uniform float uT; uniform vec3 uSd; uniform float uK; uniform vec3 uTint; uniform float uGust; varying vec2 vUv; varying vec3 vW;
    const vec2 WD = vec2(${WD.x.toFixed(4)}, ${WD.y.toFixed(4)});
    void main(){ float a = texture2D(uG, vUv).a; if (a < .5) discard;
      vec2 p = vW.xz + uSd.xz / uSd.y * ${CH.toFixed(1)} - WD * ${CV.toFixed(2)} * uT;
      float c = smoothstep(.47, .66, texture2D(uN, p / ${CS.toFixed(1)}).r) * uK;
      float al = vW.x * WD.x + vW.z * WD.y, bl = -vW.x * WD.y + vW.z * WD.x;
      float g = smoothstep(.42, .75, texture2D(uN, vec2((al - 2.6 * uT) / 34., bl / 90. + .37)).r);
      float fine = texture2D(uN, vec2((al - 2.6 * uT) / 6., bl / 22.)).r;                 // blades catching the light inside a gust
      vec3 col = mix(vec3(1.), uTint, c) * (1. + uGust * g * (0.05 + 0.05 * fine) * vec3(1., 1., .82));
      gl_FragColor = vec4(col * .5, 1.); }` });
const over = new THREE.Mesh(S.boardGeo, mat); over.position.y = 0.008; over.renderOrder = -1; S.scene.add(over);
// sprites: the same cloud shadow and gusts on trees and sheep (CPU-sampled at their feet)
const bb = o => { const m = o.material; if (!m.userData.t0) m.userData.t0 = m.uniforms.uTint.value.clone(); return m; };
const TMP = new THREE.Color();
let wt = 0;
S.HOOKS.push((dt) => { wt += dt; const time = wt;
  const sd = L.dir.y > 0.05 ? L.dir : new THREE.Vector3(0, 1, 0), sky = S.hemi.color, sc = S.sun.color, k = Math.max(0, Math.min(1, L.sunK)) * 0.78;
  U.uT.value = time; U.uSd.value.copy(sd); U.uK.value = k;
  const cosr = Math.max(sd.y, 0); U.uTint.value.set(sky.r / (sky.r + sc.r * cosr + 1e-4), sky.g / (sky.g + sc.g * cosr + 1e-4), sky.b / (sky.b + sc.b * cosr + 1e-4));
  const sh = (x, z) => { const c = cloudAt(x, z, time, sd) * k; return TMP.setRGB(1 + (U.uTint.value.x - 1) * c, 1 + (U.uTint.value.y - 1) * c, 1 + (U.uTint.value.z - 1) * c); };
  for (const t of S.trees){ const m = bb(t.grp.userData.bb.b), g = gustAt(t.x, t.z, time); m.uniforms.uTint.value.copy(m.userData.t0).multiply(sh(t.x, t.z));
    t.sw = (t.sw ?? 0) + ((g * 0.06 + Math.sin(time * 1.7 + t.phase) * 0.006) - (t.sw ?? 0)) * Math.min(1, dt * 2.5); m.uniforms.uSway.value = t.sw;
    t.crown.rotation.z += t.sw * 0.6; }
  for (const s of S.sheep){ if (!s.spr) continue; const p = s.root.position, m = bb(s.spr); m.uniforms.uTint.value.copy(m.userData.t0).multiply(sh(p.x, p.z)); }
});
S.wind = { cloudAt, gustAt };
