/**
 * Level unlock and best-result bookkeeping. Pure functions on plain objects,
 * so the UI can persist them through the storage helper.
 */

/** Storage key for saved progress. */
export const PROGRESS_KEY = 'sapan.progress.v1';

/**
 * @typedef {{unlocked: number, stars: number[], best: number[]}} Progress
 * unlocked: how many levels are playable (always at least 1);
 * stars / best: best star rating and score per level (0 = not won yet).
 */

/**
 * Fresh progress: only the first level is open.
 * @param {number} levelCount
 * @returns {Progress}
 */
export function createProgress(levelCount) {
  return { unlocked: 1, stars: new Array(levelCount).fill(0), best: new Array(levelCount).fill(0) };
}

/**
 * Turns untrusted saved data into valid progress (wrong shapes and values are dropped).
 * @param {unknown} raw Data read from storage.
 * @param {number} levelCount
 * @returns {Progress}
 */
export function sanitizeProgress(raw, levelCount) {
  const fresh = createProgress(levelCount);
  if (!raw || typeof raw !== 'object') return fresh;
  const data = /** @type {Record<string, unknown>} */ (raw);
  const pick = (list, index, max) => {
    const value = Array.isArray(list) ? Number(list[index]) : 0;
    return Number.isFinite(value) ? Math.max(0, Math.min(max, Math.floor(value))) : 0;
  };
  const stars = fresh.stars.map((_, i) => pick(data.stars, i, 3));
  const best = fresh.best.map((_, i) => pick(data.best, i, Number.MAX_SAFE_INTEGER));
  const unlocked = Number(data.unlocked);
  return {
    unlocked: Number.isFinite(unlocked) ? Math.max(1, Math.min(levelCount, Math.floor(unlocked))) : 1,
    stars,
    best,
  };
}

/**
 * Records a won level: keeps the best stars and score and unlocks the next level.
 * @param {Progress} progress
 * @param {number} levelIndex Zero-based level index.
 * @param {{stars: number, score: number}} result
 * @returns {Progress} New progress object (the input is not modified).
 */
export function recordWin(progress, levelIndex, { stars, score }) {
  const levelCount = progress.stars.length;
  if (levelIndex < 0 || levelIndex >= levelCount) return progress;
  const next = { unlocked: progress.unlocked, stars: [...progress.stars], best: [...progress.best] };
  next.stars[levelIndex] = Math.max(next.stars[levelIndex], stars);
  next.best[levelIndex] = Math.max(next.best[levelIndex], score);
  next.unlocked = Math.min(levelCount, Math.max(next.unlocked, levelIndex + 2));
  return next;
}

/**
 * @param {Progress} progress
 * @param {number} levelIndex
 * @returns {boolean} Whether the level can be played.
 */
export function isUnlocked(progress, levelIndex) {
  return levelIndex >= 0 && levelIndex < progress.unlocked;
}

/**
 * @param {Progress} progress
 * @returns {number} Sum of best stars over all levels.
 */
export function totalStars(progress) {
  return progress.stars.reduce((sum, s) => sum + s, 0);
}
