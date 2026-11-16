// The warp grid: the arena's floor is a lattice of points on springs. Explosions and the
// nova throw the nearby points outwards; the springs pull them home, so the background itself
// ripples with the fight. Brightness follows displacement, so a blast lights the grid up.

import { FIELD, GRID, PALETTE } from './config.js';

export function createGrid() {
  const cols = Math.floor(FIELD.width / GRID.spacing) + 1;
  const rows = Math.floor(FIELD.height / GRID.spacing) + 1;
  const points = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      points.push({ x: c * GRID.spacing, y: r * GRID.spacing, ox: 0, oy: 0, vx: 0, vy: 0 });
    }
  }

  function at(c, r) {
    return points[r * cols + c];
  }

  /** Throw the grid away from (x, y); `strength` scales with the blast. */
  function impulse(x, y, strength, radius) {
    const r0 = Math.max(0, Math.floor((y - radius) / GRID.spacing));
    const r1 = Math.min(rows - 1, Math.ceil((y + radius) / GRID.spacing));
    const c0 = Math.max(0, Math.floor((x - radius) / GRID.spacing));
    const c1 = Math.min(cols - 1, Math.ceil((x + radius) / GRID.spacing));
    for (let r = r0; r <= r1; r += 1) {
      for (let c = c0; c <= c1; c += 1) {
        const p = at(c, r);
        const dx = p.x + p.ox - x;
        const dy = p.y + p.oy - y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        if (d > radius) continue;
        const fall = 1 - d / radius;
        const push = strength * fall;
        p.vx += (dx / d) * push;
        p.vy += (dy / d) * push;
      }
    }
  }

  function update(dt) {
    const k = GRID.spring;
    const damp = Math.max(0, 1 - GRID.damping * dt);
    for (let i = 0; i < points.length; i += 1) {
      const p = points[i];
      p.vx += -p.ox * k * dt;
      p.vy += -p.oy * k * dt;
      p.vx *= damp;
      p.vy *= damp;
      p.ox += p.vx * dt;
      p.oy += p.vy * dt;
    }
  }

  function draw(context, time) {
    context.save();
    context.lineWidth = 1;
    for (let r = 0; r < rows; r += 1) {
      context.beginPath();
      for (let c = 0; c < cols; c += 1) {
        const p = at(c, r);
        const x = p.x + p.ox;
        const y = p.y + p.oy;
        if (c === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.strokeStyle = PALETTE.grid;
      context.stroke();
    }
    for (let c = 0; c < cols; c += 1) {
      context.beginPath();
      for (let r = 0; r < rows; r += 1) {
        const p = at(c, r);
        const x = p.x + p.ox;
        const y = p.y + p.oy;
        if (r === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.strokeStyle = PALETTE.grid;
      context.stroke();
    }
    // A slow pulse travelling across the lattice so the floor never sits still.
    context.globalAlpha = 0.10 + 0.05 * Math.sin(time * 0.7);
    context.strokeStyle = PALETTE.gridHot;
    context.beginPath();
    const pulseY = FIELD.height * (0.5 + 0.5 * Math.sin(time * 0.21));
    context.moveTo(0, pulseY);
    context.lineTo(FIELD.width, pulseY);
    context.stroke();
    context.restore();
  }

  function reset() {
    for (let i = 0; i < points.length; i += 1) {
      points[i].ox = 0;
      points[i].oy = 0;
      points[i].vx = 0;
      points[i].vy = 0;
    }
  }

  return { impulse, update, draw, reset };
}
