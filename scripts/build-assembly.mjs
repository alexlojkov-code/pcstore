// Генератор сборочного чертежа (DESIGN §6) и иконок деталей.
// Детали описаны коробками в 3D, проекция — изометрия 30°.
// Запуск: npm run assembly — обновляет вставки в public/index.html и файлы в public/img/.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ASSEMBLY } from '../public/js/quiz-schema.js';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const S = 8; // пикселей на единицу
const C = Math.cos(Math.PI / 6);
const N = Math.sin(Math.PI / 6);
const r1 = (v) => Math.round(v * 10) / 10;

const proj = ([x, y, z]) => [(x - z) * C * S, ((x + z) * N - y) * S];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const pts = (list) => list.map((p) => proj(p).map(r1).join(',')).join(' ');

// ── Грани коробки и локальные системы координат граней ──────────────
// box: { o: [x,y,z], s: [w,h,d] } — w по x (к зрителю, от стенки), h по y (вверх), d по z (к лицевой панели)
function faces(b) {
  const [x, y, z] = b.o; const [w, h, d] = b.s;
  return {
    top: [[x, y + h, z], [x + w, y + h, z], [x + w, y + h, z + d], [x, y + h, z + d]],
    front: [[x, y, z + d], [x + w, y, z + d], [x + w, y + h, z + d], [x, y + h, z + d]],
    right: [[x + w, y, z], [x + w, y, z + d], [x + w, y + h, z + d], [x + w, y + h, z]],
  };
}
// Матрица, переводящая локальные (u — вправо по грани, v — вниз по грани) в экран.
function faceMatrix(b, face) {
  const [x, y, z] = b.o; const [w, h, d] = b.s;
  let origin; let u; let v;
  if (face === 'top') { origin = [x, y + h, z]; u = [C, N]; v = [-C, N]; }
  if (face === 'front') { origin = [x, y + h, z + d]; u = [C, N]; v = [0, 1]; }
  if (face === 'right') { origin = [x + w, y + h, z + d]; u = [C, -N]; v = [0, 1]; }
  const [ox, oy] = proj(origin);
  return `matrix(${r1(u[0] * S * 100) / 100} ${r1(u[1] * S * 100) / 100} ${r1(v[0] * S * 100) / 100} ${r1(v[1] * S * 100) / 100} ${r1(ox)} ${r1(oy)})`;
}

const poly = (p, cls = 'f') => `<polygon class="${cls}" points="${pts(p)}"/>`;
const boxSvg = (b, show = ['right', 'front', 'top']) => {
  const f = faces(b);
  return show.map((k) => poly(f[k])).join('');
};
const onFace = (b, face, inner) => `<g transform="${faceMatrix(b, face)}">${inner}</g>`;

// Примитивы в локальных координатах грани
const rect = (u, v, w, h, cls = 'd') => `<rect class="${cls}" x="${r1(u)}" y="${r1(v)}" width="${r1(w)}" height="${r1(h)}"/>`;
const circ = (u, v, r, cls = 'd') => `<circle class="${cls}" cx="${r1(u)}" cy="${r1(v)}" r="${r1(r)}"/>`;
const line = (u1, v1, u2, v2, cls = 'd') => `<line class="${cls}" x1="${r1(u1)}" y1="${r1(v1)}" x2="${r1(u2)}" y2="${r1(v2)}"/>`;
const mark = (u, v, size, text, extra = '') => `<text class="mk" x="${r1(u)}" y="${r1(v)}" font-size="${size}"${extra}>${text}</text>`;

function fan(u, v, r, blades = 7) {
  let s = circ(u, v, r) + circ(u, v, r * 0.26);
  for (let k = 0; k < blades; k++) {
    const a = (k / blades) * Math.PI * 2;
    const p = (rr, aa) => [u + rr * Math.cos(aa), v + rr * Math.sin(aa)].map((n) => r1(n * 100) / 100);
    const [a1, a2] = p(r * 0.26, a);
    const [c1, c2] = p(r * 0.72, a + 0.42);
    const [e1, e2] = p(r * 0.94, a + 0.78);
    s += `<path class="d" d="M${a1} ${a2}Q${c1} ${c2} ${e1} ${e2}"/>`;
  }
  return s;
}

