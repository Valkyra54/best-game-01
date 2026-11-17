// ECHOWING — main. One job: the game loop, states (title/play/pause/relic/win/lose),
// scoring, lives, respawns, and wiring input + world + render + audio together.
import { CFG, DEPTHS, RELICS } from './config.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { buildDepth, updateWorld, applyPulse, batHitsWall, clamp, PLAYFIELD } from './world.js';
import { drawGame } from './render.js';
import { poseShot } from './shots.js';

const PF = PLAYFIELD;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = CFG.canvasW;
canvas.height = CFG.canvasH;

const input = createInput();
const audio = createAudio();
const statusEl = document.getElementById('status');

const params = new URLSearchParams(window.location.search);
const shotMode = params.get('shot');
const seed = Number(params.get('seed') || 1);

function newBat(w) {
  return {
    x: w.start.x, y: w.start.y, vx: 0, vy: 0,
    bank: 0, speed: 0, squash: 0, invulnT: 0,
  };
}

function newGame() {
  const world = buildDepth(1, seed, []);
  return {
    state: 'title',
    time: 0,
    world,
    bat: newBat(world),
    score: 0,
    best: Number(localStorage.getItem('echowing-best') || 0),
    mothsEaten: 0, // this depth
    mothsTotal: 0, // whole run
    chain: 0,
    chainT: 0,
    lives: CFG.livesBase,
    maxLives: CFG.livesBase,
    charges: CFG.pulseCharges,
    chargeT: 0,
    pulseCd: 0,
    pulseCdMax: CFG.pulseCooldownSecs,
    flutterCd: 0,
    flutterT: 0,
    roostT: 0,
    rings: [],
    particles: [],
    floats: [],
    shakeT: 0, shakeDur: 0.3, shakeMag: 0,
    hitStop: 0,
    relics: [],
    loseCause: 'wall',
    winTime: '0:00',
    playSecs: 0,
    dripT: 3,
    lastSafe: { x: world.start.x, y: world.start.y },
    shot: shotMode,
  };
}

let g = newGame();

function announce(msg) {
  if (statusEl) statusEl.textContent = msg;
}

function addFloat(x, y, text, col, big) {
  g.floats.push({ x, y, text, col: col || CFG.col.paleGold, big: !!big, life: CFG.floatSecs, max: CFG.floatSecs });
}

function burst(x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 40 + Math.random() * 90;
    g.particles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      r: 1.5 + Math.random() * 2.5, life: 0.5 + Math.random() * 0.4, max: 0.9,
    });
  }
}

function shake(mag, dur) {
  g.shakeMag = mag;
  g.shakeDur = dur;
  g.shakeT = dur;
}

function loseLife(cause) {
  if (g.bat.invulnT > 0 || g.state !== 'play') return;
  g.lives -= 1;
  g.chain = 0;
  g.loseCause = cause;
  audio.thud();
  shake(CFG.shakeHeavy, 0.4);
  g.hitStop = CFG.hitStopFrames;
  if (g.lives <= 0) {
    g.state = 'lose';
    audio.bell();
    if (g.score > g.best) {
      g.best = g.score;
      localStorage.setItem('echowing-best', String(g.best));
    }
    announce('Game over. ' + (cause === 'owl' ? 'The owl found you.' : 'The dark took you.'));
    return;
  }
  // Respawn at the last safe point (depth start or last breather), 2s invulnerable.
  const w = g.world;
  const safe = w.breather && dist2(g.bat.x, g.bat.y, w.breather.x, w.breather.y) < 400
    ? w.breather : w.start;
  g.bat.x = safe.x; g.bat.y = safe.y;
  g.bat.vx = 0; g.bat.vy = 0;
  g.bat.invulnT = 2;
  g.lastSafe = { x: safe.x, y: safe.y };
  addFloat(safe.x, safe.y - 24, cause === 'owl' ? 'THE OWL GOT YOU' : 'WALL HIT', '#ff6b5e', true);
}

