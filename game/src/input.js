// ECHOWING — input. One job: keyboard + mouse state, nothing else.
// Edge-triggered presses are queued on keydown and consumed by pressed() —
// a quick tap must not be lost if keydown and keyup land between two frames.
export function createInput() {
  const keys = new Set();
  const pressedQueue = new Set();
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let mouseSteer = false;
  let pulseQueued = false;
  let clickQueued = null; // {x, y} of the last mousedown, consumed once

  function codeOf(e) {
    return e.key.length === 1 ? e.key.toLowerCase() : e.key;
  }
  function onKeyDown(e) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
      e.preventDefault();
    }
    const c = codeOf(e);
    if (!keys.has(c)) pressedQueue.add(c);
    keys.add(c);
    if (c === ' ') pulseQueued = true;
  }
  function onKeyUp(e) {
    keys.delete(codeOf(e));
  }
  function onMouseMove(e) {
    const r = e.target.getBoundingClientRect();
    mouseX = (e.clientX - r.left) * (1280 / r.width);
    mouseY = (e.clientY - r.top) * (720 / r.height);
  }
  function onMouseDown(e) {
    mouseDown = true;
    mouseSteer = true;
    pulseQueued = true;
    onMouseMove(e);
    clickQueued = { x: mouseX, y: mouseY };
  }
  function onMouseUp() {
    mouseDown = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  return {
    // Held-state queries (call every frame).
    left() { return keys.has('ArrowLeft') || keys.has('a'); },
    right() { return keys.has('ArrowRight') || keys.has('d'); },
    up() { return keys.has('ArrowUp') || keys.has('w'); },
    down() { return keys.has('ArrowDown') || keys.has('s'); },
    shift() { return keys.has('Shift'); },
    roost() { return keys.has('q'); },
    // Edge-triggered: true once per press, even for a tap between frames.
    pressed(code) {
      if (pressedQueue.has(code)) {
        pressedQueue.delete(code);
        return true;
      }
      return false;
    },
    pulsePressed() {
      if (pulseQueued) {
        pulseQueued = false;
        return true;
      }
      return false;
    },
    // The last mousedown position, once (for clicking relic cards).
    clicked() {
      const c = clickQueued;
      clickQueued = null;
      return c;
    },
    // Discard any queued click (e.g. a mousedown from before a screen opened).
    clearClick() { clickQueued = null; },
    mouse() { return { x: mouseX, y: mouseY, steer: mouseSteer && !this.anyKey() }; },
    anyKey() {
      return keys.has('ArrowLeft') || keys.has('ArrowRight') || keys.has('ArrowUp') ||
        keys.has('ArrowDown') || keys.has('a') || keys.has('d') || keys.has('w') || keys.has('s');
    },
    clearMouseSteer() { mouseSteer = false; },
  };
}