// ── Детали в собранном положении ────────────────────────────────────
// Корпус: x 0..21, y 0..46, z 0..44. Правая стенка (x = 21) снята.
const CASE = { o: [0, 0, 0], s: [21, 46, 44] };

const PARTS = {
  motherboard: () => {
    const b = { o: [0.5, 14, 2], s: [0.4, 30, 24] };
    // локальные u: 0 у лицевой стороны платы (z = 26) → 24 у задней; v: 0 сверху (y = 44) → 30 внизу
    const det = [
      rect(9, 6, 5, 5), rect(9.8, 6.8, 3.4, 3.4, 'd thin'),               // сокет
      ...[3.6, 4.4, 5.2, 6].map((u) => rect(u, 3, 0.4, 13)),               // слоты памяти
      rect(4, 21, 17, 0.7), rect(4, 25, 17, 0.7),                           // PCIe
      rect(8, 17.6, 8, 1.1, 'd thin'),                                      // M.2
      rect(3, 26.6, 3, 2.4),                                                // чипсет
      rect(21, 2, 2.4, 13),                                                 // задняя панель разъёмов
      ...[[1, 1], [22.6, 1], [1, 28.8], [22.6, 28.8]].map(([u, v]) => circ(u, v, 0.45)),
      mark(13, 29, 1.8, 'ATX'),
    ].join('');
    return { boxes: [b], draw: () => boxSvg(b) + onFace(b, 'right', det), anchor: [0.9, 41, 4] };
  },
  cpu: () => {
    const b = { o: [0.9, 33, 12], s: [0.5, 5, 5] };
    const det = [rect(0.5, 0.5, 4, 4, 'd thin'), `<path class="d" d="M0.6 4.4L1.4 4.4L0.6 3.6Z"/>`, mark(1, 2.9, 0.95, 'CPU')].join('');
    return { boxes: [b], draw: () => boxSvg(b) + onFace(b, 'right', det), anchor: [1.4, 38, 12.6] };
  },
  cooling: () => {
    const base = { o: [1.4, 33, 12], s: [1.2, 5, 5] };
    const stack = { o: [2.6, 29, 8.5], s: [6, 14, 12] };
    const frontFins = Array.from({ length: 13 }, (_, i) => line(0, 1 + i, 6, 1 + i)).join('');
    const rightFins = Array.from({ length: 13 }, (_, i) => (i >= 5 && i <= 7 ? '' : line(0, 1 + i, 12, 1 + i))).join('');
    const pipes = [2.4, 4.8, 7.2, 9.6].map((v) => circ(3, v, 0.55)).join('');
    return {
      boxes: [base, stack],
      draw: () => boxSvg(base) + boxSvg(stack)
        + onFace(stack, 'front', frontFins)
        + onFace(stack, 'right', rightFins + rect(1.5, 6.2, 9, 1.6, 'd thin') + mark(2.2, 7.55, 1.15, 'COOLER'))
        + onFace(stack, 'top', pipes),
      anchor: [8.6, 43, 14],
    };
  },
  ram: () => {
    const sticks = [19, 20.4].map((z) => ({ o: [0.9, 28, z], s: [4.2, 13, 0.35] }));
    const chips = (b) => onFace(b, 'front',
      [1.5, 3.6, 5.7, 7.8, 9.9].map((v) => rect(0.9, v, 2.2, 1.6)).join('')
      + line(0, 6.3, 0.5, 6.3)
      + `<g transform="translate(3.75 12.4) rotate(-90)">${mark(0, 0, 0.9, 'DDR5')}</g>`);
    return {
      boxes: sticks,
      draw: () => sticks.map((b) => boxSvg(b) + chips(b)).join(''),
      anchor: [5.1, 41, 20.75],
    };
  },
  storage: () => {
    const b = { o: [0.9, 24.4, 10], s: [0.35, 2.2, 8] };
    const det = [rect(0.6, 0.4, 2.2, 1.4), rect(3.2, 0.4, 1.6, 1.4), circ(7.4, 1.1, 0.4), mark(5.1, 1.55, 0.6, 'NVME')].join('');
    return { boxes: [b], draw: () => boxSvg(b) + onFace(b, 'right', det), anchor: [1.25, 26.6, 13] };
  },
  gpu: () => {
    const body = { o: [0.9, 18, 1.2], s: [12, 5, 28] };
    const bracket = { o: [0.9, 16.5, 0.4], s: [12.6, 7.5, 0.5] };
    const top = [rect(0.8, 0.8, 10.4, 26.4, 'd thin'), fan(6, 8, 4.5), fan(6, 19.4, 4.5)].join('');
    const side = [line(0, 1.4, 28, 1.4, 'd thin'), rect(23.2, 2.4, 2.4, 1.6), mark(2, 3.9, 1.5, 'GPU')].join('');
    return {
      boxes: [bracket, body],
      draw: () => boxSvg(bracket) + boxSvg(body) + onFace(body, 'top', top) + onFace(body, 'right', side),
      anchor: [12.9, 23, 22],
    };
  },
  psu: () => {
    const b = { o: [1, 1, 2], s: [14, 8.6, 16] };
    const grill = [circ(7, 8, 5.4), circ(7, 8, 3.8, 'd thin'), circ(7, 8, 2.2, 'd thin'), circ(7, 8, 0.9)].join('');
    const side = [rect(2, 2, 9, 4.4, 'd thin'), mark(3, 5, 1.7, 'PSU'), ...[0, 1, 2].map((i) => line(12.5 + i * 0.9, 2, 12.5 + i * 0.9, 6.6))].join('');
    return {
      boxes: [b],
      draw: () => boxSvg(b) + onFace(b, 'top', grill) + onFace(b, 'right', side) + onFace(b, 'front', rect(4, 2.5, 6, 3.4, 'd thin')),
      anchor: [15, 9.6, 6],
    };
  },
};

