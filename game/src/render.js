// ECHOWING — render. One job: draw everything (cave, bat, rings, HUD, screens).
// The cave is never 100% black: glowworms + fungi are a permanent dim light, and
// the pulse ring reveals walls/moths/owl at full brightness for ~2s.
import { CFG, DEPTHS, RELICS } from './config.js';
import { PLAYFIELD } from './world.js';

const PF = PLAYFIELD;

export function drawGame(ctx, g) {
  ctx.save();
  ctx.clearRect(0, 0, CFG.canvasW, CFG.canvasH);
  // Ground — v2: a LIT teal-blue grotto, not near-black. A soft radial wash
  // keeps the centre brightest; the cave reads as a place, not a void.
  const grad = ctx.createRadialGradient(
    CFG.canvasW / 2, CFG.canvasH / 2, 80,
    CFG.canvasW / 2, CFG.canvasH / 2, 900);
  grad.addColorStop(0, '#0e5a70');
  grad.addColorStop(0.6, CFG.col.ground);
  grad.addColorStop(1, CFG.col.groundDeep);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CFG.canvasW, CFG.canvasH);

  const t = g.time;
  const w = g.world;
  const bat = g.bat;

  // Screen shake.
  if (g.shakeT > 0) {
    const s = g.shakeMag * (g.shakeT / g.shakeDur);
    ctx.translate((Math.random() - 0.5) * 2 * s, (Math.random() - 0.5) * 2 * s);
  }

  drawCave(ctx, g, t);
  drawFungi(ctx, g, t);
  drawExit(ctx, g, t);
  drawMoths(ctx, g, t);
  drawOwl(ctx, g, t);
  drawBat(ctx, g, t);
  drawRings(ctx, g, t);
  drawFlash(ctx, g);
  drawParticles(ctx, g);
  drawShards(ctx, g);
  drawFloats(ctx, g);
  ctx.restore();

  // The HUD is a dashboard for play — the title/win/lose screens are payoffs,
  // calm and minimal, with only their own score block (spec §(c)).
  if (g.state === 'play' || g.state === 'pause' || g.state === 'relic') drawHUD(ctx, g);
  if (g.state === 'title') drawTitle(ctx, g, t);
  if (g.state === 'pause') drawPause(ctx, g);
  if (g.state === 'relic') drawRelicChoice(ctx, g);
  if (g.state === 'win') drawWin(ctx, g);
  if (g.state === 'lose') drawLose(ctx, g);
}

// How "revealed" a point is: v2 the grotto is LIT — the dim floor is 0.62,
// so walls/moths/owl read even between pulses; the pulse still lifts things
// to full brightness.
function revealAt(g, x, y) {
  const bat = g.bat;
  const dBat = Math.hypot(x - bat.x, y - bat.y);
  let r = 0.62; // bright floor — the cave is never dark in v2
  if (dBat < 95) r = Math.max(r, 0.95 - (dBat / 95) * 0.35);
  for (const ring of g.rings) {
    const d = Math.hypot(x - ring.x, y - ring.y);
    if (Math.abs(d - ring.r) < 90) r = Math.max(r, 0.95);
    if (d < ring.r && ring.age < CFG.pulseRevealSecs) {
      r = Math.max(r, 0.95 * (1 - ring.age / CFG.pulseRevealSecs) + 0.62);
    }
  }
  return Math.min(1, r);
}

