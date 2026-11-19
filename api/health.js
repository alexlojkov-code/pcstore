// GET /api/health — жив ли сервер и заданы ли токен и ID чата. Без секретов.
import { send } from './_lib/http.js';
import { getEnv } from './_lib/env.js';

export default function handler(req, res) {
  const env = getEnv();
  return send(res, 200, { ok: true, configured: env.configured, env: env.vercelEnv });
}
