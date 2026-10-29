// Plus edition: sound, muted until you turn it on. Recorded sheep, lamb, skylark and field crickets (Wikimedia Commons,
// public domain / CC0 / CC BY-SA, see docs/sound.md); wind and pencil-on-paper are generated noise shaped by the scene:
// the wind follows the gust field that ripples the grass, the scratch follows your drawing speed.
const S = window.__sheep, L = S.light;
const btn = document.getElementById('snd');
const FILES = { b1: 'bleat1', b2: 'bleat2', b3: 'bleat3', b4: 'bleat4', b5: 'bleat5', b6: 'bleat6', lamb: 'lamb1', lark: 'lark', cr: 'crickets', rain: 'rain' };
let ctx = null, master, buf = {}, on = false, ready = false;
const rnd = (a, b) => a + (b - a) * Math.random(), ss = (x, a, b) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function noiseBuf(sec, kind){ const n = ctx.sampleRate * sec | 0, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, g = 0, gl = 0;
  for (let i = 0; i < n; i++){ const w = Math.random() * 2 - 1;
    if (kind === 'pink'){ b0 = .99765 * b0 + w * .099046; b1 = .963 * b1 + w * .2965164; b2 = .57 * b2 + w * 1.0526913; d[i] = (b0 + b1 + b2 + w * .1848) * .18; }
    else { if (gl <= 0){ g = Math.random() < .35 ? rnd(.5, 1) : rnd(0, .25); gl = rnd(.004, .03) * ctx.sampleRate; } gl--; d[i] = w * g; }   // grainy: paper tooth under a pencil
  }
  const f = Math.min(n >> 3, ctx.sampleRate * .2 | 0);    // seamless loop
  for (let i = 0; i < f; i++){ const t = i / f; d[i] = d[i] * Math.sin(t * Math.PI / 2) + d[n - f + i] * Math.cos(t * Math.PI / 2); }
  const o = ctx.createBuffer(1, n - f, ctx.sampleRate); o.copyToChannel(d.subarray(0, n - f), 0); return o; }
function loopFix(b, c = .4){ const sr = b.sampleRate, C = c * sr | 0, skip = .03 * sr | 0, n = b.length - skip, o = ctx.createBuffer(b.numberOfChannels, n - C, sr);
  for (let ch = 0; ch < b.numberOfChannels; ch++){ const d = b.getChannelData(ch).slice(skip), od = o.getChannelData(ch);
    for (let i = 0; i < n - C; i++) od[i] = d[i];
    for (let i = 0; i < C; i++){ const t = i / C; od[i] = d[i] * Math.sin(t * Math.PI / 2) + d[n - C + i] * Math.cos(t * Math.PI / 2); } } return o; }
function src(b, loop){ const s = ctx.createBufferSource(); s.buffer = b; s.loop = !!loop; return s; }
const gainN = v => { const g = ctx.createGain(); g.gain.value = v; return g; };
const panN = p => { const n = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain(); if (n.pan) n.pan.value = p; return n; };
const filt = (type, f, q) => { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q ?? .7; return n; };
let wind = [], rustle, cricket = [], rainG = null, rainLP = null, nextBleat = 8, nextLark = 4;
async function init(){
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3;
  master = gainN(0); master.connect(comp); comp.connect(ctx.destination);
  // wind: two pink-noise beds (left / right of the board) through a low-pass whose cutoff and level follow the gusts
  const pink = noiseBuf(7, 'pink');
  for (const side of [-1, 1]){ const s = src(pink, true), lp = filt('lowpass', 500, .5), bp = filt('bandpass', 900, .6), g = gainN(0), gb = gainN(0), p = panN(side * .6);
    s.connect(lp); lp.connect(g); s.connect(bp); bp.connect(gb); g.connect(p); gb.connect(p); p.connect(master); s.start(0, side > 0 ? 3.1 : 0); s.playbackRate.value = side > 0 ? 1.03 : .97;
    wind.push({ lp, g, gb, side, v: 0 }); }
  // pencil on paper
  { const s = src(noiseBuf(3, 'grain'), true), bp = filt('bandpass', 3000, .8), hs = filt('lowpass', 7500, .5), g = gainN(0); s.connect(bp); bp.connect(hs); hs.connect(g); g.connect(master); s.start(); rustle = { g, bp, v: 0 }; }
  await Promise.all(Object.entries(FILES).map(([k, f]) => fetch(`plus/snd/${f}.mp3`).then(r => r.arrayBuffer()).then(a => new Promise((ok, no) => ctx.decodeAudioData(a, ok, no))).then(b => { buf[k] = b; })));
  // crickets: two copies of the field, detuned and spread, so it reads as a meadow full of them rather than one insect
  const cb = loopFix(buf.cr);
  for (const [p, r, o] of [[-.55, .985, 0], [.55, 1.035, 4.3]]){ const s = src(cb, true), g = gainN(0), pn = panN(p); s.playbackRate.value = r; s.connect(g); g.connect(pn); pn.connect(master); s.start(0, o); cricket.push(g); }
  // rain: a recorded shower on leaves and grass, its level and brightness following the rain intensity
  { const s = src(loopFix(buf.rain, .8), true); rainLP = filt('lowpass', 2500, .5); rainG = gainN(0); s.connect(rainLP); rainLP.connect(rainG); rainG.connect(master); s.start(); }
  ready = true;
}
const v3 = new S.THREE.Vector3();
function panOf(x, z){ v3.set(x, 0, z).project(S.cam2 || S.camera); return Math.max(-.85, Math.min(.85, v3.x * .8)); }
function play(b, { gain = .5, pan = 0, rate = 1, at = 0, offset = 0, dur, fade = 0 } = {}){
  const s = src(b), g = gainN(0), p = panN(pan), t = ctx.currentTime + at; s.playbackRate.value = rate; s.connect(g); g.connect(p); p.connect(master);
  if (fade){ g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + fade); g.gain.setValueAtTime(gain, t + dur - fade); g.gain.linearRampToValueAtTime(0, t + dur); s.start(t, offset, dur); }
  else { g.gain.value = gain; s.start(t, offset); }
}
const BLEATS = ['b1', 'b2', 'b3', 'b4', 'b5', 'b6'];
function bleat(s, k = .5){ if (!ready || !on || !s) return;
  const near = 1 / (1 + Math.hypot(s.x - S.controls.target.x, s.z - S.controls.target.z) / 25);
  if (s.lamb){ play(buf.lamb, { gain: .32 * k * near, pan: panOf(s.x, s.z), rate: rnd(1, 1.12) });
    if (s.mother && Math.random() < .7) play(buf[BLEATS[Math.random() * 6 | 0]], { gain: .36 * k * near, pan: panOf(s.mother.x, s.mother.z), rate: rnd(.9, 1), at: rnd(.7, 1.4) }); }   // mother answers
  else play(buf[BLEATS[Math.random() * 6 | 0]], { gain: .42 * k * near, pan: panOf(s.x, s.z), rate: rnd(.9, 1.07) });
}
let an = null;
S.sound = { bleat, state: () => ({ ready, on, ctx: ctx && ctx.state, bufs: Object.keys(buf).length }),
  level(){ if (!ready) return -1; if (!an){ an = ctx.createAnalyser(); an.fftSize = 2048; master.connect(an); } const d = new Float32Array(an.fftSize); an.getFloatTimeDomainData(d); let e = 0; for (const v of d) e += v * v; return Math.sqrt(e / d.length); } };
