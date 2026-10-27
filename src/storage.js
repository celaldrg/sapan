/**
 * Tiny localStorage wrapper. Every access is guarded so private mode,
 * blocked storage or quota errors never crash the game.
 */

/** @returns {Storage|null} The browser storage, or null when unavailable. */
function defaultStore() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * Reads a JSON value.
 * @template T
 * @param {string} key Storage key.
 * @param {T} fallback Returned when the key is missing, unreadable or invalid JSON.
 * @param {Pick<Storage, 'getItem'>|null} [store] Storage backend (defaults to localStorage).
 * @returns {T|unknown} The parsed value or the fallback.
 */
export function loadJSON(key, fallback, store = defaultStore()) {
  try {
    const raw = store ? store.getItem(key) : null;
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/**
 * Writes a JSON value.
 * @param {string} key Storage key.
 * @param {unknown} value Any JSON-serialisable value.
 * @param {Pick<Storage, 'setItem'>|null} [store] Storage backend (defaults to localStorage).
 * @returns {boolean} True when the value was stored.
 */
export function saveJSON(key, value, store = defaultStore()) {
  try {
    if (!store) return false;
    store.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
