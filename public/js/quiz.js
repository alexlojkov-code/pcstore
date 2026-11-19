// Квиз: шаги, форма контактов, отправка, экраны результата (SPEC §7.2–7.6, DESIGN §8).
import { QUESTIONS, ASSEMBLY, stepsFor, toggleMulti, isValidAnswers, CITY_MIN, CITY_MAX } from './quiz-schema.js';
import { t, getLang, onChange } from './i18n.js';
import * as store from './storage.js';
import * as phone from './phone.js';
import { meta as attributionMeta } from './attribution.js';
import { track } from './analytics.js';
import { sendLead } from './api.js';
import config, { isDemo } from './config.js';

const ICON_IDS = new Set(ASSEMBLY.map((a) => a.id));
const AUTO_ADVANCE_MS = 200;

let dialog; let body; let countEl; let progressEl; let skipBtn;
let onClosed = () => {};
let state = fresh();
let entering = 'fwd';
let started = false; // QuizStart отправлен

function fresh() {
  return { screen: 0, answers: {}, contact: { name: '', phone: '', channel: 'telegram', telegram: '', comment: '', consent: false }, firstAt: null, submissionId: null, result: null };
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const steps = () => stepsFor(state.answers);
const saveDraft = () => store.set('bl.quiz.draft', { screen: state.screen, answers: state.answers, contact: { ...state.contact, consent: false }, firstAt: state.firstAt, submissionId: state.submissionId }, 'session');

export const isOpen = () => Boolean(dialog?.open);

// ── Открытие и закрытие ────────────────────────────────
export function open({ preset } = {}) {
  if (!dialog) return;
  if (preset) {
    state = fresh();
    Object.assign(state.answers, preset);
  }
  if (state.result) state = fresh();
  entering = 'fwd';
  render();
  if (!dialog.open) dialog.showModal();
  document.body.classList.add('is-locked');
  focusTitle();
}

function close(reason) {
  if (!dialog.open) return;
  if (reason === 'skip') {
    store.set('bl.quiz', 'skipped');
    track('QuizSkip', { step: Math.min(state.screen + 1, 7) });
  }
  dialog.close();
}

function handleClosed() {
  document.body.classList.remove('is-locked');
  if (state.result === 'thanks') { store.remove('bl.quiz.draft', 'session'); }
  else if (!store.get('bl.quiz')) store.set('bl.quiz', 'skipped');
  onClosed();
}

function focusTitle() {
  requestAnimationFrame(() => body.querySelector('.q-title')?.focus({ preventScroll: true }));
}

// ── Отрисовка ─────────────────────────────────────────
function render() {
  const list = steps();
  const total = list.length;
  const onContact = state.screen >= total;
  skipBtn.hidden = Boolean(state.result);
  dialog.classList.toggle('is-result', Boolean(state.result));

  if (state.result) {
    countEl.textContent = '';
    progressEl.style.width = '100%';
  } else if (onContact) {
    countEl.textContent = t('quiz.last');
    progressEl.style.width = '100%';
  } else {
    countEl.textContent = t('quiz.step', { n: state.screen + 1, total });
    progressEl.style.width = `${(state.screen / total) * 100}%`;
  }

  let html;
  if (state.result === 'thanks') html = thanksHtml();
  else if (state.result === 'error' || state.result === 'rate') html = errorHtml(state.result);
  else if (onContact) html = contactHtml();
  else html = stepHtml(list[state.screen]);

  body.innerHTML = `<div class="q-screen is-entering${entering === 'back' ? ' is-back' : ''}">${html}</div>`;
  body.scrollTop = 0;
  bindScreen();
}

function optionHtml(key, id, selected, single) {
  const icon = key === 'parts' && ICON_IDS.has(id) ? `<svg class="ic" aria-hidden="true"><use href="#ic-${id}"/></svg>` : '';
  const aria = single ? `role="radio" aria-checked="${selected}"` : `aria-pressed="${selected}"`;
  return `<button type="button" class="q-opt" data-opt="${esc(id)}" ${aria}>${icon}<span>${esc(t(`opt.${key}.${id}`))}</span></button>`;
}

function stepHtml(key) {
  const q = QUESTIONS[key];
  const single = q.type === 'single';
  const value = state.answers[key];
  const opts = Object.keys(q.options).map((id) => optionHtml(key, id, single ? value === id : (value || []).includes(id), single)).join('');
  const hint = key === 'budget' ? t('q.budget.hint') : single ? '' : t('quiz.multi');
  const city = key === 'delivery' && value === 'region'
    ? `<div class="field"><label for="q-city">${esc(t('q.city'))}</label><input class="input" id="q-city" name="city" autocomplete="address-level2" maxlength="${CITY_MAX}" value="${esc(state.answers.city || '')}"><p class="field__error" id="q-city-err"></p></div>`
    : '';
  const showNext = !single || Boolean(value);
  const hasBack = state.screen > 0;
  return `
    <div class="q-head">
      <h3 class="q-title" tabindex="-1" id="q-title">${esc(t(`q.${key}`))}</h3>
      ${hint ? `<p class="q-hint">${esc(hint)}</p>` : ''}
    </div>
    <div class="q-options" ${single ? 'role="radiogroup"' : 'role="group"'} aria-labelledby="q-title">${opts}</div>
    ${city}
    <div class="q-nav">
      ${hasBack ? `<button class="btn btn--quiet" type="button" data-act="back">${esc(t('quiz.back'))}</button>` : ''}
      ${showNext ? `<button class="btn" type="button" data-act="next" ${nextDisabled(key) ? 'disabled' : ''}>${esc(t('quiz.next'))}</button>` : ''}
    </div>`;
}

function nextDisabled(key) {
  const v = state.answers[key];
  return QUESTIONS[key].type === 'single' ? !v : !(v && v.length);
}

function contactHtml() {
  const c = state.contact;
  const ch = (id) => `<button type="button" class="q-opt" role="radio" data-channel="${id}" aria-checked="${c.channel === id}">${esc(t(`channel.${id}`))}</button>`;
  return `
    <div class="q-head">
      <h3 class="q-title" tabindex="-1">${esc(t('form.title'))}</h3>
      <p class="q-hint">${esc(t('form.hint'))}</p>
    </div>
    <form class="q-form" novalidate>
      <div class="field">
        <label for="q-name">${esc(t('form.name'))}</label>
        <input class="input" id="q-name" name="name" autocomplete="given-name" maxlength="40" value="${esc(c.name)}" aria-describedby="q-name-err">
        <p class="field__error" id="q-name-err"></p>
      </div>
      <div class="field">
        <label for="q-phone">${esc(t('form.phone'))}</label>
        <input class="input num" id="q-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" value="${esc(c.phone ? phone.format(phone.digitsOf(c.phone)) : '')}" placeholder="${esc(phone.PREFIX)}(__) ___-__-__" aria-describedby="q-phone-err">
        <p class="field__error" id="q-phone-err"></p>
      </div>
      <div class="field">
        <span class="label" id="q-channel-label">${esc(t('form.channel'))}</span>
        <div class="q-channels" role="radiogroup" aria-labelledby="q-channel-label">${ch('telegram')}${ch('call')}${ch('whatsapp')}</div>
      </div>
      <div class="field" id="q-tg-field" ${c.channel === 'telegram' ? '' : 'hidden'}>
        <label for="q-telegram">${esc(t('form.telegram'))}</label>
        <input class="input" id="q-telegram" name="telegram" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="40" value="${esc(c.telegram ? '@' + c.telegram : '')}" placeholder="@" aria-describedby="q-telegram-hint q-telegram-err">
        <p class="field__hint" id="q-telegram-hint">${esc(t('form.telegram_hint'))}</p>
        <p class="field__error" id="q-telegram-err"></p>
      </div>
      <div class="field" id="q-comment-field" ${c.comment ? '' : 'hidden'}>
        <label for="q-comment">${esc(t('form.comment'))}</label>
        <textarea class="input" id="q-comment" name="comment" maxlength="300" rows="3">${esc(c.comment)}</textarea>
      </div>
      <p ${c.comment ? 'hidden' : ''}><button class="link-btn" type="button" data-act="comment">${esc(t('form.comment_toggle'))}</button></p>
      <div class="q-trap" aria-hidden="true"><label>Website <input name="website" tabindex="-1" autocomplete="off"></label></div>
      <div class="field">
        <label class="q-consent"><input type="checkbox" name="consent" ${c.consent ? 'checked' : ''} aria-describedby="q-consent-err"><span>${t('form.consent')}</span></label>
        <p class="field__error" id="q-consent-err"></p>
      </div>
      <p class="q-form__error" id="q-form-err" role="alert"></p>
      <button class="btn" type="submit">${esc(t('form.submit'))}</button>
      <div class="q-nav"><button class="btn btn--quiet" type="button" data-act="back">${esc(t('quiz.back'))}</button></div>
    </form>`;
}

// Когда менеджер ответит: в рабочее время, сегодня позже или завтра (по Ташкенту).
function whenKey() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' })
    .formatToParts(new Date()).map((p) => [p.type, p.value]));
  const day = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(parts.weekday) + 1;
  const mins = Number(parts.hour) * 60 + Number(parts.minute);
  const toMin = (s) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
  const { open: o, close: c, days } = config.hours;
  const workday = days.includes(day);
  if (workday && mins >= toMin(o) && mins < toMin(c) - 15) return 'now';
  if (workday && mins < toMin(o)) return 'today';
  return 'tomorrow';
}

