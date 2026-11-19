import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateLead, normalizeTelegram } from '../api/_lib/validate.js';
import { score } from '../api/_lib/score.js';
import { newLeadId, LEAD_ID_RE } from '../api/_lib/lead-id.js';
import { describeUA } from '../api/_lib/ua.js';
import { clientKey, checkRate, recordHit, findDuplicate, rememberSubmission, _resetRateLimit, WINDOW_MS } from '../api/_lib/ratelimit.js';
import { formatLead, formatPhone, formatDuration, sampleLead, TG_LIMIT } from '../api/_lib/format.js';
import { validBody } from './helpers.js';

// ── validate ────────────────────────────────────────────
test('validateLead: корректная заявка нормализуется', () => {
  const r = validateLead(validBody({ contact: { name: '  Алишер   Каримов ', phone: '998901234567', channel: 'telegram', telegram: '@alisher_pc', consent: true }, extra: 'x' }));
  assert.equal(r.ok, true);
  assert.equal(r.lead.contact.name, 'Алишер Каримов');
  assert.equal(r.lead.contact.telegram, 'alisher_pc');
  assert.equal(r.lead.extra, undefined);
});

test('validateLead: каждое поле проверяется', () => {
  const bad = (over) => validateLead(validBody(over)).errors;
  assert.deepEqual(bad({ submission_id: 'nope' }), ['submission_id']);
  assert.deepEqual(bad({ contact: { ...validBody().contact, name: 'А' } }), ['contact.name']);
  assert.deepEqual(bad({ contact: { ...validBody().contact, phone: '99890123456' } }), ['contact.phone']);
  assert.deepEqual(bad({ contact: { ...validBody().contact, phone: '9989012345678' } }), ['contact.phone']);
  assert.deepEqual(bad({ contact: { ...validBody().contact, channel: 'pigeon' } }), ['contact.channel']);
  assert.deepEqual(bad({ contact: { ...validBody().contact, telegram: 'ab' } }), ['contact.telegram']);
  assert.deepEqual(bad({ contact: { ...validBody().contact, comment: 'x'.repeat(301) } }), ['contact.comment']);
  assert.deepEqual(bad({ contact: { ...validBody().contact, consent: 'true' } }), ['contact.consent']);
  assert.deepEqual(bad({ meta: { ...validBody().meta, quiz_ms: -1 } }), ['meta.quiz_ms']);
});

test('validateLead: обрезка и чистка метаданных', () => {
  const r = validateLead(validBody({ lang: 'en', meta: { utm: { source: 'x'.repeat(500) }, referrer: 'javascript:alert(1)', page: 'https://a.uz/', first_visit: 'yes', quiz_ms: 9000 } }));
  assert.equal(r.ok, true);
  assert.equal(r.lead.lang, 'ru');
  assert.equal(r.lead.meta.utm.source.length, 200);
  assert.equal(r.lead.meta.referrer, '');
  assert.equal(r.lead.meta.first_visit, false);
});

test('normalizeTelegram', () => {
  assert.equal(normalizeTelegram('https://t.me/abc_de'), 'abc_de');
  assert.equal(normalizeTelegram('@abc_de'), 'abc_de');
});

// ── score: все 24 сочетания ─────────────────────────────
test('score: все сочетания срока и бюджета', () => {
  const budgets = ['lt3', '3_7', '7_15', '15_25', 'gt25', 'unknown'];
  for (const timing of ['now', 'week', 'month', 'browsing']) {
    for (const budget of budgets) {
      let want = 'warm';
      if (timing === 'browsing') want = 'cold';
      else if ((timing === 'now' || timing === 'week') && budget !== 'unknown') want = 'hot';
      assert.equal(score({ timing, budget }), want, `${timing}/${budget}`);
    }
  }
});

// ── lead id ─────────────────────────────────────────────
test('newLeadId: формат', () => {
  for (let i = 0; i < 200; i++) assert.match(newLeadId(), LEAD_ID_RE);
});

// ── ua ──────────────────────────────────────────────────
test('describeUA: реальные строки', () => {
  const cases = [
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1', 'Телефон, iOS / Safari'],
    ['Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36', 'Телефон, Android / Chrome'],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0.0', 'Телефон, iOS / Instagram'],
    ['Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36 Telegram-Android/10.12.0', 'Телефон, Android / Telegram'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0', 'ПК, Windows / Edge'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 YaBrowser/24.4.0.0 Safari/537.36', 'ПК, Windows / Яндекс Браузер'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15', 'ПК, macOS / Safari'],
    ['Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0', 'ПК, Linux / Firefox'],
    ['Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/117.0.0.0 Mobile Safari/537.36', 'Телефон, Android / Samsung Internet'],
    ['Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36', 'Планшет, Android / Chrome'],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/460.0]', 'Телефон, iOS / Facebook'],
  ];
  for (const [ua, want] of cases) assert.equal(describeUA(ua), want, ua);
  assert.equal(describeUA(''), '—');
});

