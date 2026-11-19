// POST /api/lead — приём заявки из квиза и отправка в Telegram-группу менеджеров (SPEC §5).
import { send, readJson, header } from './_lib/http.js';
import { getEnv } from './_lib/env.js';
import { validateLead } from './_lib/validate.js';
import { score } from './_lib/score.js';
import { newLeadId } from './_lib/lead-id.js';
import { describeUA } from './_lib/ua.js';
import { formatLead } from './_lib/format.js';
import { sendToChats } from './_lib/telegram.js';
import { clientKey, checkRate, recordHit, findDuplicate, rememberSubmission } from './_lib/ratelimit.js';
import { log } from './_lib/log.js';

export const MIN_QUIZ_MS = 5000;

export default async function handler(req, res, deps = {}) {
  const now = deps.now ? deps.now() : Date.now();
  const env = deps.env || getEnv();

  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'method' }, { Allow: 'POST' });
  if (!/application\/json/i.test(header(req, 'content-type'))) return send(res, 415, { ok: false, error: 'content_type' });

  const parsed = await readJson(req);
  if (!parsed.ok) {
    return parsed.error === 'too_large'
      ? send(res, 413, { ok: false, error: 'too_large' })
      : send(res, 400, { ok: false, error: 'validation', fields: ['body'] });
  }
  const body = parsed.data && typeof parsed.data === 'object' ? parsed.data : {};

  // Антиспам: тихий отказ, который выглядит как успех.
  if (typeof body.website === 'string' && body.website.trim() !== '') {
    log('info', 'spam.honeypot');
    return send(res, 200, { ok: true, lead_id: newLeadId() });
  }
  const quizMs = body.meta && Number.isInteger(body.meta.quiz_ms) ? body.meta.quiz_ms : null;
  if (quizMs !== null && quizMs < MIN_QUIZ_MS) {
    log('info', 'spam.too_fast', { quiz_ms: quizMs });
    return send(res, 200, { ok: true, lead_id: newLeadId() });
  }

  // Повтор той же отправки (двойное нажатие, повтор после ошибки сети).
  if (typeof body.submission_id === 'string') {
    const dup = findDuplicate(body.submission_id.toLowerCase(), now);
    if (dup) {
      log('info', 'lead.duplicate', { lead_id: dup });
      return send(res, 200, { ok: true, lead_id: dup, duplicate: true });
    }
  }

  const key = clientKey(req.headers || {});
  const rate = checkRate(key, now);
  if (!rate.ok) {
    log('warn', 'rate.limited');
    return send(res, 429, { ok: false, error: 'rate_limited', retry_after: rate.retryAfter }, { 'Retry-After': String(rate.retryAfter) });
  }

  const v = validateLead(body);
  if (!v.ok) {
    log('info', 'lead.invalid', { fields: v.errors });
    return send(res, 400, { ok: false, error: 'validation', fields: v.errors });
  }

  if (!env.configured) {
    log('error', 'config.missing', { token: Boolean(env.token), chats: env.chats.length });
    return send(res, 500, { ok: false, error: 'not_configured' });
  }

  const lead = v.lead;
  const leadId = newLeadId();
  const temperature = score(lead.answers);
  const device = describeUA(header(req, 'user-agent'));
  const text = formatLead({ lead, leadId, temperature, device, now: new Date(now) });

  const started = Date.now();
  const sent = await sendToChats(env.chats, text, {}, { env, sleep: deps.sleep });
  const fields = { lead_id: leadId, temp: temperature, lang: lead.lang, chats_ok: sent.ok, chats_failed: sent.failed, tg_ms: Date.now() - started };

  if (sent.ok === 0) {
    log('error', 'lead.failed', fields);
    return send(res, 502, { ok: false, error: 'delivery_failed' });
  }

  rememberSubmission(lead.submission_id, leadId, now);
  recordHit(key, now);
  log('info', 'lead.sent', fields);
  return send(res, 200, { ok: true, lead_id: leadId });
}
