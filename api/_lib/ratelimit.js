// Лимиты и защита от дублей в памяти экземпляра функции (SPEC §5.6).
// У Vercel несколько экземпляров, поэтому работает «по возможности»;
// основная защита от двойного нажатия — на клиенте.
import { createHash } from 'node:crypto';

export const WINDOW_MS = 10 * 60 * 1000;
export const MAX_LEADS = 3;
const CAP = 5000;

const hits = new Map(); // key -> [timestamps]
const subs = new Map(); // submission_id -> { leadId, ts }

export function clientKey(headers = {}) {
  const h = (k) => String(headers[k] || '');
  const ip = h('x-forwarded-for').split(',')[0].trim();
  // Храним только хеш, не IP.
  return createHash('sha256').update(`${h('user-agent')}|${h('accept-language')}|${ip}`).digest('hex').slice(0, 32);
}

function sweep(now) {
  for (const [k, list] of hits) {
    const fresh = list.filter((t) => now - t < WINDOW_MS);
    if (fresh.length) hits.set(k, fresh); else hits.delete(k);
  }
  for (const [k, v] of subs) if (now - v.ts >= WINDOW_MS) subs.delete(k);
  while (hits.size > CAP) hits.delete(hits.keys().next().value);
  while (subs.size > CAP) subs.delete(subs.keys().next().value);
}

export function checkRate(key, now = Date.now()) {
  sweep(now);
  const list = hits.get(key) || [];
  if (list.length >= MAX_LEADS) {
    const retryAfter = Math.ceil((WINDOW_MS - (now - list[0])) / 1000);
    return { ok: false, retryAfter: Math.max(1, retryAfter) };
  }
  return { ok: true };
}

export function recordHit(key, now = Date.now()) {
  const list = hits.get(key) || [];
  list.push(now);
  hits.set(key, list);
}

export function findDuplicate(submissionId, now = Date.now()) {
  sweep(now);
  const v = subs.get(submissionId);
  return v ? v.leadId : null;
}

export function rememberSubmission(submissionId, leadId, now = Date.now()) {
  subs.set(submissionId, { leadId, ts: now });
}

export function _resetRateLimit() {
  hits.clear();
  subs.clear();
}