function tgLink() { return `https://t.me/${encodeURIComponent(config.telegram)}`; }

function thanksHtml() {
  const c = state.contact;
  const lead = store.get('bl.lastLead') || {};
  const part = (state.answers.parts || []).find((id) => ICON_IDS.has(id));
  const msg = t(`thanks.${c.channel}.${whenKey()}`, { min: config.replyMinutes, open: config.hours.open });
  return `
    <div class="q-result">
      ${part ? `<svg class="ic" aria-hidden="true"><use href="#ic-${part}"/></svg>` : ''}
      <h3 class="q-title" tabindex="-1">${esc(t('thanks.title', { name: c.name }))}</h3>
      <p>${esc(msg)}</p>
      ${lead.id ? `<p class="q-result__id">${esc(t('thanks.number', { id: lead.id }))}</p>` : ''}
      ${isDemo() ? `<p class="q-demo">${esc(t('thanks.demo'))}</p>` : ''}
      <div class="q-result__actions">
        <a class="btn" href="${esc(tgLink())}" target="_blank" rel="noopener" data-contact="telegram">${esc(t('thanks.write'))}</a>
        <button class="link-btn" type="button" data-act="close">${esc(t('thanks.back'))}</button>
      </div>
    </div>`;
}

function errorHtml(kind) {
  return `
    <div class="q-result">
      <h3 class="q-title" tabindex="-1">${esc(t(kind === 'rate' ? 'error.rate' : 'error.text'))}</h3>
      <div class="q-result__actions">
        ${kind === 'rate' ? '' : `<button class="btn" type="button" data-act="retry">${esc(t('error.retry'))}</button>`}
        <a class="btn btn--quiet" href="${esc(tgLink())}" target="_blank" rel="noopener" data-contact="telegram">${esc(t('error.telegram'))}</a>
        <a class="btn btn--quiet" href="tel:${esc(config.phone)}" data-contact="phone">${esc(t('error.call'))}</a>
      </div>
    </div>`;
}

