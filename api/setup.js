// GET /api/setup — один раз после того, как токен вставлен в Vercel (SPEC §6.6).
// Подключает webhook бота к production-адресу и задаёт список команд. Повторный вызов безопасен.
import { send } from './_lib/http.js';
import { getEnv } from './_lib/env.js';
import { tg, webhookSecret } from './_lib/telegram.js';
import { log } from './_lib/log.js';

export default async function handler(req, res, deps = {}) {
  const env = deps.env || getEnv();
  if (env.vercelEnv !== 'production') return send(res, 403, { ok: false, error: 'production_only' });
  if (!env.token) return send(res, 500, { ok: false, error: 'not_configured', hint: 'Добавьте TELEGRAM_BOT_TOKEN в Vercel и сделайте Redeploy' });
  if (!env.productionUrl) return send(res, 500, { ok: false, error: 'no_production_url' });

  const webhookUrl = `https://${env.productionUrl}/api/bot`;
  const hook = await tg('setWebhook', {
    url: webhookUrl,
    secret_token: webhookSecret(env.token),
    allowed_updates: ['message', 'my_chat_member', 'callback_query'],
    drop_pending_updates: true,
  }, { env });

  const commands = await tg('setMyCommands', {
    commands: [
      { command: 'start', description: 'Узнать ID чата' },
      { command: 'id', description: 'Узнать ID чата' },
      { command: 'help', description: 'Справка' },
      { command: 'test', description: 'Тестовая заявка' },
    ],
  }, { env });

  const info = await tg('getWebhookInfo', {}, { env });
  const result = {
    ok: Boolean(hook.ok && commands.ok),
    webhook_url: info.result?.url || null,
    pending_update_count: info.result?.pending_update_count ?? null,
    last_error_message: info.result?.last_error_message || null,
    errors: [hook, commands].filter((r) => !r.ok).map((r) => r.description),
  };
  log(result.ok ? 'info' : 'error', 'bot.setup', { ok: result.ok });
  return send(res, result.ok ? 200 : 502, result);
}
