// Самопроверка (SPEC §7.7): у каждого ключа есть RU и UZ, у каждого варианта схемы — подписи,
// у каждого data-i18n в разметке — ключ в словаре.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { QUESTIONS } from '../public/js/quiz-schema.js';

// i18n.js импортирует storage.js, которому нужен браузер только при вызове — сам импорт безопасен.
const { DICT } = await import('../public/js/i18n.js');
const errors = [];

const ru = Object.keys(DICT.ru);
const uz = Object.keys(DICT.uz);
for (const k of ru) if (!(k in DICT.uz)) errors.push(`нет UZ для ${k}`);
for (const k of uz) if (!(k in DICT.ru)) errors.push(`нет RU для ${k}`);
for (const [lang, d] of Object.entries(DICT)) for (const [k, v] of Object.entries(d)) if (!String(v).trim()) errors.push(`пусто: ${lang}.${k}`);

for (const [key, q] of Object.entries(QUESTIONS)) {
  if (!DICT.ru[`q.${key}`]) errors.push(`нет вопроса q.${key}`);
  for (const id of Object.keys(q.options)) if (!DICT.ru[`opt.${key}.${id}`]) errors.push(`нет подписи opt.${key}.${id}`);
}

const html = readFileSync(fileURLToPath(new URL('../public/index.html', import.meta.url)), 'utf8');
for (const m of html.matchAll(/data-i18n(?:-html)?="([^"]+)"/g)) if (!DICT.ru[m[1]]) errors.push(`index.html: нет ключа ${m[1]}`);
for (const m of html.matchAll(/data-i18n-attr="([^"]+)"/g)) {
  for (const pair of m[1].split(';')) { const key = pair.split(':')[1]; if (key && !DICT.ru[key.trim()]) errors.push(`index.html: нет ключа ${key}`); }
}

// Подозрительные символы в UZ: U+02BB/U+02BC в Roboto Flex с широкими полями (см. i18n.js).
for (const [k, v] of Object.entries(DICT.uz)) if (/[ʻʼ]/.test(v)) errors.push(`uz.${k}: замените ʻ/ʼ на ‘/’`);

if (errors.length) {
  console.error(`✖ ${errors.length} проблем:\n` + errors.map((e) => `  ${e}`).join('\n'));
  process.exit(1);
}
console.log(`✔ словари в порядке: ${ru.length} ключей RU и UZ, ${Object.keys(QUESTIONS).length} вопросов`);
