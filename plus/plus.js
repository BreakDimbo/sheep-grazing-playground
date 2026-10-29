// Plus edition: living light. A slow day — morning, noon (exactly the replica's light), golden hour,
// blue hour, a moonlit night — driven through the replica's own lights so every shadow is a real cast shadow.
const S = window.__sheep, { THREE, sun, hemi, GRADE, CLOUD_GRADE } = S;
const Q = new URLSearchParams(location.search);
const V = (r, g, b) => new THREE.Vector3(r, g, b);
const lerpV = (a, b, t) => a.clone().lerp(b, t);
// keyframes over the hour of day: sun light (albedo units per unit cos, replica = .796,.756,.371), sky, ground bounce
const KEYS = [
  [0,    V(0, 0, 0),            V(.017, .027, .062), V(.009, .012, .022)],
  [4.6,  V(0, 0, 0),            V(.017, .027, .062), V(.009, .012, .022)],
  [5.7,  V(0, 0, 0),            V(.16, .15, .26), V(.08, .08, .10)],
  [6.5,  V(.95, .48, .26),      V(.30, .29, .45), V(.18, .18, .22)],
  [8.0,  V(.84, .70, .44),      V(.36, .40, .66), V(.26, .30, .38)],
  [10.4, V(.796, .756, .371),   V(.40, .43, .72), V(.30, .34, .42)],
  [14.6, V(.796, .756, .371),   V(.40, .43, .72), V(.30, .34, .42)],
  [16.6, V(1.0, .76, .33),      V(.37, .39, .60), V(.30, .30, .32)],
  [18.0, V(1.18, .62, .24),     V(.30, .30, .43), V(.24, .21, .22)],
  [18.8, V(.95, .36, .13),      V(.25, .23, .38), V(.16, .14, .16)],
  [19.3, V(0, 0, 0),            V(.19, .19, .35), V(.09, .09, .13)],
  [20.6, V(0, 0, 0),            V(.024, .034, .075), V(.012, .015, .025)],
  [24,   V(0, 0, 0),            V(.017, .027, .062), V(.009, .012, .022)]];
function sample(h){ let i = 0; while (KEYS[i + 1][0] < h) i++; const a = KEYS[i], b = KEYS[i + 1], t = (h - a[0]) / (b[0] - a[0]), s = t * t * (3 - 2 * t);
  return [lerpV(a[1], b[1], s), lerpV(a[2], b[2], s), lerpV(a[3], b[3], s)]; }
const RISE = 6.2, SET = 19.05, NOON = (RISE + SET) / 2;
const EL0 = Math.asin(S.SUN_DIR.y), AZ0 = Math.atan2(S.SUN_DIR.z, S.SUN_DIR.x);
const MOON = new THREE.Vector3(0.6, 0.62, -0.5).normalize(), MOONC = V(.05, .078, .16);
const PI = Math.PI, SUNCOS = S.SUN_DIR.y;
function sunDir(h){ const f = (h - RISE) / (SET - RISE); const el = EL0 * Math.pow(Math.max(0, Math.sin(PI * Math.min(Math.max(f, 0), 1))), 0.85) + 0.035 * (1 - Math.sin(PI * Math.min(Math.max(f, 0), 1))), az = AZ0 + (f - 0.5) * PI;
  return new THREE.Vector3(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)); }
