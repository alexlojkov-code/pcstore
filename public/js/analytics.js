// Обёртка над Meta Pixel (SPEC §7.9). Без Pixel ID вызовы ничего не делают.
// В Pixel не передаются имя, телефон и комментарий.
const STANDARD = new Set(['PageView', 'Lead', 'Contact']);
let enabled = false;

export function init(pixelId, demo) {
  if (!pixelId || demo || window.fbq) return;
  const n = function fbq(...args) { n.callMethod ? n.callMethod(...args) : n.queue.push(args); };
  n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
  window.fbq = n;
  if (!window._fbq) window._fbq = n;
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://connect.facebook.net/en_US/fbevents.js';
  document.head.appendChild(s);
  window.fbq('init', pixelId);
  enabled = true;
  track('PageView');
}

export function track(name, params = {}, options) {
  if (!enabled || !window.fbq) return;
  const method = STANDARD.has(name) ? 'track' : 'trackCustom';
  if (options) window.fbq(method, name, params, options); else window.fbq(method, name, params);
}
