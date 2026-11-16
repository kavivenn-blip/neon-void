// Neon Void's rules and state, with no drawing and no browser in it: the ship, five enemy
// kinds, bullets, sniper orbs, shards, the spawn director, the multiplier, bombs, lives and
// score. step() advances one fixed step and returns what happened as bit flags, so the caller
// can react (sounds, announcements) without the world knowing about screens. Effects go out
// through the `fx` hooks the caller wires to particles, the warp grid and sound.
// Nothing here allocates after createWorld returns.

import {
  BOMBS,
  BOMB_SCORE_STEP,
  BULLET,
  ENEMY,
  EXTRA_LIFE_AT,
  FIELD,
  GRID,
  LIVES,
  MAX_BOMBS,
  ORB,
  PLAYER,
  POOL,
  SHARD,
  SPAWN,
  UNLOCK_AT,
  WAVE,
} from './config.js';

export const KIND_CHASER = 'chaser';
export const KIND_WEAVER = 'weaver';
export const KIND_SPINNER = 'spinner';
export const KIND_SPLITTER = 'splitter';
export const KIND_MITE = 'mite';
export const KIND_SNIPER = 'sniper';

export const EVENT_HIT = 1;
export const EVENT_KILL = 2;
export const EVENT_OVER = 4;
export const EVENT_WAVE = 8;
export const EVENT_BOMB = 16;
export const EVENT_EXTRALIFE = 32;
export const EVENT_PICKUP = 64;