// drawing speed -> pencil scratch
let px = null, sp = 0, down = false;
S.canvas.addEventListener('pointerdown', e => { down = true; px = [e.clientX, e.clientY, performance.now()]; });
addEventListener('pointerup', () => { down = false; }); addEventListener('pointercancel', () => { down = false; });
S.canvas.addEventListener('pointermove', e => { if (!down || !px) return; const now = performance.now(), dt = Math.max(8, now - px[2]);
  const drawing = (document.getElementById('stroke')?.getAttribute('d') || '').length > 0;
  sp = drawing ? Math.hypot(e.clientX - px[0], e.clientY - px[1]) / dt * 1000 : 0; px = [e.clientX, e.clientY, now]; });
let tt = 0;
S.HOOKS.push(dt => {
  if (!ready) return; tt += dt; const now = ctx.currentTime, T = S.controls.target;
  // wind
  if (S.wind){ for (const w of wind){ let g = 0; for (let i = 0; i < 3; i++) g += S.wind.gustAt(T.x + w.side * 8, T.z + (i - 1) * 7, S.wind.t) / 3;
      w.v += (g - w.v) * Math.min(1, dt * 1.5); const night = L.night || 0, k = .55 + .45 * (1 - night);
      w.g.gain.setTargetAtTime((.10 + .30 * w.v) * k, now, .25); w.gb.gain.setTargetAtTime(.10 * w.v * w.v * k, now, .25); w.lp.frequency.setTargetAtTime(320 + 900 * w.v, now, .3); } }
  // pencil
  rustle.v += (Math.min(1, sp / 1400) - rustle.v) * Math.min(1, dt * 12); if (!down) sp *= .5;
  rustle.g.gain.setTargetAtTime(.32 * rustle.v, now, .03); rustle.bp.frequency.setTargetAtTime(2400 + 1800 * rustle.v, now, .05);
  const rk = S.rain ? S.rain.k : 0;
  rainG.gain.setTargetAtTime(.4 * rk, now, .6); rainLP.frequency.setTargetAtTime(1800 + 7000 * rk, now, .6);
  // crickets at night, larks by day (both hush in the rain)
  const night = L.night || 0, day = Math.min(1, L.sunK * 1.6) * (1 - rk);
  for (const g of cricket) g.gain.setTargetAtTime(.22 * ss(night, .25, .8) * (1 - rk), now, .8);
  if ((nextLark -= dt) < 0){ nextLark = rnd(14, 40); if (day > .2){ const d = rnd(6, 13); play(buf.lark, { gain: .16 * day, pan: rnd(-.7, .7), offset: rnd(0, buf.lark.duration - d - .1), dur: d, fade: 1.2 }); } }
  if ((nextBleat -= dt) < 0){ nextBleat = rnd(10, 32) * (night > .6 ? 3 : 1) * (rk > .3 ? 1.8 : 1); const a = S.sheep.filter(s => !s.dying && s.state !== 'rest'); if (a.length) bleat(a[Math.random() * a.length | 0], rnd(.5, .9)); }
});
async function toggle(){
  on = !on; btn.classList.toggle('on', on); btn.setAttribute('aria-pressed', on);
  if (on && !ctx){ try { await init(); } catch (e){ console.warn('sound', e); } }
  if (!ctx) return; if (ctx.state === 'suspended') await ctx.resume();
  master.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, .25);
}
btn.title = 'Sound (recordings: Wikimedia Commons, see docs/sound.md)';
btn.addEventListener('click', e => { e.stopPropagation(); toggle(); });
document.addEventListener('visibilitychange', () => { if (!ctx) return; if (document.hidden) ctx.suspend(); else if (on) ctx.resume(); });
