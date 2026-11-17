// ECHOWING — render. One job: draw everything (cave, bat, rings, HUD, screens).
// The cave is never 100% black: glowworms + fungi are a permanent dim light, and
// the pulse ring reveals walls/moths/owl at full brightness for ~2s.
import { CFG, DEPTHS, RELICS } from './config.js';
import { PLAYFIELD } from './world.js';

const PF = PLAYFIELD;

export function drawGame(ctx, g) {
  ctx.save();
  ctx.clearRect(0, 0, CFG.canvasW, CFG.canvasH);
  // Ground.
  const grad = ctx.createLinearGradient(0, 0, 0, CFG.canvasH);
  grad.addColorStop(0, CFG.col.groundDeep);
  grad.addColorStop(1, CFG.col.ground);
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
  drawParticles(ctx, g);
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

// How "revealed" a point is: 1 near the bat's permanent light or inside a
// fresh pulse ring, falling to the dim floor further away.
function revealAt(g, x, y) {
  const bat = g.bat;
  const dBat = Math.hypot(x - bat.x, y - bat.y);
  let r = 0.34; // dim floor — the cave is never 100% black
  if (dBat < 95) r = Math.max(r, 0.95 - (dBat / 95) * 0.35);
  for (const ring of g.rings) {
    const d = Math.hypot(x - ring.x, y - ring.y);
    if (Math.abs(d - ring.r) < 90) r = Math.max(r, 0.95);
    if (d < ring.r && ring.age < CFG.pulseRevealSecs) {
      r = Math.max(r, 0.95 * (1 - ring.age / CFG.pulseRevealSecs) + 0.34);
    }
  }
  return Math.min(1, r);
}

function drawCave(ctx, g, t) {
  const w = g.world;
  // Playfield border — the cave wall.
  ctx.strokeStyle = `rgba(0, 194, 199, ${0.25 + 0.1 * Math.sin(t * 0.8)})`;
  ctx.lineWidth = 4;
  ctx.strokeRect(PF.x + 2, PF.y + 2, PF.w - 4, PF.h - 4);
  ctx.strokeStyle = 'rgba(2, 124, 140, 0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(PF.x + 8, PF.y + 8, PF.w - 16, PF.h - 16);

  // Glowworm ceiling — permanent dim starfield.
  for (const gl of w.glowworms) {
    const tw = 0.35 + 0.25 * Math.sin(t * 1.5 + gl.phase);
    ctx.fillStyle = `rgba(0, 194, 199, ${tw * w.light * w.fungiDim})`;
    ctx.beginPath();
    ctx.arc(gl.x, gl.y, gl.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Stalactites — dark rock with a faint rim light, brighter when revealed.
  for (const s of w.stalactites) {
    const rev = revealAt(g, s.x, s.y);
    ctx.fillStyle = `rgba(6, 26, 34, ${0.55 + 0.45 * rev})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(0, 194, 199, ${0.12 + 0.5 * rev})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, Math.PI * 0.9, Math.PI * 1.9);
    ctx.stroke();
    // Rocky speckle.
    ctx.fillStyle = `rgba(2, 124, 140, ${0.25 * rev})`;
    ctx.beginPath();
    ctx.arc(s.x - s.r * 0.3, s.y - s.r * 0.25, s.r * 0.22, 0, Math.PI * 2);
    ctx.arc(s.x + s.r * 0.35, s.y + s.r * 0.3, s.r * 0.18, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFungi(ctx, g, t) {
  const w = g.world;
  // The trail line itself, faint.
  ctx.strokeStyle = `rgba(0, 194, 199, ${0.10 * w.fungiDim})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(w.trail[0].x, w.trail[0].y);
  for (let i = 1; i < w.trail.length; i++) ctx.lineTo(w.trail[i].x, w.trail[i].y);
  ctx.stroke();
  // Fungi glows — the wayfinding trail.
  for (const f of w.fungi) {
    const pulse = 0.75 + 0.25 * Math.sin(t * 2 + f.phase);
    const a = (f.gold ? 0.85 : 0.7) * pulse * w.fungiDim * w.light + 0.08;
    const col = f.gold ? '247, 181, 0' : '0, 194, 199';
    const glow = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * 4);
    glow.addColorStop(0, `rgba(${col}, ${a})`);
    glow.addColorStop(1, `rgba(${col}, 0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r * 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(${col}, ${Math.min(1, a + 0.15)})`;
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawExit(ctx, g, t) {
  const w = g.world;
  const e = w.exit;
  const open = w.exitOpen;
  const half = !!w.exitHalf; // posed: quota nearly met, the exit half-open
  const glowR = open ? 70 + 10 * Math.sin(t * 3) : half ? 52 : 34;
  const col = open ? '247, 181, 0' : half ? '247, 181, 0' : '120, 110, 60';
  const glow = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, glowR);
  glow.addColorStop(0, `rgba(${col}, ${open ? 0.9 : half ? 0.6 : 0.35})`);
  glow.addColorStop(1, `rgba(${col}, 0)`);
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(e.x, e.y, glowR, 0, Math.PI * 2);
  ctx.fill();
  // The golden opening — an arch.
  ctx.fillStyle = open ? CFG.col.gold : half ? '#6b5a14' : '#3a3413';
  ctx.beginPath();
  ctx.moveTo(e.x - 22, e.y + 18);
  ctx.lineTo(e.x - 22, e.y - 6);
  ctx.quadraticCurveTo(e.x, e.y - 30, e.x + 22, e.y - 6);
  ctx.lineTo(e.x + 22, e.y + 18);
  ctx.closePath();
  ctx.fill();
  if (half && !open) {
    // Half-open: a bright gold slit down the middle, no bars.
    ctx.fillStyle = 'rgba(255, 216, 115, 0.95)';
    ctx.fillRect(e.x - 3, e.y - 18, 6, 34);
  } else if (!open) {
    // Bars across a shut exit.
    ctx.strokeStyle = '#8a6d1f';
    ctx.lineWidth = 3;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(e.x + i * 12, e.y - 22);
      ctx.lineTo(e.x + i * 12, e.y + 16);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = 'rgba(255, 216, 115, 0.9)';
    ctx.beginPath();
    ctx.moveTo(e.x - 14, e.y + 14);
    ctx.lineTo(e.x - 14, e.y - 4);
    ctx.quadraticCurveTo(e.x, e.y - 20, e.x + 14, e.y - 4);
    ctx.lineTo(e.x + 14, e.y + 14);
    ctx.closePath();
    ctx.fill();
  }
  // The blocker label — the exit shows WHY it is shut.
  const dBat = Math.hypot(g.bat.x - e.x, g.bat.y - e.y);
  if (!open && dBat < 200) {
    const need = w.depth.quota - g.mothsEaten;
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(2, 24, 33, 0.9)';
    const label = `MOTHS ${g.mothsEaten}/${w.depth.quota} — eat ${need} more`;
    const tw = ctx.measureText(label).width + 18;
    ctx.fillRect(e.x - tw / 2, e.y - 62, tw, 24);
    ctx.strokeStyle = CFG.col.panelEdge;
    ctx.strokeRect(e.x - tw / 2, e.y - 62, tw, 24);
    ctx.fillStyle = CFG.col.paleGold;
    ctx.fillText(label, e.x, e.y - 45);
  }
}

function drawMoths(ctx, g, t) {
  const w = g.world;
  for (const m of w.moths) {
    if (m.eaten) continue;
    const rev = revealAt(g, m.x, m.y);
    const flap = Math.sin(m.wing) * 0.5;
    const a = 0.55 + 0.45 * rev;
    const r = m.prowler ? 7 : 5;
    // Glow.
    const glow = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, r * 3.2);
    glow.addColorStop(0, `rgba(247, 181, 0, ${0.5 * a})`);
    glow.addColorStop(1, 'rgba(247, 181, 0, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(m.x, m.y, r * 3.2, 0, Math.PI * 2);
    ctx.fill();
    // Wings.
    ctx.fillStyle = `rgba(255, 216, 115, ${a})`;
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(flap * 0.4);
    ctx.beginPath();
    ctx.ellipse(-r * 0.7, 0, r * 0.8, r * (0.35 + flap * 0.2), -0.5, 0, Math.PI * 2);
    ctx.ellipse(r * 0.7, 0, r * 0.8, r * (0.35 + flap * 0.2), 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = `rgba(20, 12, 0, ${a})`;
    ctx.beginPath();
    ctx.arc(m.x, m.y, r * 0.4, 0, Math.PI * 2);
    ctx.fill();
    if (m.stun > 0) {
      ctx.strokeStyle = `rgba(0, 194, 199, ${0.8 * a})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(m.x, m.y, r + 5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function drawOwl(ctx, g, t) {
  const w = g.world;
  const o = w.owl;
  if (!o.active) return;
  const rev = revealAt(g, o.x, o.y);
  const diving = o.diving > 0;
  const flap = Math.sin(o.wing) * (diving ? 0.9 : 0.35);
  const a = 0.5 + 0.5 * rev;
  ctx.save();
  ctx.translate(o.x, o.y);
  const ang = Math.atan2(g.bat.y - o.y, g.bat.x - o.x);
  ctx.rotate(ang * 0.12);
  // Spread wings — a large dark shape.
  ctx.fillStyle = `rgba(8, 16, 22, ${0.92 * a})`;
  ctx.beginPath();
  ctx.ellipse(-o.r * 1.15, -flap * 8, o.r * 1.1, o.r * 0.42, -0.55, 0, Math.PI * 2);
  ctx.ellipse(o.r * 1.15, -flap * 8, o.r * 1.1, o.r * 0.42, 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, 0, o.r * 0.85, o.r * 0.62, 0, 0, Math.PI * 2);
  ctx.fill();
  // Pale eyes — always faintly visible, the threat marker.
  ctx.fillStyle = `rgba(255, 240, 200, ${0.55 + 0.45 * rev})`;
  ctx.beginPath();
  ctx.arc(-o.r * 0.3, -o.r * 0.2, 3.4, 0, Math.PI * 2);
  ctx.arc(o.r * 0.3, -o.r * 0.2, 3.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(0, 0, 0, ${0.8 * a})`;
  ctx.beginPath();
  ctx.arc(-o.r * 0.3, -o.r * 0.2, 1.5, 0, Math.PI * 2);
  ctx.arc(o.r * 0.3, -o.r * 0.2, 1.5, 0, Math.PI * 2);
  ctx.fill();
  // Beak.
  ctx.fillStyle = `rgba(247, 181, 0, ${0.85 * a})`;
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
    ctx.fillText('THE OWL DIVES!', o.x, o.y - o.r - 16);
  }
}

function drawBat(ctx, g, t) {
  const b = g.bat;
  const flap = Math.sin(t * 16) * (0.25 + Math.min(0.5, b.speed / 500));
  const inv = b.invulnT > 0 && Math.floor(t * 12) % 2 === 0;
  // A strong cyan rim-glow so the dark silhouette reads against the dark cave
  // — the bat is the hero and must be unmistakable even at contact-sheet size.
  const rim = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, 64);
  rim.addColorStop(0, 'rgba(0, 194, 199, 0.30)');
  rim.addColorStop(1, 'rgba(0, 194, 199, 0)');
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.arc(b.x, b.y, 64, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.bank);
  if (inv) ctx.globalAlpha = 0.35;
  const squash = 1 + b.squash * 0.12;
  ctx.scale(squash, 1 / squash);
  // Wings fully spread — a solid dark silhouette, ~100px across: bigger than
  // any moth by an order of magnitude and second only to the owl in the frame.
  ctx.fillStyle = '#050d12';
  ctx.strokeStyle = 'rgba(0, 194, 199, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(-22, -flap * 8, 28, 11, -0.6, 0, Math.PI * 2);
  ctx.ellipse(22, -flap * 8, 28, 11, 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
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
  // GLOWING EYES — the player marker, always visible. Larger and brighter
  // than before: at contact-sheet size these are what says "bat" first.
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.bank);
  const eyeGlow = ctx.createRadialGradient(-5.5, -3, 0, -5.5, -3, 9.5);
  eyeGlow.addColorStop(0, 'rgba(0, 255, 245, 0.9)');
  eyeGlow.addColorStop(1, 'rgba(0, 255, 245, 0)');
  ctx.fillStyle = eyeGlow;
  ctx.beginPath(); ctx.arc(-5.5, -3, 9.5, 0, Math.PI * 2); ctx.fill();
  const eyeGlow2 = ctx.createRadialGradient(5.5, -3, 0, 5.5, -3, 9.5);
  eyeGlow2.addColorStop(0, 'rgba(0, 255, 245, 0.9)');
  eyeGlow2.addColorStop(1, 'rgba(0, 255, 245, 0)');
  ctx.fillStyle = eyeGlow2;
  ctx.beginPath(); ctx.arc(5.5, -3, 9.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#eafffd';
  ctx.beginPath(); ctx.arc(-5.5, -3, 2.9, 0, Math.PI * 2); ctx.arc(5.5, -3, 2.9, 0, Math.PI * 2); ctx.fill();
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
    const a = 0.85 * (1 - p);
    ctx.strokeStyle = `rgba(0, 194, 199, ${a})`;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(0, 194, 199, ${a * 0.4})`;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, r * 0.92, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawParticles(ctx, g) {
  for (const p of g.particles) {
    ctx.fillStyle = `rgba(247, 181, 0, ${Math.max(0, p.life / p.max)})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFloats(ctx, g) {
  ctx.textAlign = 'center';
  for (const f of g.floats) {
    const p = 1 - f.life / f.max;
    ctx.font = `bold ${f.big ? 20 : 15}px system-ui, sans-serif`;
    ctx.fillStyle = f.col;
    ctx.globalAlpha = Math.max(0, 1 - p * p);
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
  ctx.fillStyle = 'rgba(1, 9, 13, 0.72)';
  ctx.fillRect(0, 0, CFG.canvasW, CFG.canvasH);
  // One focal light: a single echo ring around the bat.
  const bx = CFG.canvasW / 2;
  const by = CFG.canvasH / 2 - 40;
  ctx.strokeStyle = 'rgba(0, 194, 199, 0.5)';
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
  ctx.fillStyle = 'rgba(1, 9, 13, 0.55)';
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
  ctx.fillStyle = 'rgba(1, 9, 13, 0.62)';
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