const KINDS = [KIND_CHASER, KIND_WEAVER, KIND_SPINNER, KIND_SPLITTER, KIND_SNIPER];

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function createWorld(random, fx) {
  const player = {
    x: FIELD.width / 2,
    y: FIELD.height / 2,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    fireTimer: 0,
    invulnerable: 0,
    alive: true,
  };
  const bullets = [];
  for (let i = 0; i < POOL.bullets; i += 1) {
    bullets.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0 });
  }
  const orbs = [];
  for (let i = 0; i < POOL.orbs; i += 1) {
    orbs.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0 });
  }
  const enemies = [];
  for (let i = 0; i < POOL.enemies; i += 1) {
    enemies.push({ active: false, kind: KIND_CHASER, x: 0, y: 0, vx: 0, vy: 0, hp: 1, radius: 16, angle: 0, spin: 0, t: 0, shotTimer: 0 });
  }
  const shards = [];
  for (let i = 0; i < POOL.shards; i += 1) {
    shards.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0 });
  }
  const state = {
    player,
    bullets,
    orbs,
    enemies,
    shards,
    score: 0,
    multiplier: 1,
    lives: LIVES,
    bombs: BOMBS,
    wave: 1,
    elapsed: 0,
    kills: 0,
    waveTimer: 0,
    waveBanner: 0,
    nextBombAt: BOMB_SCORE_STEP,
    extraLifeIndex: 0,
    shake: 0,
    flash: 0,
    time: 0,
  };
  let spawnTimer = 0.8;
  let ambientTimer = 0;

  function reset() {
    player.x = FIELD.width / 2;
    player.y = FIELD.height / 2;
    player.vx = 0;
    player.vy = 0;
    player.angle = -Math.PI / 2;
    player.fireTimer = 0;
    player.invulnerable = 0;
    player.alive = true;
    for (const b of bullets) b.active = false;
    for (const o of orbs) o.active = false;
    for (const e of enemies) e.active = false;
    for (const s of shards) s.active = false;
    state.score = 0;
    state.multiplier = 1;
    state.lives = LIVES;
    state.bombs = BOMBS;
    state.wave = 1;
    state.elapsed = 0;
    state.kills = 0;
    state.waveTimer = 0;
    state.waveBanner = 0;
    state.nextBombAt = BOMB_SCORE_STEP;
    state.extraLifeIndex = 0;
    state.shake = 0;
    state.flash = 0;
    spawnTimer = 0.8;
    ambientTimer = 0;
  }

  /**
   * Fill the arena with `count` mixed enemies at random points away from the ship: used
   * to stage a busy mid-game frame for a screenshot without waiting out the early waves.
   */
  function populate(count) {
    const kinds = unlockedKinds();
    for (let i = 0; i < count; i += 1) {
      let x = 0;
      let y = 0;
      for (let tries = 0; tries < 12; tries += 1) {
        x = 60 + random() * (FIELD.width - 120);
        y = 90 + random() * (FIELD.height - 180);
        if (dist2(x, y, player.x, player.y) > 240 * 240) break;
      }
      spawnEnemy(kinds[Math.floor(random() * kinds.length)], x, y);
    }
  }

  function free(list) {
    for (let i = 0; i < list.length; i += 1) if (!list[i].active) return list[i];
    return null;
  }

  function addShake(amount) {
    state.shake = Math.min(1, state.shake + amount);
  }

  /** A point on a random edge, at least 240 px from the ship. */
  function edgePoint() {
    for (let tries = 0; tries < 12; tries += 1) {
      const side = Math.floor(random() * 4);
      let x = 0;
      let y = 0;
      if (side === 0) {
        x = random() * FIELD.width;
        y = -30;
      } else if (side === 1) {
        x = FIELD.width + 30;
        y = random() * FIELD.height;
      } else if (side === 2) {
        x = random() * FIELD.width;
        y = FIELD.height + 30;
      } else {
        x = -30;
        y = random() * FIELD.height;
      }
      if (dist2(x, y, player.x, player.y) > 240 * 240) return { x, y };
    }
    return { x: 40, y: 40 };
  }

  function unlockedKinds() {
    const out = [];
    for (const kind of KINDS) if (state.elapsed >= UNLOCK_AT[kind]) out.push(kind);
    return out;
  }

  function spawnEnemy(kind, x, y) {
    const e = free(enemies);
    if (e === null) return null;
    const tune = ENEMY[kind];
    const waveScale = 1 + (state.wave - 1) * 0.04;
    e.active = true;
    e.kind = kind;
    e.x = x;
    e.y = y;
    e.vx = 0;
    e.vy = 0;
    e.hp = tune.hp;
    e.radius = tune.radius;
    e.angle = random() * Math.PI * 2;
    e.spin = (random() - 0.5) * 4;
    e.t = 0;
    e.shotTimer = tune.shotInterval ? tune.shotInterval * (0.6 + random() * 0.8) : 0;
    e.speed = tune.speed * waveScale;
    return e;
  }

  function spawnWaveEnemy() {
    const kinds = unlockedKinds();
    const kind = kinds[Math.floor(random() * kinds.length)];
    const at = edgePoint();
    spawnEnemy(kind, at.x, at.y);
  }

  function dropShard(x, y) {
    const s = free(shards);
    if (s === null) return;
    s.active = true;
    s.x = x;
    s.y = y;
    const angle = random() * Math.PI * 2;
    s.vx = Math.cos(angle) * 60;
    s.vy = Math.sin(angle) * 60;
    s.life = SHARD.life;
  }

  function killEnemy(e, award) {
    e.active = false;
    state.kills += 1;
    const tune = ENEMY[e.kind];
    if (!award) {
      fx.burst(e.x, e.y, tuneColor(e.kind), 22, 260, 3, 0.6);
      fx.ring(e.x, e.y, 60, tuneColor(e.kind), 2, 0.4);
      fx.impulse(e.x, e.y, GRID.impulse * 0.5, 130);
      return;
    }
    const points = tune.score * state.multiplier;
    state.score += points;
    fx.popup(e.x, e.y, `+${points}`, '#ffffff', 17);
    fx.burst(e.x, e.y, tuneColor(e.kind), 26, 300, 3, 0.7);
    fx.ring(e.x, e.y, 70, tuneColor(e.kind), 2.5, 0.45);
    fx.impulse(e.x, e.y, GRID.impulse * 0.6, 150);
    addShake(0.08);
    dropShard(e.x, e.y);
    if (e.kind === KIND_SPINNER) dropShard(e.x + 14, e.y - 10);
    if (e.kind === KIND_SPLITTER) {
      for (let i = 0; i < 3; i += 1) {
        const m = spawnEnemy(KIND_MITE, e.x + (random() - 0.5) * 30, e.y + (random() - 0.5) * 30);
        if (m !== null) {
          const a = random() * Math.PI * 2;
          m.vx = Math.cos(a) * 200;
          m.vy = Math.sin(a) * 200;
        }
      }
    }
    if (state.score >= state.nextBombAt) {
      if (state.bombs < MAX_BOMBS) {
        state.bombs += 1;
        fx.popup(player.x, player.y - 34, 'BONUS BOMB', '#aef6ff', 20);
      }
      state.nextBombAt += BOMB_SCORE_STEP;
    }
    if (state.extraLifeIndex < EXTRA_LIFE_AT.length && state.score >= EXTRA_LIFE_AT[state.extraLifeIndex]) {
      state.lives += 1;
      state.extraLifeIndex += 1;
      fx.popup(player.x, player.y - 58, 'EXTRA LIFE', '#ffd94d', 22);
      fx.extraLifeSound();
    }
  }

  function tuneColor(kind) {
    if (kind === KIND_CHASER) return '#ff2d78';
    if (kind === KIND_WEAVER) return '#ffe14d';
    if (kind === KIND_SPINNER) return '#ff7a1a';
    if (kind === KIND_SPLITTER) return '#39ff6a';
    if (kind === KIND_MITE) return '#8dff5e';
    return '#c86bff';
  }

  function fireBullet() {
    const b = free(bullets);
    if (b === null) return;
    const nx = player.x + Math.cos(player.angle) * PLAYER.nose;
    const ny = player.y + Math.sin(player.angle) * PLAYER.nose;
    b.active = true;
    b.x = nx;
    b.y = ny;
    b.vx = Math.cos(player.angle) * PLAYER.bulletSpeed + player.vx * 0.35;
    b.vy = Math.sin(player.angle) * PLAYER.bulletSpeed + player.vy * 0.35;
    b.life = BULLET.life;
    fx.burst(nx, ny, '#c8fff4', 2, 60, 2, 0.15);
    fx.shootSound();
  }

  function fireOrb(e) {
    const o = free(orbs);
    if (o === null) return;
    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    o.active = true;
    o.x = e.x;
    o.y = e.y;
    o.vx = (dx / d) * ORB.speed;
    o.vy = (dy / d) * ORB.speed;
    o.life = ORB.life;
    fx.burst(e.x, e.y, '#e0aaff', 4, 80, 2, 0.25);
  }

  function detonateBomb() {
    state.bombs -= 1;
    state.flash = 1;
    addShake(1);
    fx.ring(player.x, player.y, 900, '#aef6ff', 6, 0.8);
    fx.impulse(player.x, player.y, GRID.impulse * 2.2, 700);
    fx.burst(player.x, player.y, '#aef6ff', 60, 520, 4, 0.9);
    fx.bombSound();
    for (let i = 0; i < enemies.length; i += 1) {
      const e = enemies[i];
      if (!e.active) continue;
      const points = ENEMY[e.kind].score * state.multiplier;
      state.score += points;
      state.kills += 1;
      dropShard(e.x, e.y);
      e.active = false;
    }
    for (const o of orbs) o.active = false;
  }

  function hurtPlayer() {
    state.lives -= 1;
    state.multiplier = 1;
    player.invulnerable = PLAYER.invulnerable;
    player.vx = 0;
    player.vy = 0;
    addShake(0.7);
    state.flash = 0.55;
    fx.burst(player.x, player.y, '#7df9ff', 46, 420, 4, 0.9);
    fx.burst(player.x, player.y, '#ffffff', 20, 300, 3, 0.6);
    fx.ring(player.x, player.y, 150, '#7df9ff', 4, 0.6);
    fx.impulse(player.x, player.y, GRID.impulse * 1.6, 320);
    fx.hitSound();
    if (state.lives <= 0) {
      player.alive = false;
      fx.gameOverSound();
      return EVENT_HIT | EVENT_OVER;
    }
    return EVENT_HIT;
  }

  function stepEnemy(e, dt) {
    e.t += dt;
    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / d;
    const uy = dy / d;
    if (e.kind === KIND_CHASER) {
      e.vx += ux * 620 * dt;
      e.vy += uy * 620 * dt;
      e.angle = Math.atan2(e.vy, e.vx);
    } else if (e.kind === KIND_WEAVER) {
      const wob = Math.sin(e.t * 5) * 0.9;
      e.vx = (ux * 0.8 - uy * wob) * e.speed;
      e.vy = (uy * 0.8 + ux * wob) * e.speed;
      e.angle = Math.atan2(e.vy, e.vx);
    } else if (e.kind === KIND_SPINNER) {
      e.vx += ux * 150 * dt;
      e.vy += uy * 150 * dt;
      e.angle += e.spin * dt * 2.4;
    } else if (e.kind === KIND_SPLITTER) {
      e.vx += ux * 260 * dt;
      e.vy += uy * 260 * dt;
      e.angle += dt * 0.8;
    } else if (e.kind === KIND_MITE) {
      e.vx += ux * 900 * dt;
      e.vy += uy * 900 * dt;
      e.angle = Math.atan2(e.vy, e.vx);
    } else if (e.kind === KIND_SNIPER) {
      const want = 380;
      const toward = d > want + 40 ? 1 : d < want - 40 ? -1 : 0;
      const strafe = Math.sin(e.t * 1.4) > 0 ? 1 : -1;
      e.vx = (ux * toward + -uy * strafe * 0.7) * e.speed;
      e.vy = (uy * toward + ux * strafe * 0.7) * e.speed;
      e.angle = Math.atan2(dy, dx);
      e.shotTimer -= dt;
      if (e.shotTimer <= 0 && d < ENEMY.sniper.shotRange) {
        e.shotTimer = ENEMY.sniper.shotInterval * (0.85 + random() * 0.3);
        fireOrb(e);
      }
    }
    const sp = Math.sqrt(e.vx * e.vx + e.vy * e.vy);
    const cap = e.speed * (e.kind === KIND_CHASER || e.kind === KIND_MITE ? 1.35 : 1.1);
    if (sp > cap) {
      e.vx = (e.vx / sp) * cap;
      e.vy = (e.vy / sp) * cap;
    }
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    if (e.x < -60) e.x = -60;
    if (e.x > FIELD.width + 60) e.x = FIELD.width + 60;
    if (e.y < -60) e.y = -60;
    if (e.y > FIELD.height + 60) e.y = FIELD.height + 60;
  }

  /**
   * One fixed step. `controls` is { mx, my, aim (null until the mouse moves), firing, bomb }.
   * With `harmless` set (the title screen's backdrop) the ship flies and shoots but nothing
   * can hurt it and nothing scores.
   */
  function step(dt, controls, harmless) {
    let events = 0;
    state.time += dt;
    if (state.waveBanner > 0) state.waveBanner -= dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 1.6);
    if (state.flash > 0) state.flash = Math.max(0, state.flash - dt * 2.2);

    if (!harmless) {
      state.elapsed += dt;
      state.waveTimer += dt;
      if (state.waveTimer >= WAVE.seconds && state.wave < WAVE.max) {
        state.waveTimer = 0;
        state.wave += 1;
        state.waveBanner = 2.4;
        events |= EVENT_WAVE;
        fx.waveSound();
      }
      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        const interval = Math.max(SPAWN.minInterval, SPAWN.interval * SPAWN.intervalScale ** (state.wave - 1));
        spawnWaveEnemy();
        if (state.wave >= SPAWN.batchAtWave && random() < 0.5) spawnWaveEnemy();
        spawnTimer += interval;
      }
    } else {
      ambientTimer -= dt;
      if (ambientTimer <= 0) {
        ambientTimer = 1.6;
        const kinds = [KIND_CHASER, KIND_WEAVER, KIND_SPINNER];
        const at = edgePoint();
        spawnEnemy(kinds[Math.floor(random() * kinds.length)], at.x, at.y);
      }
    }

    // --- the ship ---
    const mx = controls.mx || 0;
    const my = controls.my || 0;
    const len = Math.sqrt(mx * mx + my * my) || 1;
    player.vx += (mx / len) * PLAYER.accel * dt * (mx !== 0 || my !== 0 ? 1 : 0);
    player.vy += (my / len) * PLAYER.accel * dt * (mx !== 0 || my !== 0 ? 1 : 0);
    const drag = Math.max(0, 1 - PLAYER.drag * dt);
    player.vx *= drag;
    player.vy *= drag;
    const speed = Math.sqrt(player.vx * player.vx + player.vy * player.vy);
    if (speed > PLAYER.maxSpeed) {
      player.vx = (player.vx / speed) * PLAYER.maxSpeed;
      player.vy = (player.vy / speed) * PLAYER.maxSpeed;
    }
    player.x = Math.min(FIELD.width - PLAYER.radius, Math.max(PLAYER.radius, player.x + player.vx * dt));
    player.y = Math.min(FIELD.height - PLAYER.radius, Math.max(PLAYER.radius, player.y + player.vy * dt));
    if (player.invulnerable > 0) player.invulnerable = Math.max(0, player.invulnerable - dt);
    if (speed > 60) fx.trail(player.x - Math.cos(player.angle) * 14, player.y - Math.sin(player.angle) * 14, player.vx, player.vy, '#7df9ff');

    // --- aim: the mouse, or the nearest enemy until the mouse first moves ---
    let aimX = null;
    let aimY = null;
    let firing = controls.firing;
    if (controls.aim !== null && controls.aim !== undefined) {
      aimX = controls.aim.x;
      aimY = controls.aim.y;
    } else {
      let best = null;
      let bestD = 520 * 520;
      for (let i = 0; i < enemies.length; i += 1) {
        const e = enemies[i];
        if (!e.active) continue;
        const d = dist2(e.x, e.y, player.x, player.y);
        if (d < bestD) {
          bestD = d;
          best = e;
        }
      }
      if (best !== null) {
        aimX = best.x;
        aimY = best.y;
        firing = true;
      }
    }
    if (aimX !== null) player.angle = Math.atan2(aimY - player.y, aimX - player.x);

    player.fireTimer -= dt;
    if (firing && player.fireTimer <= 0 && player.alive) {
      player.fireTimer = PLAYER.fireInterval;
      fireBullet();
    }

    if (controls.bomb && !harmless && state.bombs > 0 && player.alive) {
      detonateBomb();
      events |= EVENT_BOMB;
    }

    // --- bullets ---
    for (let i = 0; i < bullets.length; i += 1) {
      const b = bullets[i];
      if (!b.active) continue;
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.life <= 0 || b.x < -12 || b.x > FIELD.width + 12 || b.y < -12 || b.y > FIELD.height + 12) {
        b.active = false;
        continue;
      }
      for (let j = 0; j < enemies.length; j += 1) {
        const e = enemies[j];
        if (!e.active) continue;
        const rr = e.radius + BULLET.radius;
        if (dist2(b.x, b.y, e.x, e.y) > rr * rr) continue;
        b.active = false;
        e.hp -= BULLET.damage;
        fx.burst(b.x, b.y, '#ffffff', 3, 90, 2, 0.2);
        if (e.hp <= 0) {
          killEnemy(e, !harmless);
          events |= EVENT_KILL;
        }
        break;
      }
    }

    // --- enemies move, separate, and touch the ship ---
    for (let i = 0; i < enemies.length; i += 1) {
      const e = enemies[i];
      if (!e.active) continue;
      stepEnemy(e, dt);
    }
    for (let i = 0; i < enemies.length; i += 1) {
      const a = enemies[i];
      if (!a.active) continue;
      for (let j = i + 1; j < enemies.length; j += 1) {
        const b = enemies[j];
        if (!b.active) continue;
        const rr = a.radius + b.radius;
        const d2 = dist2(a.x, a.y, b.x, b.y);
        if (d2 >= rr * rr || d2 === 0) continue;
        const d = Math.sqrt(d2);
        const push = (rr - d) / 2;
        const nx = (b.x - a.x) / d;
        const ny = (b.y - a.y) / d;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
      }
    }
    if (!harmless && player.alive && player.invulnerable === 0) {
      for (let i = 0; i < enemies.length; i += 1) {
        const e = enemies[i];
        if (!e.active) continue;
        const rr = e.radius + PLAYER.radius - 2;
        if (dist2(e.x, e.y, player.x, player.y) > rr * rr) continue;
        killEnemy(e, false);
        events |= hurtPlayer();
        break;
      }
    }

    // --- sniper orbs ---
    for (let i = 0; i < orbs.length; i += 1) {
      const o = orbs[i];
      if (!o.active) continue;
      o.life -= dt;
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      if (o.life <= 0 || o.x < -20 || o.x > FIELD.width + 20 || o.y < -20 || o.y > FIELD.height + 20) {
        o.active = false;
        continue;
      }
      if (!harmless && player.alive && player.invulnerable === 0) {
        const rr = ORB.radius + PLAYER.radius - 2;
        if (dist2(o.x, o.y, player.x, player.y) <= rr * rr) {
          o.active = false;
          events |= hurtPlayer();
        }
      }
    }

    // --- shards drift, magnetise, and collect ---
    for (let i = 0; i < shards.length; i += 1) {
      const s = shards[i];
      if (!s.active) continue;
      s.life -= dt;
      if (s.life <= 0) {
        s.active = false;
        continue;
      }
      const d2 = dist2(s.x, s.y, player.x, player.y);
      if (player.alive && d2 < SHARD.magnet * SHARD.magnet) {
        const d = Math.sqrt(d2) || 1;
        const pull = 1400 * (1 - d / SHARD.magnet) + 300;
        s.vx += ((player.x - s.x) / d) * pull * dt;
        s.vy += ((player.y - s.y) / d) * pull * dt;
      }
      s.vx *= Math.max(0, 1 - 1.6 * dt);
      s.vy *= Math.max(0, 1 - 1.6 * dt);
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (player.alive && d2 < SHARD.collect * SHARD.collect) {
        s.active = false;
        if (!harmless) {
          state.multiplier = Math.min(SHARD.maxMultiplier, state.multiplier + 1);
          const gained = SHARD.value * state.multiplier;
          state.score += gained;
          fx.popup(s.x, s.y - 10, `+${gained}`, '#9ef7ff', 15);
          fx.pickupSound(state.multiplier);
          events |= EVENT_PICKUP;
        }
      }
    }

    return events;
  }

  reset();
  return { state, reset, step, populate };
}
