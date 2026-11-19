// Вызовы Telegram Bot API с повторами и таймаутами (SPEC §6.1).
import { createHash } from 'node:crypto';
import { getEnv } from './env.js';
import { log } from './log.js';

const sleepDefault = (ms) => new Promise((r) => setTimeout(r, ms));

// Секрет webhook вычисляется из токена: отдельная переменная не нужна.
export function webhookSecret(token) {
  return createHash('sha256').update('business-landing:' + token).digest('hex').slice(0, 48);
}

/**
 * Вызов метода Bot API.
 * Возвращает { ok, result } или { ok: false, error_code, description, migrate_to }.
 * Повторяет при сети, таймауте, 5xx и 429; 400/403 не повторяет.
 */
export async function tg(method, payload, { attempts = 3, sleep = sleepDefault, env = getEnv() } = {}) {
  if (env.mock) {
    console.log(`\n[TELEGRAM_MOCK] ${method} → ${payload.chat_id ?? ''}\n${payload.text ?? JSON.stringify(payload)}\n`);
    return { ok: true, result: { message_id: 1 } };
  }

  const url = `https://api.telegram.org/bot${env.token}/${method}`;
  const delays = [300, 900];
  let last = { ok: false, error_code: 0, description: 'not_sent' };

  for (let i = 0; i < attempts; i++) {
    let wait = delays[i] ?? 900;
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(4000),
      });
      const data = await r.json().catch(() => ({ ok: false, description: `http_${r.status}` }));
      if (data.ok) return { ok: true, result: data.result };

      last = {
        ok: false,
        error_code: data.error_code ?? r.status,
        description: String(data.description || `http_${r.status}`),
        migrate_to: data.parameters?.migrate_to_chat_id,
      };
      const code = last.error_code;
      if (code === 429) {
        wait = Math.min(Number(data.parameters?.retry_after || 1) * 1000, 5000);
      } else if (code < 500) {
        return last; // ошибка данных или бота выгнали — повтор не поможет
      }
    } catch (err) {
      last = { ok: false, error_code: 0, description: err?.name === 'TimeoutError' ? 'timeout' : 'network' };
    }
    if (i < attempts - 1) {
      log('warn', 'tg.retry', { method, attempt: i + 1, code: last.error_code, description: last.description });
      await sleep(wait);
    }
  }
  return last;
}

// Отправка текста во все чаты параллельно. Учитывает миграцию группы в супергруппу.
export async function sendToChats(chats, text, extra = {}, opts = {}) {
  const results = await Promise.all(chats.map(async (chat_id) => {
    const payload = { chat_id, text, parse_mode: 'HTML', disable_web_page_preview: true, ...extra };
    let r = await tg('sendMessage', payload, opts);
    if (!r.ok && r.migrate_to) {
      log('warn', 'tg.chat_migrated', { from: String(chat_id), to: String(r.migrate_to) });
      r = await tg('sendMessage', { ...payload, chat_id: r.migrate_to }, opts);
    }
    if (!r.ok) log('error', 'tg.error', { code: r.error_code, description: r.description });
    return r;
  }));
  return { ok: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length };
}