// ── rate limit ──────────────────────────────────────────
test('ratelimit: четвёртая заявка за 10 минут — отказ', () => {
  _resetRateLimit();
  const key = clientKey({ 'user-agent': 'ua', 'x-forwarded-for': '1.2.3.4, 5.6.7.8' });
  assert.equal(key.length, 32);
  const t0 = 1_000_000;
  for (let i = 0; i < 3; i++) { assert.equal(checkRate(key, t0 + i).ok, true); recordHit(key, t0 + i); }
  const r = checkRate(key, t0 + 10);
  assert.equal(r.ok, false);
  assert.ok(r.retryAfter > 0 && r.retryAfter <= 600);
  assert.equal(checkRate(key, t0 + WINDOW_MS + 5).ok, true, 'старые записи очищаются');
});

test('ratelimit: дубль submission_id', () => {
  _resetRateLimit();
  rememberSubmission('s1', 'PC-AAAA', 0);
  assert.equal(findDuplicate('s1', 1000), 'PC-AAAA');
  assert.equal(findDuplicate('s1', WINDOW_MS + 1), null);
});

// ── format ──────────────────────────────────────────────
test('formatPhone и formatDuration', () => {
  assert.equal(formatPhone('998901234567'), '+998 90 123-45-67');
  assert.equal(formatDuration(48210), '48 сек');
  assert.equal(formatDuration(72000), '1 мин 12 сек');
});

const NOW = new Date('2026-11-19T09:32:00Z');

test('formatLead: полная заявка', () => {
  const text = formatLead({ lead: sampleLead(), leadId: 'PC-4F7K', temperature: 'hot', device: 'Телефон, iOS / Safari', now: NOW });
  assert.equal(text, [
    '🔥 <b>Новая заявка PC-4F7K</b> · горячая',
    '',
    '👤 <b>Алишер</b>',
    '📞 +998 90 123-45-67',
    '💬 Связь: Telegram @alisher_pc',
    '',
    '🖥 Нужно: Собрать ПК с нуля',
    '🎯 Для чего: Игры, Стриминг',
    '🧩 Интересует: Видеокарта, Процессор, Готовая сборка целиком',
    '💰 Бюджет: 15–25 млн сум',
    '⏱ Покупка: На этой неделе',
    '🚚 Получение: Доставка в регион — Самарканд',
    '📝 Комментарий: хочу тянуть CS2 на 240 fps',
    '',
    '— — —',
    '🌐 RU · 📱 Телефон, iOS / Safari · ⌛ квиз за 48 сек · первый визит',
    '📣 instagram / cpc / pc_build_nov / video1',
    '🕒 19.11.2026 14:32 (Ташкент)',
  ].join('\n'));
});

test('formatLead: минимальная заявка, периферия и WhatsApp', () => {
  const lead = sampleLead();
  lead.answers = { need: 'peripherals', purpose: ['work'], peripherals: ['mouse', 'keyboard'], budget: 'unknown', timing: 'browsing', delivery: 'pickup' };
  lead.contact = { name: 'Нодира', phone: '998711112233', channel: 'whatsapp', telegram: '', comment: '' };
  lead.meta = { ...lead.meta, utm: {}, referrer: 'https://l.instagram.com/?u=x', fbclid: 'abc', first_visit: false, quiz_ms: 72000 };
  const text = formatLead({ lead, leadId: 'PC-2222', temperature: 'cold', device: 'ПК, Windows / Chrome', now: NOW });
  assert.match(text, /^❄️ <b>Новая заявка PC-2222<\/b> · холодная/);
  assert.match(text, /💬 Связь: <a href="https:\/\/wa\.me\/998711112233">WhatsApp<\/a>/);
  assert.match(text, /🧩 Интересует: Мышь, Клавиатура/);
  assert.match(text, /📣 из: l\.instagram\.com · fb/);
  assert.match(text, /квиз за 1 мин 12 сек · повторный визит/);
  assert.doesNotMatch(text, /Комментарий/);
});

test('formatLead: HTML экранируется, длина не больше 4096', () => {
  const lead = sampleLead();
  lead.contact = { ...lead.contact, name: '<script>&', channel: 'telegram', telegram: '', comment: '<b>x</b> & ' + 'я'.repeat(300) };
  const text = formatLead({ lead, leadId: 'PC-3333', temperature: 'warm', device: '—', now: NOW });
  assert.match(text, /👤 <b>&lt;script&gt;&amp;<\/b>/);
  assert.match(text, /&lt;b&gt;x&lt;\/b&gt; &amp;/);
  assert.match(text, /ник не указан/);
  lead.contact.comment = 'я'.repeat(5000);
  assert.ok(formatLead({ lead, leadId: 'PC-3333', temperature: 'warm', device: '—', now: NOW }).length <= TG_LIMIT);
});