// Корпус рисуется отдельно: у него нет правой стенки.
function caseSvg() {
  const f = faces(CASE);
  const inner = [
    [[0, 0, 0], [0, 46, 0]], [[0, 0, 0], [21, 0, 0]], [[0, 0, 0], [0, 0, 44]],
  ].map(([a, b]) => `<line class="d thin" x1="${r1(proj(a)[0])}" y1="${r1(proj(a)[1])}" x2="${r1(proj(b)[0])}" y2="${r1(proj(b)[1])}"/>`).join('');
  // место материнской платы на стенке — фантомная линия
  const tray = `<polygon class="ph" points="${pts([[0, 14, 2], [0, 14, 26], [0, 44, 26], [0, 44, 2]])}"/>`;
  const frontDet = onFace(CASE, 'front', [
    rect(2, 2, 17, 30, 'd thin'),
    ...Array.from({ length: 9 }, (_, i) => line(4, 5 + i * 3, 17, 5 + i * 3, 'd thin')),
    circ(10.5, 37.5, 1.2), rect(7, 40, 7, 1, 'd thin'),
    mark(3, 44.2, 1.6, 'CASE'),
  ].join(''));
  const topDet = onFace(CASE, 'top', rect(3, 6, 15, 30, 'd thin'));
  const rightFrame = `<polygon class="o" points="${pts(f.right)}"/>`;
  return inner + tray + rightFrame + poly(f.front) + frontDet + poly(f.top) + topDet;
}

// ── Разнесённое положение (DESIGN §6.1) ────────────────────────────
// Все детали платы уходят по одной оси (+x) от платы; плата и БП — из проёма вправо-вверх.
const BOARD = [30, 6, -20];
const OFFSETS = {
  case: [0, 0, 0],
  motherboard: BOARD,
  storage: add(BOARD, [3, -3, 0]),
  ram: add(BOARD, [9, 0, 0]),
  cpu: add(BOARD, [17, 0, 0]),
  cooling: add(BOARD, [27, 4, 0]),
  gpu: add(BOARD, [26, -10, 18]),
  psu: [36, -6, 30],
};
// Положение выносок: смещение кружка от точки на детали, px
const CALLOUT = {
  gpu: [70, 34], cpu: [46, -40], motherboard: [-58, -58], ram: [-34, -70],
  storage: [-60, 26], psu: [66, 30], cooling: [50, -44], case: [-46, -40],
};
const CASE_ANCHOR = [0, 46, 12];
// Порядок отрисовки (дальние → ближние) и порядок анимации (с конца)
const ORDER = ['psu', 'motherboard', 'storage', 'cpu', 'ram', 'cooling', 'gpu'];

