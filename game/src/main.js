// Neon Void — boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between four screens: title, play, paused and game over.
//
// ?seed=N fixes the run's random stream. ?shot=start|play|end (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady for a
// screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BOMB, EVENT_HIT, EVENT_OVER, EVENT_WAVE } from './world.js';
import { ACTION_BOMB, ACTION_CONFIRM, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createParticles } from './particles.js';
import { createGrid } from './grid.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { autopilot, stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const random = createRandom(seed);
const particles = createParticles(random);
const grid = createGrid();
const audio = createAudio();
// Effects the world calls: particles, the warp grid and sound, wired here in one place.
const fx = {
  burst: (x, y, color, count, speed, size, life) => particles.burst(x, y, color, count, speed, size, life),
  trail: (x, y, vx, vy, color) => particles.trail(x, y, vx, vy, color),
  popup: (x, y, value, color, size) => particles.popup(x, y, value, color, size),
  ring: (x, y, maxRadius, color, width, life) => particles.ring(x, y, maxRadius, color, width, life),
  impulse: (x, y, strength, radius) => grid.impulse(x, y, strength, radius),
  shootSound: () => audio.shoot(),
  pickupSound: (multiplier) => audio.pickup(multiplier),
  bombSound: () => audio.bomb(),
  hitSound: () => audio.hit(),
  waveSound: () => audio.wave(),
  extraLifeSound: () => audio.extraLife(),
  gameOverSound: () => audio.gameOver(),
};
const world = createWorld(random, fx);
const renderer = createRenderer(canvas, particles, grid);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, null);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas, (x, y) => renderer.fieldPoint(x, y));
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  // A bomb press fires on the next fixed step only, never once per catch-up step.
  let bombPending = false;

  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    particles.clear();
    grid.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`Playing. 3 lives, 3 nova bombs.`);
  }

  function endGame() {
    screen = SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(`Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function handleActions(actions) {
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
      world.step(STEP, autopilot(world.state, false), true);
      return;
    }
    const move = input.move();
    const bomb = bombPending;
    bombPending = false;
    const events = world.step(
      STEP,
      { mx: move.x, my: move.y, aim: input.aim(), firing: input.isFiring(), bomb },
      false,
    );
    if (events & EVENT_OVER) endGame();
    else if (events & EVENT_HIT) announce(world.state.lives === 1 ? 'Hit. 1 life left.' : `Hit. ${world.state.lives} lives left.`);
    else if (events & EVENT_WAVE) announce(`Wave ${world.state.wave}.`);
    else if (events & EVENT_BOMB) announce(`Nova bomb. ${world.state.bombs} left.`);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    accumulator += dt;
    last = now;
    const actions = input.takeActions();
    handleActions(actions);
    if (actions & ACTION_BOMB) bombPending = true;
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    particles.update(dt);
    grid.update(dt);
    renderer.draw(world.state, screen, best, input.aim());
  }

  // Leaving the tab pauses a running game rather than letting the swarm close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });
  // Sound starts on the first gesture; M mutes it.
  window.addEventListener('pointerdown', () => audio.unlock(), { once: true });
  window.addEventListener('keydown', (event) => {
    audio.unlock();
    if (event.code === 'KeyM') announce(audio.toggleMute() ? 'Muted.' : 'Sound on.');
  });

  announce('Neon Void. Press Enter or click to launch.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