// ── Поведение экранов ─────────────────────────────────
function go(delta) {
  entering = delta < 0 ? 'back' : 'fwd';
  state.screen = Math.max(0, state.screen + delta);
  const total = steps().length;
  if (delta > 0) {
    if (state.screen < total) track('QuizStep', { step: state.screen + 1 });
    else {
      track('QuizComplete');
      if (!state.submissionId) state.submissionId = crypto.randomUUID();
    }
  }
  saveDraft();
  render();
  focusTitle();
}

function noteAnswer() {
  if (!state.firstAt) state.firstAt = Date.now();
  if (!started) { started = true; track('QuizStart'); }
}

function bindScreen() {
  const list = steps();
  const key = list[state.screen];

  body.querySelectorAll('[data-act="back"]').forEach((b) => b.addEventListener('click', () => go(-1)));
  body.querySelector('[data-act="close"]')?.addEventListener('click', () => close('done'));
  body.querySelector('[data-act="retry"]')?.addEventListener('click', () => { state.result = null; entering = 'back'; render(); submit(); });

  if (key && !state.result && state.screen < list.length) bindStep(key);
  const form = body.querySelector('.q-form');
  if (form) bindForm(form);
}

function bindStep(key) {
  const q = QUESTIONS[key];
  const single = q.type === 'single';
  const next = () => body.querySelector('[data-act="next"]');

  body.querySelectorAll('.q-opt').forEach((btn) => {
    btn.addEventListener('click', () => {
      noteAnswer();
      const id = btn.dataset.opt;
      if (single) {
        const prevNeed = state.answers.need;
        state.answers[key] = id;
        // Смена ветки на шаге 1: ответы чужой ветки удаляются.
        if (key === 'need' && prevNeed !== id) {
          if (id === 'peripherals') delete state.answers.parts; else delete state.answers.peripherals;
        }
        if (key === 'delivery' && id !== 'region') delete state.answers.city;
        body.querySelectorAll('.q-opt').forEach((b) => b.setAttribute('aria-checked', String(b === btn)));
        saveDraft();
        if (key === 'delivery' && id === 'region') { render(); body.querySelector('#q-city')?.focus(); return; }
        setTimeout(() => { if (dialog.open && steps()[state.screen] === key) go(1); }, AUTO_ADVANCE_MS);
      } else {
        state.answers[key] = toggleMulti(key, state.answers[key] || [], id);
        body.querySelectorAll('.q-opt').forEach((b) => b.setAttribute('aria-pressed', String(state.answers[key].includes(b.dataset.opt))));
        const n = next(); if (n) n.disabled = nextDisabled(key);
        saveDraft();
      }
    });
  });

  // Стрелки внутри группы одиночного выбора.
  if (single) {
    const opts = [...body.querySelectorAll('.q-opt')];
    opts.forEach((b, i) => b.addEventListener('keydown', (e) => {
      const d = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
      if (!d) return;
      e.preventDefault();
      opts[(i + d + opts.length) % opts.length].focus();
    }));
  }

  next()?.addEventListener('click', () => {
    if (key === 'delivery' && state.answers.delivery === 'region') {
      const input = body.querySelector('#q-city');
      const city = (input?.value || '').trim();
      state.answers.city = city;
      if (city.length < CITY_MIN || city.length > CITY_MAX) {
        showError(input, body.querySelector('#q-city-err'), t('err.city'));
        input.focus();
        return;
      }
    }
    go(1);
  });

  const city = body.querySelector('#q-city');
  city?.addEventListener('input', () => { state.answers.city = city.value; saveDraft(); clearError(city, body.querySelector('#q-city-err')); });
  city?.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); next()?.click(); } });
}