function build() {
  let parts = '';
  const callouts = [];
  const bounds = [];
  const track = (x, y) => bounds.push([x, y]);

  for (const p of [[0, 0, 0], [21, 0, 0], [0, 46, 0], [0, 0, 44], [21, 46, 44], [21, 0, 44], [0, 46, 44], [21, 46, 0]]) track(...proj(p));

  ORDER.forEach((id, i) => {
    const part = PARTS[id]();
    const off = OFFSETS[id];
    const [dx, dy] = proj(off);
    const meta = ASSEMBLY.find((a) => a.id === id);
    parts += `<g class="part" id="part-${id}" data-pos="${meta.pos}" data-i="${ORDER.length - 1 - i}" data-tx="${r1(dx)}" data-ty="${r1(dy)}" transform="translate(${r1(dx)} ${r1(dy)})">${part.draw()}</g>`;
    for (const b of part.boxes) {
      const f = faces(b);
      for (const k of ['top', 'front', 'right']) for (const pt of f[k]) { const [x, y] = proj(add(pt, off)); track(x, y); }
    }
    const [ax, ay] = proj(add(part.anchor, off));
    callouts.push({ id, pos: meta.pos, ax, ay });
  });
  const [cx, cy] = proj(CASE_ANCHOR);
  callouts.push({ id: 'case', pos: 8, ax: cx, ay: cy });

  let co = '';
  for (const c of callouts.sort((a, b) => a.pos - b.pos)) {
    const [ox, oy] = CALLOUT[c.id];
    const bx = c.ax + ox; const by = c.ay + oy;
    const len = Math.hypot(ox, oy);
    const R = 16;
    const ex = bx - (ox / len) * R; const ey = by - (oy / len) * R;
    track(bx - R - 4, by - R - 4); track(bx + R + 4, by + R + 4);
    co += `<g class="callout" data-part="${c.id}">`
      + `<circle class="co-dot" cx="${r1(c.ax)}" cy="${r1(c.ay)}" r="2"/>`
      + `<line class="co-line" pathLength="1" x1="${r1(c.ax)}" y1="${r1(c.ay)}" x2="${r1(ex)}" y2="${r1(ey)}"/>`
      + `<g transform="translate(${r1(bx)} ${r1(by)})"><g class="co-ball"><circle r="${R}"/><text y="5.5">${c.pos}</text></g></g>`
      + '</g>';
  }

  const pad = 8;
  const minX = Math.min(...bounds.map((b) => b[0])) - pad; const maxX = Math.max(...bounds.map((b) => b[0])) + pad;
  const minY = Math.min(...bounds.map((b) => b[1])) - pad; const maxY = Math.max(...bounds.map((b) => b[1])) + pad;
  const vb = [minX, minY, maxX - minX, maxY - minY].map((n) => Math.round(n));

  const caseG = `<g class="part part--case" id="part-case" data-pos="8">${caseSvg()}</g>`;
  const svg = `<svg class="assembly" id="assembly" viewBox="${vb.join(' ')}" role="img" aria-labelledby="assembly-title" xmlns="http://www.w3.org/2000/svg">`
    + `<title id="assembly-title" data-i18n="hero.drawing">Сборочный чертёж компьютера: 8 деталей</title>`
    + caseG + `<g class="parts">${parts}</g><g class="callouts">${co}</g></svg>`;
  return { svg, vb };
}

