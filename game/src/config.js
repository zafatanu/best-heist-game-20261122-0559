// THE LAST VAULT — every tuning number and palette colour lives here.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size. One room, one diamond.

export const FIELD = { width: 1280, height: 720, groundY: 664 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Longest frame the loop will consume; anything longer is a stall, not a slide. */
export const MAX_FRAME = 0.25;

/** Where the best result is kept between visits (this browser only). */
export const BEST_KEY = 'last-vault.best';

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const FONT_MONO = 'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace';

// ---------------------------------------------------------------------------
// Palette — cyan = player, red = danger, amber = suspicion, gold = loot,
// teal = safe cover, white = architecture.
// ---------------------------------------------------------------------------
export const PALETTE = {
  ink: '#020617',
  navy: '#0d1526',
  floor: '#0d1526',
  floorAlt: '#0f1c33',
  floorLine: '#1c2b47',
  gold: '#d4af37',
  goldLight: '#f7e9a0',
  goldDim: '#7a6420',
  cyan: '#22d3ee',
  cyanDim: '#0e7490',
  red: '#ef4444',
  redDim: '#7f1d1d',
  amber: '#f59e0b',
  amberDim: '#78350f',
  teal: '#14b8a6',
  tealDim: '#0f4a45',
  white: '#f8fafc',
  muted: '#64748b',
  wall: '#0a101f',
};
export const COLORS = PALETTE;
export const C = PALETTE;

// ---------------------------------------------------------------------------
// The thief.
// ---------------------------------------------------------------------------
export const PLAYER = {
  width: 26,
  height: 26,
  speed: 256,
  sprint: 1.62,
  accel: 14,
  reach: 52,
  startX: 150,
  startY: 600,
};

/** Sprinting raises noise: guards hear the thief inside this radius. */
export const SPRINT_NOISE = 170;

// ---------------------------------------------------------------------------
// Alarm, 0..100. Gradual suspicion, never an instant loss.
// ---------------------------------------------------------------------------
export const ALARM = {
  max: 100,
  levels: [
    { limit: 24, label: 'SAFE' },
    { limit: 49, label: 'SUSPICIOUS' },
    { limit: 74, label: 'ALERT' },
    { limit: 99, label: 'LOCKDOWN WARNING' },
    { limit: 100, label: 'BUSTED' },
  ],
  inCone: 11.5,
  sprintNear: 3.4,
  decay: 6.0,
  decayDelay: 0.9,
  lootReturn: 6,
};

/** Loot: hold E this many seconds next to the glass display. */
export const LOOT = {
  x: 620,
  y: 316,
  w: 78,
  radius: 58,
  holdTime: 2.5,
};

/** Extraction door on the south wall. */
export const EXIT = {
  x: 786,
  y: 644,
  w: 96,
  radius: 46,
};

// ---------------------------------------------------------------------------
// Room layout: one rectangle, five zones.
// ---------------------------------------------------------------------------
export const ROOM = { x: 64, y: 96, w: 1152, h: 568 };
ROOM.right = ROOM.x + ROOM.w;
ROOM.bottom = ROOM.y + ROOM.h;
ROOM.cx = ROOM.x + ROOM.w / 2;
ROOM.cy = ROOM.y + ROOM.h / 2;

/** Cover blocks line of sight AND the thief's movement. */
export const COVER = [
  { id: 'statue', kind: 'statue', x: 402, y: 296, w: 54, h: 54 },
  { id: 'cabinet', kind: 'cabinet', x: 846, y: 468, w: 44, h: 92 },
  { id: 'pillar', kind: 'pillar', x: 604, y: 424, w: 52, h: 52 },
];

// ---------------------------------------------------------------------------
// Guards: an early pair, more once the diamond is out of its case.
// ---------------------------------------------------------------------------
export const GUARD_DEFS = [
  {
    cone: 78,
    range: 236,
    speed: 78,
    waypoints: [
      { x: 250, y: 300 },
      { x: 610, y: 300 },
    ],
    pause: 1.3,
  },
  {
    cone: 72,
    range: 250,
    speed: 66,
    waypoints: [
      { x: 700, y: 380 },
      { x: 700, y: 268 },
      { x: 850, y: 268 },
      { x: 850, y: 380 },
    ],
    pause: 0.5,
  },
  {
    cone: 80,
    range: 250,
    speed: 84,
    waypoints: [
      { x: 300, y: 420 },
      { x: 300, y: 560 },
      { x: 560, y: 560 },
    ],
    pause: 0.9,
    afterLoot: true,
  },
  {
    cone: 76,
    range: 260,
    speed: 90,
    waypoints: [
      { x: 1024, y: 300 },
      { x: 1080, y: 430 },
      { x: 940, y: 430 },
    ],
    pause: 0.7,
    afterLoot: true,
  },
];

/** Cameras sleep for EMP_TIME seconds after an EMP pulse. */
export const EMP_TIME = 3;
export const DECOY_TIME = 4;
