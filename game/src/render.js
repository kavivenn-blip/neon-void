// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred, the margin filled with the backdrop
// colour. Neon shapes with glow, a warp grid, a starfield, the HUD and the panels.
// Text that holds a number is rebuilt only when the number changes, so a frame allocates
// nothing.

import { FIELD, FONT, PALETTE, PLAYER, SHARD } from './config.js';
import { KIND_CHASER, KIND_MITE, KIND_SNIPER, KIND_SPINNER, KIND_SPLITTER, KIND_WEAVER } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const PANEL = { width: 640, top: 150, line: 32, bottom: 76 };

function cachedLabel(prefix) {
  let value = null;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas, particles, grid) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const scoreLabel = cachedLabel('SCORE ');
  const multLabel = cachedLabel('×');
  const bestLabel = cachedLabel('BEST ');
  const waveLabel = cachedLabel('WAVE ');
  const finalLabel = cachedLabel('SCORE ');
  const killsLabel = cachedLabel('KILLS ');

  // A fixed starfield, drawn behind the grid.
  const stars = [];
  let seed = 1234567;
  function nextStar() {
    seed = (seed * 1664525 + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  }
  for (let i = 0; i < 90; i += 1) {
    stars.push({ x: nextStar() * FIELD.width, y: nextStar() * FIELD.height, r: 0.6 + nextStar() * 1.4, tw: nextStar() * Math.PI * 2 });
  }

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

  /** Window (client) coordinates to field coordinates. */
  function fieldPoint(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - view.x / (window.devicePixelRatio || 1)) / (view.scale / (window.devicePixelRatio || 1)),
      y: (clientY - rect.top - view.y / (window.devicePixelRatio || 1)) / (view.scale / (window.devicePixelRatio || 1)),
    };
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, weight) {
    const key = `${weight || ''}${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight || ''}${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function glow(color, blur) {
    context.shadowColor = color;
    context.shadowBlur = blur;
  }

  function noGlow() {
    context.shadowBlur = 0;
  }

  function drawStars(time) {
    for (let i = 0; i < stars.length; i += 1) {
      const s = stars[i];
      context.globalAlpha = 0.25 + 0.2 * Math.sin(time * 1.3 + s.tw);
      context.fillStyle = PALETTE.star;
      context.fillRect(s.x, s.y, s.r, s.r);
    }
    context.globalAlpha = 1;
  }

  function drawShip(x, y, angle, scale, color, core) {
    context.save();
    context.translate(x, y);
    context.rotate(angle);
    context.scale(scale, scale);
    glow(color, 18);
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(20, 0);
    context.lineTo(-14, -12);
    context.lineTo(-7, 0);
    context.lineTo(-14, 12);
    context.closePath();
    context.fill();
    noGlow();
    context.fillStyle = core;
    context.beginPath();
    context.moveTo(10, 0);
    context.lineTo(-6, -5);
    context.lineTo(-2, 0);
    context.lineTo(-6, 5);
    context.closePath();
    context.fill();
    context.restore();
  }

  function drawEnemy(e) {
    const color =
      e.kind === KIND_CHASER ? PALETTE.chaser :
      e.kind === KIND_WEAVER ? PALETTE.weaver :
      e.kind === KIND_SPINNER ? PALETTE.spinner :
      e.kind === KIND_SPLITTER ? PALETTE.splitter :
      e.kind === KIND_MITE ? PALETTE.mite : PALETTE.sniper;
    context.save();
    context.translate(e.x, e.y);
    glow(color, 14);
    context.fillStyle = color;
    context.strokeStyle = color;
    context.lineWidth = 2;
    if (e.kind === KIND_CHASER) {
      context.rotate(e.angle);
      context.beginPath();
      context.moveTo(e.radius, 0);
      context.lineTo(0, e.radius * 0.7);
      context.lineTo(-e.radius, 0);
      context.lineTo(0, -e.radius * 0.7);
      context.closePath();
      context.fill();
    } else if (e.kind === KIND_WEAVER) {
      context.rotate(e.angle);
      context.beginPath();
      context.moveTo(e.radius + 4, 0);
      context.lineTo(-e.radius, -e.radius * 0.75);
      context.lineTo(-e.radius * 0.45, 0);
      context.lineTo(-e.radius, e.radius * 0.75);
      context.closePath();
      context.fill();
    } else if (e.kind === KIND_SPINNER) {
      context.rotate(e.angle);
      context.fillRect(-e.radius * 0.7, -e.radius * 0.7, e.radius * 1.4, e.radius * 1.4);
      context.rotate(-e.angle * 2);
      context.fillStyle = '#04050e';
      context.fillRect(-e.radius * 0.32, -e.radius * 0.32, e.radius * 0.64, e.radius * 0.64);
    } else if (e.kind === KIND_SPLITTER) {
      context.rotate(e.angle);
      context.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2;
        const px = Math.cos(a) * e.radius;
        const py = Math.sin(a) * e.radius;
        if (i === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      }
      context.closePath();
      context.fill();
      context.fillStyle = '#04050e';
      context.beginPath();
      context.arc(0, 0, e.radius * 0.4, 0, Math.PI * 2);
      context.fill();
    } else if (e.kind === KIND_MITE) {
      context.rotate(e.angle);
      context.beginPath();
      context.moveTo(e.radius + 3, 0);
      context.lineTo(-e.radius, -e.radius * 0.7);
      context.lineTo(-e.radius, e.radius * 0.7);
      context.closePath();
      context.fill();
    } else {
      // Sniper: a ringed diamond that keeps its distance and fires orbs.
      context.rotate(e.angle);
      context.beginPath();
      context.moveTo(e.radius, 0);
      context.lineTo(0, e.radius);
      context.lineTo(-e.radius, 0);
      context.lineTo(0, -e.radius);
      context.closePath();
      context.fill();
      noGlow();
      context.beginPath();
      context.arc(0, 0, e.radius + 6, 0, Math.PI * 2);
      context.stroke();
    }
    noGlow();
    context.restore();
  }

  function drawField(state, time) {
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    drawStars(time);
    grid.draw(context, time);

    // Shards: small spinning diamonds that beg to be collected.
    for (let i = 0; i < state.shards.length; i += 1) {
      const s = state.shards[i];
      if (!s.active) continue;
      const blink = 0.75 + 0.25 * Math.sin(time * 6 + s.x);
      context.save();
      context.translate(s.x, s.y);
      context.rotate(time * 2 + s.x * 0.01);
      context.globalAlpha = blink;
      glow(PALETTE.shard, 12);
      context.fillStyle = PALETTE.shard;
      const r = SHARD.radius;
      context.beginPath();
      context.moveTo(r, 0);
      context.lineTo(0, r * 0.7);
      context.lineTo(-r, 0);
      context.lineTo(0, -r * 0.7);
      context.closePath();
      context.fill();
      noGlow();
      context.fillStyle = PALETTE.shardCore;
      context.fillRect(-2, -2, 4, 4);
      context.restore();
    }

    // Sniper orbs.
    for (let i = 0; i < state.orbs.length; i += 1) {
      const o = state.orbs[i];
      if (!o.active) continue;
      context.save();
      glow(PALETTE.orb, 14);
      context.fillStyle = PALETTE.orb;
      context.beginPath();
      context.arc(o.x, o.y, 7, 0, Math.PI * 2);
      context.fill();
      noGlow();
      context.fillStyle = '#ffffff';
      context.beginPath();
      context.arc(o.x, o.y, 2.5, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }

    for (let i = 0; i < state.enemies.length; i += 1) {
      if (state.enemies[i].active) drawEnemy(state.enemies[i]);
    }

    // Bullets: short bright streaks along their velocity.
    context.save();
    context.lineCap = 'round';
    for (let i = 0; i < state.bullets.length; i += 1) {
      const b = state.bullets[i];
      if (!b.active) continue;
      glow(PALETTE.bullet, 10);
      context.strokeStyle = PALETTE.bullet;
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(b.x - b.vx * 0.016, b.y - b.vy * 0.016);
      context.lineTo(b.x, b.y);
      context.stroke();
    }
    noGlow();
    context.restore();

    const p = state.player;
    if (p.alive) {
      // Blink while invulnerable after a hit: hidden on every other tenth of a second.
      if (p.invulnerable === 0 || Math.floor(p.invulnerable * 10) % 2 === 1) {
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (speed > 60) {
          context.save();
          glow('#5ec8ff', 10);
          context.fillStyle = '#9fdcff';
          context.translate(p.x, p.y);
          context.rotate(Math.atan2(p.vy, p.vx));
          context.beginPath();
          context.moveTo(-12, -5);
          context.lineTo(-12 - speed * 0.045, 0);
          context.lineTo(-12, 5);
          context.closePath();
          context.fill();
          context.restore();
        }
        drawShip(p.x, p.y, p.angle, 1, PALETTE.player, PALETTE.playerCore);
      }
    }

    particles.draw(context);
  }

  function drawHud(state, best) {
    // A dim strip behind the HUD so score, best and lives stay readable over particles
    // and floating score popups.
    context.save();
    context.fillStyle = 'rgba(4, 5, 14, 0.45)';
    context.fillRect(0, 0, FIELD.width, 116);
    context.restore();
    context.textBaseline = 'top';
    text(scoreLabel(state.score), 26, 18, 30, PALETTE.text, 'left', 'bold ');
    if (state.multiplier > 1) {
      const heat = state.multiplier >= 25 ? PALETTE.gold : state.multiplier >= 10 ? '#ffb84d' : PALETTE.shard;
      text(multLabel(state.multiplier), 26, 54, 24, heat, 'left', 'bold ');
      text('MULTIPLIER', 26 + context.measureText(multLabel(state.multiplier)).width + 10, 58, 15, PALETTE.muted, 'left');
    }
    text(bestLabel(best), FIELD.width / 2, 20, 20, PALETTE.muted, 'center');
    text(waveLabel(state.wave), FIELD.width - 26, 18, 20, PALETTE.muted, 'right');
    // Lives as little ships, bombs as rings, top right under the wave.
    for (let i = 0; i < state.lives; i += 1) {
      drawShip(FIELD.width - 34 - i * 34, 66, -Math.PI / 2, 0.62, PALETTE.player, PALETTE.playerCore);
    }
    for (let i = 0; i < state.bombs; i += 1) {
      context.save();
      glow(PALETTE.bombRing, 8);
      context.strokeStyle = PALETTE.bombRing;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(FIELD.width - 34 - i * 30, 100, 7, 0, Math.PI * 2);
      context.stroke();
      context.restore();
    }
    if (state.bombs > 0) text('NOVA', FIELD.width - 26 - state.bombs * 30 - 14, 92, 14, PALETTE.muted, 'right');
  }

  function drawPanel(title, lines, prompt, accent) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.save();
    context.fillStyle = 'rgba(6, 10, 24, 0.88)';
    context.strokeStyle = accent;
    context.lineWidth = 2;
    glow(accent, 16);
    context.beginPath();
    context.roundRect(x, y, PANEL.width, height, 14);
    context.fill();
    context.stroke();
    context.restore();
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 82, 46, PALETTE.text, 'center', 'bold ');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], FIELD.width / 2, y + PANEL.top + i * PANEL.line, 20, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 38, 22, PALETTE.gold, 'center', 'bold ');
  }

  function drawTitle(state, best) {
    // The logo, big and glowing, over the living backdrop.
    context.save();
    context.textBaseline = 'alphabetic';
    try {
      context.letterSpacing = '10px';
    } catch {
      // letterSpacing is Chrome-only; the title still reads without it.
    }
    glow('#37e6ff', 34);
    text('NEON VOID', FIELD.width / 2, 218, 92, '#eafcff', 'center', 'bold ');
    context.restore();
    try {
      context.letterSpacing = '4px';
    } catch {
      // See above.
    }
    text('A TWIN-STICK ARENA SHOOTER', FIELD.width / 2, 258, 20, PALETTE.shard, 'center');
    try {
      context.letterSpacing = '0px';
    } catch {
      // See above.
    }
    const lines = [
      'Survive the swarm. Chain shards. Guard your multiplier.',
      'WASD / arrows — fly      Mouse — aim      Hold click — fire',
      'Space — nova bomb      P — pause      M — mute',
      '',
    ];
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], FIELD.width / 2, 316 + i * 30, 19, PALETTE.muted, 'center');
    }
    if (best > 0) text(bestLabel(best), FIELD.width / 2, 452, 22, PALETTE.gold, 'center', 'bold ');
    const pulse = 0.65 + 0.35 * Math.sin(state.time * 3);
    context.globalAlpha = pulse;
    text('PRESS ENTER OR CLICK TO LAUNCH', FIELD.width / 2, 516, 24, PALETTE.text, 'center', 'bold ');
    context.globalAlpha = 1;
    text('Best played with sound on.', FIELD.width / 2, 668, 15, PALETTE.muted, 'center');
  }

  /** Paint one frame: the field, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best, aim) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const shake = state.shake * state.shake * 14;
    const sx = shake === 0 ? 0 : (Math.sin(state.time * 127.1) + Math.sin(state.time * 61.7)) * 0.5 * shake;
    const sy = shake === 0 ? 0 : (Math.cos(state.time * 113.3) + Math.sin(state.time * 71.9)) * 0.5 * shake;
    context.setTransform(view.scale, 0, 0, view.scale, view.x + sx * view.scale, view.y + sy * view.scale);
    drawField(state, state.time);
    if (screen === SCREEN_TITLE) {
      drawTitle(state, best);
    } else {
      drawHud(state, best);
      if (state.waveBanner > 0 && screen === SCREEN_PLAY) {
        context.save();
        context.globalAlpha = Math.min(1, state.waveBanner);
        try {
          context.letterSpacing = '8px';
        } catch {
          // See above.
        }
        glow('#37e6ff', 26);
        text(waveLabel(state.wave), FIELD.width / 2, 300, 54, '#eafcff', 'center', 'bold ');
        context.restore();
      }
      if (aim !== null && aim !== undefined && screen === SCREEN_PLAY) {
        context.save();
        context.strokeStyle = 'rgba(232, 246, 255, 0.55)';
        context.lineWidth = 1.5;
        context.beginPath();
        context.arc(aim.x, aim.y, 10, 0, Math.PI * 2);
        context.moveTo(aim.x - 15, aim.y);
        context.lineTo(aim.x - 6, aim.y);
        context.moveTo(aim.x + 6, aim.y);
        context.lineTo(aim.x + 15, aim.y);
        context.moveTo(aim.x, aim.y - 15);
        context.lineTo(aim.x, aim.y - 6);
        context.moveTo(aim.x, aim.y + 6);
        context.lineTo(aim.x, aim.y + 15);
        context.stroke();
        context.restore();
      }
      if (screen === SCREEN_PAUSED) {
        drawPanel('PAUSED', ['The swarm will wait for you.'], 'Press P to resume', PALETTE.shard);
      } else if (screen === SCREEN_OVER) {
        const lines = [
          finalLabel(state.score),
          bestLabel(best),
          waveLabel(state.wave),
          killsLabel(state.kills),
          '',
        ];
        drawPanel('SIGNAL LOST', lines, 'Press Enter or click to fly again', PALETTE.danger);
      }
    }
    if (state.flash > 0) {
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.fillStyle = `rgba(190, 240, 255, ${state.flash * 0.45})`;
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    noGlow();
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, fieldPoint };
}