// Иконки деталей: та же геометрия, собранное положение, без выносок.
function icons() {
  let out = '';
  const files = {};
  for (const { id } of ASSEMBLY) {
    const isCase = id === 'case';
    const part = isCase ? null : PARTS[id]();
    const draw = isCase ? caseSvg() : part.draw();
    const boxes = isCase ? [CASE] : part.boxes;
    const b = [];
    for (const bx of boxes) { const f = faces(bx); for (const k of ['top', 'front', 'right']) for (const pt of f[k]) b.push(proj(pt)); }
    const minX = Math.min(...b.map((p) => p[0])); const maxX = Math.max(...b.map((p) => p[0]));
    const minY = Math.min(...b.map((p) => p[1])); const maxY = Math.max(...b.map((p) => p[1]));
    const size = Math.max(maxX - minX, maxY - minY) + 6;
    const vb = [(minX + maxX) / 2 - size / 2, (minY + maxY) / 2 - size / 2, size, size].map((n) => r1(n));
    out += `<symbol id="ic-${id}" viewBox="${vb.join(' ')}">${symbolize(draw)}</symbol>`;
    files[id] = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.join(' ')}">${standalone(draw.replace(/<text[^>]*>[^<]*<\/text>/g, ''))}</svg>\n`;
  }
  return { sprite: `<svg class="sprite" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">${out}</svg>`, files };
}

// Отдельные SVG-файлы: стили атрибутами, потому что CSP запрещает <style> внутри.
const INK = '#23272B'; const MUTED = '#5D646B'; const CASEBG = '#F3F4F1';
const SW = ' vector-effect="non-scaling-stroke" stroke-width="1.25" stroke-linejoin="round"';
function standalone(markup) {
  return markup
    .replace(/class="f"/g, `fill="${CASEBG}" stroke="${INK}"${SW}`)
    .replace(/class="o"/g, `fill="none" stroke="${INK}"${SW}`)
    .replace(/class="d thin"/g, `fill="none" stroke="${MUTED}"${SW}`)
    .replace(/class="d"/g, `fill="none" stroke="${INK}"${SW}`)
    .replace(/class="ph"/g, `fill="none" stroke="${MUTED}" stroke-dasharray="4 3"${SW}`)
    .replace(/class="mk"/g, `fill="${INK}" font-family="Syncopate, sans-serif" font-weight="700"`)
    .replace(/class="co-dot"/g, `fill="${INK}"`)
    .replace(/class="co-line"/g, `stroke="${MUTED}"${SW}`)
    .replace(/<g class="co-ball"><circle /g, `<g><circle fill="${CASEBG}" stroke="${INK}"${SW} `)
    .replace(/<text y="5.5">/g, `<text y="4.5" text-anchor="middle" font-family="sans-serif" font-weight="600" font-size="14" fill="${INK}">`);
}

// Для <symbol>: стили документа не проходят внутрь <use>, поэтому цвета наследуются от <use>:
// заливка граней — свойство fill у .ic, линии — currentColor.
function symbolize(markup) {
  const VE = ' vector-effect="non-scaling-stroke" stroke-linejoin="round"';
  return markup
    .replace(/<text[^>]*>[^<]*<\/text>/g, '')
    .replace(/class="f"/g, `stroke="currentColor"${VE}`)
    .replace(/class="(o|d)"/g, `fill="none" stroke="currentColor"${VE}`)
    .replace(/class="d thin"/g, `fill="none" stroke="currentColor" stroke-opacity="0.55"${VE}`)
    .replace(/class="ph"/g, `fill="none" stroke="currentColor" stroke-opacity="0.55" stroke-dasharray="4 3"${VE}`);
}

function inject(html, name, content) {
  const re = new RegExp(`(<!-- ${name}:start -->)[\\s\\S]*?(<!-- ${name}:end -->)`);
  if (!re.test(html)) throw new Error(`В index.html нет меток ${name}:start / ${name}:end`);
  return html.replace(re, `$1${content}$2`);
}

const { svg, vb } = build();
const { sprite, files } = icons();
mkdirSync(here('../public/img/parts'), { recursive: true });
writeFileSync(here('../public/img/assembly.svg'), standalone(svg.replace('<svg ', `<svg width="${vb[2]}" height="${vb[3]}" `)) + '\n');
for (const [id, s] of Object.entries(files)) writeFileSync(here(`../public/img/parts/${id}.svg`), s);

const indexPath = here('../public/index.html');
let html = readFileSync(indexPath, 'utf8');
if (html.includes('<!-- assembly:start -->')) {
  html = inject(html, 'assembly', svg);
  html = inject(html, 'icons', sprite);
  writeFileSync(indexPath, html);
}
console.log(`assembly.svg ${Buffer.byteLength(svg)} B, viewBox ${vb.join(' ')}; иконок: ${Object.keys(files).length}`);
