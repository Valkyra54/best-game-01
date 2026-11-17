// ECHOWING — screenshot poses. One job: set up deterministic, staged game states
// for the four screenshots (?shot=play|start|win|lose). These are real renders of
// the game's own code — the poses stage positions and HUD values the way a live
// game would reach them, then the page renders one frame and sets __shotReady.
import { CFG, RELICS } from './config.js';
import { buildDepth, PLAYFIELD } from './world.js';

const PF = PLAYFIELD;
const relicById = (id) => RELICS.find((r) => r.id === id);

export function poseShot(g, shot, seed) {
  if (shot === 'play') posePlay(g, seed);
  else if (shot === 'start') poseStart(g, seed);
  else if (shot === 'win') poseWin(g, seed);
  else if (shot === 'lose') poseLose(g, seed);
}

function posePlay(g, seed) {
  // DEPTH 3 — the fork, the tightest readable depth with the owl hunting.
  // v2: the ACTION MOMENT — the bat MID-PULSE-BLAST: the shockwave expanding,
  // 3 moths bursting, a stalactite shattering, the owl recoiling, the radiant
  // exit behind, the fungi garden glowing. This is a fight, not a commute.
  const world = buildDepth(3, seed + 3 * 13, ['wide', 'swift']);
  g.world = world;
  g.state = 'play';
  g.time = 3.7;
  g.score = 1240;
  g.best = 2180;
  g.chain = 4;
  g.chainT = 2.1;
  g.lives = 3;
  g.maxLives = 3;
  g.charges = 2; // ECHO ●●○
  g.relics = [relicById('wide'), relicById('swift')];
  g.pulseCd = 0.5;
  g.pulseCdMax = CFG.pulseCooldownSecs;

  // The bat, centre-left, banking into a turn, wings spread.
  g.bat.x = PF.x + PF.w * 0.30;
  g.bat.y = PF.y + PF.h * 0.55;
  g.bat.vx = 120; g.bat.vy = -40;
  g.bat.speed = 126;
  g.bat.bank = 0.32;

  // The owl, top-right, RECOILING from the close-range pulse — knocked back,
  // hunt meter drained, after-image behind it.
  const owl = world.owl;
  owl.x = PF.x + PF.w * 0.82;
  owl.y = PF.y + PF.h * 0.22;
  owl.diving = 0;
  owl.hunt = 0.25; // driven back by the blast
  owl.wing = 1.2;
  owl.knockT = 0.25;
  owl.knockX = 420; owl.knockY = -260; // shoved up-right, away from the bat

  // A moth swarm, mid-right (5–6 gold moths). The cover HUD reads MOTHS 8/10
  // (spec §(c)): 8 eaten of a quota of 10, so the left panel's "Moths left"
  // reads 2. Three of the swarm are mid-BURST (eaten, gold+white particles
  // in their place); the rest are alive on screen. Moths beyond the quota
  // exist in live play too (depth 3 spawns 10 moths for a quota of 8).
  world.depth.quota = 10;
  g.mothsEaten = 8;
  g.mothsTotal = 8;
  const swarmX = PF.x + PF.w * 0.62;
  const swarmY = PF.y + PF.h * 0.42;
  const alive = world.moths.filter((m) => !m.eaten);
  alive.forEach((m, i) => { m.eaten = true; });
  const swarm = [];
  for (let i = 0; i < 6; i++) {
    swarm.push({
      x: swarmX + (i % 3) * 34 - 34 + (i * 7) % 13,
      y: swarmY + Math.floor(i / 3) * 36 - 18,
      vx: 0, vy: 0, wing: i * 1.1, stun: i < 2 ? 1.0 : 0, eaten: i < 3, prowler: i === 0,
    });
  }
  world.moths = swarm.concat(world.moths.filter((m) => !m.eaten).slice(0, 0));
  // Keep 4 more moths alive elsewhere so the cave is not empty outside the swarm.
  for (let i = 0; i < 4; i++) {
    const f = world.fungi[(i * 7 + 3) % world.fungi.length];
    world.moths.push({
      x: f.x + 20, y: f.y - 14, vx: 0, vy: 0,
      wing: i * 2.1, stun: 0, eaten: false, prowler: false,
    });
  }

  // The exit, bottom-right, half-open — quota nearly met, fungi trail leading to it.
  world.exitHalf = true;
  world.exitOpen = false;

  // The pulse, mid-blast: a thick white-cyan shockwave ~2/3 expanded, and
  // the radial flash still bright at the bat.
  g.rings = [{ x: g.bat.x, y: g.bat.y, r: 0, maxR: CFG.pulseRadius * 1.5, age: 0.20 }];
  g.flash = 0.75;

  // Burst particles where the 3 swarm moths just burst (gold + white).
  g.particles = [];
  for (let i = 0; i < 3; i++) {
    const m = swarm[i];
    for (let j = 0; j < 8; j++) {
      const a = j * 0.8 + i;
      g.particles.push({
        x: m.x + Math.cos(a) * (10 + j * 3), y: m.y + Math.sin(a) * (10 + j * 3),
        vx: 0, vy: 0, r: 2 + (j % 3), life: 0.6, max: 0.9,
        col: j % 2 ? '247, 181, 0' : '255, 255, 255',
      });
    }
  }
  // A stalactite SHATTERING inside the blast: the nearest rock to the
  // shockwave front, broken, shards mid-flight around it.
  let target = null;
  let bestD = Infinity;
  for (const s of world.stalactites) {
    const d = Math.hypot(s.x - (g.bat.x + 140), s.y - (g.bat.y - 60));
    if (d < bestD) { bestD = d; target = s; }
  }
  g.shards = [];
  if (target) {
    target.shattered = true;
    for (let i = 0; i < 10; i++) {
      const a = i * 0.63;
      g.shards.push({
        x: target.x + Math.cos(a) * (14 + i * 4), y: target.y + Math.sin(a) * (12 + i * 3),
        vx: 0, vy: 0, r: 4 + (i % 4) * 2, rot: i * 0.9, vr: 0,
        life: 0.7, max: 1.1,
      });
    }
  }

  // Floating feedback text — the fight, narrated on screen.
  g.floats = [
    { x: g.bat.x + 30, y: g.bat.y - 30, text: '+25', col: CFG.col.paleGold, big: false, life: 0.7, max: 0.9 },
    { x: g.bat.x + 90, y: g.bat.y - 52, text: '+75  CHAIN x4', col: CFG.col.paleGold, big: true, life: 0.7, max: 0.9 },
    { x: owl.x - 20, y: owl.y + 56, text: 'OWL DRIVEN BACK!', col: CFG.col.gold, big: true, life: 0.7, max: 0.9 },
    { x: target ? target.x : g.bat.x + 140, y: target ? target.y - 40 : g.bat.y - 90, text: 'SHATTERED!', col: '#7df3f7', big: true, life: 0.7, max: 0.9 },
  ];
}