function showError(input, el, text) {
  if (input) input.setAttribute('aria-invalid', 'true');
  if (el) el.textContent = text;
}
function clearError(input, el) {
  if (input) input.removeAttribute('aria-invalid');
  if (el) el.textContent = '';
}

function bindForm(form) {
  const $ = (s) => form.querySelector(s);
  const name = $('#q-name'); const tel = $('#q-phone'); const tg = $('#q-telegram'); const comment = $('#q-comment');
  phone.attach(tel);

  const sync = () => {
    state.contact.name = name.value;
    state.contact.phone = phone.normalize(tel.value) || tel.value;
    state.contact.telegram = (tg?.value || '').replace(/^@/, '').replace(/^https?:\/\/(www\.)?t\.me\//i, '').trim();
    state.contact.comment = comment?.value || '';
    state.contact.consent = $('input[name="consent"]').checked;
    saveDraft();
  };
  form.addEventListener('input', sync);
  form.addEventListener('change', sync);

  form.querySelectorAll('[data-channel]').forEach((b) => b.addEventListener('click', () => {
    state.contact.channel = b.dataset.channel;
    form.querySelectorAll('[data-channel]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    $('#q-tg-field').hidden = state.contact.channel !== 'telegram';
    saveDraft();
  }));

  form.querySelector('[data-act="comment"]')?.addEventListener('click', (e) => {
    $('#q-comment-field').hidden = false;
    e.currentTarget.parentElement.hidden = true;
    $('#q-comment').focus();
  });

  const checks = {
    name: () => { const v = name.value.trim().replace(/\s+/g, ' '); return v.length >= 2 && v.length <= 40; },
    phone: () => Boolean(phone.normalize(tel.value)),
    telegram: () => { if (state.contact.channel !== 'telegram') return true; const v = state.contact.telegram; return !v || /^[A-Za-z0-9_]{5,32}$/.test(v); },
    consent: () => $('input[name="consent"]').checked,
  };
  const fields = {
    name: [name, '#q-name-err', 'err.name'],
    phone: [tel, '#q-phone-err', 'err.phone'],
    telegram: [tg, '#q-telegram-err', 'err.telegram'],
    consent: [$('input[name="consent"]'), '#q-consent-err', 'err.consent'],
  };
  const validate = (k) => {
    const [input, err, msg] = fields[k];
    if (checks[k]()) { clearError(input, $(err)); return true; }
    showError(input, $(err), t(msg));
    return false;
  };
  name.addEventListener('blur', () => { if (name.value) validate('name'); });
  tel.addEventListener('blur', () => { if (tel.value) validate('phone'); });
  tg?.addEventListener('blur', () => { sync(); validate('telegram'); });
  $('input[name="consent"]').addEventListener('change', () => validate('consent'));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    sync();
    const bad = Object.keys(checks).filter((k) => !validate(k));
    if (bad.length) { fields[bad[0]][0].focus(); return; }
    submit(form.querySelector('input[name="website"]').value);
  });
}