// time flows faster at night (it's short) and slowest through golden hour
const rate = h => (h > 16 && h < 19.6) ? 0.075 : (h > 20.5 || h < 5.5) ? 0.24 : 0.12;     // hours per second
let hour = Q.get('h') ? +Q.get('h') : 16.2, hold = Q.has('h'), dragT = -1;
const PAPER = [[0xee, 0xe6, 0xd9], [0xe7, 0xdf, 0xd4], [0xe3, 0xdb, 0xd0], [0xdf, 0xd7, 0xcc]];
const toLin = c => Math.pow(c / 255, 2.2), toS = v => Math.round(255 * Math.pow(Math.min(1, Math.max(0, v)), 1 / 2.2));
let frame = 0;
const L = { h: 0, sunK: 1, moonK: 0, dir: new THREE.Vector3() };   // shared with the other plus modules
S.light = L;
function apply(h){
  const [sc, sky, gnd] = sample(h), d = sunDir(h);
  const sunUp = (h > RISE && h < SET) ? THREE.MathUtils.smoothstep(d.y, 0.02, 0.10) : 0, moonK = THREE.MathUtils.smoothstep(h > 12 ? h - 24 : h, -4.2, -3.0) * (1 - THREE.MathUtils.smoothstep(h > 12 ? h - 24 : h, 4.0, 5.4));
  let ld, lc;
  if (sunUp > 0.001 || moonK < 0.001){ ld = d; lc = sc.clone().multiplyScalar(sunUp); }
  else { ld = MOON; lc = MOONC.clone().multiplyScalar(moonK); }
  sun.position.copy(ld).multiplyScalar(40);
  sun.color.setRGB(lc.x * PI, lc.y * PI, lc.z * PI, THREE.LinearSRGBColorSpace);
  hemi.color.setRGB(sky.x * PI, sky.y * PI, sky.z * PI, THREE.LinearSRGBColorSpace); hemi.groundColor.setRGB(gnd.x * PI, gnd.y * PI, gnd.z * PI, THREE.LinearSRGBColorSpace);
  // painted sprites carry their own baked shading: grade them by the light the ground under them receives
  const irr = sky.clone().add(lc.clone().multiplyScalar(Math.max(ld.y, 0)));
  GRADE.value.copy(irr).multiplyScalar(0.92).addScalar(0.08 * (irr.x + irr.y + irr.z) / 3);
  // clouds sit high and catch the low sun sideways, so they stay lit (and turn rose) after the fields fall into shadow
  const cl = sky.clone().multiplyScalar(1.15).add(sc.clone().multiplyScalar(Math.max(0, THREE.MathUtils.smoothstep(d.y, -0.06, 0.05)) * 0.6 / 0.78));
  cl.add(MOONC.clone().multiplyScalar(moonK * 1.5)); CLOUD_GRADE.value.set(Math.min(1.05, cl.x), Math.min(1.05, cl.y), Math.min(1.05, cl.z));
  L.h = h; L.sunK = sunUp * (sc.x + sc.y + sc.z) / 1.92; L.moonK = moonK; L.dir.copy(ld);
  if (frame++ % 6 === 0){ const g = GRADE.value, st = PAPER.map(p => `rgb(${toS(toLin(p[0]) * g.x)},${toS(toLin(p[1]) * g.y)},${toS(toLin(p[2]) * g.z)})`);
    document.body.style.background = `radial-gradient(75% 120% at 50% 50%,${st[0]} 0%,${st[0]} 40%,${st[1]} 64%,${st[2]} 77%,${st[3]} 100%)`;
    const lum = (g.x + g.y + g.z) / 3, dark = lum < 0.45; document.documentElement.style.setProperty('--ui', dark ? 'rgba(225,228,238,.55)' : 'rgba(60,62,50,.55)'); document.documentElement.style.setProperty('--ui2', dark ? 'rgba(225,228,238,.2)' : 'rgba(60,62,50,.18)');
    const hh = Math.floor(h), mm = Math.floor((h - hh) * 60); clk.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; knob.style.left = (h / 24 * 100) + '%'; }
}
const clk = document.getElementById('clk'), knob = document.getElementById('knob'), trk = document.getElementById('trk');
const setFromX = e => { const r = trk.getBoundingClientRect(); hour = Math.min(23.99, Math.max(0, (e.clientX - r.left) / r.width * 24)); dragT = 4; frame = 0; };
trk.addEventListener('pointerdown', e => { e.stopPropagation(); trk.setPointerCapture(e.pointerId); trk.dragging = true; setFromX(e); });
trk.addEventListener('pointermove', e => { if (trk.dragging) setFromX(e); });
trk.addEventListener('pointerup', () => { trk.dragging = false; });
document.getElementById('tod').addEventListener('pointerdown', e => e.stopPropagation());
S.HOOKS.push(dt => {
  if (!hold && !trk.dragging){ if (dragT > 0) dragT -= dt; else hour = (hour + dt * rate(hour)) % 24; }
  apply(hour);
});
S.setHour = h => { hour = h; hold = true; frame = 0; apply(h); };
apply(hour);
import('./wind.js').catch(e => console.warn('wind', e));
import('./flock.js').catch(e => console.warn('flock', e));
import('./camera.js').catch(e => console.warn('camera', e));
