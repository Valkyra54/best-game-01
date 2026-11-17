// ECHOWING — world. One job: cave generation, moths, the owl, the exit, levels,
// collision, and the pulse-cost rules. No drawing here (render.js draws).
import { CFG, DEPTHS } from './config.js';
import { makeRng, range } from './random.js';

const PF = {
  x: CFG.leftPanelW,
  y: CFG.topBarH,
  w: CFG.canvasW - CFG.leftPanelW - CFG.rightPanelW,
  h: CFG.canvasH - CFG.topBarH - CFG.bottomBarH,
};
export const PLAYFIELD = PF;

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

// Build one depth's cave from a seed. The fungi trail is a polyline from the
// start (left, mid) to the exit (right, bottom); moths cluster within ~150px
// of a fungus; stalactites keep clear of the trail, the start and the exit.
export function buildDepth(depthN, seed, relics) {
  const d = DEPTHS[depthN - 1];
  const rng = makeRng(seed * 1000 + depthN * 77);
  const trail = [];
  const start = { x: PF.x + 70, y: PF.y + PF.h * 0.52 };
  const exit = { x: PF.x + PF.w - 80, y: PF.y + PF.h * 0.78 };

  // Trail waypoints: start -> mid chambers -> (fork on depth 3) -> breather -> exit.
  const mid1 = { x: PF.x + PF.w * 0.30, y: PF.y + PF.h * range(rng, 0.25, 0.45) };
  const mid2 = { x: PF.x + PF.w * 0.55, y: PF.y + PF.h * range(rng, 0.45, 0.65) };
  const preExit = { x: PF.x + PF.w * 0.78, y: PF.y + PF.h * 0.62 };
  let forkA = null;
  let forkB = null;
  if (d.fork) {
    // Wide safe tunnel (upper, few moths) vs tight dark tunnel (lower, many moths).
    forkA = [
      { x: PF.x + PF.w * 0.38, y: PF.y + PF.h * 0.22 },
      { x: PF.x + PF.w * 0.58, y: PF.y + PF.h * 0.28 },
    ];
    forkB = [
      { x: PF.x + PF.w * 0.38, y: PF.y + PF.h * 0.72 },
      { x: PF.x + PF.w * 0.58, y: PF.y + PF.h * 0.80 },
    ];
  }
  const spine = [start, mid1, mid2, preExit, exit];
  for (const p of spine) trail.push(p);

  // Fungi along the spine (and along both fork branches on depth 3).
  const fungi = [];
  function fungiAlong(a, b, n) {
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      fungi.push({
        x: a.x + (b.x - a.x) * t + range(rng, -26, 26),
        y: a.y + (b.y - a.y) * t + range(rng, -26, 26),
        r: range(rng, 3, 7),
        gold: rng() < 0.35,
        phase: rng() * Math.PI * 2,
      });
    }
  }
  for (let i = 0; i < spine.length - 1; i++) fungiAlong(spine[i], spine[i + 1], 7);
  if (forkA) {
    fungiAlong(mid1, forkA[0], 4); fungiAlong(forkA[0], forkA[1], 4); fungiAlong(forkA[1], mid2, 4);
    fungiAlong(mid1, forkB[0], 4); fungiAlong(forkB[0], forkB[1], 4); fungiAlong(forkB[1], mid2, 4);
  }

  // Glowworm ceiling — a permanent dim starfield across the whole playfield.
  const glowworms = [];
  for (let i = 0; i < 130; i++) {
    glowworms.push({
      x: PF.x + rng() * PF.w,
      y: PF.y + rng() * PF.h,
      r: range(rng, 0.8, 2.2),
      phase: rng() * Math.PI * 2,
    });
  }

  // Stalactites: dark rock circles, clear of the trail / start / exit.
  const stalactites = [];
  let guard = 0;
  while (stalactites.length < d.stalactites && guard++ < 400) {
    const x = PF.x + 30 + rng() * (PF.w - 60);
    const y = PF.y + 30 + rng() * (PF.h - 60);
    const r = range(rng, 13, 30);
    if (dist(x, y, start.x, start.y) < 110) continue;
    if (dist(x, y, exit.x, exit.y) < 120) continue;
    let nearTrail = false;
    for (let i = 0; i < spine.length - 1; i++) {
      if (pointSegDist(x, y, spine[i], spine[i + 1]) < r + 46) { nearTrail = true; break; }
    }
    if (nearTrail) continue;
    if (stalactites.some((s) => dist(x, y, s.x, s.y) < r + s.r + 24)) continue;
    stalactites.push({ x, y, r });
  }

  // Breather chamber: a wide spot with many moths, no owl, before the exit.
  const breather = { x: PF.x + PF.w * 0.68, y: PF.y + PF.h * 0.5, r: 90 };

  // Moths cluster near the fungi trail (never more than ~150px from a fungus).
  const moths = [];
  for (let i = 0; i < d.moths; i++) {
    const f = fungi[Math.floor(rng() * fungi.length)];
    const a = rng() * Math.PI * 2;
    const rr = range(rng, 18, 130);
    moths.push({
      x: clamp(f.x + Math.cos(a) * rr, PF.x + 16, PF.x + PF.w - 16),
      y: clamp(f.y + Math.sin(a) * rr, PF.y + 16, PF.y + PF.h - 16),
      vx: 0, vy: 0,
      wing: rng() * Math.PI * 2,
      stun: 0,
      eaten: false,
      prowler: i < (depthN >= 4 ? 3 : 2) && depthN >= 2, // a few fast "Prowler" moths
    });
  }

  // Owl: patrols a slow loop when not alerted.
  const owl = {
    x: PF.x + PF.w * 0.72, y: PF.y + PF.h * 0.25,
    vx: 0, vy: 0, r: 26,
    patrol: [
      { x: PF.x + PF.w * 0.7, y: PF.y + PF.h * 0.22 },
      { x: PF.x + PF.w * 0.85, y: PF.y + PF.h * 0.5 },
      { x: PF.x + PF.w * 0.62, y: PF.y + PF.h * 0.68 },
      { x: PF.x + PF.w * 0.45, y: PF.y + PF.h * 0.35 },
    ],
    patrolI: 0,
    alertT: 0, alertX: 0, alertY: 0,
    hunt: 0, // hunt meter 0..1 — fills as the owl closes in
    diving: 0, retreatT: 0,
    wing: 0,
    passT: depthN === 2 ? 6 : 0, // depth 2: the owl sweeps across every ~15s
    active: d.owl !== 'absent',
  };

  return {
    depth: d, depthN, seed,
    start, exit, trail, forkA, forkB, fungi, glowworms, stalactites, breather, moths, owl,
    exitOpen: false,
    fungiDim: 1, // 1 = full brightness, 0.30 right after a pulse
    fungiDimT: 0,
    light: d.light,
    relics: relics || [],
  };
}

