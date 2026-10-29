// Plus edition: the camera as a lens. (1) A tilt-shift miniature depth of field: thin-lens circle of confusion for
// the ground point under each pixel (that is what a tilted plane of focus does: tall things blur with the ground behind
// them), focus racks slowly to the flock or the selected sheep. Two separable gather passes over the finished frame,
// so the image itself (sRGB, premultiplied) is untouched where it is in focus. (2) A slow breathing drift while idle.
// (3) Gyroscope parallax on phones. Drift and parallax go into a separate render camera; ray picks follow it.
const S = window.__sheep, { THREE, renderer, scene, camera, controls } = S;
const Q = new URLSearchParams(location.search);
const TILT = +(Q.get('tilt') ?? 1), DRIFT = +(Q.get('drift') ?? 1);
const cam = camera.clone();

// ---- picks and projections use what is on screen
const rs = THREE.Raycaster.prototype.setFromCamera;
THREE.Raycaster.prototype.setFromCamera = function(c, k){ return rs.call(this, c, k === camera ? cam : k); };
const pj = THREE.Vector3.prototype.project;
THREE.Vector3.prototype.project = function(k){ return pj.call(this, k === camera ? cam : k); };

// ---- drift + parallax
let idle = 0, dk = 0, t = 0;
const bump = () => { idle = 0; };
for (const e of ['pointerdown', 'wheel', 'keydown']) addEventListener(e, bump, { passive: true, capture: true });
let gy = null, gb = { b: 0, g: 0 }, ga = { az: 0, el: 0 }, gon = false;
function onOri(e){ if (e.beta == null) return; const b = e.beta, g = e.gamma;
  if (!gy){ gy = { b, g }; gb = { b, g }; } gy.b = b; gy.g = g; gon = true; }
function startGyro(){ addEventListener('deviceorientation', onOri); }
if (S.MOBILE && window.DeviceOrientationEvent){
  if (typeof DeviceOrientationEvent.requestPermission === 'function'){        // iOS: needs a tap
    const b = document.createElement('button'); b.id = 'tiltbtn'; b.textContent = 'tilt to look'; b.title = 'move the view with your phone';
    (document.getElementById('tod') || document.body).appendChild(b);
    b.addEventListener('click', () => DeviceOrientationEvent.requestPermission().then(r => { if (r === 'granted') startGyro(); b.remove(); }).catch(() => b.remove()));
  } else startGyro();
}
const off = new THREE.Vector3(), q = new THREE.Quaternion(), ax = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
function place(dt){
  t += dt; idle += dt;
  dk += ((idle > 6 && DRIFT ? 1 : 0) - dk) * Math.min(1, dt * (idle > 6 ? 0.25 : 3));   // dt here is wall time
  let az = dk * (0.9 * Math.sin(t * 2 * Math.PI / 53) + 0.35 * Math.sin(t * 2 * Math.PI / 31 + 2)) * Math.PI / 180;
  let el = dk * 0.45 * Math.sin(t * 2 * Math.PI / 67 + 1) * Math.PI / 180;
  const dolly = 1 + dk * 0.006 * Math.sin(t * 2 * Math.PI / 41);
  if (gon){ const k = Math.min(1, dt / 5); gb.b += (gy.b - gb.b) * k; gb.g += (gy.g - gb.g) * k;   // slowly re-centre on how the phone is held
    const cl = (v, m) => Math.max(-m, Math.min(m, v));
    ga.az += (cl((gy.g - gb.g) * 0.14, 3.2) - ga.az) * Math.min(1, dt * 6); ga.el += (cl((gy.b - gb.b) * 0.09, 2) - ga.el) * Math.min(1, dt * 6);
    az += ga.az * Math.PI / 180; el += ga.el * Math.PI / 180; }
  cam.copy(camera, false); cam.fov = camera.fov; cam.aspect = camera.aspect; cam.near = camera.near; cam.far = camera.far;
  off.copy(camera.position).sub(controls.target).multiplyScalar(dolly);
  off.applyQuaternion(q.setFromAxisAngle(up, az));
  ax.crossVectors(up, off).normalize(); off.applyQuaternion(q.setFromAxisAngle(ax, -el));
  cam.position.copy(controls.target).add(off); cam.up.set(0, 1, 0); cam.lookAt(controls.target);
  cam.updateProjectionMatrix(); cam.updateMatrixWorld();
}

