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
  const world = buildDepth(3, seed + 3 * 13, ['wide', 'swift']);
  g.world = world;
  g.state = 'play';
  g.time = 3.7;
  g.score = 1240;
  g.best = 2180;
  g.chain = 3;
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

  // The owl, top-right, mid-dive — the visible antagonist.
  const owl = world.owl;
  owl.x = PF.x + PF.w * 0.82;
  owl.y = PF.y + PF.h * 0.22;
  owl.diving = 0.5;
  owl.hunt = 0.8;
  owl.wing = 1.2;

  // A moth swarm, mid-right (5–6 gold moths). The cover HUD reads MOTHS 8/10
  // (spec §(c)): 8 eaten of a quota of 10, so the left panel's "Moths left"
  // reads 2. The frame shows 10 live moths (the 6-moth swarm + 4 near the
  // trail) — that does not contradict the count: moths beyond the quota exist
  // in live play too (depth 3 spawns 10 moths for a quota of 8), and the
  // player needs 2 more of the moths on screen. A staging choice, noted here.
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
      vx: 0, vy: 0, wing: i * 1.1, stun: i < 2 ? 1.0 : 0, eaten: false, prowler: i === 0,
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

  // An echo ring mid-expansion (~2/3 of its radius), revealing walls + moths + owl.
  g.rings = [{ x: g.bat.x, y: g.bat.y, r: 0, maxR: CFG.pulseRadius * 1.5, age: 0.20 }];

  // Floating feedback text.
  g.floats = [
    { x: g.bat.x + 30, y: g.bat.y - 30, text: '+25', col: CFG.col.paleGold, big: false, life: 0.7, max: 0.9 },
    { x: g.bat.x + 90, y: g.bat.y - 52, text: 'CHAIN x3', col: CFG.col.paleGold, big: true, life: 0.7, max: 0.9 },
    { x: owl.x - 20, y: owl.y + 56, text: 'THE OWL STIRS!', col: '#ff9d7a', big: false, life: 0.7, max: 0.9 },
  ];
  g.particles = [];
  for (let i = 0; i < 8; i++) {
    g.particles.push({
      x: g.bat.x + 20 + (i % 4) * 12, y: g.bat.y - 10 - Math.floor(i / 4) * 12,
      vx: 0, vy: 0, r: 2, life: 0.6, max: 0.9,
    });
  }
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
  // The bat at the glowing exit, flying into the light.
  g.bat.x = world.exit.x - 40;
  g.bat.y = world.exit.y;
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
