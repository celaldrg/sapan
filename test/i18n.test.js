import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LANGS, STRINGS, normalizeLang, otherLang, translate, formatNumber } from '../src/i18n.js';
import { LEVELS } from '../src/levels.js';

test('English and Turkish define the same non-empty keys', () => {
  const en = Object.keys(STRINGS.en).sort();
  assert.deepEqual(LANGS, ['en', 'tr']);
  assert.deepEqual(Object.keys(STRINGS.tr).sort(), en);
  for (const lang of LANGS) {
    for (const key of en) assert.ok(STRINGS[lang][key].trim().length > 0, `${lang}.${key}`);
  }
});

test('the toggle shows the other language and switches back', () => {
  assert.equal(translate('en', 'langToggle'), 'TR');
  assert.equal(translate('tr', 'langToggle'), 'EN');
  assert.equal(otherLang('en'), 'tr');
  assert.equal(otherLang('tr'), 'en');
  assert.equal(otherLang('xx'), 'tr', 'unknown counts as English');
});

test('unknown languages fall back to English', () => {
  assert.equal(normalizeLang('tr'), 'tr');
  assert.equal(normalizeLang('de'), 'en');
  assert.equal(normalizeLang(null), 'en');
  assert.equal(normalizeLang({}), 'en');
});

test('placeholders are filled; missing keys and params stay visible', () => {
  assert.equal(translate('en', 'level', { n: 3 }), 'Level 3');
  assert.equal(translate('tr', 'level', { n: 3 }), 'Bölüm 3');
  assert.equal(translate('en', 'ammoLeft', { n: 2, total: 4 }), '2 of 4 stones left');
  assert.equal(translate('en', 'level'), 'Level {n}');
  assert.equal(translate('en', 'no.such.key'), 'no.such.key');
});

test('every level and every key used in index.html has a string in both languages', () => {
  for (const level of LEVELS) {
    for (const lang of LANGS) assert.ok(Object.hasOwn(STRINGS[lang], `level.${level.key}`), `${lang} level.${level.key}`);
  }
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const keys = [...html.matchAll(/data-i18n(?:-label)?="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(keys.length > 10);
  for (const key of keys) assert.ok(Object.hasOwn(STRINGS.en, key), `missing string ${key}`);
});

test('numbers use the language digit grouping', () => {
  assert.equal(formatNumber('en', 12300), '12,300');
  assert.equal(formatNumber('tr', 12300), '12.300');
  assert.equal(formatNumber('en', 0), '0');
});
