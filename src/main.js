/**
 * Page controller: wires the game, renderer, sound, HUD, overlays and input together.
 * Matter.js is loaded by a classic script tag and passed into the game modules.
 */
import { createGame, createDemoGame, DEMO } from './game.js';
import { LEVELS, LEVEL_COUNT } from './levels.js';
import { STEP_MS, trajectory } from './launch.js';
import { PROGRESS_KEY, sanitizeProgress, recordWin } from './progress.js';
import { loadJSON, saveJSON } from './storage.js';
import { LANG_KEY, normalizeLang, otherLang, translate } from './i18n.js';
import { levelBounds, fitCamera, pullFromScreen } from './camera.js';
import { createKeyAim, nudgeKeyAim, keyAimToDrag } from './keyaim.js';
import { createEffects, applyEvents, stepEffects } from './effects.js';
import { createRenderer } from './render.js';
import { createSound, MUTE_KEY } from './audio.js';
import { createRng } from './rng.js';
import { applyTranslations, createHud, renderLevelGrid, renderResult, lightStars } from './view.js';

/** Pause between the last goblin falling and the result card. */
const WIN_DELAY_MS = 1100;
const LOSE_DELAY_MS = 500;
/** The aiming hint fades after the first shot or after this long. */
const HINT_MS = 7000;
/** Longest frame fed to the simulation, so a background tab does not jump ahead. */
const MAX_FRAME_MS = 100;

const Matter = globalThis.Matter;
const $ = (id) => document.getElementById(id);
const els = {
  stage: $('stage'), canvas: $('game'), hint: $('hint'),
  newGame: $('btn-new'), mute: $('btn-mute'), lang: $('btn-lang'), restart: $('btn-restart'),
  levels: $('overlay-levels'), levelGrid: $('level-grid'), levelsTotal: $('levels-total'), closeLevels: $('btn-close-levels'),
  result: $('overlay-result'),
  resultEls: {
    title: $('result-title'), stars: $('result-stars'), score: $('result-score'), best: $('result-best'),
    next: $('btn-next'), retry: $('btn-retry'), levels: $('btn-levels'),
  },
};
const updateHud = createHud({
  level: $('hud-level'), levelName: $('hud-level-name'), ammo: $('hud-ammo'),
  score: $('hud-score'), goblins: $('hud-goblins'), goblinsCount: $('hud-goblins-count'),
});
const renderer = createRenderer(els.canvas);
const sound = createSound();
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const app = {
  lang: normalizeLang(loadJSON(LANG_KEY, 'en')),
  muted: loadJSON(MUTE_KEY, false) === true,
  progress: sanitizeProgress(loadJSON(PROGRESS_KEY, null), LEVEL_COUNT),
  game: null,
  cam: null,
  fx: createEffects(),
  fxRng: createRng(99),
  frozen: false,
  overlay: /** @type {null|'levels'|'result'} */ (null),
  result: /** @type {import('./view.js').ResultInfo|null} */ (null),
  resultTimer: 0,
  hintTimer: 0,
  pointer: null,
  keyAim: createKeyAim(),
  keyMode: false,
  clock: 0,
  last: 0,
};

const t = (key, params) => translate(app.lang, key, params);
const levelIndex = () => app.game.getState().levelIndex;

/* ---------- levels ---------- */

function startLevel(index) {
  app.game = createGame({ Matter, levelIndex: index });
  app.fx = createEffects();
  app.frozen = false;
  app.pointer = null;
  app.result = null;
  window.clearTimeout(app.resultTimer);
  closeOverlay();
  showHint();
  fitView();
}

/** ?demo: level 2 frozen with a stone in flight, its trail and the aim preview. */
function startDemo() {
  app.game = createDemoGame({ Matter });
  const aim = app.game.getState().aim;
  const flight = trajectory(aim.start, aim.velocity, { steps: Math.round(DEMO.flightMs / STEP_MS), every: 1 });
  app.fx.trail = flight.slice(-14);
  app.frozen = true;
  els.hint.hidden = true;
  fitView();
}

function unfreeze() {
  if (!app.frozen) return;
  app.frozen = false;
  app.fx.trail = [];
  app.game.setAim(null);
}

/** Level to offer first: the first unlocked level without stars, else the last unlocked one. */
function suggestedLevel() {
  const open = Math.min(app.progress.unlocked, LEVEL_COUNT);
  const fresh = app.progress.stars.findIndex((s, i) => i < open && s === 0);
  return fresh >= 0 ? fresh : open - 1;
}

/* ---------- view ---------- */

