// Чтение переменных окружения (SPEC §3.1).
export function getEnv() {
  const token = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const mock = process.env.TELEGRAM_MOCK === '1';
  let chats = String(process.env.TELEGRAM_CHAT_ID || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (mock && !chats.length) chats = ['mock'];
  return {
    token,
    mock,
    chats,
    configured: Boolean((token || mock) && chats.length),
    vercelEnv: process.env.VERCEL_ENV || 'development',
    productionUrl: process.env.VERCEL_PROJECT_PRODUCTION_URL || '',
  };
}
