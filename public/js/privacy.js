// Политика конфиденциальности: язык и данные магазина из config.js.
import config from './config.js';
import * as store from './storage.js';

const blocks = [...document.querySelectorAll('[data-lang-block]')];
const buttons = [...document.querySelectorAll('[data-lang]')];

function formatPhone(p) {
  const d = String(p).replace(/\D/g, '').replace(/^998/, '');
  return d.length === 9 ? `+998 ${d.slice(0, 2)} ${d.slice(2, 5)}-${d.slice(5, 7)}-${d.slice(7)}` : p;
}

function setLang(lang) {
  document.documentElement.lang = lang;
  blocks.forEach((b) => { b.hidden = b.dataset.langBlock !== lang; });
  buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  document.title = lang === 'uz' ? `Maxfiylik siyosati — ${config.shopName}` : `Политика конфиденциальности — ${config.shopName}`;
  store.set('bl.lang', lang);
}

document.querySelectorAll('[data-config="shopName"]').forEach((el) => { el.textContent = config.shopName; });
document.querySelectorAll('[data-config="telegram"]').forEach((el) => { el.href = `https://t.me/${config.telegram}`; });
document.querySelectorAll('[data-config="phone"]').forEach((el) => { el.href = `tel:${config.phone}`; el.textContent = formatPhone(config.phone); });
const l = config.legal || {};
document.querySelector('[data-config="legal-ru"]').textContent = l.name ? `${l.name}${l.inn ? `, ИНН ${l.inn}` : ''}.` : '';
document.querySelector('[data-config="legal-uz"]').textContent = l.name ? `${l.name}${l.inn ? `, STIR ${l.inn}` : ''}.` : '';

buttons.forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang)));
const q = new URLSearchParams(location.search).get('lang');
setLang(q === 'uz' || q === 'ru' ? q : (store.get('bl.lang') === 'uz' ? 'uz' : 'ru'));
