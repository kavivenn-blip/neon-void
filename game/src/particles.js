// Particles, shockwave rings and floating score text: the juice. Everything is pooled at
// boot and drawn additively ('lighter'), so a big explosion glows instead of smearing.
// Nothing here allocates after createParticles returns.

import { FIELD, POOL } from './config.js';

export function createParticles(random) {
  const sparks = [];
  for (let i = 0; i < POOL.particles; i += 1) {
    sparks.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#fff', drag: 2 });
  }
  const texts = [];
  for (let i = 0; i < POOL.texts; i += 1) {
    texts.push({ active: false, x: 0, y: 0, life: 0, maxLife: 1, value: '', color: '#fff', size: 18 });
  }
  const rings = [];
  for (let i = 0; i < POOL.rings; i += 1) {
    rings.push({ active: false, x: 0, y: 0, radius: 0, maxRadius: 100, life: 0, maxLife: 1, color: '#fff', width: 3 });
  }

  function free(list) {
    for (let i = 0; i < list.length; i += 1) if (!list[i].active) return list[i];
    return null;
  }

  function burst(x, y, color, count, speed, size, life) {
    for (let n = 0; n < count; n += 1) {
      const p = free(sparks);
      if (p === null) return;
      const angle = random() * Math.PI * 2;
      const v = speed * (0.3 + random() * 0.7);
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * v;
      p.vy = Math.sin(angle) * v;
      p.maxLife = life * (0.6 + random() * 0.6);
      p.life = p.maxLife;
      p.size = size * (0.6 + random() * 0.8);
      p.color = color;
      p.drag = 2.5;
    }
  }

  /** A short engine trail behind the ship: two soft sparks, no allocation. */
  function trail(x, y, vx, vy, color) {
    for (let n = 0; n < 2; n += 1) {
      const p = free(sparks);
      if (p === null) return;
      p.active = true;
      p.x = x + (random() - 0.5) * 6;
      p.y = y + (random() - 0.5) * 6;
      p.vx = -vx * 0.25 + (random() - 0.5) * 40;
      p.vy = -vy * 0.25 + (random() - 0.5) * 40;
      p.maxLife = 0.28;
      p.life = p.maxLife;
      p.size = 2.5;
      p.color = color;
      p.drag = 1;
    }
  }

  function popup(x, y, value, color, size) {
    const t = free(texts);
    if (t === null) return;
    t.active = true;
    t.x = x;
    t.y = y;
    t.maxLife = 0.9;
    t.life = t.maxLife;
    t.value = value;
    t.color = color;
    t.size = size;
  }

  function ring(x, y, maxRadius, color, width, life) {
    const r = free(rings);
    if (r === null) return;
    r.active = true;
    r.x = x;
    r.y = y;
    r.radius = 8;
    r.maxRadius = maxRadius;
    r.maxLife = life;
    r.life = life;
    r.color = color;
    r.width = width;
  }

  function update(dt) {
    for (let i = 0; i < sparks.length; i += 1) {
      const p = sparks[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      const d = Math.max(0, 1 - p.drag * dt);
      p.vx *= d;
      p.vy *= d;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.x < -20 || p.x > FIELD.width + 20 || p.y < -20 || p.y > FIELD.height + 20) p.active = false;
    }
    for (let i = 0; i < texts.length; i += 1) {
      const t = texts[i];
      if (!t.active) continue;
      t.life -= dt;
      if (t.life <= 0) t.active = false;
      else t.y -= 42 * dt;
    }
    for (let i = 0; i < rings.length; i += 1) {
      const r = rings[i];
      if (!r.active) continue;
      r.life -= dt;
      if (r.life <= 0) {
        r.active = false;
        continue;
      }
      const k = 1 - r.life / r.maxLife;
      r.radius = 8 + (r.maxRadius - 8) * (1 - (1 - k) * (1 - k));
    }
  }

  function draw(context) {
    context.save();
    context.globalCompositeOperation = 'lighter';
    for (let i = 0; i < sparks.length; i += 1) {
      const p = sparks[i];
      if (!p.active) continue;
      const a = p.life / p.maxLife;
      context.globalAlpha = a;
      context.fillStyle = p.color;
      context.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    for (let i = 0; i < rings.length; i += 1) {
      const r = rings[i];
      if (!r.active) continue;
      context.globalAlpha = (r.life / r.maxLife) * 0.9;
      context.strokeStyle = r.color;
      context.lineWidth = r.width * (r.life / r.maxLife) + 0.5;
      context.beginPath();
      context.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      context.stroke();
    }
    context.restore();
    context.save();
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    for (let i = 0; i < texts.length; i += 1) {
      const t = texts[i];
      if (!t.active) continue;
      context.globalAlpha = Math.min(1, (t.life / t.maxLife) * 1.6);
      context.font = `bold ${t.size}px ${'system-ui, sans-serif'}`;
      context.fillStyle = t.color;
      context.fillText(t.value, t.x, t.y);
    }
    context.restore();
  }

  function clear() {
    for (const p of sparks) p.active = false;
    for (const t of texts) t.active = false;
    for (const r of rings) r.active = false;
  }

  return { burst, trail, popup, ring, update, draw, clear };
}
