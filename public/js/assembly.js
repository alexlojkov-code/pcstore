// Сборочный чертёж: раскладка один раз и связь со спецификацией (DESIGN §6, SPEC §8.2).
import * as store from './storage.js';

let svg;
let quizOpen = () => false;
let seen = false;
let started = false;

const done = () => document.documentElement.classList.contains('explode-done');

function maybeStart() {
  if (started || done() || !seen || quizOpen()) return;
  started = true;
  const parts = [...svg.querySelectorAll('.parts .part')];
  svg.classList.add('is-exploding');
  const last = parts.reduce((a, b) => (Number(b.dataset.i) > Number(a.dataset.i) ? b : a), parts[0]);
  const finish = () => {
    document.documentElement.classList.add('explode-done');
    svg.classList.remove('is-exploding');
    store.set('bl.explode', '1', 'session');
  };
  if (last) last.addEventListener('animationend', finish, { once: true });
  setTimeout(() => { if (!done()) finish(); }, 2200); // если animationend не придёт
}

export function quizClosed() { maybeStart(); }

// Подсветка: строка спецификации ↔ деталь и её выноска.
function setActive(id, on) {
  svg.querySelector(`#part-${id}`)?.classList.toggle('is-active', on);
  svg.querySelector(`.callout[data-part="${id}"]`)?.classList.toggle('is-active', on);
  document.querySelector(`.spec tr[data-part="${id}"]`)?.classList.toggle('is-active', on);
}

export function init({ isQuizOpen, onPick } = {}) {
  svg = document.getElementById('assembly');
  if (!svg) return;
  if (isQuizOpen) quizOpen = isQuizOpen;

  // Смещения для анимации берём из атрибута transform (разнесённое положение).
  svg.querySelectorAll('.parts .part').forEach((g) => {
    g.style.setProperty('--tx', `${g.dataset.tx}px`);
    g.style.setProperty('--ty', `${g.dataset.ty}px`);
    g.style.setProperty('--i', g.dataset.i);
  });
  svg.querySelectorAll('.callout').forEach((c, n) => c.style.setProperty('--n', n));

  if (!done()) {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { seen = true; io.disconnect(); maybeStart(); }
    }, { threshold: 0.35 });
    io.observe(svg);
  }

  const hover = matchMedia('(hover: hover)').matches;
  const partOf = (el) => el.closest('[data-part], .part')?.dataset.part || el.closest('.part')?.id?.replace('part-', '');

  if (hover) {
    document.querySelectorAll('.spec tr[data-part]').forEach((tr) => {
      const id = tr.dataset.part;
      tr.addEventListener('pointerenter', () => setActive(id, true));
      tr.addEventListener('pointerleave', () => setActive(id, false));
    });
    svg.addEventListener('pointerover', (e) => { const id = partOf(e.target); if (id) setActive(id, true); });
    svg.addEventListener('pointerout', (e) => { const id = partOf(e.target); if (id) setActive(id, false); });
  }
  document.querySelectorAll('.spec tr[data-part]').forEach((tr) => {
    const id = tr.dataset.part;
    tr.addEventListener('focusin', () => setActive(id, true));
    tr.addEventListener('focusout', () => setActive(id, false));
  });

  // Нажатие на деталь открывает квиз с этой деталью.
  svg.addEventListener('click', (e) => {
    const id = partOf(e.target);
    if (id && onPick) onPick(id);
  });
}