function pointSegDist(px, py, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((px - a.x) * dx + (py - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return dist(px, py, a.x + dx * t, a.y + dy * t);
}

export function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// --- per-frame world update (called by main.js) ---
export function updateWorld(w, bat, dt, events) {
  // Fungi dim recovery (Waitomo rule: glowworms switch off when disturbed).
  if (w.fungiDimT > 0) {
    w.fungiDimT -= dt;
    const wideN = w.relics.filter((r) => r === 'wide').length;
    const dimSecs = 3 + wideN;
    const f = Math.max(0, w.fungiDimT / dimSecs);
    w.fungiDim = 0.3 + 0.7 * (1 - f);
    if (w.fungiDimT <= 0) w.fungiDim = 1;
  }

  // Moths drift; stunned moths freeze; prowlers dart.
  for (const m of w.moths) {
    if (m.eaten) continue;
    if (m.stun > 0) { m.stun -= dt; continue; }
    m.wing += dt * 14;
    const sp = m.prowler ? 34 : 16;
    m.vx += (Math.random() - 0.5) * sp * dt * 8;
    m.vy += (Math.random() - 0.5) * sp * dt * 8;
    // Moths shy away from the bat unless stunned.
    const d = dist(m.x, m.y, bat.x, bat.y);
    if (d < 70) {
      m.vx += ((m.x - bat.x) / (d || 1)) * 60 * dt;
      m.vy += ((m.y - bat.y) / (d || 1)) * 60 * dt;
    }
    m.vx *= 0.96; m.vy *= 0.96;
    m.x = clamp(m.x + m.vx * dt, PF.x + 12, PF.x + PF.w - 12);
    m.y = clamp(m.y + m.vy * dt, PF.y + 12, PF.y + PF.h - 12);
  }

  // Owl behaviour.
  const owl = w.owl;
  if (owl.active) {
    owl.wing += dt * 6;
    const batSpeed = CFG.batBaseSpeed * w.depth.batSpeed;
    const owlSpeed = batSpeed * w.depth.owlSpeed;
    let tx = owl.x;
    let ty = owl.y;
    let speed = owlSpeed * 0.55; // patrol speed
    if (owl.retreatT > 0) {
      owl.retreatT -= dt;
      tx = PF.x + PF.w * 0.5; ty = PF.y + 30; // retreat to the top
      speed = owlSpeed;
    } else if (owl.diving > 0) {
      owl.diving -= dt;
      tx = bat.x; ty = bat.y;
      speed = owlSpeed * 2.2;
    } else if (w.depth.owl === 'chases') {
      tx = bat.x; ty = bat.y; speed = owlSpeed; // depth 5: constant chase
    } else if (owl.alertT > 0) {
      owl.alertT -= dt;
      tx = owl.alertX; ty = owl.alertY;
      speed = batSpeed * CFG.owlAlertSpeedMult;
    } else if (w.depth.owl === 'guards') {
      // Patrol the exit.
      tx = w.exit.x + Math.sin(owl.wing * 0.4) * 90;
      ty = w.exit.y - 70 + Math.cos(owl.wing * 0.4) * 40;
      speed = owlSpeed * 0.7;
    } else if (w.depth.owl === 'passes') {
      // A slow sweep across the cave every ~15s.
      owl.passT -= dt;
      if (owl.passT <= 0) {
        owl.passT = 15;
        owl.x = PF.x + 40;
        owl.y = PF.y + PF.h * 0.3;
        owl.sweeping = true;
      }
      if (owl.sweeping) {
        tx = PF.x + PF.w - 40; ty = PF.y + PF.h * 0.3;
        speed = owlSpeed;
        if (owl.x > PF.x + PF.w - 60) owl.sweeping = false;
      } else {
        tx = owl.patrol[owl.patrolI].x; ty = owl.patrol[owl.patrolI].y;
      }
    } else {
      tx = owl.patrol[owl.patrolI].x; ty = owl.patrol[owl.patrolI].y;
    }
    const dx = tx - owl.x;
    const dy = ty - owl.y;
    const dd = Math.hypot(dx, dy) || 1;
    if (dd > 6) {
      owl.x += (dx / dd) * speed * dt;
      owl.y += (dy / dd) * speed * dt;
    } else if (owl.patrolI !== undefined && owl.alertT <= 0 && owl.diving <= 0 && owl.retreatT <= 0) {
      owl.patrolI = (owl.patrolI + 1) % owl.patrol.length;
    }
    // Hunt meter: fills as the owl closes in on the bat, drains when far.
    const bd = dist(owl.x, owl.y, bat.x, bat.y);
    if (owl.diving > 0) {
      owl.hunt = 1;
    } else if (bd < 260) {
      owl.hunt = Math.min(1, owl.hunt + dt * (0.5 + (260 - bd) / 260 * 0.8));
    } else {
      owl.hunt = Math.max(0, owl.hunt - dt * 0.25);
    }
    if (owl.hunt >= 1 && owl.diving <= 0 && owl.retreatT <= 0) {
      owl.diving = 0.9; // the dive
      events.owlDive = true;
    }
  }
}

// A pulse at (x, y): stun moths in the ring, alert the owl, dim the fungi.
// Relics stack: WIDE PULSE x1.5 radius each (and the fungi dim 1s longer each).
export function applyPulse(w, bat, events) {
  const wideN = w.relics.filter((r) => r === 'wide').length;
  const radius = CFG.pulseRadius * Math.pow(1.5, wideN);
  for (const m of w.moths) {
    if (!m.eaten && dist(m.x, m.y, bat.x, bat.y) < radius) m.stun = 1.5;
  }
  const owl = w.owl;
  if (owl.active) {
    const d = dist(owl.x, owl.y, bat.x, bat.y);
    // The owl hears the ping and comes for the last ping location.
    owl.alertT = CFG.owlAlertSecs;
    owl.alertX = bat.x;
    owl.alertY = bat.y;
    if (d < radius + 60) {
      // Close-range pulse drives the owl back — the hunt meter drains.
      owl.hunt = Math.max(0, owl.hunt - 0.45);
      if (owl.hunt <= 0.05 && owl.diving <= 0) owl.retreatT = 5;
    }
  }
  w.fungiDimT = 3 + wideN;
  w.fungiDim = CFG.fungiDimTo;
  events.pulsed = true;
}

// Wall / stalactite collision for the bat (circle vs circles + playfield bounds).
export function batHitsWall(w, bat) {
  if (bat.x < PF.x + CFG.batRadius || bat.x > PF.x + PF.w - CFG.batRadius ||
      bat.y < PF.y + CFG.batRadius || bat.y > PF.y + PF.h - CFG.batRadius) {
    return true;
  }
  for (const s of w.stalactites) {
    if (dist(bat.x, bat.y, s.x, s.y) < s.r + CFG.batRadius - 2) return true;
  }
  return false;
}
