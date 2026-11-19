// POST /api/bot — webhook Telegram-бота (SPEC §6.4).
// Бот сообщает ID чатов, чтобы получателей заявок можно было настроить без программиста.
// Заявки сюда не приходят: их отправляет /api/lead в чаты из TELEGRAM_CHAT_ID.
import { send, readJson, header } from './_lib/http.js';
import { getEnv } from './_lib/env.js';
import { tg, webhookSecret } from './_lib/telegram.js';
import { formatLead, sampleLead, escapeHtml } from './_lib/format.js';
import { log } from './_lib/log.js';

const COMMAND = /^\/(start|id|help|test)(@[A-Za-z0-9_]+)?(?:\s|$)/i;

const isGroup = (chat) => chat?.type === 'group' || chat?.type === 'supergroup';

function idText(chat) {
  const id = `<code>${escapeHtml(chat.id)}</code>`;
  return isGroup(chat)
    ? `ID этой группы: ${id}\n\nВставьте его в переменную TELEGRAM_CHAT_ID в Vercel (проект business-landing), затем сделайте Redeploy. После этого заявки с сайта будут приходить сюда.`
    : `Ваш ID: ${id}\n\nЕсли заявки должны приходить вам лично, вставьте этот ID в TELEGRAM_CHAT_ID в Vercel. Для общей группы менеджеров добавьте бота в группу — он пришлёт её ID.`;
}

const HELP = [
  'Я присылаю заявки с сайта в группу менеджеров.',
  '',
  '/id — узнать ID этого чата',
  '/test — прислать пример заявки (работает только в группе заявок)',
].join('\n');

async function reply(chat_id, text, env) {
  return tg('sendMessage', { chat_id, text, parse_mode: 'HTML', disable_web_page_preview: true }, { env, attempts: 2 });
}

export async function handleUpdate(update, env) {
  const msg = update.message;
  if (msg?.chat) {
    if (msg.migrate_to_chat_id) {
      await reply(msg.migrate_to_chat_id,
        `Группа обновилась, и у неё новый ID: <code>${escapeHtml(msg.migrate_to_chat_id)}</code>\n\nЕсли заявки шли сюда — замените ID в TELEGRAM_CHAT_ID в Vercel.`, env);
      return 'migrate';
    }
    const m = String(msg.text || '').match(COMMAND);
    if (m) {
      const cmd = m[1].toLowerCase();
      if (cmd === 'start' || cmd === 'id') { await reply(msg.chat.id, idText(msg.chat), env); return cmd; }
      if (cmd === 'help') { await reply(msg.chat.id, HELP, env); return cmd; }
      if (cmd === 'test') {
        if (!env.chats.includes(String(msg.chat.id))) {
          await reply(msg.chat.id, 'Эта команда работает только в группе заявок.', env);
          return 'test_denied';
        }
        const text = formatLead({ lead: sampleLead(), leadId: 'PC-TEST', temperature: 'hot', device: 'Телефон, iOS / Safari', test: true });
        await reply(msg.chat.id, text, env);
        return 'test';
      }
    }
    return 'ignored';
  }

  // Бота добавили в группу — сразу пишем её ID.
  const member = update.my_chat_member;
  if (member?.chat && member.chat.type !== 'private') {
    const was = member.old_chat_member?.status;
    const now = member.new_chat_member?.status;
    if ((was === 'left' || was === 'kicked') && (now === 'member' || now === 'administrator')) {
      await reply(member.chat.id, idText(member.chat), env);
      return 'added';
    }
  }
  return 'ignored';
}

export default async function handler(req, res, deps = {}) {
  const env = deps.env || getEnv();
  if (req.method !== 'POST') return send(res, 200, { ok: true });
  if (!env.token || header(req, 'x-telegram-bot-api-secret-token') !== webhookSecret(env.token)) {
    log('warn', 'bot.unauthorized');
    return send(res, 401, { ok: false });
  }

  // Telegram повторяет обновление, если не получил 200, поэтому ошибки только в лог.
  try {
    const parsed = await readJson(req, 64_000);
    const update = parsed.ok && parsed.data && typeof parsed.data === 'object' ? parsed.data : {};
    const kind = await handleUpdate(update, env);
    log('info', 'bot.update', { kind });
  } catch (err) {
    log('error', 'bot.error', { message: String(err?.message || err).slice(0, 200) });
  }
  return send(res, 200, { ok: true });
}
