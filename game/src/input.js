// Keyboard and pointer input. Held keys give a steering direction; one-shot presses (start or
// restart, pause) are queued as bit flags and taken once by the loop, so a press between two
// frames is never lost and never counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_DECOY = 8;
export const ACTION_EMP = 16;
export const ACTION_RESTART = 32;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const SPRINT = new Set(['ShiftLeft', 'ShiftRight']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const INTERACT = new Set(['KeyE']);
const DECOY = new Set(['KeyQ']);
const EMP = new Set(['KeyF']);
const RESTART = new Set(['KeyR']);

export function createInput(target) {
  let left = false;
  let right = false;
  let up = false;
  let down = false;
  let actionSprint = false;
  let actions = 0;
  let interact = false;
  let decoy = false;
  let emp = false;
  let restart = false;

  function releaseAll() {
    left = false;
    right = false;
    up = false;
    down = false;
    actionSprint = false;
    interact = false;
    decoy = false;
    emp = false;
    restart = false;
  }

  window.addEventListener('keydown', (event) => {
    if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (UP.has(event.code)) up = true;
    else if (DOWN.has(event.code)) down = true;
    else if (SPRINT.has(event.code)) actionSprint = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (INTERACT.has(event.code)) {
      if (!event.repeat) {
        actions |= ACTION_INTERACT;
        interact = true;
      }
    } else if (DECOY.has(event.code)) {
      if (!event.repeat) {
        actions |= ACTION_DECOY;
        decoy = true;
      }
    } else if (EMP.has(event.code)) {
      if (!event.repeat) {
        actions |= ACTION_EMP;
        emp = true;
      }
    } else if (RESTART.has(event.code)) {
      if (!event.repeat) {
        actions |= ACTION_RESTART;
        restart = true;
      }
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
    else if (UP.has(event.code)) up = false;
    else if (DOWN.has(event.code)) down = false;
    else if (SPRINT.has(event.code)) actionSprint = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', releaseAll);
  target.addEventListener('pointerdown', () => {
    actions |= ACTION_CONFIRM;
  });

  return {
    /** -1 for left, 1 for right, 0 for neither or both. */
    direction() {
      return (right ? 1 : 0) - (left ? 1 : 0);
    },
    /** -1 for up, 1 for down, 0 for neither or both. */
    vertical() {
      return (down ? 1 : 0) - (up ? 1 : 0);
    },
    /** Sprint is a held modifier, not a press. */
    sprint() {
      return actionSprint;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** The one-shot presses since the last call, one-shot flags cleared by the take. */
    takePresses() {
      const taken = { interact, decoy, emp, restart };
      interact = false;
      decoy = false;
      emp = false;
      restart = false;
      return taken;
    },
    /** Everything the world step needs in one read. */
    readState() {
      return {
        mx: (right ? 1 : 0) - (left ? 1 : 0),
        my: (down ? 1 : 0) - (up ? 1 : 0),
        sprint: actionSprint,
        interact,
        decoy,
        emp,
      };
    },
  };
}
