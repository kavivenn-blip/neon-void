// Keyboard and mouse input. Held keys give a steering vector; one-shot presses (start or
// restart, pause, bomb) are queued as bit flags and taken once by the loop, so a press between
// two frames is never lost and never counted twice. The mouse aims: until it first moves, the
// ship auto-aims at the nearest enemy, so the game also plays keyboard-only.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_BOMB = 4;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const BOMB = new Set(['Space', 'ShiftLeft', 'ShiftRight']);

export function createInput(target, toField) {
  const keys = { up: false, down: false, left: false, right: false };
  let actions = 0;
  let firing = false;
  let mouseSeen = false;
  let aimX = 0;
  let aimY = 0;

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) keys.up = true;
    else if (DOWN.has(event.code)) keys.down = true;
    else if (LEFT.has(event.code)) keys.left = true;
    else if (RIGHT.has(event.code)) keys.right = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (BOMB.has(event.code)) {
      if (!event.repeat) actions |= ACTION_BOMB;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) keys.up = false;
    else if (DOWN.has(event.code)) keys.down = false;
    else if (LEFT.has(event.code)) keys.left = false;
    else if (RIGHT.has(event.code)) keys.right = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    keys.up = keys.down = keys.left = keys.right = false;
    firing = false;
  });

  target.addEventListener('pointermove', (event) => {
    const point = toField(event.clientX, event.clientY);
    aimX = point.x;
    aimY = point.y;
    mouseSeen = true;
  });
  target.addEventListener('pointerdown', (event) => {
    const point = toField(event.clientX, event.clientY);
    aimX = point.x;
    aimY = point.y;
    mouseSeen = true;
    if (event.button === 0) firing = true;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', (event) => {
    if (event.button === 0) firing = false;
  });
  // Right click is a bomb too, without opening the menu over the game.
  target.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    actions |= ACTION_BOMB;
  });

  return {
    /** Steering vector, each component -1, 0 or 1. */
    move() {
      return { x: (keys.right ? 1 : 0) - (keys.left ? 1 : 0), y: (keys.down ? 1 : 0) - (keys.up ? 1 : 0) };
    },
    /** Where the gun points, in field coordinates; null until the mouse first moves. */
    aim() {
      return mouseSeen ? { x: aimX, y: aimY } : null;
    },
    /** True while the left mouse button is held. */
    isFiring() {
      return firing;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
