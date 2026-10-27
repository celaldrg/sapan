/**
 * Canvas renderer: dusk sky with parallax hills, the slingshot, castle blocks,
 * slime goblins, the stone, aim preview and effects. Everything is drawn with primitives.
 */
import { WORLD, PROJECTILE } from './levels.js';
import { createRng } from './rng.js';
import { toScreen } from './camera.js';
import { popupProgress } from './effects.js';
import { formatNumber } from './i18n.js';

const SKY = [[0, '#1e1b4b'], [0.45, '#4c1d95'], [0.8, '#be185d'], [1, '#fb923c']];
const HILLS = [
  { parallax: 0.15, height: 250, color: '#55286f', f1: 0.004, f2: 0.011, seed: 1 },
  { parallax: 0.35, height: 170, color: '#38204f', f1: 0.006, f2: 0.017, seed: 2 },
  { parallax: 0.6, height: 90, color: '#1f2d3d', f1: 0.009, f2: 0.023, seed: 3 },
];
const GROUND = { grass: '#4d7c0f', grassTop: '#84cc16', dirt: '#3b2a1e', dirtDeep: '#22170f', pebble: '#57422f' };
const WOOD = { fill: '#b7793f', grain: '#8a5428', edge: '#5c3a1a' };
const STONE = { fill: '#8b95a5', light: '#cbd5e1', edge: '#4b5563' };
const GLASS = { fill: 'rgba(165, 243, 252, 0.35)', edge: '#a5f3fc', shine: 'rgba(255, 255, 255, 0.7)' };
const SLIME = [
  { body: '#84cc16', light: '#d9f99d', dark: '#3f6212' },
  { body: '#2dd4bf', light: '#ccfbf1', dark: '#115e59' },
  { body: '#eab308', light: '#fef08a', dark: '#854d0e' },
];
const SLINGSHOT = {
  base: { x: WORLD.sling.x, y: WORLD.groundY },
  fork: { x: WORLD.sling.x, y: WORLD.sling.y + 58 },
  back: { x: WORLD.sling.x - 17, y: WORLD.sling.y - 12 },
  front: { x: WORLD.sling.x + 19, y: WORLD.sling.y - 12 },
  wood: '#8a5428', woodDark: '#5c3a1a', band: '#ef4444', bandDark: '#991b1b', leather: '#4a2c17',
};
/** Screen y of the marker that shows a stone flying above the view (below the HUD). */
const MARKER_Y = 64;
const STONE_BALL = { fill: '#78716c', light: '#d6d3d1', dark: '#44403c' };

/**
 * @typedef {{state: import('./game.js').GameState, cam: import('./camera.js').Camera,
 *   fx: import('./effects.js').Effects, time: number, reduced: boolean, lang: string}} Frame
 */

/**
 * Creates the renderer for one canvas.
 * @param {HTMLCanvasElement} canvas
 * @returns {{resize: (width: number, height: number, dpr: number) => void, draw: (frame: Frame) => void}}
 */
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const scenery = makeScenery(createRng(2026));
  let ratio = 1;

  function resize(width, height, dpr) {
    ratio = dpr;
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
  }

  function draw(frame) {
    const { cam, fx, time } = frame;
    const shake = fx.shake ? { x: Math.sin(time * 91) * fx.shake, y: Math.cos(time * 73) * fx.shake } : { x: 0, y: 0 };
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawBackdrop(ctx, cam, scenery, frame);
    const s = cam.scale * ratio;
    ctx.setTransform(s, 0, 0, s, (shake.x - cam.x * cam.scale) * ratio, (shake.y - cam.y * cam.scale) * ratio);
    drawWorld(ctx, frame);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawOffscreenMarker(ctx, frame);
  }

  return { resize, draw };
}

/**
 * Fixed random scenery: stars and clouds in relative screen units.
 * @param {() => number} rng
 */
function makeScenery(rng) {
  const stars = Array.from({ length: 70 }, () => ({ u: rng(), v: rng() * rng(), size: 0.6 + rng() * 1.4, phase: rng() * 6.3 }));
  const clouds = Array.from({ length: 6 }, (_, i) => ({
    u: rng(), v: 0.18 + rng() * 0.35, size: 0.7 + rng() * 0.8, speed: 4 + (i % 3) * 5, layer: i % 3,
  }));
  return { stars, clouds };
}

