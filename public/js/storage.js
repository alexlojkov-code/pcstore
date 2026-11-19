// Безопасный доступ к localStorage / sessionStorage (SPEC §7.10).
// Если хранилище недоступно (приватный режим, запрет), сайт продолжает работать.
function area(kind) {
  try { return kind === 'session' ? window.sessionStorage : window.localStorage; } catch { return null; }
}

export function get(key, kind = 'local') {
  try {
    const raw = area(kind)?.getItem(key);
    if (raw == null) return null;
    try { return JSON.parse(raw); } catch { return raw; }
  } catch { return null; }
}

export function set(key, value, kind = 'local') {
  try { area(kind)?.setItem(key, typeof value === 'string' ? value : JSON.stringify(value)); } catch { /* недоступно */ }
}

export function remove(key, kind = 'local') {
  try { area(kind)?.removeItem(key); } catch { /* недоступно */ }
}
