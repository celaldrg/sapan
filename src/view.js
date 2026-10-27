/**
 * DOM views: translated static text, the HUD, the level picker and the result card.
 * Built with createElement/textContent only.
 */
import { translate, formatNumber } from './i18n.js';
import { LEVELS } from './levels.js';
import { isUnlocked, totalStars } from './progress.js';

/**
 * Fills every `data-i18n` element's text and every `data-i18n-label` element's accessible name.
 * @param {ParentNode} root
 * @param {string} lang
 */
export function applyTranslations(root, lang) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = translate(lang, el.dataset.i18n);
  });
  root.querySelectorAll('[data-i18n-label]').forEach((el) => {
    const text = translate(lang, el.dataset.i18nLabel);
    el.setAttribute('aria-label', text);
    if (el.tagName === 'BUTTON') el.title = text;
  });
}

/**
 * Creates the HUD updater; it only touches the DOM when a shown value changes.
 * @param {{level: HTMLElement, levelName: HTMLElement, ammo: HTMLElement, score: HTMLElement,
 *   goblins: HTMLElement, goblinsCount: HTMLElement}} els
 * @returns {(state: import('./game.js').GameState, lang: string) => void}
 */
export function createHud(els) {
  let shown = '';
  return function updateHud(state, lang) {
    const key = [lang, state.levelIndex, state.ammo, state.ammoTotal, state.score, state.targetsLeft].join('|');
    if (key === shown) return;
    shown = key;
    els.level.textContent = translate(lang, 'level', { n: state.levelIndex + 1 });
    els.levelName.textContent = translate(lang, `level.${state.levelKey}`);
    els.score.textContent = formatNumber(lang, state.score);
    els.goblinsCount.textContent = String(state.targetsLeft);
    els.goblins.setAttribute('aria-label', translate(lang, 'goblinsLeft', { n: state.targetsLeft, total: state.targetsTotal }));
    els.ammo.setAttribute('aria-label', translate(lang, 'ammoLeft', { n: state.ammo, total: state.ammoTotal }));
    const dots = Array.from({ length: state.ammoTotal }, (_, i) => {
      const dot = els.ammo.ownerDocument.createElement('span');
      dot.className = i < state.ammo ? 'ammo-dot' : 'ammo-dot is-used';
      return dot;
    });
    els.ammo.replaceChildren(...dots);
  };
}

/**
 * A row of three stars, `count` of them lit.
 * @param {Document} doc
 * @param {number} count
 * @returns {HTMLSpanElement}
 */
function starRow(doc, count) {
  const row = doc.createElement('span');
  row.className = 'level-stars';
  row.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 3; i += 1) {
    const star = doc.createElement('span');
    star.textContent = '★';
    if (i < count) star.className = 'is-on';
    row.append(star);
  }
  return row;
}

/**
 * Fills the level picker: one button per level with its name and best stars; locked levels are disabled.
 * @param {HTMLElement} grid Container for the level buttons.
 * @param {HTMLElement} total Element showing the collected star total.
 * @param {{progress: import('./progress.js').Progress, current: number, lang: string, onPick: (index: number) => void}} options
 */
export function renderLevelGrid(grid, total, { progress, current, lang, onPick }) {
  const doc = grid.ownerDocument;
  total.textContent = translate(lang, 'totalStars', { n: totalStars(progress), max: LEVELS.length * 3 });
  const cards = LEVELS.map((level, i) => {
    const open = isUnlocked(progress, i);
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = i === current ? 'btn level-card is-current' : 'btn level-card';
    button.disabled = !open;
    const num = doc.createElement('span');
    num.className = 'level-num';
    num.textContent = translate(lang, 'level', { n: i + 1 });
    const name = doc.createElement('span');
    name.className = 'level-name';
    name.textContent = open ? translate(lang, `level.${level.key}`) : translate(lang, 'locked');
    button.append(num, name, starRow(doc, progress.stars[i]));
    button.setAttribute('aria-label', [num.textContent, name.textContent,
      translate(lang, 'starsLabel', { n: progress.stars[i] })].join(', '));
    button.addEventListener('click', () => onPick(i));
    return button;
  });
  grid.replaceChildren(...cards);
}

/**
 * @typedef {{won: boolean, stars: number, score: number, best: number, newBest: boolean,
 *   isLast: boolean, targetsLeft: number}} ResultInfo
 */

/**
 * Fills the win/lose card and returns the button that should get focus.
 * @param {{title: HTMLElement, stars: HTMLElement, score: HTMLElement, best: HTMLElement,
 *   next: HTMLButtonElement, retry: HTMLButtonElement, levels: HTMLButtonElement}} els
 * @param {ResultInfo} info
 * @param {string} lang
 * @returns {HTMLButtonElement} The primary action.
 */
export function renderResult(els, info, lang) {
  const titleKey = info.won ? (info.isLast ? 'wonAll' : 'won') : 'lost';
  els.title.textContent = translate(lang, titleKey);
  els.stars.setAttribute('aria-label', translate(lang, 'starsLabel', { n: info.stars }));
  els.score.textContent = translate(lang, 'scoreLine', { score: formatNumber(lang, info.score) });
  if (!info.won) els.best.textContent = translate(lang, 'lostText', { n: info.targetsLeft });
  else if (info.newBest) els.best.textContent = translate(lang, 'newBest');
  else els.best.textContent = translate(lang, 'bestLine', { best: formatNumber(lang, info.best) });
  els.next.hidden = !info.won || info.isLast;
  let primary = els.retry;
  if (info.won) primary = info.isLast ? els.levels : els.next;
  [els.next, els.retry, els.levels].forEach((b) => b.classList.toggle('btn-primary', b === primary));
  return primary;
}

/**
 * Lights the result stars one after another (CSS handles the timing).
 * @param {HTMLElement} starsEl
 * @param {number} count Stars to light (0 clears them).
 */
export function lightStars(starsEl, count) {
  [...starsEl.children].forEach((star, i) => star.classList.toggle('is-on', i < count));
}
