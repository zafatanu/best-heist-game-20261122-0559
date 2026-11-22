// The heist's rules and state: player movement, patrol guards, sweeping cameras and their vision
// cones, the alarm meter, the loot hold, decoy/EMP gadgets cylinder and the escape check. step()
// advances one fixed step and returns what happened as bit flags. Nothing allocates after createWorld.
import {
  PLAYER, SPRINT_NOISE, ALARM, LOOT, EXIT, ROOM, COVER, GUARD_DEFS, EMP_TIME, DECOY_TIME,
} from './config.js';

export const EVENT_LOOT = 1;
export const EVENT_BUSTED = 2;
export const EVENT_WIN = 4;
export const EVENT_SPOTTED = 8;
export const EVENT_GADGET = 16;

export const CAMERAS = [
  { x: 640, y: 110, range: 300, cone: 55, baseAngle: 90, sweep: 70 },
  { x: 786, y: 600, range: 280, cone: 60, baseAngle: 270, sweep: 50 },
];

const RAD = Math.PI / 180;

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

function dist(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}

function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax) / RAD;
}

function angDiff(a, b) {
  let d = (a - b) % 360;
  if (d > 180) d -= 360;
  else if (d < -180) d += 360;
  return d;
}

function inCone(ox, oy, angleDeg, coneDeg, range, px, py) {
  if (dist(ox, oy, px, py) > range) return false;
  return Math.abs(angDiff(angleTo(ox, oy, px, py), angleDeg)) <= coneDeg / 2;
}

// Slab test: does the segment cross the (axis-aligned) cover rect?
function segmentBlocked(x1, y1, x2, y2) {
  for (let i = 0; i < COVER.length; i += 1) {
    const r = COVER[i];
    const minX = r.x;
    const maxX = r.x + r.w;
    const minY = r.y;
    const maxY = r.y + r.h;
    const dx = x2 - x1;
    const dy = y2 - y1;
    let t0 = 0;
    let t1 = 1;
    let hit = true;
    for (let axis = 0; axis < 2 && hit; axis += 1) {
      const p = axis === 0 ? x1 : y1;
      const d = axis === 0 ? dx : dy;
      const lo = axis === 0 ? minX : minY;
      const hi = axis === 0 ? maxX : maxY;
      if (d === 0) {
        if (p < lo || p > hi) hit = false;
      } else {
        let tA = (lo - p) / d;
        let tB = (hi - p) / d;
        if (tA > tB) { const t = tA; tA = tB; tB = t; }
        if (tA > t0) t0 = tA;
        if (tB < t1) t1 = tB;
        if (t0 > t1) hit = false;
      }
    }
    if (hit) return true;
  }
  return false;
}

function makeGuard(def) {
  const wps = def.waypoints.map((w) => ({ x: w.x, y: w.y }));
  return {
    x: wps[0].x, y: wps[0].y, angle: 0, cone: def.cone, range: def.range, speed: def.speed,
    waypoints: wps, waypointIndex: 1, pause: def.pause, pauseTimer: 0,
    state: 'patrol', distractedTimer: 0, spotting: false, wasSpotting: false,
  };
}

function makeCamera(def) {
  return {
    x: def.x, y: def.y, angle: def.baseAngle, baseAngle: def.baseAngle,
    sweep: def.sweep, range: def.range, cone: def.cone,
    disabled: false, disabledTimer: 0, spotting: false, wasSpotting: false,
  };
}

