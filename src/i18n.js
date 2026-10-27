/**
 * English and Turkish UI strings. Pure data plus lookup helpers, so tests can check
 * that both languages define the same keys.
 */

/** Supported languages; the first one is the default. */
export const LANGS = Object.freeze(['en', 'tr']);

/** Storage key for the chosen language. */
export const LANG_KEY = 'sapan.lang';

/** @type {Readonly<Record<string, Readonly<Record<string, string>>>>} */
export const STRINGS = Object.freeze({
  en: Object.freeze({
    title: 'Sapan',
    docTitle: 'Sapan: slingshot castle game',
    newGame: 'New game',
    newGameLabel: 'New game: choose a level',
    langToggle: 'TR',
    langToggleLabel: 'Türkçe’ye geç (switch to Turkish)',
    mute: 'Mute sound',
    restart: 'Restart',
    restartLabel: 'Restart level (R)',
    level: 'Level {n}',
    'level.gate': 'The Gate',
    'level.lookout': 'Lookout Tower',
    'level.steps': 'Stone Steps',
    'level.twins': 'Twin Bastions',
    'level.keep': 'The Keep',
    score: 'Score',
    ammoLeft: '{n} of {total} stones left',
    goblinsLeft: '{n} of {total} goblins left',
    hintTouch: 'Drag back to aim, release to fire',
    hintKeys: '↑/↓ angle · ←/→ power · Space fire · R restart · Esc levels',
    canvasLabel: 'Game area. Drag back to pull the slingshot, release to fire.',
    chooseLevel: 'Choose a level',
    totalStars: '{n} of {max} stars collected',
    locked: 'Locked',
    close: 'Close',
    starsLabel: '{n} of 3 stars',
    won: 'Castle cleared!',
    wonAll: 'Every castle has fallen!',
    lost: 'Out of stones',
    lostText: 'Goblins still standing: {n}',
    scoreLine: 'Score {score}',
    bestLine: 'Best {best}',
    newBest: 'New best!',
    next: 'Next level',
    retry: 'Retry',
    levels: 'Levels',
    footer: 'MIT · Source on GitHub',
  }),
  tr: Object.freeze({
    title: 'Sapan',
    docTitle: 'Sapan: sapanla kale yıkma oyunu',
    newGame: 'Yeni oyun',
    newGameLabel: 'Yeni oyun: bölüm seç',
    langToggle: 'EN',
    langToggleLabel: 'Switch to English (İngilizceye geç)',
    mute: 'Sesi kapat',
    restart: 'Yeniden',
    restartLabel: 'Bölümü yeniden başlat (R)',
    level: 'Bölüm {n}',
    'level.gate': 'Kale Kapısı',
    'level.lookout': 'Gözcü Kulesi',
    'level.steps': 'Taş Basamaklar',
    'level.twins': 'İkiz Burçlar',
    'level.keep': 'İç Kale',
    score: 'Puan',
    ammoLeft: '{total} taştan {n} tane kaldı',
    goblinsLeft: '{total} goblinden {n} tane kaldı',
    hintTouch: 'Nişan almak için geri çek, atmak için bırak',
    hintKeys: '↑/↓ açı · ←/→ güç · Boşluk at · R yeniden · Esc bölümler',
    canvasLabel: 'Oyun alanı. Sapanı geri çek, atmak için bırak.',
    chooseLevel: 'Bölüm seç',
    totalStars: '{max} yıldızdan {n} tanesi toplandı',
    locked: 'Kilitli',
    close: 'Kapat',
    starsLabel: '3 yıldızdan {n}',
    won: 'Kale temizlendi!',
    wonAll: 'Bütün kaleler düştü!',
    lost: 'Taş bitti',
    lostText: 'Ayakta kalan goblin: {n}',
    scoreLine: 'Puan {score}',
    bestLine: 'En iyi {best}',
    newBest: 'Yeni rekor!',
    next: 'Sonraki bölüm',
    retry: 'Tekrar dene',
    levels: 'Bölümler',
    footer: 'MIT · Kaynak kodu GitHub’da',
  }),
});

/**
 * Returns a supported language code, falling back to the default.
 * @param {unknown} value Any saved or requested value.
 * @returns {'en'|'tr'}
 */
export function normalizeLang(value) {
  return /** @type {'en'|'tr'} */ (LANGS.includes(/** @type {string} */ (value)) ? value : LANGS[0]);
}

/**
 * The language the toggle switches to.
 * @param {string} lang Current language.
 * @returns {'en'|'tr'}
 */
export function otherLang(lang) {
  return normalizeLang(lang) === 'en' ? 'tr' : 'en';
}

/**
 * Looks up a string and fills `{name}` placeholders.
 * Unknown keys return the key itself so a missing string is visible but harmless.
 * @param {string} lang Language code.
 * @param {string} key String key.
 * @param {Record<string, string|number>} [params] Placeholder values.
 * @returns {string}
 */
export function translate(lang, key, params = {}) {
  const table = STRINGS[normalizeLang(lang)];
  const text = Object.hasOwn(table, key) ? table[key] : key;
  return text.replace(/\{(\w+)\}/g, (match, name) => (Object.hasOwn(params, name) ? String(params[name]) : match));
}

/**
 * Formats a score with the language's digit grouping.
 * @param {string} lang Language code.
 * @param {number} value
 * @returns {string}
 */
export function formatNumber(lang, value) {
  return Math.round(value).toLocaleString(normalizeLang(lang) === 'tr' ? 'tr-TR' : 'en-US');
}