function dist2(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

function eatMoth(m) {
  m.eaten = true;
  g.mothsEaten += 1;
  g.mothsTotal += 1;
  // Chain: eat within 3s of the last moth to build it, capped at x5.
  if (g.chainT > 0) g.chain = Math.min(CFG.chainMax, g.chain + 1);
  else g.chain = 1;
  g.chainT = CFG.chainWindowSecs;
  const pts = CFG.mothScore * g.chain;
  g.score += pts;
  audio.chime(g.chain);
  burst(m.x, m.y, 8);
  addFloat(m.x, m.y - 14, `+${pts}${g.chain > 1 ? '  CHAIN x' + g.chain : ''}`, CFG.col.paleGold, g.chain >= 3);
  g.bat.squash = 1;
  if (g.mothsEaten >= g.world.depth.quota && !g.world.exitOpen) {
    g.world.exitOpen = true;
    audio.open();
    addFloat(g.world.exit.x, g.world.exit.y - 44, 'EXIT OPEN', CFG.col.gold, true);
    announce('The exit is open.');
  }
}

function doPulse() {
  if (g.charges <= 0 || g.pulseCd > 0) return;
  g.charges -= 1;
  g.pulseCd = g.pulseCdMax;
  const radius = CFG.pulseRadius * Math.pow(1.5, countRelic(g, 'wide'));
  g.rings.push({ x: g.bat.x, y: g.bat.y, r: 0, maxR: radius, age: 0 });
  const events = {};
  applyPulse(g.world, g.bat, events);
  audio.ping();
  shake(CFG.shakeLight, 0.18);
  if (g.world.owl.active && g.world.owl.alertT > 0) {
    addFloat(g.bat.x, g.bat.y - 30, 'THE OWL STIRS!', '#ff9d7a', false);
    audio.hoot();
  }
}

function startDepth(n) {
  const world = buildDepth(n, seed + n * 13, g.relics.map((r) => r.id));
  g.world = world;
  g.bat = newBat(world);
  g.mothsEaten = 0;
  g.chain = 0;
  g.chainT = 0;
  g.charges = CFG.pulseCharges;
  g.chargeT = 0;
  g.pulseCd = 0;
  g.flutterCd = 0;
  g.rings = [];
  g.floats = [];
  g.state = 'play';
  g.lastSafe = { x: world.start.x, y: world.start.y };
  // THICK HIDE stacks: +0.5s pulse cooldown per hide relic.
  g.pulseCdMax = CFG.pulseCooldownSecs + 0.5 * countRelic(g, 'hide');
  audio.setTension(n);
  announce(`Depth ${n}: ${world.depth.name}. Eat ${world.depth.quota} moths to open the exit.`);
}

function countRelic(g, id) {
  return g.relics.filter((r) => r.id === id).length;
}

function chooseRelic(i) {
  const r = RELICS[i];
  if (!r) return;
  g.relics.push(r);
  if (r.id === 'hide') {
    g.maxLives += 1;
    g.lives += 1;
  }
  // The +500 depth bonus was already added when the exit was reached (the
  // relic screen's header shows it) — do not add it again here.
  // Relics stack when picked twice (WIDE: radius x1.5 each; SWIFT: speed
  // x1.25 each; HIDE: +1 life and +0.5s pulse cooldown each) — the costs are
  // recomputed from the counts in startDepth / doPulse / applyPulse.
  const next = g.world.depthN + 1;
  if (next > 5) {
    startDepth(5);
    return;
  }
  startDepth(next);
}

function fmtTime(secs) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function update(dt) {
  g.time += dt;
  if (g.shakeT > 0) g.shakeT -= dt;
  if (g.hitStop > 0) { g.hitStop -= 1; return; } // hit-stop freezes the world briefly

  // Rings age.
  for (const ring of g.rings) ring.age += dt;
  g.rings = g.rings.filter((r) => r.age < CFG.pulseRevealSecs + 0.2);
  // Particles / floats.
  for (const p of g.particles) {
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= 0.96; p.vy *= 0.96;
    p.life -= dt;
  }
  g.particles = g.particles.filter((p) => p.life > 0);
  for (const f of g.floats) f.life -= dt;
  g.floats = g.floats.filter((f) => f.life > 0);
  if (g.bat.squash > 0) g.bat.squash = Math.max(0, g.bat.squash - dt * 4);

  if (g.state === 'title') {
    if (input.pressed('Enter')) {
      audio.unlock();
      audio.startDrone(1);
      g.state = 'play';
      announce('Depth 1: The Mouth. Eat 4 moths to open the exit.');
    }
    return;
  }

  if (g.state === 'win' || g.state === 'lose') {
    if (input.pressed('r') || input.pressed('R')) {
      g = newGame();
      g.state = 'play';
      audio.startDrone(1);
    }
    return;
  }

  if (g.state === 'relic') {
    if (input.pressed('1')) chooseRelic(0);
    else if (input.pressed('2')) chooseRelic(1);
    else if (input.pressed('3')) chooseRelic(2);
    // Click a card: same layout as render.js drawRelicChoice (3 cards,
    // 330x240, 26px gaps, starting at y=210, centred).
    const c = input.clicked();
    if (c) {
      const cw = 330;
      const ch = 240;
      const gap = 26;
      const x0 = (CFG.canvasW - (3 * cw + 2 * gap)) / 2;
      const y0 = 210;
      for (let i = 0; i < 3; i++) {
        const cx = x0 + i * (cw + gap);
        if (c.x >= cx && c.x <= cx + cw && c.y >= y0 && c.y <= y0 + ch) {
          chooseRelic(i);
          break;
        }
      }
    }
    return;
  }

  if (g.state === 'play') {
    if (input.pressed('p') || input.pressed('P')) { g.state = 'pause'; return; }
    if (input.pressed('r') || input.pressed('R')) { g = newGame(); g.state = 'play'; return; }
    g.playSecs += dt;

    const w = g.world;
    const bat = g.bat;
    const speedMult = w.depth.batSpeed * Math.pow(1.25, countRelic(g, 'swift'));
    const maxSpeed = CFG.batBaseSpeed * speedMult;

    // Steering: arrows/WASD (momentum + banking) or mouse-follow.
    let ax = 0;
    let ay = 0;
    if (input.left()) ax -= 1;
    if (input.right()) ax += 1;
    if (input.up()) ay -= 1;
    if (input.down()) ay += 1;
    const m = input.mouse();
    if (ax === 0 && ay === 0 && m.steer) {
      const dx = m.x - bat.x;
      const dy = m.y - bat.y;
      const d = Math.hypot(dx, dy);
      if (d > 12) { ax = dx / d; ay = dy / d; }
    }
    const accel = CFG.batAccel * Math.pow(0.8, countRelic(g, 'hide'));
    if (ax !== 0 || ay !== 0) {
      const len = Math.hypot(ax, ay) || 1;
      bat.vx += (ax / len) * accel * dt;
      bat.vy += (ay / len) * accel * dt;
      // Banking: tilt into the turn.
      const targetBank = (ax / len) * 0.35;
      bat.bank += (targetBank - bat.bank) * Math.min(1, CFG.batTurn * dt);
    } else {
      bat.bank += (0 - bat.bank) * Math.min(1, 6 * dt);
    }
    // Flutter burst.
    if (g.flutterCd > 0) g.flutterCd -= dt;
    if (g.flutterT > 0) g.flutterT -= dt;
    if (input.shift() && g.flutterCd <= 0) {
      g.flutterCd = CFG.flutterCooldownSecs;
      g.flutterT = CFG.flutterSecs;
    }
    const boost = g.flutterT > 0 ? CFG.flutterBoostMult : 1;
    // Damping + speed cap.
    const damp = Math.pow(CFG.batDamping, dt * 60);
    bat.vx *= damp;
    bat.vy *= damp;
    const sp = Math.hypot(bat.vx, bat.vy);
    const cap = maxSpeed * boost;
    if (sp > cap) {
      bat.vx = (bat.vx / sp) * cap;
      bat.vy = (bat.vy / sp) * cap;
    }
    bat.x += bat.vx * dt;
    bat.y += bat.vy * dt;
    bat.speed = Math.hypot(bat.vx, bat.vy);
    if (bat.invulnT > 0) bat.invulnT -= dt;

    // Roost: hold Q while still to regain a charge.
    if (input.roost() && bat.speed < 30) {
      g.roostT += dt;
      if (g.roostT >= CFG.roostHoldSecs && g.charges < CFG.pulseCharges) {
        g.charges += 1;
        g.roostT = 0;
        addFloat(bat.x, bat.y - 26, '+1 ECHO', CFG.col.cyan, false);
      }
    } else {
      g.roostT = 0;
    }

    // Pulse.
    if (g.pulseCd > 0) g.pulseCd -= dt;
    if (input.pulsePressed()) doPulse();
    // Charge regen.
    if (g.charges < CFG.pulseCharges) {
      g.chargeT += dt;
      if (g.chargeT >= CFG.pulseRegenSecs) {
        g.charges += 1;
        g.chargeT = 0;
      }
    }
    // Chain timer.
    if (g.chainT > 0) {
      g.chainT -= dt;
      if (g.chainT <= 0) g.chain = 0;
    }

    // World update (moths drift, owl patrols/hunts/dives, fungi dim recovery).
    const events = {};
    updateWorld(w, bat, dt, events);
    if (events.owlDive) audio.hoot();

    // Eat moths.
    for (const mo of w.moths) {
      if (!mo.eaten && dist2(mo.x, mo.y, bat.x, bat.y) < CFG.batRadius + 8) eatMoth(mo);
    }
    // Wall hit.
    if (bat.invulnT <= 0 && batHitsWall(w, bat)) {
      loseLife('wall');
      if (g.state !== 'play') return;
    }
    // Owl hit.
    const owl = w.owl;
    if (owl.active && bat.invulnT <= 0 &&
        dist2(owl.x, owl.y, bat.x, bat.y) < owl.r + CFG.batRadius - 4) {
      loseLife('owl');
      if (g.state !== 'play') return;
      // The owl backs off after a hit so the player gets a breath.
      owl.hunt = 0;
      owl.retreatT = 5;
    }
    // Reached the open exit?
    if (w.exitOpen && dist2(bat.x, bat.y, w.exit.x, w.exit.y) < 34) {
      g.score += CFG.depthBonus;
      if (w.depthN >= 5) {
        g.state = 'win';
        g.winTime = fmtTime(g.playSecs);
        audio.fanfare();
        if (g.score > g.best) {
          g.best = g.score;
          localStorage.setItem('echowing-best', String(g.best));
        }
        announce('You reached the light. Depth 5 cleared.');
      } else {
        g.state = 'relic';
        input.clearClick(); // a mousedown from before the screen opened is stale
        announce(`Depth ${w.depthN} cleared. Choose a relic.`);
      }
      return;
    }
    // Breather: passing the breather chamber updates the last safe point.
    if (dist2(bat.x, bat.y, w.breather.x, w.breather.y) < w.breather.r) {
      g.lastSafe = { x: w.breather.x, y: w.breather.y };
    }
    // Ambient drips.
    g.dripT -= dt;
    if (g.dripT <= 0) {
      g.dripT = 2.5 + Math.random() * 4;
      audio.drip();
    }
    return;
  }

  if (g.state === 'pause') {
    if (input.pressed('p') || input.pressed('P')) g.state = 'play';
  }
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  drawGame(ctx, g);
  window.__echowing = g; // live state for headless playtests (steer/pulse/eat/exit)
  if (!shotMode) requestAnimationFrame(frame);
}

// Shot poses: deterministic, posed states for the 4 screenshots.
if (shotMode) {
  poseShot(g, shotMode, seed);
  drawGame(ctx, g);
  // Let the first paint land, then signal readiness.
  requestAnimationFrame(() => {
    window.__shotReady = true;
  });
} else {
  requestAnimationFrame(frame);
}
