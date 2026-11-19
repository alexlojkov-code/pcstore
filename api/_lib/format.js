// Текст сообщения о заявке для Telegram (SPEC §6.2), parse_mode: HTML.
import { QUESTIONS, labelFor } from '../../public/js/quiz-schema.js';
import { TEMPERATURE } from './score.js';

export const TG_LIMIT = 4096;

export function escapeHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// 998901234567 → +998 90 123-45-67
export function formatPhone(p) {
  const d = String(p).replace(/\D/g, '').replace(/^998/, '');
  if (d.length !== 9) return `+${p}`;
  return `+998 ${d.slice(0, 2)} ${d.slice(2, 5)}-${d.slice(5, 7)}-${d.slice(7, 9)}`;
}

export function formatDuration(ms) {
  const sec = Math.max(0, Math.round(ms / 1000));
  if (sec < 60) return `${sec} сек`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m} мин ${s} сек` : `${m} мин`;
}

export function formatTashkent(date) {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date).replace(',', '');
}

function channelLine(contact) {
  if (contact.channel === 'telegram') {
    return contact.telegram
      ? `Telegram @${escapeHtml(contact.telegram)}`
      : 'Telegram (ник не указан, писать по номеру)';
  }
  if (contact.channel === 'whatsapp') return `<a href="https://wa.me/${escapeHtml(contact.phone)}">WhatsApp</a>`;
  return 'Звонок';
}

function sourceLine(meta) {
  const utm = ['source', 'medium', 'campaign', 'content', 'term'].map((k) => meta.utm?.[k]).filter(Boolean);
  let line = '';
  if (utm.length) line = utm.map(escapeHtml).join(' / ');
  else if (meta.referrer) {
    try { line = `из: ${escapeHtml(new URL(meta.referrer).hostname)}`; } catch { /* нет домена */ }
  }
  const clicks = [meta.fbclid && 'fb', meta.gclid && 'google'].filter(Boolean);
  if (clicks.length) line = line ? `${line} · ${clicks.join(' · ')}` : clicks.join(' · ');
  return line ? `📣 ${line}` : '';
}

const labels = (key, ids) => ids.map((id) => escapeHtml(labelFor(key, id))).join(', ');

/**
 * @param {object} p
 * @param {object} p.lead       нормализованная заявка из validateLead
 * @param {string} p.leadId
 * @param {'hot'|'warm'|'cold'} p.temperature
 * @param {string} p.device     описание из describeUA
 * @param {Date}   [p.now]
 * @param {boolean} [p.test]    пометка «ТЕСТ» для команды /test
 */
export function formatLead({ lead, leadId, temperature, device, now = new Date(), test = false }) {
  const { answers: a, contact: c, meta: m, lang } = lead;
  const t = TEMPERATURE[temperature] || TEMPERATURE.warm;
  const interestKey = a.peripherals ? 'peripherals' : 'parts';
  const interest = a[interestKey] || [];
  let delivery = escapeHtml(labelFor('delivery', a.delivery));
  if (a.delivery === 'region' && a.city) delivery += ` — ${escapeHtml(a.city)}`;

  const head = `${test ? '🧪 <b>ТЕСТ</b> · ' : ''}${t.icon} <b>Новая заявка ${escapeHtml(leadId)}</b> · ${t.label}`;

  const footer = [
    [lang.toUpperCase(), `📱 ${escapeHtml(device)}`, `⌛ квиз за ${formatDuration(m.quiz_ms)}`, m.first_visit ? 'первый визит' : 'повторный визит'].join(' · ').replace(/^/, '🌐 '),
    sourceLine(m),
    `🕒 ${formatTashkent(now)} (Ташкент)`,
  ].filter(Boolean);

  const build = (comment) => [
    head,
    '',
    `👤 <b>${escapeHtml(c.name)}</b>`,
    `📞 ${formatPhone(c.phone)}`,
    `💬 Связь: ${channelLine(c)}`,
    '',
    `🖥 ${QUESTIONS.need.label}: ${escapeHtml(labelFor('need', a.need))}`,
    `🎯 ${QUESTIONS.purpose.label}: ${labels('purpose', a.purpose || [])}`,
    `🧩 ${QUESTIONS[interestKey].label}: ${labels(interestKey, interest)}`,
    `💰 ${QUESTIONS.budget.label}: ${escapeHtml(labelFor('budget', a.budget))}`,
    `⏱ ${QUESTIONS.timing.label}: ${escapeHtml(labelFor('timing', a.timing))}`,
    `🚚 ${QUESTIONS.delivery.label}: ${delivery}`,
    comment ? `📝 Комментарий: ${escapeHtml(comment)}` : null,
    '',
    '— — —',
    ...footer,
  ].filter((l) => l !== null).join('\n');

  let text = build(c.comment);
  if (text.length > TG_LIMIT && c.comment) {
    const over = text.length - TG_LIMIT + 1;
    text = build(c.comment.slice(0, Math.max(0, c.comment.length - over - 20)) + '…');
  }
  return text.slice(0, TG_LIMIT);
}

// Пример заявки для команды /test.
export function sampleLead() {
  return {
    submission_id: '00000000-0000-4000-8000-000000000000',
    lang: 'ru',
    answers: { need: 'build', purpose: ['gaming', 'streaming'], parts: ['gpu', 'cpu', 'full_build'], budget: '15_25', timing: 'week', delivery: 'region', city: 'Самарканд' },
    contact: { name: 'Алишер', phone: '998901234567', channel: 'telegram', telegram: 'alisher_pc', comment: 'хочу тянуть CS2 на 240 fps' },
    meta: { utm: { source: 'instagram', medium: 'cpc', campaign: 'pc_build_nov', content: 'video1', term: '' }, fbclid: '', gclid: '', referrer: '', page: '', first_visit: true, quiz_ms: 48210 },
  };
}
