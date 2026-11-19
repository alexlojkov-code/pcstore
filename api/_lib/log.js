// JSON-логи без персональных данных (SPEC §9).
// Никогда не передавать сюда имя, телефон, ник, комментарий, город, токен, IP.
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

export function log(level, event, fields = {}) {
  const min = LEVELS[process.env.LOG_LEVEL] ?? LEVELS.info;
  if ((LEVELS[level] ?? 20) < min) return;
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...fields });
  if (level === 'error' || level === 'warn') console.error(line); else console.log(line);
}
