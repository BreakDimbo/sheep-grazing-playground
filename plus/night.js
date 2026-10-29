// Plus edition: moonlight on the river. The moon's mirror image broken up by the water's own ripples: every fragment
// gets a wave-slope normal, reflects the view ray, and lights only where that reflection lands within a few degrees of
// the moon. That is a glitter path, the way moonlight really sits on moving water. Additive over the river ribbon,
// drawn only while the moon is up (no cost by day).
const S = window.__sheep, { THREE, scene } = S, L = S.light, GL = +(new URLSearchParams(location.search).get('glint') ?? 1);
let rib = null; scene.traverse(o => { if (o.material === scene.userData.riverMat) rib = o; });
const U = { uT: { value: 0 }, uMoon: { value: new THREE.Vector3() }, uK: { value: 0 }, uLen: { value: rib.material.uniforms.uLen.value }, uG: { value: S.groundTex } };
const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,   // add light, leave coverage alone
  side: THREE.DoubleSide, uniforms: U,
  vertexShader: `attribute vec2 tuv; varying vec2 vUv, vT; varying vec3 vW;
    void main(){ vUv = uv; vT = tuv; vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `uniform float uT, uK, uLen; uniform vec3 uMoon; uniform sampler2D uG; varying vec2 vUv, vT; varying vec3 vW;
    float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + 1.), f.x), f.y); }
    vec2 grad(vec2 p){ float e = .5, c = n(p); return vec2(n(p + vec2(e, 0)) - c, n(p + vec2(0, e)) - c) / e; }
    void main(){
      vec2 p = vW.xz; float t = uT;
      // slopes: slow irregular swell from warped noise, no fine chop
      vec2 s = vec2(0.);
      // calm water: long slow swells only (0.3-0.8 m), so the moon lies on it as a soft broken column, not sparkles
      vec2 q = p + vec2(n(p * .9 + t * .05), n(p * .9 + 7.3 - t * .04)) * .8;          // warped, so the swell is irregular
      s += (grad(q * 2.0 + vec2(0., t * .16)) - .5) * .045 + (grad(q * 4.3 - vec2(t * .12, 0.)) - .5) * .022;
      vec3 N = normalize(vec3(-s.x, 1., -s.y));
      vec3 V = normalize(cameraPosition - vW), R = reflect(-V, N);
      float c = dot(R, uMoon);
      float g = exp(-(1. - c) / .0016);                                // soft lobe, ~3 degrees: the moon's mirror image smeared by the swell
      float F = .02 + .98 * pow(1. - max(dot(V, N), 0.), 5.);           // Fresnel for water
      float x = vUv.x, edge = smoothstep(0., .18, x) * smoothstep(1., .82, x), ends = smoothstep(.3, 1.5, vUv.y) * smoothstep(uLen - .3, uLen - 1.5, vUv.y);
      vec4 gt = texture2D(uG, vT); float wet = step(.5, gt.a) * smoothstep(.04, .14, gt.b - gt.r);
      float I = g * F * .85 * uK * edge * ends * wet;
      gl_FragColor = vec4(vec3(.80, .86, .95) * min(I, 1.), 0.);
      #include <colorspace_fragment>
    }` });
const glint = new THREE.Mesh(rib.geometry, mat); glint.renderOrder = 2; glint.visible = false; scene.add(glint);
let t = 0;
S.HOOKS.push(dt => {
  t += dt; const k = L.moonK * (1 - Math.min(1, L.sunK * 4));
  glint.visible = k > 0.01 && GL > 0; if (!glint.visible) return;
  U.uT.value = t; U.uK.value = k; U.uMoon.value.copy(L.dir);
});