// ---- tilt-shift
const size = new THREE.Vector2();
const fbTex = new THREE.FramebufferTexture(1, 1); fbTex.minFilter = fbTex.magFilter = THREE.LinearFilter;
const rt = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
const FS = `
precision highp float;
uniform sampler2D uSrc; uniform vec2 uPx, uDir; uniform mat4 uInvPV; uniform vec3 uCam, uFwd; uniform float uFoc, uA, uMax;
varying vec2 vUv;
float coc(vec2 uv){                                  // thin lens: |1 - zf/z| for the ground point under this pixel
  vec4 a = uInvPV * vec4(uv * 2. - 1., -1., 1.), b = uInvPV * vec4(uv * 2. - 1., 1., 1.);
  vec3 p0 = a.xyz / a.w, d = normalize(b.xyz / b.w - p0);
  float tt = d.y < -1e-4 ? -p0.y / d.y : 1e4; vec3 g = p0 + d * tt;
  float z = max(dot(g - uCam, uFwd), 0.1);
  return min(uA * max(abs(1. - uFoc / z) - 0.05, 0.), uMax);
}
void main(){
  float r = coc(vUv);
  vec4 c = texture2D(uSrc, vUv);
  if (r < 0.25){ gl_FragColor = c; return; }
  vec4 acc = c; float w = 1.;
  for (int i = 1; i <= 6; i++){ float f = float(i) / 6.; float k = exp(-2.2 * f * f); vec2 o = uDir * uPx * r * f;
    acc += (texture2D(uSrc, vUv + o) + texture2D(uSrc, vUv - o)) * k; w += 2. * k; }
  gl_FragColor = acc / w;
}`;
const VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;
const U = { uSrc: { value: fbTex }, uPx: { value: new THREE.Vector2() }, uDir: { value: new THREE.Vector2(1, 0) }, uInvPV: { value: new THREE.Matrix4() },
  uCam: { value: new THREE.Vector3() }, uFwd: { value: new THREE.Vector3() }, uFoc: { value: 20 }, uA: { value: 0 }, uMax: { value: 6 } };
const mat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: U, blending: THREE.NoBlending, depthTest: false, depthWrite: false });
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); quad.frustumCulled = false;
const qs = new THREE.Scene(); qs.add(quad); const qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const fp = new THREE.Vector3(), tmp = new THREE.Vector3(), zero = new THREE.Vector2();
let foc = null, fbW = 0, fbH = 0;
function focusTarget(){
  const sel = S.sheep.find(s => s.lockT === -1e9);
  if (sel) return tmp.set(sel.x, 0, sel.z);
  const a = S.sheep.filter(s => !s.dying); if (!a.length) return tmp.copy(controls.target);
  let x = 0, z = 0; for (const s of a){ x += s.x; z += s.z; } return tmp.set(x / a.length * 0.8 + controls.target.x * 0.2, 0, z / a.length * 0.8 + controls.target.z * 0.2);
}
let last = performance.now();
S.POST.render = () => {
  const now = performance.now(), wall = Math.min((now - last) / 1000, 2), dt = Math.min(wall, 0.1); last = now;
  place(wall);
  renderer.render(scene, cam);
  if (!TILT) return;
  renderer.getDrawingBufferSize(size);
  if (size.x !== fbW || size.y !== fbH){ fbW = size.x; fbH = size.y; fbTex.image.width = fbW; fbTex.image.height = fbH; fbTex.dispose(); rt.setSize(fbW, fbH); }
  const ft = focusTarget(); if (!foc) foc = ft.clone(); else foc.lerp(ft, Math.min(1, dt * 0.35));   // a slow rack focus
  cam.getWorldDirection(U.uFwd.value); U.uCam.value.copy(cam.position);
  U.uFoc.value = fp.copy(foc).sub(cam.position).dot(U.uFwd.value);
  U.uInvPV.value.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse).invert();
  const pr = renderer.getPixelRatio(), sc = Math.min(fbW / pr / 1440, fbH / pr / 900) * pr;   // blur in CSS px, scaled to how big the board is drawn
  U.uA.value = 14 * sc * TILT; U.uMax.value = 3.6 * sc;
  U.uPx.value.set(1 / fbW, 1 / fbH);
  renderer.copyFramebufferToTexture(fbTex, zero);
  const ac = renderer.autoClear; renderer.autoClear = false;
  U.uSrc.value = fbTex; U.uDir.value.set(1, 0); renderer.setRenderTarget(rt); renderer.render(qs, qc);
  U.uSrc.value = rt.texture; U.uDir.value.set(0, 1); renderer.setRenderTarget(null); renderer.render(qs, qc);
  renderer.autoClear = ac;
};
S.cam2 = cam;