function showHint() {
  els.hint.hidden = false;
  els.hint.classList.remove('is-hidden');
  window.clearTimeout(app.hintTimer);
  app.hintTimer = window.setTimeout(hideHint, HINT_MS);
}

function hideHint() {
  els.hint.classList.add('is-hidden');
}

function fitView() {
  const rect = els.stage.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  renderer.resize(width, height, Math.min(window.devicePixelRatio || 1, 3));
  if (app.game) app.cam = fitCamera(levelBounds(LEVELS[levelIndex()]), width, height);
}

function applyLanguage() {
  document.documentElement.lang = app.lang;
  document.title = t('docTitle');
  applyTranslations(document.body, app.lang);
  if (app.overlay === 'levels') fillLevelGrid();
  if (app.overlay === 'result' && app.result) renderResult(els.resultEls, app.result, app.lang);
}

function syncMuteButton() {
  els.mute.setAttribute('aria-pressed', String(app.muted));
}

/* ---------- overlays ---------- */

function setOverlay(name) {
  app.overlay = name;
  els.levels.classList.toggle('is-open', name === 'levels');
  els.result.classList.toggle('is-open', name === 'result');
  cancelAim();
}

function closeOverlay() {
  setOverlay(null);
  lightStars(els.resultEls.stars, 0);
}

function fillLevelGrid() {
  renderLevelGrid(els.levelGrid, els.levelsTotal, {
    progress: app.progress, current: levelIndex(), lang: app.lang, onPick: startLevel,
  });
}

function openLevels() {
  unfreeze();
  fillLevelGrid();
  setOverlay('levels');
  const focus = els.levelGrid.querySelector('.is-current:not(:disabled)') || els.levelGrid.querySelector('button:not(:disabled)');
  focus?.focus({ preventScroll: true });
}

function closeLevels() {
  if (app.result) {
    showResult();
    return;
  }
  closeOverlay();
  els.canvas.focus({ preventScroll: true });
}

function showResult() {
  const primary = renderResult(els.resultEls, app.result, app.lang);
  setOverlay('result');
  primary.focus({ preventScroll: true });
  const stars = app.result.stars;
  window.requestAnimationFrame(() => window.requestAnimationFrame(() => lightStars(els.resultEls.stars, stars)));
}

/** Shows the result card after a pause, unless the level picker is open (closing it shows the card). */
function queueResult(delay) {
  app.resultTimer = window.setTimeout(() => {
    if (app.overlay !== 'levels') showResult();
  }, delay);
}

/* ---------- game events ---------- */

function onWon() {
  const s = app.game.getState();
  const index = s.levelIndex;
  const previousBest = app.progress.best[index];
  app.progress = recordWin(app.progress, index, { stars: s.stars, score: s.score });
  saveJSON(PROGRESS_KEY, app.progress);
  app.result = {
    won: true, stars: s.stars, score: s.score, best: app.progress.best[index],
    newBest: s.score > previousBest, isLast: index === LEVEL_COUNT - 1, targetsLeft: 0,
  };
  queueResult(WIN_DELAY_MS);
}

function onLost() {
  const s = app.game.getState();
  app.result = {
    won: false, stars: 0, score: s.score, best: app.progress.best[s.levelIndex],
    newBest: false, isLast: false, targetsLeft: s.targetsLeft,
  };
  queueResult(LOSE_DELAY_MS);
}

function handleEvents(events) {
  if (!events.length) return;
  applyEvents(app.fx, events, app.fxRng, { reduced: reducedMotion.matches });
  for (const e of events) {
    sound.play(e);
    if (e.type === 'launch') hideHint();
    else if (e.type === 'won') onWon();
    else if (e.type === 'lost') onLost();
  }
}

/* ---------- aiming ---------- */

function cancelAim() {
  if (app.pointer) els.canvas.classList.remove('is-aiming');
  app.pointer = null;
  if (app.game && !app.frozen) app.game.setAim(null);
}

function onPointerDown(e) {
  if (app.overlay || (e.pointerType === 'mouse' && e.button !== 0)) return;
  unfreeze();
  if (app.pointer || !app.game.canLaunch()) return;
  e.preventDefault();
  els.canvas.setPointerCapture(e.pointerId);
  els.canvas.classList.add('is-aiming');
  app.keyMode = false;
  app.pointer = { id: e.pointerId, x: e.clientX, y: e.clientY, pull: null, ready: false };
}

function onPointerMove(e) {
  const p = app.pointer;
  if (!p || e.pointerId !== p.id) return;
  p.pull = pullFromScreen(app.cam, e.clientX - p.x, e.clientY - p.y);
  app.game.setAim(p.pull);
  const ready = app.game.getState().aim.ready;
  if (ready && !p.ready) sound.play({ type: 'pull' });
  p.ready = ready;
}

