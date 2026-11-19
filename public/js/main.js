// Точка входа (SPEC §7.1): язык, источник трафика, аналитика, квиз, чертёж, данные магазина.
import config, { isDemo } from './config.js';
import * as i18n from './i18n.js';
import * as attribution from './attribution.js';
import * as analytics from './analytics.js';
import * as store from './storage.js';
import * as quiz from './quiz.js';
import * as assembly from './assembly.js';

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

function formatPhone(p) {
  const d = String(p).replace(/\D/g, '').replace(/^998/, '');
  return d.length === 9 ? `+998 ${d.slice(0, 2)} ${d.slice(2, 5)}-${d.slice(5, 7)}-${d.slice(7)}` : p;
}

// Данные магазина из config.js; пустые значения скрывают элемент.
function fillConfig() {
  const lang = i18n.getLang();
  const vars = { shop: config.shopName };
  document.title = i18n.t('meta.title', vars);
  $('meta[name="description"]')?.setAttribute('content', i18n.t('meta.description'));

  $$('[data-config="shopName"]').forEach((el) => { el.textContent = config.shopName; });
  $$('[data-config="year"]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });
  $$('[data-config="phone"], [data-config="phone-icon"]').forEach((el) => {
    el.hidden = !config.phone;
    el.href = `tel:${config.phone}`;
    if (el.dataset.config === 'phone') el.textContent = formatPhone(config.phone);
  });
  $$('[data-config="telegram"]').forEach((el) => { el.hidden = !config.telegram; el.href = `https://t.me/${config.telegram}`; });
  $$('[data-config="instagram"]').forEach((el) => { el.hidden = !config.instagram; el.href = `https://instagram.com/${config.instagram}`; });
  $$('[data-config="address"]').forEach((el) => { el.textContent = config.address?.[lang] || config.address?.ru || ''; el.hidden = !el.textContent; });
  $$('[data-config="hours"]').forEach((el) => { el.textContent = i18n.t('contacts.hours', config.hours); });
  $$('[data-config="legal"]').forEach((el) => {
    const l = config.legal || {};
    el.textContent = l.name ? `, ${l.name}${l.inn ? `, ИНН ${l.inn}` : ''}` : '';
  });
  $$('[data-config="privacy"]').forEach((el) => { el.href = lang === 'uz' ? 'privacy.html?lang=uz' : 'privacy.html'; });

  // Паспорт сборки: реальные значения, прочерки или простой текст (DESIGN §7.3).
  const p = config.passport;
  $('#passport-doc').hidden = p === null;
  $('#passport-text').textContent = i18n.t(p === null ? 'passport.fallback' : 'passport.text');
  if (p) {
    $$('[data-passport]').forEach((dd) => {
      const v = p[dd.dataset.passport];
      const unit = dd.dataset.unit.startsWith('unit.') ? i18n.t(dd.dataset.unit) : dd.dataset.unit;
      dd.textContent = v === '' || v == null ? '—' : `${v} ${unit}`;
    });
  }

  const inst = $('#pay-installment');
  inst.hidden = !config.installment?.length;
  if (!inst.hidden) inst.textContent = i18n.t('pay.installment', { list: config.installment.join(', ') });
  for (const k of ['tashkent', 'regions']) {
    const el = $(`#pay-delivery-${k}`);
    el.textContent = config.delivery?.[k] || '';
    el.hidden = !el.textContent;
  }

  const map = $('#contacts-map');
  if (config.mapEmbedUrl && !map.firstChild) {
    const f = document.createElement('iframe');
    f.src = config.mapEmbedUrl; f.loading = 'lazy'; f.title = i18n.t('contacts.title'); f.referrerPolicy = 'no-referrer-when-downgrade';
    map.appendChild(f);
  }
  map.hidden = !config.mapEmbedUrl;
  $('#contacts-grid').classList.toggle('has-map', Boolean(config.mapEmbedUrl));
}

function setupLang() {
  const buttons = $$('[data-lang]');
  const mark = (lang) => buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  buttons.forEach((b) => b.addEventListener('click', () => i18n.setLang(b.dataset.lang)));
  i18n.onChange((lang) => { mark(lang); fillConfig(); });
  const lang = i18n.detect();
  i18n.setLang(lang, { save: false });
  mark(lang);
}

function setupHeader() {
  const top = $('#top');
  const onScroll = () => top.classList.toggle('is-scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Плавающая кнопка на телефоне: после первого экрана, скрыта при открытом квизе.
  const sticky = $('#sticky-cta');
  const heroCta = $('#hero-cta');
  if (sticky && heroCta && 'IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => {
      const show = !e.isIntersecting && e.boundingClientRect.top < 0;
      sticky.classList.toggle('is-visible', show);
      sticky.setAttribute('aria-hidden', String(!show));
      sticky.querySelector('button').tabIndex = show ? 0 : -1;
    }).observe(heroCta);
  }
}

function setupContacts() {
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-contact]');
    if (a) analytics.track('Contact', { method: a.dataset.contact });
  });
}

function presetFor(el) {
  if (el.dataset.presetNeed) return { need: el.dataset.presetNeed };
  if (el.dataset.presetPart) return { need: 'part', parts: [el.dataset.presetPart] };
  return null;
}

function boot() {
  attribution.capture();
  setupLang();
  analytics.init(config.pixelId, isDemo());
  setupHeader();
  setupContacts();

  const ready = quiz.init({ onClose: () => assembly.quizClosed() });
  assembly.init({
    isQuizOpen: quiz.isOpen,
    onPick: (id) => quiz.open({ preset: { need: 'part', parts: [id] } }),
  });

  if (ready) {
    $$('[data-open-quiz]').forEach((b) => b.addEventListener('click', () => quiz.open({ preset: presetFor(b) })));
    if (!store.get('bl.quiz')) quiz.open();
  } else {
    // Нет <dialog>: кнопки ведут в Telegram.
    $$('[data-open-quiz]').forEach((b) => b.addEventListener('click', () => { location.href = `https://t.me/${config.telegram}`; }));
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