// ── Отправка ──────────────────────────────────────────
let sending = false;

async function submit(website = '') {
  if (sending) return;
  const btn = body.querySelector('.q-form button[type="submit"]');
  const answers = isValidAnswers(state.answers);
  if (!answers.ok) { state.screen = 0; render(); return; }

  // Клиентский лимит: повторная отправка в течение 2 минут показывает прошлую заявку.
  const last = store.get('bl.lastLead');
  if (last && last.sid === state.submissionId && Date.now() - last.ts < 120_000) return finish('thanks');

  sending = true;
  if (btn) { btn.disabled = true; btn.textContent = t('form.sending'); }

  const payload = {
    submission_id: state.submissionId || (state.submissionId = crypto.randomUUID()),
    lang: getLang(),
    answers: answers.value,
    contact: {
      name: state.contact.name.trim(),
      phone: phone.normalize(state.contact.phone),
      channel: state.contact.channel,
      telegram: state.contact.channel === 'telegram' ? state.contact.telegram : '',
      comment: state.contact.comment.trim(),
      consent: true,
    },
    meta: { ...attributionMeta(), quiz_ms: Math.min(Date.now() - (state.firstAt || Date.now()), 3_600_000) },
    website,
  };

  let r;
  if (isDemo()) {
    await new Promise((res) => setTimeout(res, 600));
    r = { status: 200, ok: true, lead_id: 'PC-DEMO' };
  } else {
    r = await sendLead(payload);
  }
  sending = false;

  if (r.status === 200 && r.ok) {
    store.set('bl.lastLead', { id: r.lead_id, ts: Date.now(), sid: payload.submission_id });
    store.set('bl.quiz', 'done');
    track('Lead', { content_category: state.answers.need }, { eventID: r.lead_id });
    return finish('thanks');
  }
  if (r.status === 400 && Array.isArray(r.fields)) {
    if (btn) { btn.disabled = false; btn.textContent = t('form.submit'); }
    const map = { 'contact.name': 'name', 'contact.phone': 'phone', 'contact.telegram': 'telegram', 'contact.consent': 'consent' };
    const hit = r.fields.map((f) => map[f]).filter(Boolean);
    if (hit.length) {
      const form = body.querySelector('.q-form');
      form.querySelector('#q-form-err').textContent = t('form.check');
      for (const k of hit) {
        const sel = { name: '#q-name', phone: '#q-phone', telegram: '#q-telegram', consent: 'input[name="consent"]' }[k];
        showError(form.querySelector(sel), form.querySelector(`#q-${k}-err`), t(`err.${k}`));
      }
      return;
    }
    state.screen = 0; render(); return;
  }
  return finish(r.status === 429 ? 'rate' : 'error');
}

function finish(kind) {
  state.result = kind;
  entering = 'fwd';
  render();
  focusTitle();
}

// ── Инициализация ─────────────────────────────────────
export function init({ onClose } = {}) {
  dialog = document.getElementById('quiz');
  body = document.getElementById('quiz-body');
  countEl = document.getElementById('quiz-count');
  progressEl = document.getElementById('quiz-progress');
  skipBtn = document.getElementById('quiz-skip');
  if (!dialog || typeof dialog.showModal !== 'function') return false;
  if (onClose) onClosed = onClose;

  const draft = store.get('bl.quiz.draft', 'session');
  if (draft && typeof draft === 'object') {
    state = { ...fresh(), ...draft, contact: { ...fresh().contact, ...draft.contact }, result: null };
    if (state.firstAt) started = true;
  }

  skipBtn.addEventListener('click', () => close('skip'));
  dialog.addEventListener('cancel', (e) => { e.preventDefault(); close(state.result ? 'done' : 'skip'); });
  dialog.addEventListener('close', handleClosed);
  // Нажатие на затемнение на ПК закрывает окно как «Пропустить».
  dialog.addEventListener('click', (e) => { if (e.target === dialog) close(state.result ? 'done' : 'skip'); });

  onChange(() => { if (dialog.open) { const f = document.activeElement; render(); if (f === document.body) focusTitle(); } });
  return true;
}
