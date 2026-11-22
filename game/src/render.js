// Drawing only: the heist world's state and the current screen in, pixels out.
import { FIELD, PALETTE, FONT, ROOM, COVER, LOOT, EXIT } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const PANEL_WIDTH = 680;
const DEG = Math.PI / 180;

function alarmColor(label) {
  if (label === 'SAFE') return PALETTE.teal;
  if (label === 'SUSPICIOUS' || label === 'ALERT') return PALETTE.amber;
  return PALETTE.red;
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  resize();
  window.addEventListener('resize', resize);

  function text(value, x, y, size, color, align = 'left') {
    context.font = size + 'px ' + FONT;
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function circle(x, y, radius, color) {
    context.fillStyle = color;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }

  function wedge(x, y, angleDeg, coneDeg, range, color) {
    const facing = angleDeg * DEG;
    const half = (coneDeg / 2) * DEG;
    context.save();
    context.globalAlpha = 0.25;
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(x, y);
    context.arc(x, y, range, facing - half, facing + half);
    context.closePath();
    context.fill();
    context.restore();
  }

  function rect(r, color) {
    context.fillStyle = color;
    context.fillRect(r.x, r.y, r.w, r.h);
  }

  function drawField(state) {
    context.fillStyle = PALETTE.floor;
    context.fillRect(0, 0, FIELD.width, FIELD.height);

    context.strokeStyle = PALETTE.gold;
    context.lineWidth = 3;
    context.strokeRect(ROOM.x, ROOM.y, ROOM.w, ROOM.h);

    for (const piece of COVER) {
      context.fillStyle = PALETTE.teal;
      context.fillRect(piece.x, piece.y, piece.w, piece.h);
    }

    const loot = state.loot;
    if (!loot.taken) {
      context.save();
      context.globalAlpha = 0.3;
      circle(loot.x, loot.y, 26, PALETTE.gold);
      context.restore();
      context.save();
      context.translate(loot.x, loot.y);
      context.rotate(Math.PI / 4);
      context.fillStyle = PALETTE.gold;
      context.fillRect(-9, -9, 18, 18);
      context.restore();
      if (loot.holdProgress > 0 && loot.holdProgress < 1) {
        rect({ x: loot.x - 20, y: loot.y - 30, w: 40, h: 5 }, PALETTE.muted);
        rect({ x: loot.x - 20, y: loot.y - 30, w: 40 * loot.holdProgress, h: 5 }, PALETTE.gold);
      }
    } else {
      rect({ x: loot.x - 14, y: loot.y - 14, w: 28, h: 28 }, PALETTE.muted);
    }

    rect(EXIT, state.exitLit ? PALETTE.gold : PALETTE.muted);
    text('EXIT', EXIT.x + EXIT.w / 2, EXIT.y - 6, 14, PALETTE.muted, 'center');

    for (const camera of state.cameras) {
      if (camera.disabled) {
        rect({ x: camera.x - 7, y: camera.y - 7, w: 14, h: 14 }, PALETTE.muted);
        continue;
      }
      rect({ x: camera.x - 7, y: camera.y - 7, w: 14, h: 14 }, PALETTE.grey);
      wedge(camera.x, camera.y, camera.angle, camera.cone, camera.range, camera.spotting ? PALETTE.red : PALETTE.amber);
    }

    for (const guard of state.guards) {
      wedge(guard.x, guard.y, guard.angle, guard.cone, guard.range, guard.spotting ? PALETTE.red : PALETTE.amber);
      circle(guard.x, guard.y, 9, PALETTE.red);
    }

    const player = state.player;
    circle(player.x, player.y, 8, PALETTE.cyan);
  }

  function drawHud(state) {
    text('ALARM ' + state.alarmLabel, 40, 34, 16, PALETTE.muted);
    text(Math.round(state.alarm) + '%', 40, 58, 20, alarmColor(state.alarmLabel));
    const x = 40, y = 66, w = 420, h = 16;
    rect({ x, y, w, h }, PALETTE.panel);
    rect({ x, y, w: (w * Math.max(0, Math.min(100, state.alarm))) / 100, h }, alarmColor(state.alarmLabel));

    text('Q DECOY x' + state.gadgets.decoy + '    F EMP x' + state.gadgets.emp, 40, 118, 18, PALETTE.muted);

    const objective = state.hasLoot ? 'DIAMOND SECURED — REACH THE EXIT' : 'STEAL THE HEART. REACH EXTRACTION.';
    text(objective, 40, 146, 18, PALETTE.gold);

    text('DETECTIONS ' + state.detections, FIELD.width - 40, 34, 16, PALETTE.muted, 'right');
    text('TIME ' + Math.round(state.elapsed) + 's', FIELD.width - 40, 60, 20, PALETTE.muted, 'right');
  }

  function drawPanel(title, lines, prompt) {
    const top = FIELD.height / 2 - 120;
    context.fillStyle = PALETTE.panel;
    context.fillRect((FIELD.width - PANEL_WIDTH) / 2, top, PANEL_WIDTH, 240);
    text(title, FIELD.width / 2, top + 60, 48, PALETTE.gold, 'center');
    lines.forEach((line, index) => {
      text(line, FIELD.width / 2, top + 108 + index * 30, 22, PALETTE.text, 'center');
    });
    text(prompt, FIELD.width / 2, top + 240 - 28, 24, PALETTE.gold, 'center');
  }

  function draw(state, screen, best) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.ink;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);

    drawField(state);

    if (screen === SCREEN_PLAY) {
      drawHud(state);
    } else if (screen === SCREEN_TITLE) {
      drawPanel('THE LAST VAULT', [
        'One night. One diamond. Three ways in. One way out.',
        'WASD move · Shift sprint · E loot · Q decoy · F EMP · R restart',
      ], 'Press Space or click to start');
    } else if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The guards wait.'], 'Press P to resume');
    } else if (screen === SCREEN_OVER) {
      if (state.phase === 'victory') {
        drawPanel('CLEAN GETAWAY', [
          'Grade ' + state.grade,
          'Time ' + Math.round(state.victoryTime) + 's · ' + state.detections + ' detections · Alarm ' + Math.round(state.finalAlarm),
        ], 'Press Space to play again');
      } else {
        drawPanel('BUSTED', [
          'The alarm hit 100.',
          state.detections + ' detections · ' + Math.round(state.elapsed) + 's',
        ], 'Press R to try again');
      }
    }
  }

  return { draw };
}
