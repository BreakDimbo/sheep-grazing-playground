// Plus edition: a flock. One wandering leader, the rest drift after it and keep together; lambs stay at their
// mothers' flanks; a tap on the grass startles the nearby sheep, which bolt, slow, then drift back; at dusk they lie down.
const S = window.__sheep, { THREE, Sheep } = S, L = S.light;
const rnd = (a, b) => a + (b - a) * Math.random();
const live = () => S.sheep.filter(s => !s.dying && s.reveal >= 1);
const P = Sheep.prototype, think0 = P.think, pick0 = P.pickGoal;
let leader = null, scare = null;
const centroid = () => { const a = live().filter(s => !s.lamb); let x = 0, z = 0; for (const s of a){ x += s.x; z += s.z; } return a.length ? [x / a.length, z / a.length] : [0, 0]; };
const restHour = h => h > 19.9 || h < 5.4;
function goalNear(s, x, z, r0, r1){ for (let k = 0; k < 14; k++){ const a = rnd(-Math.PI, Math.PI), r = rnd(r0, r1), gx = x + Math.cos(a) * r, gz = z + Math.sin(a) * r; if (S.walkable(gx, gz, 1.0)) return [gx, gz]; } return null; }
P.pickGoal = function(r0, r1){
  const hd = S.flock && S.flock.huddle; if (hd && !this.flee) return goalNear(this, hd.x, hd.z, 0.4, hd.r) || pick0.call(this, 0.5, 1);   // rain: keep tight together
  if (this === leader) return pick0.call(this, 4, 9);                       // the leader roams a little further
  const [cx, cz] = centroid(), lx = leader ? leader.x : cx, lz = leader ? leader.z : cz;
  const dC = Math.hypot(this.x - cx, this.z - cz), dL = Math.hypot(this.x - lx, this.z - lz);
  if (dL > 8 || dC > 6){ const tx = cx * 0.45 + lx * 0.55, tz = cz * 0.45 + lz * 0.55; return goalNear(this, tx, tz, 1.5, 3.5) || pick0.call(this, r0, r1); }
  const g = pick0.call(this, r0, r1); if (!g) return g;
  return Math.hypot(g[0] - cx, g[1] - cz) < 7 ? g : (goalNear(this, cx, cz, 1.5, 4) || g);
};
P.think = function(dt){
  if (this.lock || this.state === 'jump') return think0.call(this, dt);
  // resting: lie down at dusk, get up at dawn (staggered)
  if (restHour(L.h) && !this.flee){ if (this.state !== 'rest'){ this.restIn = this.restIn ?? rnd(0, 25); this.restIn -= dt;
      if (this.restIn < 0 && this.state !== 'walk'){ this.state = 'rest'; this.goal = null; } } if (this.state === 'rest') return; }
  else if (this.state === 'rest'){ this.restIn = this.restIn > -1 ? -1 : this.restIn; this.wake = (this.wake ?? rnd(0, 18)) - dt; if (this.wake > 0) return; this.state = 'idle'; this.t = rnd(2, 5); this.wake = undefined; this.restIn = undefined; }
  // fleeing: run until the goal, then slow down and look back
  if (this.flee){ this.flee -= dt; if (this.flee <= 0 || !this.goal){ this.flee = 0; this.pace = 1; this.state = 'idle'; this.t = rnd(2, 4); this.lookYaw = rnd(-0.9, 0.9); this.regroup = rnd(3, 6); } else return; }
  if (this.regroup){ this.regroup -= dt; if (this.regroup <= 0){ this.regroup = 0; const [cx, cz] = centroid(); const g = goalNear(this, cx, cz, 1.2, 3); if (g){ this.state = 'walk'; this.goal = g; this.pace = 0.8; return; } } }
  // rain: walk in to the huddle, then stand there (heads down, little grazing)
  const hd = S.flock && S.flock.huddle;
  if (hd && !this.lamb){ const d = Math.hypot(this.x - hd.x, this.z - hd.z);
    if (d > hd.r + 0.8 && this.state !== 'walk'){ const g = goalNear(this, hd.x, hd.z, 0.4, hd.r); if (g){ this.state = 'walk'; this.goal = g; this.pace = 0.95; return; } }
    if (d <= hd.r + 0.8 && this.state === 'graze' && Math.random() < dt * 0.3){ this.state = 'idle'; this.t = rnd(4, 9); } }
  // lambs: stay close to mother, trot to catch up
  if (this.lamb){ const m = this.mother; if (!m || m.dying){ this.lamb = false; } else {
      const d = Math.hypot(this.x - m.x, this.z - m.z);
      if (d > 2.2 && this.state !== 'walk'){ const side = this.side; const f = m.fwd(); const gx = m.x - f.x * 0.6 + f.z * side * 0.9, gz = m.z - f.z * 0.6 - f.x * side * 0.9; this.state = 'walk'; this.goal = [gx, gz]; this.pace = d > 4 ? 1.6 : 1.15; return; }
      if (this.state === 'walk' && this.goal){ const f = m.fwd(); this.goal = [m.x - f.x * 0.6 + f.z * this.side * 0.9, m.z - f.z * 0.6 - f.x * this.side * 0.9]; if (d < 1.3){ this.goal = null; this.state = m.state === 'graze' ? 'graze' : 'idle'; this.t = rnd(2, 6); this.pace = 1; } return; }
      if (this.t < 0){ this.state = m.state === 'walk' ? 'idle' : (Math.random() < 0.6 ? 'graze' : 'idle'); this.t = rnd(2, 5); this.lookYaw = rnd(-0.6, 0.6); } this.t -= dt; return; } }
  this.pace = 1; think0.call(this, dt);
};
function startle(p){
  for (const s of live()){ const dx = s.x - p.x, dz = s.z - p.z, d = Math.hypot(dx, dz); if (d > 6.5) continue;
    const a = Math.atan2(dz, dx) + rnd(-0.5, 0.5), r = rnd(4, 7) * (1.1 - d / 9); let g = null;
    for (let k = 0; k < 8 && !g; k++){ const aa = a + (k % 2 ? 1 : -1) * k * 0.25, gx = s.x + Math.cos(aa) * r, gz = s.z + Math.sin(aa) * r; if (S.walkable(gx, gz, 1.0)) g = [gx, gz]; }
    if (!g) continue; setTimeout(() => { if (s.state === 'rest'){ s.state = 'idle'; } s.state = 'walk'; s.goal = g; s.flee = 4; s.pace = s.lamb ? 2.6 : 2.2 * (1 - d / 14); s.regroup = 0; s.targetHeading = Math.atan2(-(g[1] - s.z), g[0] - s.x); if (S.sound) S.sound.bleat(s, 0.8); }, d * 70 + rnd(0, 160)); }
}
// a tap (no drag) on open grass startles
let dn = null;
S.canvas.addEventListener('pointerdown', e => { dn = { x: e.clientX, y: e.clientY, t: performance.now() }; });
S.canvas.addEventListener('pointerup', e => { if (!dn) return; const moved = Math.hypot(e.clientX - dn.x, e.clientY - dn.y), dur = performance.now() - dn.t; dn = null;
  if (moved > 6 || dur > 450 || e.button > 0) return; if (S.pickSheep(e.clientX, e.clientY)) return; const p = S.pickGround(e.clientX, e.clientY, 0.2); if (p) startle(p); });
