// Проверка и нормализация заявки (SPEC §5.2). Сервер не доверяет клиенту:
// всё проверяется заново, лишние поля отбрасываются.
import { isValidAnswers } from '../../public/js/quiz-schema.js';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CHANNELS = new Set(['telegram', 'call', 'whatsapp']);
const UTM_KEYS = ['source', 'medium', 'campaign', 'content', 'term'];

const clean = (s) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
const cut = (s, n) => clean(s).slice(0, n);
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

function cleanUrl(s) {
  const v = cut(s, 300);
  return /^https?:\/\//i.test(v) ? v : '';
}

export function normalizeTelegram(s) {
  return clean(s).replace(/^https?:\/\/(www\.)?t\.me\//i, '').replace(/^@/, '');
}

export function validateLead(body) {
  const errors = [];
  if (!isObj(body)) return { ok: false, errors: ['body'] };

  const submission_id = typeof body.submission_id === 'string' && UUID_V4.test(body.submission_id) ? body.submission_id.toLowerCase() : null;
  if (!submission_id) errors.push('submission_id');

  const lang = body.lang === 'uz' ? 'uz' : 'ru';

  const answers = isValidAnswers(body.answers);
  errors.push(...answers.errors);

  const c = isObj(body.contact) ? body.contact : {};
  const name = clean(c.name);
  if (name.length < 2 || name.length > 40) errors.push('contact.name');

  const phone = typeof c.phone === 'string' ? c.phone : '';
  if (!/^998\d{9}$/.test(phone)) errors.push('contact.phone');

  const channel = CHANNELS.has(c.channel) ? c.channel : null;
  if (!channel) errors.push('contact.channel');

  let telegram = '';
  if (c.telegram != null && c.telegram !== '') {
    telegram = normalizeTelegram(c.telegram);
    if (!/^[A-Za-z0-9_]{5,32}$/.test(telegram)) errors.push('contact.telegram');
  }

  const rawComment = String(c.comment ?? '').trim();
  if (rawComment.length > 300) errors.push('contact.comment');
  const comment = rawComment.replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

  if (c.consent !== true) errors.push('contact.consent');

  const m = isObj(body.meta) ? body.meta : {};
  const u = isObj(m.utm) ? m.utm : {};
  const utm = Object.fromEntries(UTM_KEYS.map((k) => [k, cut(u[k], 200)]));
  const quizMs = Number.isInteger(m.quiz_ms) && m.quiz_ms >= 0 && m.quiz_ms <= 3_600_000 ? m.quiz_ms : null;
  if (quizMs === null) errors.push('meta.quiz_ms');

  const meta = {
    utm,
    fbclid: cut(m.fbclid, 200),
    gclid: cut(m.gclid, 200),
    referrer: cleanUrl(m.referrer),
    page: cleanUrl(m.page),
    first_visit: m.first_visit === true,
    quiz_ms: quizMs ?? 0,
  };

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    lead: {
      submission_id,
      lang,
      answers: answers.value,
      contact: { name, phone, channel, telegram, comment },
      meta,
    },
  };
}
