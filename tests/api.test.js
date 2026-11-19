import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import lead from '../api/lead.js';
import bot from '../api/bot.js';
import setup from '../api/setup.js';
import { webhookSecret } from '../api/_lib/telegram.js';
import { _resetRateLimit } from '../api/_lib/ratelimit.js';
import { mockReq, mockRes, validBody, mockFetch, tgOk, env, noSleep } from './helpers.js';

beforeEach(() => _resetRateLimit());

async function callLead(body, { e = env(), headers, responses = [tgOk], method } = {}) {
  const f = mockFetch(responses);
  const res = mockRes();
  try {
    await lead(mockReq({ body, headers, method }), res, { env: e, sleep: noSleep });
  } finally { f.restore(); }
  return { res, calls: f.calls, json: res.body ? res.json() : null };
}

// ── /api/lead ───────────────────────────────────────────
test('lead: успешная заявка уходит в Telegram', async () => {
  const { res, calls, json } = await callLead(validBody());
  assert.equal(res.statusCode, 200);
  assert.equal(json.ok, true);
  assert.match(json.lead_id, /^PC-/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.chat_id, '-1001');
  assert.equal(calls[0].body.parse_mode, 'HTML');
  assert.match(calls[0].body.text, /Новая заявка/);
  assert.match(calls[0].url, /bot123:ABC\/sendMessage$/);
});

test('lead: несколько чатов, достаточно одного успешного', async () => {
  const { res, calls } = await callLead(validBody(), { e: env({ chats: ['-1', '-2'] }), responses: [tgOk, { status: 403, json: { ok: false, error_code: 403, description: 'Forbidden' } }] });
  assert.equal(res.statusCode, 200);
  assert.equal(calls.length, 2);
});

test('lead: ловушка и слишком быстрый квиз — тихий отказ', async () => {
  for (const body of [validBody({ website: 'http://spam' }), validBody({ meta: { ...validBody().meta, quiz_ms: 1200 } })]) {
    const { res, calls, json } = await callLead(body);
    assert.equal(res.statusCode, 200);
    assert.equal(json.ok, true);
    assert.equal(calls.length, 0);
  }
});

test('lead: 400 с перечнем полей', async () => {
  const { res, json, calls } = await callLead(validBody({ contact: { name: 'А', phone: '1', channel: 'telegram', consent: false } }));
  assert.equal(res.statusCode, 400);
  assert.deepEqual(json.fields, ['contact.name', 'contact.phone', 'contact.consent']);
  assert.equal(calls.length, 0);
});

test('lead: метод, тип, размер, битый JSON', async () => {
  assert.equal((await callLead(validBody(), { method: 'GET' })).res.statusCode, 405);
  assert.equal((await callLead(validBody(), { headers: { 'content-type': 'text/plain' } })).res.statusCode, 415);
  assert.equal((await callLead(validBody({ pad: 'x'.repeat(11000) }))).res.statusCode, 413);
  assert.equal((await callLead('{oops')).res.statusCode, 400);
});

test('lead: 500 not_configured без токена', async () => {
  const { res, json } = await callLead(validBody(), { e: env({ token: '', configured: false }) });
  assert.equal(res.statusCode, 500);
  assert.equal(json.error, 'not_configured');
});

test('lead: 502 после трёх неудачных попыток', async () => {
  const { res, calls, json } = await callLead(validBody(), { responses: [{ status: 502, json: { ok: false, error_code: 502, description: 'Bad Gateway' } }] });
  assert.equal(res.statusCode, 502);
  assert.equal(json.error, 'delivery_failed');
  assert.equal(calls.length, 3);
});

test('lead: сетевая ошибка, затем успех', async () => {
  const { res, calls } = await callLead(validBody(), { responses: [new TypeError('fetch failed'), tgOk] });
  assert.equal(res.statusCode, 200);
  assert.equal(calls.length, 2);
});

test('lead: 429 от Telegram повторяется', async () => {
  const { res, calls } = await callLead(validBody(), { responses: [{ status: 429, json: { ok: false, error_code: 429, description: 'Too Many Requests', parameters: { retry_after: 1 } } }, tgOk] });
  assert.equal(res.statusCode, 200);
  assert.equal(calls.length, 2);
});