// Deterministic wobble for the rock wall band (no RNG at draw time — the
// wall must look identical every frame).
function wallWobble(i) {
  const s = Math.sin(i * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

function drawCave(ctx, g, t) {
  const w = g.world;
  // v2: VISIBLE ROCK WALLS — jagged slabs around the whole playfield edge,
  // flat dark teal with a lit inner rim, so the cave has walls you can see.
  // (NOT radial-gradient circles: a light centre reads as bubbles.)
  const slab = (x, y, r, inner) => {
    const pts = [];
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + 0.3;
      const rr = r * (0.78 + 0.35 * wallWobble(Math.round(x + y + k * 17)));
      pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
    }
    ctx.fillStyle = '#0d4a5c';
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]);
    ctx.closePath();
    ctx.fill();
    // Lit rim on the inner (playfield-facing) side.
    ctx.strokeStyle = 'rgba(0, 220, 220, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.85, inner - 0.9, inner + 0.9);
    ctx.stroke();
    // A darker core so the slab reads as solid rock, not a lit disc.
    ctx.fillStyle = 'rgba(4, 26, 36, 0.55)';
    ctx.beginPath();
    ctx.arc(x, y, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  };
  for (let i = 0; i < 12; i++) {
    const fx = i / 11;
    const x = PF.x + fx * PF.w;
    const wob = wallWobble(i);
    slab(x, PF.y + 8 + wob * 14, 26 + wob * 16, Math.PI / 2);
    slab(x, PF.y + PF.h - 8 - wob * 14, 26 + wob * 16, -Math.PI / 2);
  }
  for (let i = 0; i < 8; i++) {
    const fy = i / 7;
    const y = PF.y + fy * PF.h;
    const wob = wallWobble(i + 40);
    slab(PF.x + 8 + wob * 14, y, 26 + wob * 16, 0);
    slab(PF.x + PF.w - 8 - wob * 14, y, 26 + wob * 16, Math.PI);
  }

  // Glowworm ceiling — permanent dim starfield, brighter in v2.
  for (const gl of w.glowworms) {
    const tw = 0.5 + 0.3 * Math.sin(t * 1.5 + gl.phase);
    ctx.fillStyle = `rgba(0, 220, 220, ${tw * w.light * w.fungiDim})`;
    ctx.beginPath();
    ctx.arc(gl.x, gl.y, gl.r * 1.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Stalactites — v2: jagged rock cones with a bright lit face, brighter
  // when revealed. Shattered ones leave only a broken stump.
  for (const s of w.stalactites) {
    if (s.shattered) {
      ctx.fillStyle = 'rgba(13, 74, 92, 0.9)';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0, 194, 199, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * 0.4, Math.PI * 0.9, Math.PI * 1.9);
      ctx.stroke();
      continue;
    }
    const rev = revealAt(g, s.x, s.y);
    ctx.fillStyle = `rgba(10, 58, 74, ${0.75 + 0.25 * rev})`;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y - s.r * 1.25);
    ctx.lineTo(s.x + s.r * 0.85, s.y + s.r * 0.7);
    ctx.lineTo(s.x - s.r * 0.85, s.y + s.r * 0.7);
    ctx.closePath();
    ctx.fill();
    // Lit face (left side catches the grotto light).
    ctx.fillStyle = `rgba(0, 194, 199, ${0.25 + 0.45 * rev})`;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y - s.r * 1.25);
    ctx.lineTo(s.x - s.r * 0.85, s.y + s.r * 0.7);
    ctx.lineTo(s.x - s.r * 0.2, s.y + s.r * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = `rgba(0, 220, 220, ${0.3 + 0.5 * rev})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y - s.r * 1.25);
    ctx.lineTo(s.x + s.r * 0.85, s.y + s.r * 0.7);
    ctx.stroke();
  }
}

function drawFungi(ctx, g, t) {
  const w = g.world;
  // The trail line itself, faint.
  ctx.strokeStyle = `rgba(0, 194, 199, ${0.14 * w.fungiDim})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(w.trail[0].x, w.trail[0].y);
  for (let i = 1; i < w.trail.length; i++) ctx.lineTo(w.trail[i].x, w.trail[i].y);
  ctx.stroke();
  // v2: LARGE blooms — a mushroom cap + stem with a BIG soft glow (radius
  // r*5), amber or cyan. These are the garden the playfield is built on:
  // at a glance the cave must read as glowing, not dotted.
  for (const f of w.fungi) {
    const pulse = 0.75 + 0.25 * Math.sin(t * 2 + f.phase);
    const a = (f.gold ? 0.9 : 0.8) * pulse * w.fungiDim * w.light + 0.1;
    const col = f.gold ? '247, 181, 0' : '0, 220, 220';
    const glow = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * 5);
    glow.addColorStop(0, `rgba(${col}, ${a})`);
    glow.addColorStop(0.5, `rgba(${col}, ${a * 0.35})`);
    glow.addColorStop(1, `rgba(${col}, 0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r * 5, 0, Math.PI * 2);
    ctx.fill();
    // Stem.
    ctx.fillStyle = `rgba(${col}, ${Math.min(1, a * 0.7)})`;
    ctx.fillRect(f.x - f.r * 0.22, f.y - f.r * 0.1, f.r * 0.44, f.r * 0.9);
    // Cap — a dome, brighter on top.
    ctx.fillStyle = `rgba(${col}, ${Math.min(1, a + 0.1)})`;
    ctx.beginPath();
    ctx.arc(f.x, f.y - f.r * 0.1, f.r, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    // Cap highlight.
    ctx.fillStyle = `rgba(255, 255, 255, ${0.35 * a})`;
    ctx.beginPath();
    ctx.arc(f.x - f.r * 0.3, f.y - f.r * 0.55, f.r * 0.28, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawExit(ctx, g, t) {
  const w = g.world;
  const e = w.exit;
  const open = w.exitOpen;
  const half = !!w.exitHalf; // posed: quota nearly met, the exit half-open
  // v2: a HUGE radiant gate — a tall golden doorway with light spilling out,
  // visible from anywhere in the depth. It is the one bright focal point.
  const glowR = open ? 150 + 14 * Math.sin(t * 3) : half ? 120 : 80;
  const col = open || half ? '247, 181, 0' : '120, 110, 60';
  const glow = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, glowR);
  glow.addColorStop(0, `rgba(${col}, ${open ? 0.95 : half ? 0.75 : 0.4})`);
  glow.addColorStop(0.45, `rgba(${col}, ${open ? 0.5 : half ? 0.35 : 0.18})`);
  glow.addColorStop(1, `rgba(${col}, 0)`);
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(e.x, e.y, glowR, 0, Math.PI * 2);
  ctx.fill();
  // Light spilling out across the floor (a bright pool in front of the gate).
  if (open || half) {
    const pool = ctx.createRadialGradient(e.x, e.y + 46, 0, e.x, e.y + 46, 90);
    pool.addColorStop(0, `rgba(255, 216, 115, ${open ? 0.5 : 0.35})`);
    pool.addColorStop(1, 'rgba(255, 216, 115, 0)');
    ctx.fillStyle = pool;
    ctx.beginPath();
    ctx.ellipse(e.x, e.y + 46, 90, 34, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // The golden doorway — a tall arch, ~90px high, ~64px wide.
  const W = 32;
  const H = 46;
  ctx.fillStyle = open ? CFG.col.gold : half ? '#8a6d1f' : '#3a3413';
  ctx.beginPath();
  ctx.moveTo(e.x - W, e.y + H);
  ctx.lineTo(e.x - W, e.y - H * 0.4);
  ctx.quadraticCurveTo(e.x, e.y - H * 1.5, e.x + W, e.y - H * 0.4);
  ctx.lineTo(e.x + W, e.y + H);
  ctx.closePath();
  ctx.fill();
  // Stone frame around the doorway.
  ctx.strokeStyle = 'rgba(0, 220, 220, 0.5)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(e.x - W - 6, e.y + H + 4);
  ctx.lineTo(e.x - W - 6, e.y - H * 0.4);
  ctx.quadraticCurveTo(e.x, e.y - H * 1.5 - 8, e.x + W + 6, e.y - H * 0.4);
  ctx.lineTo(e.x + W + 6, e.y + H + 4);
  ctx.stroke();
  if (half && !open) {
    // Half-open: a wide bright gold slit down the middle, no bars.
    ctx.fillStyle = 'rgba(255, 216, 115, 0.95)';
    ctx.fillRect(e.x - 7, e.y - H, 14, H * 2);
    ctx.fillStyle = 'rgba(255, 240, 190, 0.9)';
    ctx.fillRect(e.x - 3, e.y - H, 6, H * 2);
  } else if (!open) {
    // Bars across a shut exit.
    ctx.strokeStyle = '#8a6d1f';
    ctx.lineWidth = 4;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(e.x + i * 18, e.y - H * 0.9);
      ctx.lineTo(e.x + i * 18, e.y + H * 0.9);
      ctx.stroke();
    }
  } else {
    // Open: the doorway is solid light.
    ctx.fillStyle = 'rgba(255, 216, 115, 0.95)';
    ctx.beginPath();
    ctx.moveTo(e.x - W + 5, e.y + H - 4);
    ctx.lineTo(e.x - W + 5, e.y - H * 0.35);
    ctx.quadraticCurveTo(e.x, e.y - H * 1.3, e.x + W - 5, e.y - H * 0.35);
    ctx.lineTo(e.x + W - 5, e.y + H - 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 240, 0.9)';
    ctx.beginPath();
    ctx.moveTo(e.x - 12, e.y + H - 8);
    ctx.lineTo(e.x - 12, e.y - H * 0.3);
    ctx.quadraticCurveTo(e.x, e.y - H * 1.1, e.x + 12, e.y - H * 0.3);
    ctx.lineTo(e.x + 12, e.y + H - 8);
    ctx.closePath();
    ctx.fill();
  }
  // The blocker label — the exit shows WHY it is shut (above the tall gate).
  const dBat = Math.hypot(g.bat.x - e.x, g.bat.y - e.y);
  if (!open && dBat < 200) {
    const need = w.depth.quota - g.mothsEaten;
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(2, 24, 33, 0.9)';
    const label = `MOTHS ${g.mothsEaten}/${w.depth.quota} — eat ${need} more`;
    const tw = ctx.measureText(label).width + 18;
    ctx.fillRect(e.x - tw / 2, e.y - 96, tw, 24);
    ctx.strokeStyle = CFG.col.panelEdge;
    ctx.strokeRect(e.x - tw / 2, e.y - 96, tw, 24);
    ctx.fillStyle = CFG.col.paleGold;
    ctx.fillText(label, e.x, e.y - 79);
  }
}

function drawMoths(ctx, g, t) {
  const w = g.world;
  for (const m of w.moths) {
    if (m.eaten) continue;
    const rev = revealAt(g, m.x, m.y);
    const flap = Math.sin(m.wing) * 0.5;
    const a = 0.8 + 0.2 * rev;
    // v2: BIG golden orbs with visible wings — prey worth chasing, not dots.
    const r = m.prowler ? 14 : 11;
    // Glow.
    const glow = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, r * 3.5);
    glow.addColorStop(0, `rgba(247, 181, 0, ${0.65 * a})`);
    glow.addColorStop(0.5, `rgba(255, 216, 115, ${0.3 * a})`);
    glow.addColorStop(1, 'rgba(247, 181, 0, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(m.x, m.y, r * 3.5, 0, Math.PI * 2);
    ctx.fill();
    // Wings — large, pale gold, visibly flapping.
    ctx.fillStyle = `rgba(255, 216, 115, ${a})`;
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(flap * 0.4);
    ctx.beginPath();
    ctx.ellipse(-r * 0.85, 0, r * 0.95, r * (0.5 + flap * 0.25), -0.5, 0, Math.PI * 2);
    ctx.ellipse(r * 0.85, 0, r * 0.95, r * (0.5 + flap * 0.25), 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Body — a solid golden orb.
    ctx.fillStyle = `rgba(247, 181, 0, ${a})`;
    ctx.beginPath();
    ctx.arc(m.x, m.y, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255, 240, 190, ${a})`;
    ctx.beginPath();
    ctx.arc(m.x - r * 0.15, m.y - r * 0.15, r * 0.25, 0, Math.PI * 2);
    ctx.fill();
    if (m.stun > 0) {
      ctx.strokeStyle = `rgba(0, 220, 220, ${0.9 * a})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(m.x, m.y, r + 7, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function drawOwl(ctx, g, t) {
  const w = g.world;
  const o = w.owl;
  if (!o.active) return;
  // v2: DIVE TELEGRAPH — 0.5s before the dive, a dark shadow pools under the
  // dive point and a screech ring expands from it. The player can see the
  // attack coming and dodge.
  if (o.diveWarnT > 0 && o.diveTarget) {
    const p = 1 - o.diveWarnT / CFG.owlDiveWarnSecs; // 0 -> 1 as the dive nears
    ctx.fillStyle = `rgba(1, 9, 13, ${0.35 + 0.4 * p})`;
    ctx.beginPath();
    ctx.ellipse(o.diveTarget.x, o.diveTarget.y, 46 + p * 10, 30 + p * 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 80, 60, ${0.5 + 0.5 * p})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(o.diveTarget.x, o.diveTarget.y, 20 + p * 46, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff6b5e';
    ctx.fillText('! DIVE !', o.diveTarget.x, o.diveTarget.y - 46);
  }
  const rev = revealAt(g, o.x, o.y);
  const diving = o.diving > 0;
  const flap = Math.sin(o.wing) * (diving ? 0.9 : 0.35);
  const a = 0.65 + 0.35 * rev;
  // v2: KNOCKBACK recoil — while shoved back, draw a fading after-image
  // behind the owl so the hit reads as a physical shove, not a teleport.
  if (o.knockT > 0) {
    ctx.save();
    ctx.globalAlpha = 0.35 * (o.knockT / 0.35);
    ctx.translate(o.x - o.knockX * 0.12, o.y - o.knockY * 0.12);
    ctx.fillStyle = '#8a97a3';
    ctx.beginPath();
    ctx.ellipse(0, 0, o.r * 1.1, o.r * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.save();
  ctx.translate(o.x, o.y);
  const ang = Math.atan2(g.bat.y - o.y, g.bat.x - o.x);
  ctx.rotate(ang * 0.12);
  // v2: the owl is BIGGER (draw scale 1.3) — the antagonist must dominate
  // the frame next to the bat. Wings spread, dark body, pale eyes.
  const S = 1.3;
  ctx.scale(S, S);
  ctx.fillStyle = `rgba(8, 16, 22, ${0.95 * a})`;
  ctx.beginPath();
  ctx.ellipse(-o.r * 1.15, -flap * 8, o.r * 1.1, o.r * 0.42, -0.55, 0, Math.PI * 2);
  ctx.ellipse(o.r * 1.15, -flap * 8, o.r * 1.1, o.r * 0.42, 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, 0, o.r * 0.85, o.r * 0.62, 0, 0, Math.PI * 2);
  ctx.fill();
  // Pale eyes — always faintly visible, the threat marker.
  ctx.fillStyle = `rgba(255, 240, 200, ${0.65 + 0.35 * rev})`;
  ctx.beginPath();
  ctx.arc(-o.r * 0.3, -o.r * 0.2, 4.2, 0, Math.PI * 2);
  ctx.arc(o.r * 0.3, -o.r * 0.2, 4.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(0, 0, 0, ${0.85 * a})`;
  ctx.beginPath();
  ctx.arc(-o.r * 0.3, -o.r * 0.2, 1.8, 0, Math.PI * 2);
  ctx.arc(o.r * 0.3, -o.r * 0.2, 1.8, 0, Math.PI * 2);
  ctx.fill();
  // Beak.
  ctx.fillStyle = `rgba(247, 181, 0, ${0.9 * a})`;
  ctx.beginPath();
  ctx.moveTo(-4, o.r * 0.05);
  ctx.lineTo(4, o.r * 0.05);
  ctx.lineTo(0, o.r * 0.35);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  if (diving) {
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff6b5e';
    ctx.fillText('THE OWL DIVES!', o.x, o.y - o.r * 1.3 - 16);
  }
}

function drawBat(ctx, g, t) {
  const b = g.bat;
  const flap = Math.sin(t * 16) * (0.25 + Math.min(0.5, b.speed / 500));
  const inv = b.invulnT > 0 && Math.floor(t * 12) % 2 === 0;
  // v2: a BIG bright cyan rim-glow — the bat is the hero and must be
  // unmistakable even at contact-sheet size.
  // Builder 4: the v2 glow (alpha 0.45, r92) washed out against the bright
  // pulse-ring interior — at 768x480 the bat had no halo at all. Bigger,
  // hotter halo: the bat now carries its own light into the frame.
  const rim = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, 115);
  rim.addColorStop(0, 'rgba(0, 220, 220, 0.70)');
  rim.addColorStop(0.35, 'rgba(0, 210, 210, 0.38)');
  rim.addColorStop(0.7, 'rgba(0, 194, 199, 0.14)');
  rim.addColorStop(1, 'rgba(0, 194, 199, 0)');
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.arc(b.x, b.y, 115, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.bank);
  if (inv) ctx.globalAlpha = 0.35;
  const squash = 1 + b.squash * 0.12;
  ctx.scale(squash, 1 / squash);
  // v2: wings spread ~140px across (draw scale 1.4 on the v1 ~100px shape):
  // bigger than any moth by an order of magnitude, second only to the owl.
  // Each wing is a scalloped bat-wing path (wavy trailing edge), not an
  // ellipse — an ellipse reads as a manta ray at a glance.
  // Builder 4: wingspan 50 -> 58 units (~162px on screen) and a much thicker,
  // brighter rim stroke (1.5 -> 2.5, alpha 0.65 -> 0.9). At 768x480 the old
  // 1.5px stroke fell below a pixel and the scallops blurred into a smudge;
  // the outline is what survives the downscale, so it now carries the shape.
  ctx.scale(CFG.batDrawScale, CFG.batDrawScale);
  ctx.fillStyle = '#0a1820';
  ctx.strokeStyle = 'rgba(0, 235, 235, 0.9)';
  ctx.lineWidth = 2.5;
  const wing = (dir) => {
    ctx.beginPath();
    ctx.moveTo(dir * 10, -6);
    ctx.quadraticCurveTo(dir * 34, -26 - flap * 8, dir * 58, -12 - flap * 10);
    ctx.quadraticCurveTo(dir * 46, 2, dir * 38, 4);
    ctx.quadraticCurveTo(dir * 26, 10, dir * 20, 6);
    ctx.quadraticCurveTo(dir * 14, 8, dir * 10, 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };
  wing(-1);
  wing(1);
  // Body.
  ctx.fillStyle = '#0a161d';
  ctx.beginPath();
  ctx.ellipse(0, 0, 15, 11, 0, 0, Math.PI * 2);
  ctx.fill();
  // Ears.
  ctx.beginPath();
  ctx.moveTo(-8, -8); ctx.lineTo(-13, -20); ctx.lineTo(-3, -11);
  ctx.moveTo(8, -8); ctx.lineTo(13, -20); ctx.lineTo(3, -11);
  ctx.fill();
  ctx.restore();
  // GLOWING EYES — the player marker, always visible. v2: larger and
  // brighter — at contact-sheet size these are what says "bat" first.
  // Builder 4: the old 4px white cores were ~2.4px dots at 768x480 — invisible.
  // Cores 4 -> 6.5, glow radius 13 -> 20: two unmistakable cyan headlights.
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.bank);
  ctx.scale(CFG.batDrawScale, CFG.batDrawScale);
  const eyeGlow = ctx.createRadialGradient(-5.5, -3, 0, -5.5, -3, 20);
  eyeGlow.addColorStop(0, 'rgba(0, 255, 245, 0.95)');
  eyeGlow.addColorStop(1, 'rgba(0, 255, 245, 0)');
  ctx.fillStyle = eyeGlow;
  ctx.beginPath(); ctx.arc(-5.5, -3, 20, 0, Math.PI * 2); ctx.fill();
  const eyeGlow2 = ctx.createRadialGradient(5.5, -3, 0, 5.5, -3, 20);
  eyeGlow2.addColorStop(0, 'rgba(0, 255, 245, 0.95)');
  eyeGlow2.addColorStop(1, 'rgba(0, 255, 245, 0)');
  ctx.fillStyle = eyeGlow2;
  ctx.beginPath(); ctx.arc(5.5, -3, 20, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#eafffd';
  ctx.beginPath(); ctx.arc(-5.5, -3, 6.5, 0, Math.PI * 2); ctx.arc(5.5, -3, 6.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // Roost indicator.
  if (g.roostT > 0.05) {
    ctx.strokeStyle = CFG.col.cyan;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 30, -Math.PI / 2, -Math.PI / 2 + (g.roostT / 1) * Math.PI * 2);
    ctx.stroke();
  }
}

function drawRings(ctx, g, t) {
  for (const ring of g.rings) {
    const p = ring.age / CFG.pulseRingSecs;
    if (p >= 1) continue;
    const r = ring.maxR * (1 - Math.pow(1 - p, 3));
    const a = 0.9 * (1 - p);
    // v2: the pulse is a WEAPON — a thick white-cyan shockwave, three strokes
    // (wide faint cyan, mid white-cyan, hot white core), the brightest thing
    // in the frame for its 0.3s.
    ctx.strokeStyle = `rgba(0, 194, 199, ${a * 0.35})`;
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(120, 240, 245, ${a * 0.8})`;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255, 255, 255, ${a})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, r, 0, Math.PI * 2);
    ctx.stroke();
    // A faint filled disc inside the front, so the blast reads as a wave,
    // not a thin outline.
    ctx.fillStyle = `rgba(0, 220, 220, ${a * 0.07})`;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// v2: the radial flash at the bat when the pulse fires — a white-cyan burst
// that is the brightest thing in the frame for ~0.3s.
function drawFlash(ctx, g) {
  if (!g.flash || g.flash <= 0) return;
  const f = g.flash; // 1 -> 0
  const radius = CFG.pulseRadius * 1.5;
  const grad = ctx.createRadialGradient(g.bat.x, g.bat.y, 0, g.bat.x, g.bat.y, radius);
  grad.addColorStop(0, `rgba(255, 255, 255, ${0.55 * f})`);
  grad.addColorStop(0.35, `rgba(120, 240, 245, ${0.35 * f})`);
  grad.addColorStop(1, 'rgba(0, 220, 220, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(g.bat.x, g.bat.y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawParticles(ctx, g) {
  for (const p of g.particles) {
    ctx.fillStyle = `rgba(${p.col || '247, 181, 0'}, ${Math.max(0, p.life / p.max)})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// v2: stalactite shards — rock triangles flung by the shatter, spinning and
// fading. Drawn from g.shards (main.js spawns them on events.shattered).
function drawShards(ctx, g) {
  for (const s of (g.shards || [])) {
    const a = Math.max(0, s.life / s.max);
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.rot);
    // Bright rock — pale teal with a hot cyan rim, so shards read as fresh
    // breaks, not as more stalactites.
    ctx.fillStyle = `rgba(90, 190, 205, ${a})`;
    ctx.strokeStyle = `rgba(160, 245, 250, ${a * 0.9})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -s.r);
    ctx.lineTo(s.r * 0.8, s.r * 0.7);
    ctx.lineTo(-s.r * 0.8, s.r * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

function drawFloats(ctx, g) {
  ctx.textAlign = 'center';
  for (const f of g.floats) {
    const p = 1 - f.life / f.max;
    // v2: bigger numbers (big 26px, normal 18px) with a dark outline so
    // they read over the bright cave.
    ctx.font = `bold ${f.big ? 26 : 18}px system-ui, sans-serif`;
    ctx.globalAlpha = Math.max(0, 1 - p * p);
    ctx.fillStyle = 'rgba(1, 9, 13, 0.85)';
    ctx.fillText(f.text, f.x + 1.5, f.y - p * CFG.floatRisePx + 1.5);
    ctx.fillStyle = f.col;
    ctx.fillText(f.text, f.x, f.y - p * CFG.floatRisePx);
    ctx.globalAlpha = 1;
  }
}

// --- HUD: dense but organised, centre kept clear ---
function panel(ctx, x, y, w, h) {
  ctx.fillStyle = CFG.col.panel;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = CFG.col.panelEdge;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

function drawHUD(ctx, g) {
  const w = g.world;
  const topY = 0;
  // Top bar.
  panel(ctx, 0, topY, CFG.canvasW, CFG.topBarH);
  // WIN / LOSE chips — plain words, criterion 1 at a glance.
  chip(ctx, 12, 10, 'WIN: reach the exit', CFG.col.winGreen);
  chip(ctx, 12, 29, 'LOSE: 3 lives lost', CFG.col.loseRed);
  // Campaign counter + score, centred.
  ctx.textAlign = 'center';
  ctx.fillStyle = CFG.col.paleGold;
  ctx.font = 'bold 19px system-ui, sans-serif';
  ctx.fillText(`DEPTH ${w.depthN}/5 — ${w.depth.name.toUpperCase()}`, CFG.canvasW / 2, 21);
  ctx.fillStyle = CFG.col.text;
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillText(`SCORE ${g.score.toLocaleString()}    BEST ${g.best.toLocaleString()}`, CFG.canvasW / 2, 41);
  // Resource counters top-right.
  ctx.textAlign = 'right';
  ctx.fillStyle = CFG.col.gold;
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillText(`MOTHS ${g.mothsEaten}/${w.depth.quota}`, CFG.canvasW - 14, 21);
  const charges = '●'.repeat(g.charges) + '○'.repeat(Math.max(0, 3 - g.charges));
  ctx.fillStyle = CFG.col.cyan;
  ctx.fillText(`ECHO ${charges}`, CFG.canvasW - 14, 41);
  if (g.chain > 1) {
    ctx.fillStyle = CFG.col.paleGold;
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText(`CHAIN x${g.chain}`, CFG.canvasW - 170, 41);
  }

  // Left panel — INCOMING.
  panel(ctx, 0, CFG.topBarH, CFG.leftPanelW, CFG.canvasH - CFG.topBarH - CFG.bottomBarH);
  ctx.textAlign = 'left';
  ctx.fillStyle = CFG.col.paleGold;
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText('INCOMING', 12, CFG.topBarH + 22);
  ctx.fillStyle = CFG.col.text;
  ctx.font = '13px system-ui, sans-serif';
  w.depth.incoming.forEach((line, i) => {
    ctx.fillText(line, 12, CFG.topBarH + 48 + i * 22);
  });
  ctx.font = '12px system-ui, sans-serif';
  // "Moths left" means moths still to eat for this depth's quota (quota -
  // eaten), not moths alive in the cave: the top bar reads MOTHS eaten/quota,
  // so the two must agree (8/10 eaten means 2 left, never 10). Moths beyond
  // the quota exist in live play too (depth 3 spawns 10 moths, quota 8), so a
  // visible swarm does not contradict the count. Once the exit is open the
  // goal has changed, so say that instead of a count that could go negative.
  const leftY = CFG.topBarH + 48 + w.depth.incoming.length * 22 + 14;
  if (w.exitOpen) {
    ctx.fillStyle = CFG.col.gold;
    ctx.fillText('Exit open!', 12, leftY);
  } else {
    ctx.fillStyle = CFG.col.dimText;
    ctx.fillText(`Moths left: ${Math.max(0, w.depth.quota - g.mothsEaten)}`, 12, leftY);
  }
  ctx.fillStyle = CFG.col.dimText;
  ctx.fillText(`Lives: ${'♥'.repeat(g.lives)}${'♡'.repeat(Math.max(0, g.maxLives - g.lives))}`, 12, CFG.topBarH + 48 + w.depth.incoming.length * 22 + 36);

  // Right panel — RELICS.
  panel(ctx, CFG.canvasW - CFG.rightPanelW, CFG.topBarH, CFG.rightPanelW, CFG.canvasH - CFG.topBarH - CFG.bottomBarH);
  ctx.fillStyle = CFG.col.paleGold;
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText('RELICS', CFG.canvasW - CFG.rightPanelW + 12, CFG.topBarH + 22);
  ctx.fillStyle = CFG.col.text;
  ctx.font = '13px system-ui, sans-serif';
  if (g.relics.length === 0) {
    ctx.fillStyle = CFG.col.dimText;
    ctx.fillText('— none yet —', CFG.canvasW - CFG.rightPanelW + 12, CFG.topBarH + 48);
    ctx.fillText('Clear a depth', CFG.canvasW - CFG.rightPanelW + 12, CFG.topBarH + 68);
    ctx.fillText('to choose one.', CFG.canvasW - CFG.rightPanelW + 12, CFG.topBarH + 86);
  } else {
    // Grouped with counts — a relic picked twice shows as ×2.
    const counts = {};
    for (const r of g.relics) counts[r.id] = (counts[r.id] || 0) + 1;
    Object.entries(counts).forEach(([id, n], i) => {
      const r = g.relics.find((x) => x.id === id);
      ctx.fillStyle = CFG.col.gold;
      ctx.fillText('◆ ' + r.name + (n > 1 ? ` ×${n}` : ''), CFG.canvasW - CFG.rightPanelW + 12, CFG.topBarH + 48 + i * 22);
    });
  }

  // Boss bar — a HUNT METER, shown when the owl is active.
  const owl = w.owl;
  if (owl.active && g.state !== 'title') {
    const bx = PF.x + 60;
    const bw = PF.w - 120;
    const by = PF.y + 10;
    ctx.textAlign = 'center';
    ctx.fillStyle = CFG.col.paleGold;
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText('THE OWL — HUNTER OF THE DEEP', PF.x + PF.w / 2, by + 11);
    ctx.fillStyle = 'rgba(2, 24, 33, 0.9)';
    ctx.fillRect(bx, by + 16, bw, 12);
    ctx.strokeStyle = CFG.col.panelEdge;
    ctx.strokeRect(bx + 0.5, by + 16.5, bw - 1, 11);
    // The bar FILLS as the owl closes in (threat), drains when driven back.
    const fill = owl.hunt;
    ctx.fillStyle = fill > 0.66 ? '#e5484d' : fill > 0.33 ? CFG.col.gold : CFG.col.cyan;
    ctx.fillRect(bx + 2, by + 18, Math.max(0, (bw - 4) * fill), 8);
    ctx.fillStyle = CFG.col.dimText;
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillText(`PHASE ${Math.min(3, w.depthN - 1)}/3`, PF.x + PF.w / 2, by + 42);
  }

  // Bottom ability toolbar.
  panel(ctx, 0, CFG.canvasH - CFG.bottomBarH, CFG.canvasW, CFG.bottomBarH);
  const slots = [
    { key: 'SPACE', name: 'PULSE', cd: g.pulseCd, cdMax: g.pulseCdMax, note: `${g.charges} charges` },
    { key: 'SHIFT', name: 'FLUTTER', cd: g.flutterCd, cdMax: CFG.flutterCooldownSecs, note: 'speed burst' },
    { key: 'Q', name: 'ROOST', cd: 0, cdMax: 1, note: 'hold 1s: +1 charge' },
    { key: 'R', name: 'RESTART', cd: 0, cdMax: 1, note: 'always' },
  ];
  const slotW = 200;
  const totalW = slots.length * slotW;
  let sx = (CFG.canvasW - totalW) / 2;
  for (const s of slots) {
    const cx = sx + 14;
    const cy = CFG.canvasH - CFG.bottomBarH + 8;
    // Square keycap.
    ctx.fillStyle = '#0b2b38';
    ctx.fillRect(cx, cy, 34, 30);
    ctx.strokeStyle = CFG.col.panelEdge;
    ctx.strokeRect(cx + 0.5, cy + 0.5, 33, 29);
    ctx.fillStyle = CFG.col.text;
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(s.key, cx + 17, cy + 19);
    ctx.textAlign = 'left';
    ctx.fillStyle = CFG.col.paleGold;
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText(s.name, cx + 44, cy + 16);
    ctx.fillStyle = CFG.col.dimText;
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillText(s.note, cx + 44, cy + 32);
    // Radial cooldown sweep.
    if (s.cd > 0) {
      ctx.fillStyle = 'rgba(2, 24, 33, 0.72)';
      ctx.beginPath();
      ctx.moveTo(cx + 17, cy + 15);
      ctx.arc(cx + 17, cy + 15, 20, -Math.PI / 2, -Math.PI / 2 + (s.cd / s.cdMax) * Math.PI * 2);
      ctx.closePath();
      ctx.fill();
    }
    sx += slotW;
  }
}

function chip(ctx, x, y, text, col) {
  ctx.font = 'bold 11px system-ui, sans-serif';
  const tw = ctx.measureText(text).width + 14;
  ctx.fillStyle = 'rgba(2, 24, 33, 0.9)';
  ctx.fillRect(x, y, tw, 16);
  ctx.fillStyle = col;
  ctx.fillRect(x, y, 4, 16);
  ctx.fillStyle = '#e8f4f2';
  ctx.textAlign = 'left';
  ctx.fillText(text, x + 9, y + 12);
}

// --- Screens ---
function drawTitle(ctx, g, t) {
  // v2: a lighter veil (0.45) so the BRIGHT grotto shows through — the title
  // is calm, but the cave behind it is alive, not black.
  ctx.fillStyle = 'rgba(1, 9, 13, 0.45)';
  ctx.fillRect(0, 0, CFG.canvasW, CFG.canvasH);
  // One focal light: a single echo ring around the bat.
  const bx = CFG.canvasW / 2;
  const by = CFG.canvasH / 2 - 40;
  ctx.strokeStyle = 'rgba(0, 220, 220, 0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(bx, by, 60 + 8 * Math.sin(t * 1.2), 0, Math.PI * 2);
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = CFG.col.gold;
  ctx.font = 'bold 84px "Arial Narrow", system-ui, sans-serif';
  ctx.fillText('ECHOWING', bx, 300);
  ctx.fillStyle = CFG.col.dimText;
  ctx.font = 'italic 20px system-ui, sans-serif';
  ctx.fillText("a bat's flight through the dark", bx, 336);
  ctx.fillStyle = CFG.col.text;
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText('press ENTER', bx, 430);
  ctx.fillStyle = CFG.col.dimText;
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText('Arrows / WASD steer   •   SPACE pulse   •   SHIFT flutter   •   Q roost', bx, 470);
  ctx.fillText('Eat the moths to open the exit. The pulse reveals — and the owl hears it.', bx, 496);
}

function drawPause(ctx, g) {
  ctx.fillStyle = 'rgba(1, 9, 13, 0.6)';
  ctx.fillRect(0, 0, CFG.canvasW, CFG.canvasH);
  ctx.textAlign = 'center';
  ctx.fillStyle = CFG.col.text;
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.fillText('PAUSED', CFG.canvasW / 2, CFG.canvasH / 2);
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('press P to continue', CFG.canvasW / 2, CFG.canvasH / 2 + 36);
}

function drawRelicChoice(ctx, g) {
  ctx.fillStyle = 'rgba(1, 9, 13, 0.78)';
  ctx.fillRect(0, 0, CFG.canvasW, CFG.canvasH);
  ctx.textAlign = 'center';
  ctx.fillStyle = CFG.col.gold;
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.fillText(`DEPTH ${g.world.depthN} CLEARED  •  +${CFG.depthBonus} BONUS`, CFG.canvasW / 2, 120);
  ctx.fillStyle = CFG.col.text;
  ctx.font = '20px system-ui, sans-serif';
  ctx.fillText('Choose one relic — every gift has a cost.', CFG.canvasW / 2, 158);
  const cw = 330;
  const ch = 240;
  const gap = 26;
  const total = RELICS.length * cw + (RELICS.length - 1) * gap;
  let x = (CFG.canvasW - total) / 2;
  const y = 210;
  RELICS.forEach((r, i) => {
    panel(ctx, x, y, cw, ch);
    ctx.fillStyle = CFG.col.gold;
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText(`[${r.key}]  ${r.name}`, x + cw / 2, y + 40);
    ctx.fillStyle = CFG.col.winGreen;
    ctx.font = '15px system-ui, sans-serif';
    wrapText(ctx, '✓ ' + r.benefit, x + 18, y + 78, cw - 36, 20);
    ctx.fillStyle = CFG.col.loseRed;
    wrapText(ctx, '✗ ' + r.cost, x + 18, y + 150, cw - 36, 20);
    x += cw + gap;
  });
  ctx.fillStyle = CFG.col.dimText;
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('Press 1, 2 or 3 — or click a card.', CFG.canvasW / 2, y + ch + 44);
}

function wrapText(ctx, text, x, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  ctx.textAlign = 'left';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineH;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, yy);
  ctx.textAlign = 'center';
}

function drawWin(ctx, g) {
  ctx.fillStyle = 'rgba(1, 9, 13, 0.42)';
  ctx.fillRect(0, 0, CFG.canvasW, CFG.canvasH);
  ctx.textAlign = 'center';
  ctx.fillStyle = CFG.col.gold;
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.fillText('DEPTH 5 CLEARED — YOU REACHED THE LIGHT', CFG.canvasW / 2, 180);
  ctx.fillStyle = CFG.col.text;
  ctx.font = '22px system-ui, sans-serif';
  ctx.fillText(`SCORE ${g.score.toLocaleString()}    •    MOTHS ${g.mothsTotal}    •    BEST ${g.best.toLocaleString()}`, CFG.canvasW / 2, 240);
  ctx.fillText(`DEPTH 5/5    •    TIME ${g.winTime}`, CFG.canvasW / 2, 276);
  if (g.relics.length) {
    const counts = {};
    for (const r of g.relics) counts[r.id] = (counts[r.id] || 0) + 1;
    const list = Object.entries(counts).map(([id, n]) => {
      const r = g.relics.find((x) => x.id === id);
      return r.name + (n > 1 ? ` ×${n}` : '');
    }).join('  •  ');
    ctx.fillStyle = CFG.col.dimText;
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText('Relics: ' + list, CFG.canvasW / 2, 316);
  }
  ctx.fillStyle = CFG.col.paleGold;
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText('press R to play again', CFG.canvasW / 2, 380);
}

function drawLose(ctx, g) {
  ctx.fillStyle = 'rgba(1, 9, 13, 0.5)';
  ctx.fillRect(0, 0, CFG.canvasW, CFG.canvasH);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff6b5e';
  ctx.font = 'bold 48px system-ui, sans-serif';
  ctx.fillText(g.loseCause === 'owl' ? 'THE OWL FOUND YOU' : 'THE DARK TOOK YOU', CFG.canvasW / 2, 180);
  ctx.fillStyle = CFG.col.text;
  ctx.font = '22px system-ui, sans-serif';
  ctx.fillText(`SCORE ${g.score.toLocaleString()}    •    MOTHS ${g.mothsTotal}    •    DEPTH ${g.world.depthN}/5    •    BEST ${g.best.toLocaleString()}`, CFG.canvasW / 2, 240);
  ctx.fillStyle = CFG.col.paleGold;
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText('press R to try again', CFG.canvasW / 2, 300);
}
