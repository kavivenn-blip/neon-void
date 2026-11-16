// The screenshot scenes behind ?shot=start|play|end. Each one plays the real rules forward
// from a fresh world for a fixed number of steps, steered by a simple autopilot (flee the
// nearest threats, chase the nearest shard, shoot the nearest enemy, nova when surrounded),
// so the frame is what a short game really looks like and the same seed always gives the
// same frame. The end scene's pilot is reckless — no nova, no fleeing — so it is caught out
// once the swarm thickens, as a hurried player is.
import { FIELD, STEP } from './config.js';
import { EVENT_OVER } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 30;
const END_LIMIT_SECONDS = 600;
const SAMPLE = 1 / 60;

function nearestEnemy(state, maxD) {
  let best = null;
  let bestD = maxD * maxD;
  for (let i = 0; i < state.enemies.length; i += 1) {
    const e = state.enemies[i];
    if (!e.active) continue;
    const dx = e.x - state.player.x;
    const dy = e.y - state.player.y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

function nearestShard(state, maxD) {
  let best = null;
  let bestD = maxD * maxD;
  for (let i = 0; i < state.shards.length; i += 1) {
    const s = state.shards[i];
    if (!s.active) continue;
    const dx = s.x - state.player.x;
    const dy = s.y - state.player.y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

function countNear(state, radius) {
  let n = 0;
  const r2 = radius * radius;
  for (let i = 0; i < state.enemies.length; i += 1) {
    const e = state.enemies[i];
    if (!e.active) continue;
    const dx = e.x - state.player.x;
    const dy = e.y - state.player.y;
    if (dx * dx + dy * dy < r2) n += 1;
  }
  return n;
}

/**
 * Steer the ship for one step. `reckless` pilots chase shards and never flee or nova, so
 * they die; careful pilots keep their distance and spend a nova when surrounded.
 */
export function autopilot(state, reckless) {
  const p = state.player;
  let mx = 0;
  let my = 0;
  const threat = nearestEnemy(state, 260);
  if (threat !== null && !reckless) {
    const dx = p.x - threat.x;
    const dy = p.y - threat.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    mx += (dx / d) * 1.4;
    my += (dy / d) * 1.4;
  }
  const shard = nearestShard(state, 320);
  if (shard !== null) {
    const dx = shard.x - p.x;
    const dy = shard.y - p.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    mx += (dx / d) * 0.8;
    my += (dy / d) * 0.8;
  } else if (threat === null) {
    // Nothing to do: drift back toward the middle so the frame stays composed.
    mx += ((FIELD.width / 2 - p.x) / FIELD.width) * 0.5;
    my += ((FIELD.height / 2 - p.y) / FIELD.height) * 0.5;
  }
  const len = Math.sqrt(mx * mx + my * my);
  if (len > 1) {
    mx /= len;
    my /= len;
  }
  const target = nearestEnemy(state, 640);
  const bomb = !reckless && state.bombs > 0 && countNear(state, 230) >= 7;
  return {
    mx,
    my,
    aim: target === null ? null : { x: target.x, y: target.y },
    firing: target !== null,
    bomb,
  };
}

/**
 * Set `world` to the named scene (start, play or end; any other name is start) and return the
 * screen to draw over it and the best score to show. The play scene starts mid-run — wave 2
 * with a swarm already in the arena — so the frame shows the game at full tilt, not the
 * quiet opening seconds.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'end') {
    for (let t = 0; t < START_SECONDS; t += SAMPLE) {
      world.step(SAMPLE, autopilot(world.state, false), true);
    }
    world.state.flash = 0;
    world.state.shake = 0;
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'play') {
    world.state.elapsed = 40;
    world.state.wave = 2;
    world.populate(12);
  }
  const limit = name === 'end' ? END_LIMIT_SECONDS : PLAY_SECONDS;
  const reckless = name === 'end';
  for (let t = 0; t < limit; t += SAMPLE) {
    if (world.step(SAMPLE, autopilot(world.state, reckless), false) & EVENT_OVER) break;
  }
  // A staged frame is painted cold: no dying flash or shake left on it.
  world.state.flash = 0;
  world.state.shake = 0;
  const over = world.state.lives === 0;
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
}