test('lead: группа стала супергруппой — отправка на новый ID', async () => {
  const { res, calls } = await callLead(validBody(), { responses: [{ status: 400, json: { ok: false, error_code: 400, description: 'group chat was upgraded', parameters: { migrate_to_chat_id: -100777 } } }, tgOk] });
  assert.equal(res.statusCode, 200);
  assert.equal(calls[1].body.chat_id, -100777);
});

test('lead: повтор той же отправки не создаёт вторую заявку', async () => {
  const body = validBody();
  const first = await callLead(body);
  const second = await callLead(body);
  assert.equal(second.json.duplicate, true);
  assert.equal(second.json.lead_id, first.json.lead_id);
  assert.equal(second.calls.length, 0);
});

test('lead: четвёртая заявка за 10 минут — 429', async () => {
  for (let i = 0; i < 3; i++) assert.equal((await callLead(validBody())).res.statusCode, 200);
  const { res, json } = await callLead(validBody());
  assert.equal(res.statusCode, 429);
  assert.equal(json.error, 'rate_limited');
  assert.ok(res.headers['retry-after']);
});

// ── /api/bot ────────────────────────────────────────────
async function callBot(update, { e = env(), secret, responses = [tgOk] } = {}) {
  const f = mockFetch(responses);
  const res = mockRes();
  const headers = { 'x-telegram-bot-api-secret-token': secret ?? webhookSecret(e.token) };
  try { await bot(mockReq({ body: update, headers }), res, { env: e }); } finally { f.restore(); }
  return { res, calls: f.calls };
}

test('bot: неверный секрет — 401', async () => {
  const { res, calls } = await callBot({}, { secret: 'wrong' });
  assert.equal(res.statusCode, 401);
  assert.equal(calls.length, 0);
});

test('bot: /start в личке и /id в группе', async () => {
  let r = await callBot({ message: { text: '/start', chat: { id: 42, type: 'private' } } });
  assert.equal(r.res.statusCode, 200);
  assert.match(r.calls[0].body.text, /Ваш ID: <code>42<\/code>/);
  r = await callBot({ message: { text: '/id@pc_store_bot', chat: { id: -100555, type: 'supergroup' } } });
  assert.match(r.calls[0].body.text, /ID этой группы: <code>-100555<\/code>/);
});

test('bot: /test только в группе заявок', async () => {
  let r = await callBot({ message: { text: '/test', chat: { id: -999, type: 'group' } } });
  assert.match(r.calls[0].body.text, /только в группе заявок/);
  r = await callBot({ message: { text: '/test', chat: { id: -1001, type: 'supergroup' } } });
  assert.match(r.calls[0].body.text, /ТЕСТ/);
  assert.match(r.calls[0].body.text, /Новая заявка PC-TEST/);
});

test('bot: добавили в группу — пишет её ID', async () => {
  const { calls } = await callBot({ my_chat_member: { chat: { id: -100123, type: 'supergroup' }, old_chat_member: { status: 'left' }, new_chat_member: { status: 'member' } } });
  assert.match(calls[0].body.text, /-100123/);
});

test('bot: обычные сообщения игнорируются, ошибки не ломают ответ', async () => {
  let r = await callBot({ message: { text: 'привет', chat: { id: -1001, type: 'group' } } });
  assert.equal(r.calls.length, 0);
  r = await callBot({ message: { text: '/start', chat: { id: 1, type: 'private' } } }, { responses: [new Error('boom')] });
  assert.equal(r.res.statusCode, 200);
});

// ── /api/setup ──────────────────────────────────────────
test('setup: только на production', async () => {
  const res = mockRes();
  await setup(mockReq({ method: 'GET' }), res, { env: env({ vercelEnv: 'preview' }) });
  assert.equal(res.statusCode, 403);
});

test('setup: webhook на production-адрес с секретом', async () => {
  const f = mockFetch([tgOk, tgOk, { json: { ok: true, result: { url: 'https://example.vercel.app/api/bot', pending_update_count: 0 } } }]);
  const res = mockRes();
  try { await setup(mockReq({ method: 'GET' }), res, { env: env() }); } finally { f.restore(); }
  assert.equal(res.statusCode, 200);
  assert.equal(f.calls[0].body.url, 'https://example.vercel.app/api/bot');
  assert.equal(f.calls[0].body.secret_token, webhookSecret('123:ABC'));
  assert.equal(res.json().webhook_url, 'https://example.vercel.app/api/bot');
  assert.doesNotMatch(res.body, /123:ABC/);
});