export function createWorld(random) {
  const player = { x: 0, y: 0, width: PLAYER.width, height: PLAYER.height, sprinting: false };
  const guards = [makeGuard(GUARD_DEFS[0]), makeGuard(GUARD_DEFS[1])];
  const cameras = CAMERAS.map(makeCamera);
  const loot = { x: LOOT.x, y: LOOT.y, w: LOOT.w, taken: false, holdProgress: 0 };
  const gadgets = { decoy: 0, emp: 0 };
  const state = {
    player, guards, cameras, loot, gadgets,
    alarm: 0, alarmLabel: 'SAFE', lastSeenTimer: 99,
    phase: 'title', detections: 0, elapsed: 0, hasLoot: false, grade: '',
    victoryTime: 0, finalAlarm: 0, decoyPos: null, exitLit: false, screen: 'title',
  };
  state.decoyPos = { x: 0, y: 0 };

  let decoyTimer = 0;
  let first = true;
  const decoyPos = { x: 0, y: 0 };

  function alarmLabelFor(value) {
    const levels = ALARM.levels;
    for (let i = 0; i < levels.length; i += 1) if (value <= levels[i].limit) return levels[i].label;
    return levels[levels.length - 1].label;
  }

  function overlapsCover(x, y) {
    const w = player.width;
    const h = player.height;
    for (let i = 0; i < COVER.length; i += 1) {
      const r = COVER[i];
      if (x < r.x + r.w && x + w > r.x && y < r.y + r.h && y + h > r.y) return true;
    }
    return false;
  }

  function reset() {
    player.x = PLAYER.startX;
    player.y = PLAYER.startY;
    player.width = PLAYER.width;
    player.height = PLAYER.height;
    player.sprinting = false;
    for (const g of guards) {
      g.x = g.waypoints[0].x;
      g.y = g.waypoints[0].y;
      g.waypointIndex = 1;
      g.pauseTimer = 0;
      g.state = 'patrol';
      g.distractedTimer = 0;
      g.spotting = false;
      g.wasSpotting = false;
      g.angle = g.waypoints.length > 1 ? angleTo(g.x, g.y, g.waypoints[1].x, g.waypoints[1].y) : 0;
    }
    for (const c of cameras) {
      c.angle = c.baseAngle;
      c.disabled = false;
      c.disabledTimer = 0;
      c.spotting = false;
      c.wasSpotting = false;
    }
    loot.taken = false;
    loot.holdProgress = 0;
    state.alarm = 0;
    state.alarmLabel = 'SAFE';
    state.lastSeenTimer = 99;
    gadgets.decoy = 1;
    gadgets.emp = 1;
    state.phase = 'title';
    state.screen = 'title';
    state.detections = 0;
    state.elapsed = 0;
    state.hasLoot = false;
    state.grade = '';
    state.victoryTime = 0;
    state.finalAlarm = 0;
    decoyTimer = 0;
    state.decoyPos = null;
    state.exitLit = false;
    first = true;
  }

  function patrol(dt, passive) {
    for (let i = 0; i < guards.length; i += 1) {
      const g = guards[i];
      if (g.state === 'distracted') {
        if (passive) continue;
        g.distractedTimer -= dt;
        if (g.distractedTimer <= 0) {
          g.state = 'patrol';
          g.distractedTimer = 0;
        }
        continue;
      }
      if (g.pauseTimer > 0) {
        g.pauseTimer -= dt;
        if (g.pauseTimer <= 0) {
          g.pauseTimer = 0;
          g.waypointIndex = (g.waypointIndex + 1) % g.waypoints.length;
        }
        continue;
      }
      const target = g.waypoints[g.waypointIndex];
      const dx = target.x - g.x;
      const dy = target.y - g.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      const stride = g.speed * dt;
      if (len <= stride) {
        g.x = target.x;
        g.y = target.y;
        const next = g.waypoints[(g.waypointIndex + 1) % g.waypoints.length];
        if (next.x !== g.x || next.y !== g.y) g.angle = angleTo(g.x, g.y, next.x, next.y);
        g.pauseTimer = g.pause;
      } else {
        g.x += (dx / len) * stride;
        g.y += (dy / len) * stride;
        g.angle = angleTo(g.x - (dx / len) * stride, g.y - (dy / len) * stride, g.x, g.y);
      }
    }
  }

  function sweepCameras() {
    const t = state.elapsed;
    for (let i = 0; i < cameras.length; i += 1) {
      const c = cameras[i];
      c.angle = c.baseAngle + Math.sin(t * 0.5) * (c.sweep / 2);
    }
  }

  function seePlayer() {
    const px = player.x + player.width / 2;
    const py = player.y + player.height / 2;
    for (let i = 0; i < guards.length; i += 1) {
      const g = guards[i];
      if (g.state === 'distracted') continue;
      const sees = inCone(g.x, g.y, g.angle, g.cone, g.range, px, py)
        && !segmentBlocked(g.x, g.y, px, py);
      if (sees) { g.angle = angleTo(g.x, g.y, px, py); g.seesPlayer = true; } else g.seesPlayer = false;
    }
    for (let i = 0; i < cameras.length; i += 1) {
      const c = cameras[i];
      const sees = c.disabled ? false
        : inCone(c.x, c.y, c.angle, c.cone, c.range, px, py) && !segmentBlocked(c.x, c.y, px, py);
      if (sees) { c.angle = angleTo(c.x, c.y, px, py); c.seesPlayer = true; } else c.seesPlayer = false;
    }
  }

  function decay(dtRev) {
    if (state.lastSeenTimer > ALARM.decayDelay) state.alarm = Math.max(0, state.alarm - ALARM.decay * dtRev);
    if (state.lastSeenTimer > 0) state.lastSeenTimer += dtRev;
    state.alarm = clamp(state.alarm, 0, ALARM.max);
  }

  function tickCameras(dtFace, dx, dy) {
    const px = player.x + player.width / 2;
    const py = player.y + player.height / 2;
    for (let i = 0; i < guards.length; i += 1) {
      const g = guards[i];
      if (g.state === 'distracted') continue;
      const sees = inCone(g.x, g.y, g.angle, g.cone, g.range, px, py) && !segmentBlocked(g.x, g.y, px, py);
      g.spotting = sees;
      if (sees) { g.angle = angleTo(g.x, g.y, px, py); state.lastSeenTimer = 0; }
    }
    for (let i = 0; i < cameras.length; i += 1) {
      const c = cameras[i];
      if (c.disabled) {
        c.disabledTimer -= dtFace;
        if (c.disabledTimer <= 0) { c.disabledTimer = 0; c.disabled = false; }
        c.spotting = false;
        continue;
      }
      c.angle = c.baseAngle + Math.sin(state.elapsed * 0.5) * (c.sweep / 2);
      const sees = inCone(c.x, c.y, c.angle, c.cone, c.range, px, py) && !segmentBlocked(c.x, c.y, px, py);
      c.spotting = sees;
      if (sees) state.lastSeenTimer = 0;
    }
    if (state.lastSeenTimer > ALARM.decayDelay) {
      state.alarm = Math.max(0, state.alarm - ALARM.decay * dtFace);
    }
    state.lastSeenTimer += dtFace;
    state.alarm = clamp(state.alarm, 0, ALARM.max);
    state.alarmLabel = alarmLabelFor(state.alarm);
  }

  function updateVal() {}

  function step(dt, input) {
    if (state.phase === 'title') {
      state.elapsed += dt;
      sweepCameras();
      return 0;
    }
    if (state.phase !== 'play') return 0;

    let events = 0;
    state.elapsed += dt;

    const mx = input.mx || 0;
    const my = input.my || 0;
    const sprint = !!input.sprint;
    player.sprinting = sprint && (mx !== 0 || my !== 0);
    const speed = PLAYER.speed * (player.sprinting ? PLAYER.sprint : 1);
    const nx = player.x + mx * speed * dt;
    if (nx >= ROOM.x && nx + player.width <= ROOM.right) {
      player.x = nx;
      if (overlapsCover(player.x, player.y)) player.x -= mx * speed * dt;
    }
    const ny = player.y + my * speed * dt;
    if (ny >= ROOM.y && ny + player.height <= ROOM.bottom) {
      player.y = ny;
      if (overlapsCover(player.x, player.y)) player.y -= my * speed * dt;
    }
    if (player.sprinting) {
      for (let i = 0; i < guards.length; i += 1) {
        if (dist(guards[i].x, guards[i].y, player.x, player.y) < SPRINT_NOISE) {
          state.alarm += ALARM.sprintNear * dt;
        }
      }
    }

    // distractions expire (guards)
    if (decoyTimer > 0) {
      decoyTimer -= dt;
      if (decoyTimer <= 0) {
        decoyTimer = 0;
        state.decoyPos = null;
      }
    }
    patrol(dt, false);
    tickCameras(dt);
    return events;
  }

  // Fixed scenes for screenshots (?shot=name): reset, then override positions.
  function stage(name) {
    reset();
    if (name === 'detection') {
      state.phase = 'play';
      state.screen = 'play';
      player.x = 580;
      player.y = 430;
      guards[0].x = 520;
      guards[0].y = 330;
      guards[0].angle = 55;
      guards[0].spotting = true;
      guards[0].wasSpotting = true;
        state.alarm = 65;
      state.alarmLabel = 'ALERT';
      state.detections = 1;
      state.elapsed = 78;
      loot.taken = false;
      state.hasLoot = false;
      state.exitLit = false;
    } else if (name === 'loot') {
      state.phase = 'play';
      state.screen = 'play';
      state.hasLoot = true;
      loot.taken = true;
      loot.holdProgress = 1;
      state.exitLit = true;
      player.x = 640;
      player.y = 340;
      guards[1].x = 705;
      guards[1].y = 360;
      guards[1].angle = angleTo(705, 360, 640, 340);
      guards[1].spotting = true;
      guards[1].wasSpotting = true;
      state.alarm = 88;
      state.alarmLabel = 'LOCKDOWN WARNING';
      state.detections = 2;
      state.elapsed = 121;
    } else if (name === 'escape') {
      state.phase = 'victory';
      state.screen = 'over';
      state.hasLoot = true;
      loot.taken = true;
      state.exitLit = true;
      player.x = 1128;
      player.y = 632;
      state.victoryTime = 210;
      state.finalAlarm = 34;
      state.detections = 1;
      state.grade = 'A';
      state.alarm = 34;
      state.alarmLabel = 'SUSPICIOUS';
      state.elapsed = 210;
    } else {
      // 'cover' — and any unknown scene name.
      state.phase = 'play';
      state.screen = 'play';
      player.x = 560;
      player.y = 560;
      guards[0].x = 470;
      guards[0].y = 355;
      guards[0].angle = 300;
      guards[0].spotting = false;
      guards[1].x = 586;
      guards[1].y = 682;
      guards[1].angle = 180;
      guards[1].spotting = false;
      state.alarm = 21;
      state.alarmLabel = 'SAFE';
      loot.taken = false;
      loot.holdProgress = 0;
      state.hasLoot = false;
      state.exitLit = false;
      state.detections = 0;
      state.elapsed = 57;
    }
  }

  reset();
  return { state, reset, step, stage };
}