// lambs beside three ewes
function addLambs(){ const ewes = live().filter(s => !s.lamb).sort((a, b) => a.z - b.z); const picks = [ewes[2], ewes[5], ewes[8]].filter(Boolean);
  picks.forEach((m, i) => { const side = i % 2 ? 1 : -1, f = m.fwd(); const x = m.x - f.x * 0.6 + f.z * side * 0.95, z = m.z - f.z * 0.6 - f.x * side * 0.95;
    const l = new Sheep(x, z, { size: 0.56, heading: m.heading + rnd(-0.3, 0.3), state: 'idle' }); l.lamb = true; l.mother = m; l.side = side; l.t = rnd(1, 3); }); }
addLambs(); leader = live().find(s => !s.lamb && s.x > -4 && s.x < 4) || live()[0];
// lying down: legs fold under (the painted body settles into the grass), head comes down slowly
S.HOOKS.push(dt => {
  for (const s of S.sheep){ const want = s.state === 'rest' ? 1 : 0; s.lie = (s.lie ?? 0) + (want - (s.lie ?? 0)) * Math.min(1, dt * 0.9); const k = s.lie;
    const u = s.spr.material.uniforms.uFade.value;
    if (k > 0.002){ const y0 = 0.035 + k * 0.17; u.set(-y0 / 0.03, 0, 1 / 0.03, 0); s.spr.position.y -= k * 0.17 * 1.0 * s.spr.material.uniforms.uSize.value.y / s.root.scale.x; s.body.position.y -= k * 0.28; }
    else u.set(1, 0, 0, 1); }
});
S.flock = { startle, get leader(){ return leader; } };