function onPointerUp(e) {
  const p = app.pointer;
  if (!p || e.pointerId !== p.id) return;
  app.pointer = null;
  els.canvas.classList.remove('is-aiming');
  if (!p.pull || !app.game.launch(p.pull)) app.game.setAim(null);
}

function onPointerCancel(e) {
  if (app.pointer && e.pointerId === app.pointer.id) cancelAim();
}

function nudgeAim(steps) {
  if (app.pointer) return;
  app.keyMode = true;
  app.keyAim = nudgeKeyAim(app.keyAim, steps);
}

function fireKeyAim() {
  if (app.pointer) return;
  app.keyMode = true;
  app.game.launch(keyAimToDrag(app.keyAim));
}

/** Keeps the keyboard aim preview on screen whenever a stone is ready. */
function syncKeyAim() {
  if (app.keyMode && !app.pointer && !app.overlay && app.game.canLaunch()) app.game.setAim(keyAimToDrag(app.keyAim));
}

/* ---------- controls ---------- */

function restart() {
  startLevel(levelIndex());
}

function toggleMute() {
  app.muted = !app.muted;
  sound.setMuted(app.muted);
  saveJSON(MUTE_KEY, app.muted);
  syncMuteButton();
}

function toggleLang() {
  app.lang = otherLang(app.lang);
  saveJSON(LANG_KEY, app.lang);
  applyLanguage();
}

const GAME_KEYS = {
  ArrowUp: (big) => nudgeAim({ angle: big ? 5 : 1 }),
  ArrowDown: (big) => nudgeAim({ angle: big ? -5 : -1 }),
  ArrowRight: (big) => nudgeAim({ power: big ? 5 : 1 }),
  ArrowLeft: (big) => nudgeAim({ power: big ? -5 : -1 }),
  ' ': fireKeyAim,
  Enter: fireKeyAim,
  r: restart,
  m: toggleMute,
  l: openLevels,
};

function onKeyDown(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'Escape') {
    if (app.overlay === 'levels') closeLevels();
    else openLevels();
    e.preventDefault();
    return;
  }
  const onControl = e.target instanceof Element && e.target.closest('button, a');
  if (app.overlay || (onControl && (e.key === ' ' || e.key === 'Enter'))) return;
  const action = GAME_KEYS[e.key.length === 1 ? e.key.toLowerCase() : e.key];
  if (!action) return;
  e.preventDefault();
  unfreeze();
  action(e.shiftKey);
}

function bindControls() {
  const unlock = () => sound.unlock();
  document.addEventListener('pointerup', unlock, true);
  document.addEventListener('keydown', unlock, true);
  els.canvas.addEventListener('pointerdown', onPointerDown);
  els.canvas.addEventListener('pointermove', onPointerMove);
  els.canvas.addEventListener('pointerup', onPointerUp);
  els.canvas.addEventListener('pointercancel', onPointerCancel);
  els.canvas.addEventListener('lostpointercapture', onPointerCancel);
  window.addEventListener('keydown', onKeyDown);
  els.newGame.addEventListener('click', openLevels);
  els.mute.addEventListener('click', toggleMute);
  els.lang.addEventListener('click', toggleLang);
  els.restart.addEventListener('click', restart);
  els.closeLevels.addEventListener('click', closeLevels);
  els.resultEls.next.addEventListener('click', () => startLevel(levelIndex() + 1));
  els.resultEls.retry.addEventListener('click', restart);
  els.resultEls.levels.addEventListener('click', openLevels);
  new ResizeObserver(fitView).observe(els.stage);
}

/* ---------- loop ---------- */

function frame(now) {
  const dt = Math.min(MAX_FRAME_MS, Math.max(0, now - app.last));
  app.last = now;
  if (!app.frozen) {
    app.clock += dt / 1000;
    syncKeyAim();
    handleEvents(app.game.update(dt));
  }
  const state = app.game.getState();
  if (!app.frozen) stepEffects(app.fx, dt / 1000, state.projectile);
  updateHud(state, app.lang);
  renderer.draw({ state, cam: app.cam, fx: app.fx, time: app.clock, reduced: reducedMotion.matches, lang: app.lang });
  window.requestAnimationFrame(frame);
}

function init() {
  sound.setMuted(app.muted);
  syncMuteButton();
  bindControls();
  if (new URLSearchParams(window.location.search).has('demo')) {
    startDemo();
  } else {
    startLevel(suggestedLevel());
    openLevels();
  }
  applyLanguage();
  window.requestAnimationFrame((now) => {
    app.last = now;
    frame(now);
  });
}

init();
