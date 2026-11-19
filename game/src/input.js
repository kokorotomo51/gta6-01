// Keyboard and mouse input. Held keys steer and drive; one-shot presses
// (confirm, pause, interact, weapon switch, shop keys) are queued as flags
// and taken once by the loop, so a press between two frames is never lost.
// The mouse aims on foot: the renderer hands the camera in each frame so the
// aim point converts from screen to world coordinates.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_NEXT_MISSION = 8;
export const ACTION_WEAPON = 16;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const INTERACT = new Set(['KeyE']);
const NEXT_MISSION = new Set(['KeyN']);
const WEAPON = new Set(['KeyQ']);
const RELOAD = new Set(['KeyR']);
const MUTE = new Set(['KeyM']);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDownFlag = false;
  let mouseSeen = false;
  // World aim, updated by the loop once the camera is known.
  let aimX = 0;
  let aimY = 0;
  let onMute = null;
  let onReload = null;

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) {
      held.add(event.code);
      event.preventDefault();
      return;
    }
    if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
      event.preventDefault();
      return;
    }
    if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
      return;
    }
    if (INTERACT.has(event.code)) {
      if (!event.repeat) actions |= ACTION_INTERACT;
      return;
    }
    if (NEXT_MISSION.has(event.code)) {
      if (!event.repeat) actions |= ACTION_NEXT_MISSION;
      return;
    }
    if (WEAPON.has(event.code)) {
      if (!event.repeat) actions |= ACTION_WEAPON;
      return;
    }
    if (RELOAD.has(event.code)) {
      if (!event.repeat && onReload) onReload();
      return;
    }
    if (MUTE.has(event.code)) {
      if (!event.repeat && onMute) onMute();
      return;
    }
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') held.add(event.code);
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  window.addEventListener('blur', () => {
    held.clear();
    mouseDownFlag = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    const kx = canvas.width / Math.max(1, rect.width);
    const ky = canvas.height / Math.max(1, rect.height);
    mouseX = (event.clientX - rect.left) * kx;
    mouseY = (event.clientY - rect.top) * ky;
    mouseSeen = true;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    const kx = canvas.width / Math.max(1, rect.width);
    const ky = canvas.height / Math.max(1, rect.height);
    mouseX = (event.clientX - rect.left) * kx;
    mouseY = (event.clientY - rect.top) * ky;
    mouseSeen = true;
    mouseDownFlag = true;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => {
    mouseDownFlag = false;
  });

  function anyOf(set) {
    for (const code of set) if (held.has(code)) return true;
    return false;
  }

  return {
    held(code) { return held.has(code); },
    /** -1/0/1 steering for a car, and the on-foot move vector's x. */
    steer() { return (anyOf(RIGHT) ? 1 : 0) - (anyOf(LEFT) ? 1 : 0); },
    /** -1/0/1 throttle for a car. */
    throttle() { return (anyOf(UP) ? 1 : 0) - (anyOf(DOWN) ? 1 : 0); },
    /** Normalised on-foot movement vector. */
    moveVector() {
      const x = (anyOf(RIGHT) ? 1 : 0) - (anyOf(LEFT) ? 1 : 0);
      const y = (anyOf(DOWN) ? 1 : 0) - (anyOf(UP) ? 1 : 0);
      const len = Math.hypot(x, y);
      if (len === 0) return { x: 0, y: 0 };
      return { x: x / len, y: y / len };
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    mouseDown() { return mouseDownFlag; },
    mouseActive() { return mouseSeen; },
    get aimX() { return aimX; },
    get aimY() { return aimY; },
    /** Convert the mouse position to world coordinates for this frame. */
    setAim(camera, scale, offsetX, offsetY) {
      aimX = camera.x + (mouseX - offsetX) / scale;
      aimY = camera.y + (mouseY - offsetY) / scale;
    },
    onMuteKey(fn) { onMute = fn; },
    onReloadKey(fn) { onReload = fn; },
  };
}
