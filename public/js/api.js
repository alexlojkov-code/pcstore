// Отправка заявки (SPEC §7.5).
import config from './config.js';

export async function sendLead(payload) {
  try {
    const r = await fetch(config.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
    const data = await r.json().catch(() => ({}));
    return { status: r.status, ...data };
  } catch {
    return { status: 0, ok: false, error: 'network' };
  }
}
