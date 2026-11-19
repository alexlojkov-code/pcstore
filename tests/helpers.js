// Подделки req/res и fetch для тестов обработчиков.
export function mockReq({ method = 'POST', headers = {}, body } = {}) {
  return {
    method,
    headers: { 'content-type': 'application/json', 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  };
}

export function mockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    end(b) { this.body = b ?? ''; this.ended = true; },
    json() { return JSON.parse(this.body); },
  };
  return res;
}

export function validBody(over = {}) {
  return {
    submission_id: crypto.randomUUID(),
    lang: 'ru',
    answers: { need: 'build', purpose: ['gaming'], parts: ['gpu', 'cpu'], budget: '7_15', timing: 'week', delivery: 'tashkent' },
    contact: { name: 'Алишер', phone: '998901234567', channel: 'telegram', telegram: 'alisher_pc', comment: '', consent: true },
    meta: { utm: { source: 'instagram', medium: 'cpc', campaign: 'nov', content: '', term: '' }, fbclid: '', gclid: '', referrer: '', page: 'https://example.uz/', first_visit: true, quiz_ms: 30000 },
    website: '',
    ...over,
  };
}

// Подменяет global fetch очередью ответов Telegram. Возвращает список вызовов.
export function mockFetch(responses) {
  const calls = [];
  const queue = [...responses];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(init.body) });
    const next = queue.length > 1 ? queue.shift() : queue[0];
    if (next instanceof Error) throw next;
    return { status: next.status ?? 200, json: async () => next.json };
  };
  return { calls, restore: () => { globalThis.fetch = original; } };
}

export const tgOk = { json: { ok: true, result: { message_id: 7 } } };

export const env = (over = {}) => ({ token: '123:ABC', mock: false, chats: ['-1001'], configured: true, vercelEnv: 'production', productionUrl: 'example.vercel.app', ...over });

export const noSleep = async () => {};