function poseStart(g, seed) {
  const world = buildDepth(1, seed, []);
  g.world = world;
  g.state = 'title';
  g.time = 2.0;
  g.score = 0;
  g.best = 2180;
  g.mothsEaten = 0;
  g.charges = 3;
  g.relics = [];
  g.lives = 3;
  // The bat centred under the title, one echo ring around it — the one focal light.
  g.bat.x = CFG.canvasW / 2;
  g.bat.y = CFG.canvasH / 2 - 40;
  g.bat.bank = 0;
  g.rings = [{ x: g.bat.x, y: g.bat.y, r: 0, maxR: 130, age: 0.20 }];
  g.floats = [];
  g.particles = [];
}

function poseWin(g, seed) {
  const world = buildDepth(5, seed + 5 * 13, ['wide', 'swift', 'hide']);
  g.world = world;
  world.exitOpen = true;
  // v2: the owl is GONE from the win shot — the bat reached the light, the
  // threat is over; the win frame belongs to the bat + the radiant exit.
  world.owl.active = false;
  g.state = 'win';
  g.time = 4.2;
  g.score = 4820;
  g.best = 4820;
  g.mothsTotal = 52;
  g.mothsEaten = 12;
  g.winTime = '6:24';
  g.relics = [relicById('wide'), relicById('swift'), relicById('hide')];
  g.lives = 2;
  g.maxLives = 4;
  // The bat at the glowing exit, flying into the light (just outside the
  // tall gate so the bat reads against the light, not inside it).
  g.bat.x = world.exit.x - 72;
  g.bat.y = world.exit.y + 6;
  g.bat.bank = 0.15;
  g.floats = [];
  g.particles = [];
  for (let i = 0; i < 14; i++) {
    g.particles.push({
      x: world.exit.x - 30 + (i % 7) * 10, y: world.exit.y - 20 + Math.floor(i / 7) * 18,
      vx: 0, vy: 0, r: 2, life: 0.8, max: 0.9,
    });
  }
}

function poseLose(g, seed) {
  const world = buildDepth(3, seed + 3 * 13, ['wide']);
  g.world = world;
  g.state = 'lose';
  g.time = 2.6;
  g.score = 1240;
  g.best = 2180;
  g.mothsTotal = 8;
  g.mothsEaten = 8;
  g.loseCause = 'owl';
  g.relics = [relicById('wide')];
  g.lives = 0;
  g.maxLives = 3;
  // The owl large over the small bat, wings spread, on the cave floor.
  const owl = world.owl;
  owl.x = PF.x + PF.w * 0.5;
  owl.y = PF.y + PF.h * 0.52;
  owl.diving = 0;
  owl.hunt = 1;
  owl.wing = 0.4;
  g.bat.x = owl.x;
  g.bat.y = owl.y + 52;
  g.bat.bank = 0;
  g.floats = [];
  g.particles = [];
}