function drawBackdrop(ctx, cam, scenery, { time, reduced }) {
  const { width: w, height: h } = cam;
  const horizon = toScreen(cam, { x: 0, y: WORLD.groundY }).y;
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  SKY.forEach(([at, color]) => sky.addColorStop(at, color));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  drawStars(ctx, scenery.stars, w, horizon, reduced ? 0 : time);
  drawSun(ctx, w * 0.5, horizon - 150 * cam.scale, Math.max(24, 50 * cam.scale));
  drawClouds(ctx, scenery.clouds, w, horizon, cam.scale, reduced ? 0 : time);
  HILLS.forEach((layer) => drawHills(ctx, cam, layer, horizon));
}

function drawStars(ctx, stars, w, horizon, time) {
  ctx.fillStyle = '#f8fafc';
  for (const s of stars) {
    ctx.globalAlpha = 0.35 + 0.35 * Math.sin(time * 1.3 + s.phase) ** 2;
    ctx.fillRect(s.u * w, s.v * horizon * 0.7, s.size, s.size);
  }
  ctx.globalAlpha = 1;
}

function drawSun(ctx, x, y, r) {
  const glow = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 4);
  glow.addColorStop(0, 'rgba(253, 230, 138, 0.55)');
  glow.addColorStop(1, 'rgba(253, 230, 138, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
  ctx.fillStyle = '#fde68a';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawClouds(ctx, clouds, w, horizon, scale, time) {
  const span = w + 400;
  for (const c of clouds) {
    const x = ((c.u * span + time * c.speed * (1 + c.layer)) % span) - 200;
    const y = c.v * horizon;
    const k = c.size * Math.max(0.55, scale) * (0.7 + c.layer * 0.25);
    ctx.fillStyle = `rgba(253, 186, 116, ${0.16 + c.layer * 0.08})`;
    ctx.beginPath();
    ctx.ellipse(x, y, 70 * k, 16 * k, 0, 0, Math.PI * 2);
    ctx.ellipse(x - 30 * k, y + 2 * k, 38 * k, 12 * k, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 26 * k, y - 8 * k, 36 * k, 15 * k, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawHills(ctx, cam, layer, horizon) {
  const { width: w, height: h, scale } = cam;
  ctx.fillStyle = layer.color;
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w + 8; x += 8) {
    const u = x / scale + cam.x * layer.parallax;
    const wave = 0.55 + 0.28 * Math.sin(u * layer.f1 + layer.seed) + 0.17 * Math.sin(u * layer.f2 + layer.seed * 2.3);
    ctx.lineTo(x, horizon - layer.height * wave * scale);
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
}

/** Draws everything that lives in world coordinates (the transform is already set). */
function drawWorld(ctx, frame) {
  const { state, cam, fx, time, reduced } = frame;
  drawGround(ctx, cam);
  const pouch = pouchPosition(state);
  drawSlingshotBack(ctx, pouch);
  if (state.aim && state.aim.ready) drawPreview(ctx, state.aim.path);
  state.blocks.forEach((b) => drawBlock(ctx, b));
  state.targets.forEach((t) => drawGoblin(ctx, t, reduced ? 0 : time));
  drawTrail(ctx, fx.trail);
  if (state.projectile) drawStone(ctx, state.projectile.x, state.projectile.y, state.projectile.r, state.projectile.angle);
  if (pouch.loaded) drawStone(ctx, pouch.x, pouch.y, PROJECTILE.radius, 0);
  drawSlingshotFront(ctx, pouch);
  drawParticles(ctx, fx.particles);
  drawPopups(ctx, fx.popups, frame.lang);
}

function drawGround(ctx, cam) {
  const left = cam.x - 20;
  const right = cam.x + cam.width / cam.scale + 20;
  const bottom = cam.y + cam.height / cam.scale + 20;
  const y = WORLD.groundY;
  const dirt = ctx.createLinearGradient(0, y, 0, y + 160);
  dirt.addColorStop(0, GROUND.dirt);
  dirt.addColorStop(1, GROUND.dirtDeep);
  ctx.fillStyle = dirt;
  ctx.fillRect(left, y, right - left, Math.max(0, bottom - y));
  ctx.fillStyle = GROUND.pebble;
  for (let x = Math.floor(left / 47) * 47; x < right; x += 47) {
    const n = hash(x);
    ctx.beginPath();
    ctx.ellipse(x + n * 30, y + 26 + n * 50, 5 + n * 5, 3 + n * 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = GROUND.grass;
  ctx.fillRect(left, y - 2, right - left, 14);
  ctx.fillStyle = GROUND.grassTop;
  for (let x = Math.floor(left / 18) * 18; x < right; x += 18) {
    const n = hash(x);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 4 + n * 4, y - 6 - n * 8);
    ctx.lineTo(x + 9, y);
    ctx.fill();
  }
  ctx.fillRect(left, y - 2, right - left, 3);
}

/** Deterministic 0..1 value for a position, for scenery details. */
function hash(x) {
  const v = Math.sin(x * 12.9898) * 43758.5453;
  return v - Math.floor(v);
}

/** Where the sling's pouch is and whether it holds a stone. */
function pouchPosition(state) {
  if (state.aim) return { x: state.aim.start.x, y: state.aim.start.y, loaded: true };
  if (state.canLaunch) return { x: WORLD.sling.x, y: WORLD.sling.y, loaded: true };
  return { x: WORLD.sling.x + 1, y: SLINGSHOT.back.y + 6, loaded: false };
}

function stroke(ctx, color, width, points) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.stroke();
}

function drawSlingshotBack(ctx, pouch) {
  const { fork, back } = SLINGSHOT;
  stroke(ctx, SLINGSHOT.woodDark, 12, [fork, back]);
  stroke(ctx, SLINGSHOT.bandDark, 6, [back, pouch]);
  ctx.fillStyle = SLINGSHOT.leather;
  ctx.beginPath();
  ctx.ellipse(pouch.x - 4, pouch.y, 9, 17, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawSlingshotFront(ctx, pouch) {
  const { base, fork, back, front } = SLINGSHOT;
  stroke(ctx, SLINGSHOT.band, 6, [pouch, front]);
  stroke(ctx, SLINGSHOT.woodDark, 20, [base, fork]);
  stroke(ctx, SLINGSHOT.wood, 14, [base, fork]);
  stroke(ctx, SLINGSHOT.woodDark, 14, [fork, front]);
  stroke(ctx, SLINGSHOT.wood, 9, [fork, front]);
  stroke(ctx, 'rgba(255, 255, 255, 0.18)', 3, [{ x: base.x - 3, y: base.y - 6 }, { x: fork.x - 3, y: fork.y + 4 }]);
  [back, front].forEach((tip) => {
    ctx.fillStyle = SLINGSHOT.bandDark;
    ctx.fillRect(tip.x - 6, tip.y + 2, 12, 6);
  });
}

function drawPreview(ctx, path) {
  path.forEach((p, i) => {
    const k = 1 - i / path.length;
    ctx.globalAlpha = 0.25 + 0.7 * k;
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.5 + 3 * k, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawBlock(ctx, b) {
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.angle);
  const x = -b.w / 2;
  const y = -b.h / 2;
  if (b.material === 'wood') drawWood(ctx, x, y, b.w, b.h);
  else if (b.material === 'stone') drawStoneBlock(ctx, x, y, b.w, b.h);
  else drawGlass(ctx, x, y, b.w, b.h);
  if (b.damage > 0.12) drawCracks(ctx, b);
  ctx.restore();
}

function drawWood(ctx, x, y, w, h) {
  roundRect(ctx, x, y, w, h, 3);
  ctx.fillStyle = WOOD.fill;
  ctx.fill();
  ctx.strokeStyle = WOOD.grain;
  ctx.lineWidth = 1.5;
  const along = w >= h;
  const lines = Math.max(1, Math.floor((along ? h : w) / 7));
  for (let i = 1; i <= lines; i += 1) {
    const t = i / (lines + 1);
    ctx.beginPath();
    if (along) {
      ctx.moveTo(x + 4, y + h * t);
      ctx.lineTo(x + w - 4, y + h * t + (i % 2 ? 1 : -1));
    } else {
      ctx.moveTo(x + w * t, y + 4);
      ctx.lineTo(x + w * t + (i % 2 ? 1 : -1), y + h - 4);
    }
    ctx.stroke();
  }
  roundRect(ctx, x, y, w, h, 3);
  ctx.strokeStyle = WOOD.edge;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawStoneBlock(ctx, x, y, w, h) {
  roundRect(ctx, x, y, w, h, 4);
  ctx.fillStyle = STONE.fill;
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.fillRect(x + 2, y + 2, w - 4, Math.min(5, h / 4));
  ctx.fillStyle = STONE.light;
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 3; i += 1) ctx.fillRect(x + w * (0.2 + i * 0.27), y + h * (0.35 + (i % 2) * 0.3), 3, 2);
  ctx.globalAlpha = 1;
  roundRect(ctx, x, y, w, h, 4);
  ctx.strokeStyle = STONE.edge;
  ctx.lineWidth = 2.5;
  ctx.stroke();
}

function drawGlass(ctx, x, y, w, h) {
  roundRect(ctx, x, y, w, h, 2);
  ctx.fillStyle = GLASS.fill;
  ctx.fill();
  ctx.strokeStyle = GLASS.edge;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = GLASS.shine;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 4, y + Math.min(h, w) * 0.8);
  ctx.lineTo(x + Math.min(h, w) * 0.8, y + 4);
  ctx.stroke();
}

function drawCracks(ctx, b) {
  const rng = createRng(b.id * 7919);
  const count = Math.ceil(b.damage * 4);
  ctx.strokeStyle = b.material === 'glass' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(20, 12, 6, 0.65)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < count; i += 1) {
    let px = (rng() - 0.5) * b.w * 0.8;
    let py = (rng() - 0.5) * b.h * 0.8;
    ctx.beginPath();
    ctx.moveTo(px, py);
    for (let j = 0; j < 3; j += 1) {
      px = Math.max(-b.w / 2, Math.min(b.w / 2, px + (rng() - 0.5) * 18));
      py = Math.max(-b.h / 2, Math.min(b.h / 2, py + (rng() - 0.5) * 18));
      ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
}

function drawGoblin(ctx, t, time) {
  const c = SLIME[t.variant] || SLIME[0];
  const r = t.r;
  const squash = 1 + 0.05 * Math.sin(time * 3 + t.phase);
  ctx.save();
  ctx.translate(t.x, t.y);
  ctx.rotate(t.angle);
  ctx.scale(1 / squash, squash);
  drawEars(ctx, r, c);
  const body = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.15);
  body.addColorStop(0, c.light);
  body.addColorStop(0.45, c.body);
  body.addColorStop(1, c.dark);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = c.body;
  ctx.beginPath();
  ctx.arc(-r * 0.45, r * 0.92, 3.2, 0, Math.PI * 2);
  ctx.arc(r * 0.35, r * 0.97, 2.4, 0, Math.PI * 2);
  ctx.fill();
  if (t.variant === 2) drawSprout(ctx, r, c);
  drawFace(ctx, r, t.variant, t.damage);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.45, -r * 0.55, r * 0.22, r * 0.12, -0.6, 0, Math.PI * 2);
  ctx.fill();
  if (t.damage > 0) {
    ctx.fillStyle = `rgba(127, 29, 29, ${0.4 * t.damage})`;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawEars(ctx, r, c) {
  for (const side of [-1, 1]) {
    ctx.fillStyle = c.dark;
    ctx.beginPath();
    ctx.moveTo(side * r * 0.7, -r * 0.2);
    ctx.lineTo(side * r * 1.6, -r * 0.85);
    ctx.lineTo(side * r * 0.45, -r * 0.75);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = c.body;
    ctx.beginPath();
    ctx.moveTo(side * r * 0.75, -r * 0.35);
    ctx.lineTo(side * r * 1.35, -r * 0.78);
    ctx.lineTo(side * r * 0.6, -r * 0.68);
    ctx.closePath();
    ctx.fill();
  }
}

function drawSprout(ctx, r, c) {
  stroke(ctx, c.dark, 2.5, [{ x: 0, y: -r * 0.9 }, { x: r * 0.15, y: -r * 1.45 }]);
  ctx.fillStyle = c.light;
  ctx.beginPath();
  ctx.arc(r * 0.17, -r * 1.5, 3.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawFace(ctx, r, variant, damage) {
  const eyes = variant === 1 ? [{ x: 0, y: -r * 0.15, size: r * 0.36 }]
    : [{ x: -r * 0.36, y: -r * 0.15, size: r * 0.24 }, { x: r * 0.36, y: -r * 0.15, size: r * 0.24 }];
  for (const e of eyes) {
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.ellipse(e.x, e.y, e.size, damage > 0.5 ? e.size * 0.35 : e.size, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.arc(e.x - e.size * 0.35, e.y + e.size * 0.1, e.size * (damage > 0.5 ? 0.3 : 0.5), 0, Math.PI * 2);
    ctx.fill();
    stroke(ctx, '#1f2937', 2, [{ x: e.x - e.size, y: e.y - e.size * 1.35 }, { x: e.x + e.size, y: e.y - e.size * 0.9 }]);
  }
  ctx.fillStyle = '#1f2937';
  ctx.beginPath();
  ctx.moveTo(-r * 0.45, r * 0.3);
  ctx.quadraticCurveTo(0, r * 0.75, r * 0.45, r * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.moveTo(-r * 0.25, r * 0.36);
  ctx.lineTo(-r * 0.15, r * 0.36);
  ctx.lineTo(-r * 0.2, r * 0.5);
  ctx.moveTo(r * 0.12, r * 0.36);
  ctx.lineTo(r * 0.24, r * 0.36);
  ctx.lineTo(r * 0.18, r * 0.52);
  ctx.fill();
}

function drawTrail(ctx, trail) {
  trail.forEach((p, i) => {
    const k = (i + 1) / trail.length;
    ctx.fillStyle = `rgba(239, 68, 68, ${0.35 * k})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4 + 7 * k, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawStone(ctx, x, y, r, angle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const g = ctx.createRadialGradient(-r * 0.4, -r * 0.45, r * 0.1, 0, 0, r);
  g.addColorStop(0, STONE_BALL.light);
  g.addColorStop(0.5, STONE_BALL.fill);
  g.addColorStop(1, STONE_BALL.dark);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = STONE_BALL.dark;
  ctx.globalAlpha = 0.6;
  [[0.3, 0.2, 2.5], [-0.2, 0.45, 1.8], [0.45, -0.3, 1.5]].forEach(([u, v, s]) => {
    ctx.beginPath();
    ctx.arc(u * r, v * r, s, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawParticles(ctx, particles) {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.maxLife)) * (p.kind === 'dust' ? 0.6 : 1);
    ctx.fillStyle = p.color;
    if (p.kind === 'shard') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function drawPopups(ctx, popups, lang) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '800 26px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.8)';
  for (const pop of popups) {
    const k = popupProgress(pop);
    const text = `+${formatNumber(lang, pop.value)}`;
    const y = pop.y - 50 * k;
    ctx.globalAlpha = 1 - k * k;
    ctx.strokeText(text, pop.x, y);
    ctx.fillStyle = pop.value >= 1000 ? '#fde047' : '#f8fafc';
    ctx.fillText(text, pop.x, y);
  }
  ctx.globalAlpha = 1;
}

function drawOffscreenMarker(ctx, { state, cam }) {
  const p = state.projectile;
  if (!p) return;
  const s = toScreen(cam, p);
  if (s.y >= -p.r * cam.scale) return;
  const x = Math.max(16, Math.min(cam.width - 16, s.x));
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.moveTo(x, MARKER_Y);
  ctx.lineTo(x - 9, MARKER_Y + 14);
  ctx.lineTo(x + 9, MARKER_Y + 14);
  ctx.closePath();
  ctx.fill();
}
