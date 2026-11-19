// Чтение тела запроса и JSON-ответы.
export function send(res, status, data, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(data));
}

// Возвращает { ok: true, data } или { ok: false, error: 'too_large' | 'bad_json' }.
// На Vercel тело может прийти уже разобранным (req.body), локально — строкой.
export async function readJson(req, limit = 10_240) {
  let raw;
  let body;
  try {
    body = req.body;
  } catch {
    return { ok: false, error: 'bad_json' };
  }

  if (body === undefined) {
    raw = '';
    for await (const chunk of req) {
      raw += chunk;
      if (raw.length > limit) return { ok: false, error: 'too_large' };
    }
  } else if (typeof body === 'string') {
    raw = body;
  } else if (Buffer.isBuffer(body)) {
    raw = body.toString('utf8');
  } else {
    raw = JSON.stringify(body ?? null);
  }

  if (Buffer.byteLength(raw || '') > limit) return { ok: false, error: 'too_large' };
  try {
    return { ok: true, data: JSON.parse(raw || 'null') };
  } catch {
    return { ok: false, error: 'bad_json' };
  }
}

export function header(req, name) {
  const v = req.headers?.[name.toLowerCase()];
  return Array.isArray(v) ? v[0] : String(v || '');
}
