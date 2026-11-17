// ECHOWING — tuning constants. One job: every number the game balances on lives here.
export const CFG = {
  canvasW: 1280,
  canvasH: 720,

  // HUD layout (1280x720 logical canvas, scaled by CSS to the window).
  topBarH: 48,
  bottomBarH: 48,
  leftPanelW: 170,
  rightPanelW: 170,

  // Palette — v2: BRIGHT bioluminescent grotto. The ground is a lit teal-blue
  // grotto now, not near-black: at least half the playfield must read as lit.
  col: {
    ground: '#0a4a5e',
    groundDeep: '#07405a',
    teal: '#027c8c',
    cyan: '#00c2c7',
    gold: '#f7b500',
    paleGold: '#ffd873',
    ink: '#01090d',
    panel: 'rgba(2, 24, 33, 0.88)',
    panelEdge: '#8a6d1f',
    text: '#e8f4f2',
    dimText: '#7fa8a4',
    winGreen: '#3fce6b',
    loseRed: '#e5484d',
  },

  // Bat — v2: +25% speed, drawn ~2x (wingspan ~140px in the cover pose).
  batRadius: 12,
  batBaseSpeed: 294,
  batAccel: 1150,
  batDamping: 0.90, // per-frame velocity retention at 60fps (scaled by dt)
  batTurn: 9.0, // banking responsiveness
  batDrawScale: 1.4, // visual scale vs v1 (wingspan ~100px -> ~140px; collision radius unchanged)

  // Pulse (echolocation) — v2: a WEAPON. Cooldown 1.2s, thick shockwave.
  pulseRadius: 220,
  pulseRevealSecs: 2.0,
  pulseCooldownSecs: 1.2,
  pulseCharges: 3,
  pulseRegenSecs: 4.0,
  pulseRingSecs: 0.65, // ring expansion time
  fungiDimTo: 0.30,
  fungiDimSecs: 3.0,
  owlAlertSecs: 4.0,
  owlAlertSpeedMult: 1.2,

  // Owl dive telegraph (v2): shadow pools + screech ring 0.5s before the dive.
  owlDiveWarnSecs: 0.5,
  // Owl knockback (v2): a close-range pulse shoves the owl away.
  owlKnockbackPx: 170,

  // Flutter (SHIFT burst).
  flutterCooldownSecs: 2.0,
  flutterBoostMult: 1.85,
  flutterSecs: 0.35,

  // Roost (Q, hold still to regain a charge).
  roostHoldSecs: 1.0,

  // Chain — v2: 4s window, up to x8 (swarm-eating is the skill shot).
  chainWindowSecs: 4.0,
  chainMax: 8,
  mothScore: 25,

  // Lives / depth bonus.
  livesBase: 3,
  depthBonus: 500,

  // Juice — v2: hit-stop on every moth burst, shake on every shatter.
  shakeLight: 3,
  shakeHeavy: 11,
  shakeShatter: 5,
  hitStopFrames: 4,
  hitStopBurst: 3,
  floatRisePx: 24,
  floatSecs: 0.9,
};

// Depth table — v2: the cave stays BRIGHT at every depth (light 1.0 → 0.8).
// The v1 "darker each depth" dial is what made the playfield unreadable;
// difficulty now comes from stalactite density, owl speed and the fork, not
// from turning the lights off.
export const DEPTHS = [
  {
    n: 1, name: 'The Mouth', moths: 6, quota: 4, owl: 'absent',
    batSpeed: 1.0, owlSpeed: 0, stalactites: 7, light: 1.0, fork: false,
    incoming: ['Duskmoth ×6', 'Stalactite field'],
  },
  {
    n: 2, name: 'The Gallery', moths: 8, quota: 6, owl: 'passes',
    batSpeed: 1.0, owlSpeed: 0.8, stalactites: 12, light: 0.95, fork: false,
    incoming: ['Duskmoth ×8', 'Prowler ×2', 'THE OWL', 'Stalactite field'],
  },
  {
    n: 3, name: 'The Narrow', moths: 10, quota: 8, owl: 'hunts',
    batSpeed: 1.05, owlSpeed: 1.0, stalactites: 16, light: 0.9, fork: true,
    incoming: ['Duskmoth ×10', 'Prowler ×2', 'THE OWL', 'Stalactite field'],
  },
  {
    n: 4, name: 'The Deep', moths: 12, quota: 10, owl: 'guards',
    batSpeed: 1.10, owlSpeed: 1.1, stalactites: 20, light: 0.85, fork: false,
    incoming: ['Duskmoth ×12', 'Prowler ×3', 'THE OWL', 'Stalactite field'],
  },
  {
    n: 5, name: 'The Core', moths: 14, quota: 12, owl: 'chases',
    batSpeed: 1.15, owlSpeed: 1.2, stalactites: 24, light: 0.8, fork: false,
    incoming: ['Duskmoth ×14', 'Prowler ×3', 'THE OWL', 'Stalactite field'],
  },
];

export const RELICS = [
  {
    id: 'wide', name: 'WIDE PULSE', key: '1',
    benefit: 'Pulse radius +50% (330px) — see much more of the cave.',
    cost: 'The owl hears it from farther away, and the fungi dim for 4s instead of 3s.',
  },
  {
    id: 'swift', name: 'SWIFT WINGS', key: '2',
    benefit: 'Flight speed +25% — outrun the owl, cross open chambers fast.',
    cost: 'Looser steering (wider turns) and louder wingbeats — the owl notices movement from farther away.',
  },
  {
    id: 'hide', name: 'THICK HIDE', key: '3',
    benefit: '+1 life (4 instead of 3) — one more mistake allowed.',
    cost: 'Heavier: slower acceleration, and the pulse cooldown is +0.5s.',
  },
];
