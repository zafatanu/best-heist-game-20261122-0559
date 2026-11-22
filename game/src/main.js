// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the renderer paints what is there. The game
// moves between four screens: title, play, paused and over.
//
// ?seed=N fixes the layout and the guards' patrol timings. ?shot=cover|detection|loot|escape (with
// &seed=N) stages that scene instead of running the loop, paints it twice and sets window.__shotReady
// for a screenshot.
import { BEST_KEY, MAX_FRAME, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  createWorld,
  EVENT_BUSTED,
  EVENT_GADGET,
  EVENT_LOOT,
  EVENT_SPOTTED,
  EVENT_WIN,
} from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

const IDLE = { mx: 0, my: 0, sprint: false, interact: false, decoy: false, emp: false };

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);

function readBest() {
  try {
    const value = Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '', 10);
    return Number.isInteger(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the record time then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear each change of screen.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    world.state.phase = 'play';
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Steal the Heart of Aurelia.');
  }

  // The clock stops on a clean getaway, so the run time is the score; lower is better.
  function endGame(win) {
    screen = SCREEN_OVER;
    if (win) {
      const time = Math.round(world.state.elapsed);
      if (best === 0 || time < best) {
        best = time;
        saveBest(best);
      }
      announce(`Clean getaway. ${time}s. Best ${best}s.`);
    } else {
      announce('Busted.');
    }
  }

  function handleActions(actions) {
    if (actions & ACTION_RESTART && screen !== SCREEN_TITLE) {
      startGame();
      return;
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) startGame();
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      // The courtyard backdrop keeps moving behind the title, but nothing can happen there.
      world.step(STEP, IDLE);
      return;
    }
    const presses = input.takePresses();
    if (presses.restart) {
      startGame();
      return;
    }
    const events = world.step(STEP, {
      mx: input.direction(),
      my: input.vertical(),
      sprint: input.sprint(),
      interact: presses.interact,
      decoy: presses.decoy,
      emp: presses.emp,
    });
    if (events & EVENT_WIN) endGame(true);
    else if (events & EVENT_BUSTED) endGame(false);
    else if (events & EVENT_LOOT) announce('Diamond secured. Reach the exit.');
    else if (events & EVENT_SPOTTED) announce('Spotted.');
    else if (events & EVENT_GADGET) announce('Gadget armed.');
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions(input.takeActions());
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  // Leaving the tab pauses a running heist rather than letting the guards walk unwatched.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('THE LAST VAULT. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
