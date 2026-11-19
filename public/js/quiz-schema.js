// Вопросы квиза: стабильные ID вариантов и русские подписи для Telegram-бота.
// Файл общий для браузера и сервера (api/ импортирует его), поэтому без DOM.
// Подписи для интерфейса на RU/UZ — в i18n.js по тем же ID.

export const QUESTIONS = {
  need: {
    type: 'single',
    label: 'Нужно',
    options: { build: 'Собрать ПК с нуля', upgrade: 'Улучшить мой ПК', part: 'Купить комплектующую', peripherals: 'Только периферия', b2b: 'Закупка для офиса/клуба' },
  },
  purpose: {
    type: 'multi',
    label: 'Для чего',
    options: { gaming: 'Игры', streaming: 'Стриминг', creative: 'Монтаж / 3D / дизайн', work: 'Работа и учёба', kids: 'Для ребёнка', other: 'Другое' },
  },
  parts: {
    type: 'multi',
    label: 'Интересует',
    exclusive: ['unsure'],
    options: {
      gpu: 'Видеокарта', cpu: 'Процессор', motherboard: 'Материнская плата', ram: 'Оперативная память', storage: 'SSD / HDD',
      psu: 'Блок питания', case: 'Корпус', cooling: 'Охлаждение', full_build: 'Готовая сборка целиком', unsure: 'Не знаю, нужна консультация',
    },
  },
  peripherals: {
    type: 'multi',
    label: 'Интересует',
    exclusive: ['other'],
    options: {
      monitor: 'Монитор', keyboard: 'Клавиатура', mouse: 'Мышь', headset: 'Наушники / гарнитура', mic: 'Микрофон',
      webcam: 'Веб-камера', mousepad: 'Коврик', chair: 'Кресло', other: 'Другое',
    },
  },
  budget: {
    type: 'single',
    label: 'Бюджет',
    options: { lt3: 'до 3 млн сум', '3_7': '3–7 млн сум', '7_15': '7–15 млн сум', '15_25': '15–25 млн сум', gt25: 'больше 25 млн сум', unknown: 'Пока не знаю, нужна консультация' },
  },
  timing: {
    type: 'single',
    label: 'Покупка',
    options: { now: 'Сегодня–завтра', week: 'На этой неделе', month: 'В течение месяца', browsing: 'Пока присматриваюсь' },
  },
  delivery: {
    type: 'single',
    label: 'Получение',
    options: { pickup: 'Самовывоз в Ташкенте', tashkent: 'Доставка по Ташкенту', region: 'Доставка в регион' },
  },
};

// Детали на сборочном чертеже: номер позиции = номер в спецификации.
export const ASSEMBLY = [
  { id: 'gpu', pos: 1, mark: 'GPU' },
  { id: 'cpu', pos: 2, mark: 'CPU' },
  { id: 'motherboard', pos: 3, mark: 'ATX' },
  { id: 'ram', pos: 4, mark: 'DDR5' },
  { id: 'storage', pos: 5, mark: 'NVME' },
  { id: 'psu', pos: 6, mark: 'PSU' },
  { id: 'cooling', pos: 7, mark: 'COOLER' },
  { id: 'case', pos: 8, mark: 'CASE' },
];

export const CITY_MIN = 2;
export const CITY_MAX = 40;

export function stepsFor(answers = {}) {
  const third = answers.need === 'peripherals' ? 'peripherals' : 'parts';
  return ['need', 'purpose', third, 'budget', 'timing', 'delivery'];
}

export function labelFor(key, id) {
  const q = QUESTIONS[key];
  return (q && q.options[id]) || id;
}

// Нажатие на вариант множественного выбора с учётом «исключающих» вариантов.
export function toggleMulti(key, current = [], id) {
  const q = QUESTIONS[key];
  const ex = q.exclusive || [];
  if (current.includes(id)) return current.filter((v) => v !== id);
  if (ex.includes(id)) return [id];
  return [...current.filter((v) => !ex.includes(v)), id];
}

const clean = (s) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();

// Общая проверка ответов для клиента и сервера.
// Возвращает { ok, errors: ['answers.need', …], value: нормализованные ответы }.
export function isValidAnswers(a) {
  const errors = [];
  const value = {};
  if (!a || typeof a !== 'object' || Array.isArray(a)) return { ok: false, errors: ['answers'], value };

  for (const key of stepsFor(a)) {
    const q = QUESTIONS[key];
    const v = a[key];
    if (q.type === 'single') {
      if (typeof v === 'string' && Object.hasOwn(q.options, v)) value[key] = v;
      else errors.push(`answers.${key}`);
    } else {
      const ok = Array.isArray(v) && v.length > 0 && v.length <= Object.keys(q.options).length
        && v.every((x) => typeof x === 'string' && Object.hasOwn(q.options, x))
        && new Set(v).size === v.length
        && !(v.length > 1 && v.some((x) => (q.exclusive || []).includes(x)));
      if (ok) value[key] = [...v];
      else errors.push(`answers.${key}`);
    }
  }

  if (value.delivery === 'region') {
    const city = clean(a.city);
    if (city.length >= CITY_MIN && city.length <= CITY_MAX) value.city = city;
    else errors.push('answers.city');
  }

  return { ok: errors.length === 0, errors, value };
}
