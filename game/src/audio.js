// ECHOWING — sound. One job: synthesized WebAudio only, no audio files.
// One AudioContext, one tone() helper, resumed on the first gesture.
export function createAudio() {
  let ctx = null;
  let drone = null;
  let droneGain = null;
  let muted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    return ctx;
  }

  function tone(freq, dur, type, vol, slideTo, delay) {
    const c = ensure();
    if (!c || muted) return;
    const t0 = c.currentTime + (delay || 0);
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.12, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(c.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  function noise(dur, vol, freq) {
    const c = ensure();
    if (!c || muted) return;
    const t0 = c.currentTime;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = freq || 400;
    const g = c.createGain();
    g.gain.value = vol || 0.2;
    src.connect(f).connect(g).connect(c.destination);
    src.start(t0);
  }

  return {
    unlock() { ensure(); },
    // Soft ping + a descending echo — the pulse.
    ping() {
      tone(920, 0.28, 'sine', 0.16, 430);
      tone(920, 0.5, 'sine', 0.05, 430, 0.16);
    },
    // Two-note chime — eating a moth.
    chime(chain) {
      const base = 660 + Math.min(chain, 5) * 40;
      tone(base, 0.14, 'triangle', 0.14);
      tone(base * 1.5, 0.2, 'triangle', 0.12, null, 0.07);
    },
    // Low thud — a wall or owl hit.
    thud() { noise(0.18, 0.3, 220); tone(90, 0.2, 'sine', 0.25, 45); },
    // Low hoot — the owl stirs.
    hoot() {
      tone(240, 0.22, 'sine', 0.12, 200);
      tone(240, 0.3, 'sine', 0.1, 190, 0.3);
    },
    // Win fanfare — ascending arpeggio.
    fanfare() {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.32, 'triangle', 0.13, null, i * 0.11));
    },
    // Lose bell — a low toll.
    bell() {
      tone(196, 0.9, 'sine', 0.16, 180);
      tone(196, 0.9, 'sine', 0.08, 180, 0.5);
    },
    // Exit opens — a bright swell.
    open() {
      tone(392, 0.5, 'sine', 0.1, 784);
      tone(784, 0.6, 'sine', 0.08, 1175, 0.12);
    },
    // Ambient drip drone — starts on first gesture, tenser with depth.
    startDrone(depth) {
      const c = ensure();
      if (!c || drone) return;
      drone = c.createOscillator();
      drone.type = 'sine';
      drone.frequency.value = 55;
      const lfo = c.createOscillator();
      lfo.frequency.value = 0.07;
      const lfoGain = c.createGain();
      lfoGain.gain.value = 12;
      lfo.connect(lfoGain).connect(drone.frequency);
      droneGain = c.createGain();
      droneGain.gain.value = 0.035;
      drone.connect(droneGain).connect(c.destination);
      drone.start();
      lfo.start();
      this.setTension(depth || 1);
    },
    setTension(depth) {
      if (!droneGain) return;
      droneGain.gain.setTargetAtTime(0.03 + depth * 0.008, ctx.currentTime, 0.5);
    },
    // A single cave drip, called on a slow timer by the game loop.
    drip() { tone(1200 + Math.random() * 500, 0.09, 'sine', 0.03, 300); },
  };
}
