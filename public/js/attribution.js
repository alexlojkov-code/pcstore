// Источник трафика: UTM, fbclid, gclid, referrer, первый визит (SPEC §7.8).
import * as store from './storage.js';

const KEYS = ['source', 'medium', 'campaign', 'content', 'term'];
const TTL = 30 * 24 * 60 * 60 * 1000;
let firstVisit = false;

export function capture() {
  const q = new URLSearchParams(location.search);
  const utm = Object.fromEntries(KEYS.map((k) => [k, (q.get(`utm_${k}`) || '').slice(0, 200)]));
  const fbclid = (q.get('fbclid') || '').slice(0, 200);
  const gclid = (q.get('gclid') || '').slice(0, 200);
  let referrer = '';
  try {
    if (document.referrer && new URL(document.referrer).host !== location.host) referrer = document.referrer.slice(0, 300);
  } catch { /* битый referrer */ }

  const hasNew = KEYS.some((k) => utm[k]) || fbclid || gclid;
  const saved = store.get('bl.attr');
  const fresh = saved && Date.now() - (saved.ts || 0) < TTL;
  // Первое касание: метки из адреса сохраняются на 30 дней и не перезаписываются пустыми.
  if (hasNew || !fresh) store.set('bl.attr', { utm, fbclid, gclid, referrer, ts: Date.now() });
  else if (!saved.referrer && referrer) store.set('bl.attr', { ...saved, referrer });

  firstVisit = !store.get('bl.visited');
  if (firstVisit) store.set('bl.visited', new Date().toISOString());
}

export function meta() {
  const a = store.get('bl.attr') || {};
  return {
    utm: Object.fromEntries(KEYS.map((k) => [k, a.utm?.[k] || ''])),
    fbclid: a.fbclid || '',
    gclid: a.gclid || '',
    referrer: a.referrer || '',
    page: location.href.slice(0, 300),
    first_visit: firstVisit,
  };
}
