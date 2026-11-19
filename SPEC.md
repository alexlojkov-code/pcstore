# SPEC: лендинг комплектующих для ПК с квизом и Telegram-ботом (MVP)

| | |
|---|---|
| Проект | `business-landing` |
| Основа | [PRD.md](PRD.md) v0.3, [DESIGN.md](DESIGN.md) v0.1 |
| Версия SPEC | 0.2 (учтён DESIGN.md) |
| Дата | 19.11.2026 |
| Бэкенд и бот | Node.js 22 (Vercel Functions), ES-модули, без внешних зависимостей |

---

## 1. Границы

### 1.1 Входит в MVP

- Квиз при входе: 6 шагов, ветвление на шаге 3, форма контактов, экран «Спасибо», «Пропустить» на каждом шаге.
- Лендинг: блоки 1, 2, 4, 6, 8, 9, 10 из PRD §7, плавающая кнопка «Подобрать комплектующие» на телефоне. Сборочный чертёж на первом экране с одной анимацией раскладки (§8.2).
- Языки RU и UZ (латиница) с первого дня.
- `POST /api/lead`: проверка заявки и отправка её в Telegram-группу менеджеров.
- Telegram-бот на Node.js (webhook): `/start`, `/id`, `/help`, `/test`, сообщает ID группы, когда его в неё добавляют.
- Политика конфиденциальности RU/UZ (`privacy.html`).
- Meta Pixel (если задан Pixel ID) и события квиза.
- Защита от спама, повторы отправки в Telegram, понятная ошибка для клиента.
- Демо на GitHub Pages: заявки не отправляются.

### 1.2 Этап 2 (описан в SPEC, но не в MVP)

- Кнопки в боте «✅ Взял в работу» / «📵 Не дозвонился» (§6.5). Это примерно полдня работы, их можно перенести в MVP.
- Блоки «Популярные товары / сборки», «Отзывы», «Бренды».

### 1.3 Не входит

Корзина, онлайн-оплата, каталог, хранение заявок в базе, CRM, синхронизация со складом.

### 1.4 Решения, которые уточняют PRD

| PRD | В SPEC | Почему |
|---|---|---|
| Телефон в боте — ссылкой `tel:` | Телефон обычным текстом `+998 90 123-45-67` | Bot API не поддерживает ссылки `tel:`. Telegram сам делает номер кликабельным |
| Отдельная переменная `TELEGRAM_WEBHOOK_SECRET` | Секрет webhook вычисляется из токена (SHA-256) | На одну переменную меньше, которую пользователь вводит вручную |
| Ошибки пишутся в логи | В логах нет имени, телефона и комментария | Логи Vercel хранятся за рубежом, персональные данные туда не пишем (PRD §10.5) |
| Защита от повторов: «3 заявки за 10 минут» | В памяти функции + `localStorage` у клиента | Без базы данных лимит работает «по возможности» (§5.6) |
| Шрифты с Google Fonts | Шрифты лежат на нашем сервере (`public/fonts/`) | Быстрее, нет внешнего запроса, CSP строже (DESIGN §4.1) |

---

## 2. Архитектура

```
Браузер (статика public/)
  ├─ квиз + лендинг (vanilla JS, ES-модули)
  └─ POST /api/lead ─────────► Vercel Function (Node.js 22)
                                 ├─ проверка, антиспам, оценка «температуры»
                                 └─ Telegram Bot API sendMessage ──► группа «Заявки»

Telegram ── webhook POST /api/bot ──► Vercel Function (Node.js 22)
                                         └─ /start, /id, /help, /test, добавление в группу, кнопки (этап 2)
```

- Хранилища нет: заявка живёт только в Telegram.
- Справочник вопросов квиза (`public/js/quiz-schema.js`) — **единый источник** для фронтенда и сервера. Функции импортируют его через `../public/js/quiz-schema.js`, Vercel включает файл в бандл автоматически.
- Внешних npm-зависимостей нет: `fetch`, `crypto`, `node:test` встроены в Node.js.

### 2.1 Структура проекта

```
business-landing/
├─ api/
│  ├─ lead.js              POST /api/lead — приём заявки
│  ├─ bot.js               POST /api/bot  — webhook Telegram
│  ├─ setup.js             GET  /api/setup — регистрация webhook и команд бота
│  ├─ health.js            GET  /api/health
│  └─ _lib/
│     ├─ telegram.js       вызовы Bot API, повторы, таймауты
│     ├─ validate.js       проверка и нормализация заявки
│     ├─ format.js         текст сообщения о заявке (HTML)
│     ├─ score.js          «температура» заявки
│     ├─ lead-id.js        ID вида PC-4F7K
│     ├─ ua.js             краткий разбор User-Agent
│     ├─ ratelimit.js      лимиты и защита от дублей (в памяти)
│     ├─ http.js           чтение тела, JSON-ответы
│     ├─ env.js            чтение переменных окружения
│     └─ log.js            JSON-логи без персональных данных
├─ public/
│  ├─ index.html
│  ├─ privacy.html
│  ├─ css/
│  │  ├─ tokens.css        цвета, шрифты, отступы, радиусы из DESIGN §3–5
│  │  ├─ base.css          сброс, типографика, кнопки, поля
│  │  ├─ quiz.css
│  │  └─ landing.css
│  ├─ fonts/
│  │  ├─ roboto-flex.woff2 вариативный, оси wdth/wght/opsz урезаны, латиница + кириллица
│  │  └─ syncopate-700.woff2 только A–Z, 0–9, пробел и знаки цены
│  ├─ js/
│  │  ├─ main.js           точка входа: язык, первый визит, запуск квиза
│  │  ├─ config.js         данные магазина (контакты, Pixel ID, рассрочка…)
│  │  ├─ quiz-schema.js    вопросы, ID вариантов, ветвление (общий с сервером)
│  │  ├─ quiz.js           интерфейс квиза и машина состояний
│  │  ├─ i18n.js           словари RU/UZ, переключение языка
│  │  ├─ phone.js          маска и нормализация телефона
│  │  ├─ attribution.js    UTM, fbclid, gclid, referrer, первый визит
│  │  ├─ analytics.js      обёртка над Meta Pixel
│  │  ├─ api.js            отправка заявки
│  │  ├─ assembly.js       раскладка чертежа и связь чертёж ↔ спецификация
│  │  └─ storage.js        безопасный доступ к localStorage / sessionStorage
│  └─ img/
│     ├─ assembly.svg      исходник сборочного чертежа, ≤ 25 КБ; его код вставлен в index.html (§8.2)
│     ├─ parts/*.svg       детали для квиза, спецификации и заглушек фото
│     └─ og.png            картинка для соцсетей 1200×630: чертёж на фоне --case
├─ scripts/
│  └─ check.mjs            самопроверка: схема квиза ↔ словари RU/UZ
├─ tests/                  node --test
├─ server.mjs              локальный сервер: статика + /api/*
├─ vercel.json
├─ package.json
├─ .env.example
├─ PRD.md · SPEC.md · README.md
└─ .github/workflows/pages.yml
```

---

## 3. Конфигурация

### 3.1 Переменные окружения

| Переменная | Где | Обязательна | Описание |
|---|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Vercel (Production, Preview) | да | Токен от @BotFather. Владелец вставляет сам, в код и чат не попадает. Тип **Sensitive** |
| `TELEGRAM_CHAT_ID` | Vercel (Production) | да | ID группы «Заявки», например `-1002233445566`. Можно несколько через запятую |
| `TELEGRAM_MOCK` | только локально | нет | `1` — сообщения не уходят в Telegram, а печатаются в консоль |
| `LOG_LEVEL` | везде | нет | `info` (по умолчанию) или `debug` |

`VERCEL_ENV` и `VERCEL_PROJECT_PRODUCTION_URL` Vercel задаёт сам.

`.env.example`:

```
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
TELEGRAM_MOCK=1
```

Если токена или ID чата нет, `/api/lead` отвечает `500 {"ok":false,"error":"not_configured"}`, а клиент видит запасной экран (§7.6).

### 3.2 `package.json`

```json
{
  "name": "business-landing",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22" },
  "scripts": {
    "dev": "node server.mjs",
    "test": "node --test tests/",
    "check": "node scripts/check.mjs"
  }
}
```

### 3.3 `vercel.json`

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": null,
  "buildCommand": "",
  "outputDirectory": "public",
  "functions": {
    "api/*.js": { "maxDuration": 15 }
  },
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" },
        { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self' https://connect.facebook.net; connect-src 'self' https://www.facebook.com https://connect.facebook.net; img-src 'self' data: https://www.facebook.com; style-src 'self'; font-src 'self'; frame-src https://yandex.uz https://www.google.com; base-uri 'self'; form-action 'self'; frame-ancestors 'none'" }
      ]
    },
    {
      "source": "/api/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "no-store" }]
    }
  ]
}
```

Инлайн-скриптов нет, поэтому `'unsafe-inline'` не нужен. Инициализация Pixel тоже лежит в отдельном файле (`analytics.js`). Шрифты с нашего домена, поэтому Google Fonts в CSP нет.

### 3.4 `public/js/config.js`

Все данные магазина в одном месте. Пустые значения скрывают соответствующий элемент на странице.

```js
export default {
  shopName: 'PCSTORE',                       // PRD §14.1, логотип — Syncopate (только латиница)
  phone: '+998000000000',                    // PRD §14.2
  telegram: 'username',                      // без @
  instagram: '',
  address: { ru: '', uz: '' },
  mapEmbedUrl: '',                           // iframe Яндекс/Google Карт
  hours: { open: '10:00', close: '20:00', days: [1, 2, 3, 4, 5, 6, 7] }, // время Ташкента
  installment: [],                           // например ['Uzum Nasiya', 'Alif'] — PRD §14.3
  delivery: { tashkent: '', regions: '' },   // сроки и стоимость — PRD §14.4
  warranty: '',                              // PRD §14.5
  passport: null,                            // PRD §14.9: { stressHours, cpuMaxC, gpuMaxC, buildWarrantyMonths } или null → простой текст вместо паспорта
  pixelId: '',                               // PRD §14.7
  legal: { name: '', inn: '' },              // PRD §14.8
  replyMinutes: 15,                          // «свяжемся в течение N минут»
  apiUrl: '/api/lead',
};
```

Демо-режим включается сам, если `location.hostname` заканчивается на `github.io`.

---

## 4. Квиз: схема данных (`quiz-schema.js`)

Файл без DOM, работает и в браузере, и в Node.js. В нём стабильные ID вариантов (они уходят на сервер) и **русские** подписи для бота. Подписи для интерфейса на RU/UZ лежат в `i18n.js` по тем же ID.

### 4.1 Шаги и варианты

| Шаг | Ключ | Тип | ID вариантов → подпись в боте |
|---|---|---|---|
| 1 | `need` | один | `build` Собрать ПК с нуля · `upgrade` Улучшить мой ПК · `part` Купить комплектующую · `peripherals` Только периферия · `b2b` Закупка для офиса/клуба |
| 2 | `purpose` | 1–6 | `gaming` Игры · `streaming` Стриминг · `creative` Монтаж / 3D / дизайн · `work` Работа и учёба · `kids` Для ребёнка · `other` Другое |
| 3а | `parts` | 1–10 | `gpu` Видеокарта · `cpu` Процессор · `motherboard` Материнская плата · `ram` Оперативная память · `storage` SSD / HDD · `psu` Блок питания · `case` Корпус · `cooling` Охлаждение · `full_build` Готовая сборка целиком · `unsure` Не знаю, нужна консультация |
| 3б | `peripherals` | 1–9 | `monitor` Монитор · `keyboard` Клавиатура · `mouse` Мышь · `headset` Наушники / гарнитура · `mic` Микрофон · `webcam` Веб-камера · `mousepad` Коврик · `chair` Кресло · `other` Другое |
| 4 | `budget` | один | `lt3` до 3 млн сум · `3_7` 3–7 млн сум · `7_15` 7–15 млн сум · `15_25` 15–25 млн сум · `gt25` больше 25 млн сум · `unknown` Пока не знаю, нужна консультация |
| 5 | `timing` | один | `now` Сегодня–завтра · `week` На этой неделе · `month` В течение месяца · `browsing` Пока присматриваюсь |
| 6 | `delivery` | один | `pickup` Самовывоз в Ташкенте · `tashkent` Доставка по Ташкенту · `region` Доставка в регион |
| 6+ | `city` | текст | только если `delivery = region`, 2–40 символов |

Вариант `unsure` в шаге 3а и `other` в 3б — «исключающие»: при их выборе остальные снимаются, и наоборот.

### 4.2 Ветвление

```js
export function stepsFor(answers) {
  const third = answers.need === 'peripherals' ? 'peripherals' : 'parts';
  return ['need', 'purpose', third, 'budget', 'timing', 'delivery'];
}
```

Если на шаге 1 изменили ответ и ветка сменилась, ответы чужой ветки удаляются (`parts` ↔ `peripherals`).

### 4.3 Экспорт

```js
export const QUESTIONS;          // описание шагов из §4.1
export function stepsFor(a);     // §4.2
export function labelFor(key, id);   // русская подпись для бота
export function isValidAnswers(a);   // общая проверка для клиента и сервера → { ok, errors[] }
```

---

## 5. API

### 5.1 `POST /api/lead`

**Запрос** (`Content-Type: application/json`, не больше 10 КБ):

```json
{
  "submission_id": "6f1c2a9e-3b0d-4f6a-9c1e-2d7b8a4e5f10",
  "lang": "ru",
  "answers": {
    "need": "build",
    "purpose": ["gaming", "streaming"],
    "parts": ["gpu", "cpu", "full_build"],
    "budget": "15_25",
    "timing": "week",
    "delivery": "region",
    "city": "Самарканд"
  },
  "contact": {
    "name": "Алишер",
    "phone": "998901234567",
    "channel": "telegram",
    "telegram": "alisher_pc",
    "comment": "хочу тянуть CS2 на 240 fps",
    "consent": true
  },
  "meta": {
    "utm": { "source": "instagram", "medium": "cpc", "campaign": "pc_build_nov", "content": "video1", "term": "" },
    "fbclid": "",
    "gclid": "",
    "referrer": "https://l.instagram.com/",
    "first_visit": true,
    "quiz_ms": 48210,
    "page": "https://business-landing-uz.vercel.app/?utm_source=instagram"
  },
  "website": ""
}
```

`website` — скрытое поле-ловушка (honeypot), у человека всегда пустое.

**Ответы:**

| Код | Тело | Когда |
|---|---|---|
| 200 | `{"ok":true,"lead_id":"PC-4F7K"}` | доставлено хотя бы в один чат |
| 200 | `{"ok":true,"lead_id":"PC-XXXX"}` | сработал антиспам (ловушка, слишком быстро) — бот **молча** отбрасывает заявку |
| 200 | `{"ok":true,"lead_id":"…","duplicate":true}` | повтор с тем же `submission_id` за 10 минут — повторно не отправляется |
| 400 | `{"ok":false,"error":"validation","fields":["contact.phone"]}` | неверные данные |
| 405 | `{"ok":false,"error":"method"}` | не POST |
| 413 | `{"ok":false,"error":"too_large"}` | тело больше 10 КБ |
| 415 | `{"ok":false,"error":"content_type"}` | не JSON |
| 429 | `{"ok":false,"error":"rate_limited","retry_after":600}` | лимит (§5.6) |
| 500 | `{"ok":false,"error":"not_configured"}` | нет токена или ID чата |
| 502 | `{"ok":false,"error":"delivery_failed"}` | Telegram не принял после всех попыток |

### 5.2 Проверка (`_lib/validate.js`)

Сервер не доверяет клиенту: всё проверяется заново, лишние поля отбрасываются.

| Поле | Правило |
|---|---|
| `submission_id` | UUID v4 |
| `lang` | `ru` \| `uz`, иначе `ru` |
| `answers` | `isValidAnswers()` из схемы: ID только из списков, обязательные шаги ветки заполнены, у одиночных — строка, у множественных — непустой массив без повторов |
| `answers.city` | обязателен при `delivery = region`, 2–40 символов после `trim` |
| `contact.name` | 2–40 символов после `trim`, без управляющих символов, повторяющиеся пробелы схлопываются |
| `contact.phone` | ровно `/^998\d{9}$/` |
| `contact.channel` | `telegram` \| `call` \| `whatsapp` |
| `contact.telegram` | необязателен, `/^[A-Za-z0-9_]{5,32}$/` после удаления `@` и `https://t.me/` |
| `contact.comment` | необязателен, не больше 300 символов |
| `contact.consent` | строго `true` |
| `meta.utm.*`, `fbclid`, `gclid` | строки, обрезка до 200 символов |
| `meta.referrer`, `meta.page` | только `http(s)://`, обрезка до 300 символов |
| `meta.quiz_ms` | целое 0…3 600 000 |
| `meta.first_visit` | boolean |

### 5.3 Антиспам

1. `website` не пустой → тихий отказ (200, заявка не отправляется, лог `spam.honeypot`).
2. `quiz_ms < 5000` → тихий отказ (лог `spam.too_fast`).
3. Тихий ответ выглядит как успех, чтобы бот не подбирал обход.

### 5.4 Обработка заявки

1. Проверить метод, `Content-Type`, размер, распарсить JSON.
2. Антиспам (§5.3) → лимиты (§5.6) → проверка (§5.2).
3. `lead_id = newLeadId()` (§5.5), `temperature = score(answers)` (§6.3).
4. Устройство из заголовка `User-Agent` (`_lib/ua.js`): `Телефон` / `Планшет` / `ПК` + ОС (iOS, Android, Windows, macOS, Linux) + браузер (Safari, Chrome, Firefox, Edge, Samsung Internet, Instagram, Facebook, Telegram). Неизвестное → `—`.
5. Собрать сообщение `formatLead()` (§6.2) и отправить в каждый чат из `TELEGRAM_CHAT_ID` параллельно (§6.1).
6. Хотя бы одна доставка удалась → 200. Все неудачны → 502.
7. Записать в лог `lead.sent` / `lead.failed` (§9).

IP-адрес клиента не читается и не пересылается.

### 5.5 ID заявки

`PC-` + 4 символа из алфавита `23456789ABCDEFGHJKLMNPQRSTUVWXYZ` (без 0/O/1/I), источник — `crypto.randomInt`. Это около миллиона вариантов: для ссылок внутри группы хватает, глобальная уникальность не требуется.

### 5.6 Лимиты и дубли (`_lib/ratelimit.js`)

- В памяти экземпляра функции: `Map` с ключом `sha256(user-agent + accept-language + x-forwarded-for)`. Хранится только хеш, не IP. Не больше 3 заявок за 10 минут, иначе 429.
- Повтор `submission_id` за 10 минут → ответ `duplicate: true` с тем же `lead_id`, без повторной отправки.
- Записи старше 10 минут удаляются при каждом обращении, размер `Map` не больше 5000.
- Ограничение: у Vercel несколько экземпляров функции, поэтому лимит работает «по возможности». Основная защита от двойного нажатия — на клиенте (§7.5). Если спама станет много, добавить Upstash Redis (этап 3).

### 5.7 `GET /api/health`

`200 {"ok":true,"configured":true|false,"env":"production"}`. Без секретов, `configured` показывает, заданы ли токен и ID чата.

---

## 6. Telegram-бот (Node.js)

### 6.1 `_lib/telegram.js`

```js
export async function tg(method, payload, { attempts = 3 } = {})
```

- `POST https://api.telegram.org/bot<TOKEN>/<method>`, JSON, таймаут 4 секунды на попытку (`AbortSignal.timeout(4000)`).
- Повтор при сетевой ошибке, таймауте, `5xx` и `429`. Пауза: `retry_after` из ответа Telegram (при 429) или 300 мс → 900 мс. Всего не больше 3 попыток и не больше ~10 секунд.
- `400`/`403` не повторяются: это ошибка данных или бота выгнали из группы. В лог пишется `description` от Telegram.
- Ответ `400` с `migrate_to_chat_id` (группа стала супергруппой): одна повторная отправка на новый ID и предупреждение в лог `tg.chat_migrated`, что ID в Vercel нужно поменять.
- `TELEGRAM_MOCK=1`: ничего не отправляет, печатает `payload.text` в консоль и возвращает `{ ok: true, result: { message_id: 1 } }`.
- Токен никогда не попадает в логи и тексты ошибок.

### 6.2 Сообщение о заявке (`_lib/format.js`)

`parse_mode: "HTML"`, все пользовательские значения проходят через `escapeHtml` (`& < > "`), `disable_web_page_preview: true`.

```
🔥 <b>Новая заявка PC-4F7K</b> · горячая

👤 <b>Алишер</b>
📞 +998 90 123-45-67
💬 Связь: Telegram @alisher_pc

🖥 Нужно: Собрать ПК с нуля
🎯 Для чего: Игры, Стриминг
🧩 Интересует: Видеокарта, Процессор, Готовая сборка целиком
💰 Бюджет: 15–25 млн сум
⏱ Покупка: На этой неделе
🚚 Получение: Доставка в регион — Самарканд
📝 Комментарий: хочу тянуть CS2 на 240 fps

— — —
🌐 RU · 📱 Телефон, iOS / Safari · ⌛ квиз за 48 сек · первый визит
📣 instagram / cpc / pc_build_nov / video1
🕒 19.11.2026 14:32 (Ташкент)
```

Правила:

- Телефон: `+998 XX XXX-XX-XX`, Telegram сам делает его кликабельным.
- Связь: `telegram` → `Telegram @ник` (Telegram сам сделает ссылку). Без ника → `Telegram (ник не указан, писать по номеру)`. `call` → `Звонок`. `whatsapp` → `<a href="https://wa.me/998901234567">WhatsApp</a>`.
- В шаге 3 подпись «🧩 Интересует» общая для `parts` и `peripherals`.
- Пустые строки (нет комментария, нет UTM) не выводятся. Если нет UTM, но есть referrer, выводится `📣 из: l.instagram.com` (только домен). Если есть `fbclid`/`gclid`, к источнику добавляется `· fb` / `· google`.
- Время: `Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Tashkent', … })`.
- Длина сообщения ≤ 4096 символов: при превышении обрезается комментарий.
- Подписи для бота всегда на русском (`labelFor`), язык клиента — отдельной пометкой `RU` / `UZ`.

### 6.3 «Температура» (`_lib/score.js`)

```js
export function score({ timing, budget }) {
  if (timing === 'browsing') return 'cold';
  if ((timing === 'now' || timing === 'week') && budget !== 'unknown') return 'hot';
  return 'warm';
}
```

`hot` → `🔥 … · горячая`, `warm` → `🟡 … · тёплая`, `cold` → `❄️ … · холодная`. Правило вынесено в одну функцию, тесты покрывают все 24 сочетания.

### 6.4 Webhook `POST /api/bot`

- Проверка заголовка `X-Telegram-Bot-Api-Secret-Token` = `webhookSecret(token)`, где `webhookSecret = sha256('business-landing:' + token).hex.slice(0, 48)`. Не совпал → 401.
- Метод не POST → 200 `{ok:true}` (Telegram не ждёт ответа на GET).
- Обработчик всегда отвечает 200 быстрее чем за 10 секунд, даже при внутренней ошибке (иначе Telegram будет повторять обновление). Ошибки только в лог.

| Обновление | Действие |
|---|---|
| `/start`, `/id` (в т. ч. `/id@bot`) | Ответ с ID чата. В личке: «Ваш ID: `…`». В группе: «ID этой группы: `…`. Вставьте его в TELEGRAM_CHAT_ID в Vercel» |
| `/help` | Короткая справка: что делает бот, откуда приходят заявки |
| `/test` | **Только** в чатах из `TELEGRAM_CHAT_ID`: присылает пример заявки с пометкой «ТЕСТ», чтобы проверить формат. В других чатах — «Эта команда работает только в группе заявок» |
| `my_chat_member` (бота добавили в группу) | Пишет в группу её ID и подсказку, куда его вставить |
| `message.migrate_to_chat_id` | Пишет в новую супергруппу её новый ID и просит обновить его в Vercel |
| `callback_query` | Этап 2, §6.5 |
| остальное | игнорируется |

Бот не отвечает на обычные сообщения в группе, чтобы не мешать менеджерам.

### 6.5 Кнопки в заявке (этап 2)

Сообщение о заявке получает `reply_markup`:

```json
{ "inline_keyboard": [[
  { "text": "✅ Взял в работу", "callback_data": "take:PC-4F7K" },
  { "text": "📵 Не дозвонился", "callback_data": "miss:PC-4F7K" }
]] }
```

Без базы данных: всё состояние хранится в самом сообщении.

- Нажатие засчитывается, только если `callback_query.message.chat.id` есть в `TELEGRAM_CHAT_ID`.
- `take`: к тексту дописывается строка `✅ Взял: <имя менеджера>, 14:35`, кнопка «Взял» исчезает, «Не дозвонился» остаётся. Если заявку уже взял другой, всплывает уведомление `answerCallbackQuery`: «Уже взял Сардор».
- `miss`: дописывается `📵 Не дозвонился: <имя>, 14:40`. Максимум 5 таких строк.
- Редактирование: `editMessageText` с `text = message.text + '\n' + строка` и `entities = message.entities`. Строки добавляются в конец, поэтому смещения форматирования не сдвигаются, и HTML собирать заново не нужно.
- Всегда вызывается `answerCallbackQuery`, иначе у менеджера будут «часики» на кнопке.

### 6.6 Регистрация `GET /api/setup`

Открыть один раз после того, как токен вставлен в Vercel:

1. Работает только на production (`VERCEL_ENV === 'production'`). На preview и локально → 403.
2. `setWebhook`: `url = https://${VERCEL_PROJECT_PRODUCTION_URL}/api/bot`, `secret_token = webhookSecret(token)`, `allowed_updates = ["message","my_chat_member","callback_query"]`, `drop_pending_updates = true`.
3. `setMyCommands` для RU: `start` — «Узнать ID чата», `id` — «Узнать ID чата», `help` — «Справка», `test` — «Тестовая заявка».
4. `getWebhookInfo` → ответ страницы: `{ ok, webhook_url, pending_update_count, last_error_message }` без токена.

Вызов идемпотентный: повторное открытие ничего не ломает. Webhook всегда указывает на production-адрес, а не на хост запроса, поэтому вызов с preview-домена его не уведёт.

### 6.7 Настройка бота владельцем (войдёт в README)

1. @BotFather → `/newbot` → имя и username → скопировать токен.
2. @BotFather → `/setprivacy` → бот → `Enable` (бот видит в группе только команды).
3. Vercel → проект `business-landing` → Settings → Environment Variables → `TELEGRAM_BOT_TOKEN` (Sensitive, Production + Preview) → Save → Redeploy.
4. Открыть `https://business-landing-uz.vercel.app/api/setup`, должно быть `"ok": true`.
5. Создать группу «Заявки», добавить менеджеров и бота → бот пришлёт ID группы.
6. ID группы — в `TELEGRAM_CHAT_ID` (Production) → Redeploy.
7. В группе отправить `/test` → должна прийти тестовая заявка.

---

## 7. Фронтенд

### 7.1 Загрузка

- `index.html` отдаёт лендинг сразу, квиз — в том же документе в `<dialog id="quiz">`.
- `main.js` (`type="module"`, `defer`):
  1. `i18n.init()` — язык (§7.7).
  2. `attribution.capture()` — UTM и источник (§7.8).
  3. Если `storage.get('bl.quiz')` пустой → открыть квиз. Иначе квиз не открывается сам.
  4. Навесить кнопки «Подобрать комплектующие» и строки спецификации.
  5. `assembly.init()` — раскладка чертежа (§8.2): запускается, когда чертёж виден **и** окно квиза закрыто.
- Пока JS не загрузился, лендинг полностью рабочий: контакты и ссылка на Telegram видны.

### 7.2 Интерфейс квиза (`quiz.js`)

- `<dialog>` + `showModal()`: фокус удерживается внутри окна, фон не прокручивается (`body` получает `overflow: hidden`). На ширине < 768 px — на весь экран (`100dvh`), на ПК — окно до 640 px шириной по центру.
- Шапка: прогресс «Шаг 2 из 6» + полоска, кнопка «Пропустить, просто посмотреть». `Esc` работает как «Пропустить».
- Варианты — `<button>` с `aria-pressed` (множественный выбор) или группа `role="radiogroup"` (одиночный). Не меньше 56 px в высоту, сетка: 1 колонка на телефоне, 2 на ПК. Выбранный вариант — заливка `--kapton`, текст `--ink` (DESIGN §8.1). Иконки из `img/parts/` только у деталей на шаге 3.
- Одиночный выбор: подсветка, через 200 мс переход к следующему шагу. Множественный: кнопка «Далее», неактивна, пока ничего не выбрано.
- «Назад» на шагах 2–6 и в форме контактов, ответы сохраняются.
- Переход между шагами: сдвиг на 24 px + прозрачность, 200 мс. При `prefers-reduced-motion` — без анимации.
- После каждого шага состояние сохраняется в `sessionStorage` (`bl.quiz.draft`), поэтому обновление страницы не теряет ответы.
- Шаги считаются от первого ответа: `quiz_ms` = время от первого ответа до отправки.

### 7.3 Состояния

```
closed ──open()──► step(1..6) ──last──► contact ──submit──► sending ──ok──► thanks
   ▲                   │                   │                   │
   └──── skip ─────────┴───────────────────┘                   └─error─► error (повторить / написать в Telegram)
```

- `skip` (на любом шаге): `bl.quiz = 'skipped'`, `track('QuizSkip', { step })`, окно закрывается.
- `thanks`: `bl.quiz = 'done'`, черновик удаляется.
- `open({ preset })` вызывается кнопкой «Подобрать» в строке спецификации: например `preset = { need: 'part', parts: ['gpu'] }`. Квиз открывается на шаге 1 с отмеченными вариантами.
- При закрытии окна (`skip` или `thanks`) квиз сообщает `assembly.js`, что можно запускать раскладку чертежа.

### 7.4 Форма контактов

| Поле | Элемент | Проверка на клиенте |
|---|---|---|
| Имя | `<input autocomplete="given-name">` | 2–40 символов |
| Телефон | `<input type="tel" inputmode="tel" autocomplete="tel">` + маска `phone.js` | 9 цифр после `+998` |
| Как связаться | три кнопки-переключателя, по умолчанию Telegram | — |
| Telegram-ник | показывается при Telegram, префикс `@` | `[A-Za-z0-9_]{5,32}` или пусто |
| Комментарий | `<textarea maxlength="300">`, свёрнут под ссылкой «Добавить комментарий» | — |
| Согласие | `<input type="checkbox" required>` + ссылка на `privacy.html` (в новой вкладке) | обязательно |
| Ловушка | `<input name="website" tabindex="-1" autocomplete="off">` вне экрана, `aria-hidden` | — |

- `phone.js`: поле всегда начинается с `+998 `, курсор нельзя поставить перед кодом. При вставке номера в любом виде (`90 123 45 67`, `+998901234567`, `8 90…`) остаются последние 9 цифр. Отображение `+998 (90) 123-45-67`, на сервер уходит `998901234567`.
- Ошибки показываются под полем после ухода из поля (`blur`) или при нажатии «Получить подборку». Поле связано с текстом ошибки через `aria-describedby`, фокус переходит на первое неверное поле.
- Шрифт полей не меньше 16 px, иначе iOS увеличивает страницу.

### 7.5 Отправка (`api.js`)

- `submission_id = crypto.randomUUID()` создаётся при открытии формы и не меняется при повторных попытках.
- Кнопка блокируется, вместо текста — индикатор «Отправляем…». Повторное нажатие ничего не делает.
- Таймаут запроса 15 секунд.
- Клиентский лимит: если в `localStorage` есть `bl.lastLead` моложе 2 минут, то не отправлять повторно, а сразу показать «Спасибо» с прошлым `lead_id`.
- Демо-режим (`github.io`): запрос не отправляется. Через 600 мс показывается «Спасибо» с плашкой «Демо-версия: заявка не отправлена».

### 7.6 Экраны результата

**Спасибо** (`thanks`):
- Заголовок «Спасибо, {имя}.» Без восклицательного знака и без конфетти, выровнено влево.
- Текст по способу связи: `telegram` — «Менеджер напишет вам в Telegram», `call` — «Менеджер позвонит вам», `whatsapp` — «Менеджер напишет вам в WhatsApp». Окончание по `config.hours` (Ташкент): в рабочее время «…в течение {replyMinutes} минут», иначе «…завтра после {open}».
- Номер заявки мелко: «Номер заявки: PC-4F7K».
- Если на шаге 3 выбрана деталь — её рисунок из `img/parts/` с подсветкой `--kapton`, без анимации.
- Кнопка «Написать нам сейчас» (`https://t.me/{telegram}`) и текстовая ссылка «Вернуться на сайт» (закрывает окно).

**Ошибка** (`error`: 5xx, 429, сеть, таймаут):
- «Не получилось отправить заявку. Попробуйте ещё раз или напишите нам в Telegram».
- Кнопки: «Отправить ещё раз» (тот же `submission_id`), «Написать в Telegram», «Позвонить» (`tel:`).
- Ответы квиза и контакты не теряются.

**400 validation**: подсветить поля из `fields`, остаться на форме.

### 7.7 Языки (`i18n.js`)

- Порядок выбора: `?lang=uz|ru` → `localStorage bl.lang` → `navigator.language` начинается с `uz` → `ru`.
- Словари `{ ru: {...}, uz: {...} }` в одном файле. Ключи — ID из схемы квиза и ключи текстов страницы. Тексты страницы в HTML размечены `data-i18n="key"`, атрибуты — `data-i18n-attr="placeholder:key"`.
- Переключатель RU | UZ в шапке и в квизе: меняет тексты без перезагрузки, обновляет `<html lang>`, `<title>`, `meta description` и `?lang` в адресе через `history.replaceState`.
- `npm run check` проверяет, что у каждого ключа есть перевод на оба языка и у каждого варианта схемы есть подписи.
- UZ-тексты помечены `// TODO: вычитка носителем` до проверки.

### 7.8 Источник трафика (`attribution.js`)

- При входе читаются `utm_source|medium|campaign|content|term`, `fbclid`, `gclid` из адреса и `document.referrer` (только внешний).
- **Первое касание**: если в адресе есть метки, они сохраняются в `localStorage bl.attr` на 30 дней и не перезаписываются пустыми. Если в адресе меток нет, берутся сохранённые.
- `first_visit`: нет `bl.visited` → `true`, затем записывается дата визита.

### 7.9 Аналитика (`analytics.js`)

- Pixel загружается, только если `config.pixelId` не пустой и это не демо. Скрипт `connect.facebook.net/en_US/fbevents.js` подключается динамически.
- `track(name, params)`: стандартные события (`PageView`, `Lead`, `Contact`) — `fbq('track')`, остальные — `fbq('trackCustom')`. Без Pixel вызовы ничего не делают.

| Событие | Когда | Параметры |
|---|---|---|
| `PageView` | загрузка | — |
| `QuizStart` | первый ответ | — |
| `QuizStep` | переход на шаг N | `{ step }` |
| `QuizSkip` | «Пропустить» | `{ step }` |
| `QuizComplete` | открыта форма контактов | — |
| `Lead` | ответ 200 от `/api/lead` | `{ eventID: lead_id, content_category: need }` |
| `Contact` | клик по Telegram / телефону / WhatsApp на странице | `{ method }` |

В Pixel не передаются имя, телефон и комментарий.

### 7.10 `storage.js`

`get/set/remove` для `localStorage` и `sessionStorage`, каждое обращение в `try/catch`. Если хранилище недоступно (приватный режим, запрет), сайт работает: квиз просто показывается при каждом визите.

| Ключ | Где | Значение |
|---|---|---|
| `bl.quiz` | local | `done` \| `skipped` |
| `bl.quiz.draft` | session | `{ step, answers, contact }` |
| `bl.lang` | local | `ru` \| `uz` |
| `bl.attr` | local | `{ utm, fbclid, gclid, referrer, ts }` |
| `bl.visited` | local | ISO-дата первого визита |
| `bl.lastLead` | local | `{ id, ts }` |
| `bl.explode` | session | `1` — раскладка чертежа уже показана |

---

## 8. Лендинг

### 8.1 Блоки MVP (PRD §7)

| # | Блок | Источник данных | Примечание |
|---|---|---|---|
| 1 | Первый экран | i18n + `img/assembly.svg` | заголовок, абзац, кнопка квиза, одна фраза о проверке, чертёж. Ряда цифр-фактов нет |
| 2 | Спецификация | `quiz-schema` + i18n | `<table>` на ПК, список на телефоне; номера = позиции чертежа; «Подобрать» → `quiz.open({ preset })` |
| 4 | Паспорт сборки | `config.passport` + i18n | документ с реальными значениями; при `passport = null` — абзац о гарантии и проверке |
| 6 | Оплата и доставка | `config.installment`, `config.delivery` | пустые пункты скрываются |
| 8 | FAQ | i18n | `<details>/<summary>`, разметка `FAQPage` в JSON-LD |
| 9 | Контакты | `config` | карта — `<iframe loading="lazy">`, если `mapEmbedUrl` задан, `filter: grayscale(1)` |
| 10 | Подвал | `config.legal` | ссылка на `privacy.html` |

- Плавающая кнопка «Подобрать комплектующие» на ширине < 768 px: появляется после прокрутки первого экрана, учитывает `env(safe-area-inset-bottom)`, скрыта, пока открыт квиз.
- SEO: `<title>`, `meta description`, Open Graph (картинка 1200×630), `link rel="canonical"`, `hreflang` ru/uz, JSON-LD `Store` (название, адрес, телефон, часы), `robots.txt`, `sitemap.xml`.

### 8.2 Визуальная система и чертёж

Все визуальные решения — в [DESIGN.md](DESIGN.md). SPEC фиксирует только то, что нужно для кода.

- `tokens.css` переносит токены DESIGN §3–5 один в один: цвета (`--case`, `--panel`, `--ink`, `--ink-muted`, `--line`, `--kapton`, `--danger`), шкалу шрифтов, отступы, радиусы. Тёмная тема — те же имена внутри `@media (prefers-color-scheme: dark)`, переключателя нет. Компоненты используют только токены, «сырых» HEX в других файлах нет.
- **Шрифты.** Готовятся один раз и коммитятся в `public/fonts/` (fonttools нужен только на машине разработчика, не на сервере):
  - Roboto Flex: `fonttools varLib.instancer` с осями `wdth=100:151 wght=400:640 opsz=14:60`, затем `pyftsubset` — латиница, узбекские `ʻ ʼ`, кириллица `U+0400–045F`, знаки `« » — № °`. Цель ≤ 150 КБ. Если не выходит — зафиксировать `opsz`.
  - Syncopate 700: `pyftsubset` только `A–Z 0–9`, пробел, точка, дефис. Цель ≤ 20 КБ.
  - `@font-face` с `font-display: swap`, `<link rel="preload">` только для Roboto Flex.
- **Чертёж** (`assembly.svg`) встроен в `index.html` инлайном, чтобы управлять деталями из CSS. Каждая деталь — `<g id="part-{id}" data-pos="N">`, где `{id}` — ID из `quiz-schema` (`gpu`, `cpu`, `motherboard`, `ram`, `storage`, `psu`, `cooling`, `case`). У SVG `role="img"` и `aria-label`.
- **`assembly.js`:**
  - `init()`: если `bl.explode` уже есть или `prefers-reduced-motion: reduce` — сразу ставит класс `is-exploded`. Иначе ждёт `IntersectionObserver` (чертёж виден) **и** закрытое окно квиза, затем ставит `is-exploding`; CSS двигает детали из собранного положения в разнесённое (только `transform`/`opacity`, выноски — `stroke-dashoffset`), тайминги DESIGN §6.2. По `animationend` последней детали — `is-exploded` и `bl.explode = 1`.
  - Связь со спецификацией: `pointerenter`/`focusin` на строке → класс `is-active` на `#part-{id}` и на строке; и наоборот с детали. На сенсорных экранах связи наведением нет.
- Изображения товаров до своих фото — рисунки из `img/parts/` (DESIGN §9.1). Стоковые и сгенерированные картинки не используются.

### 8.3 Производительность и доступность

- Без фреймворков. JS ≤ 40 КБ (без сжатия), CSS ≤ 30 КБ, страница без фото и шрифтов ≤ 300 КБ (включая чертёж ≤ 25 КБ), шрифты ≤ 170 КБ.
- LCP < 2 с на «Fast 4G» в Lighthouse (мобильный), CLS < 0.05, Lighthouse Performance ≥ 90, Accessibility ≥ 95.
- Картинки WebP с `width`/`height`, `loading="lazy"` ниже первого экрана.
- Контраст WCAG AA, видимый фокус, квиз проходится с клавиатуры, область нажатия ≥ 44×44 px.

---

## 9. Логи (`_lib/log.js`)

Одна JSON-строка на событие в `console.log`/`console.error` (их собирают логи Vercel):

```json
{"ts":"2026-11-19T09:32:11Z","level":"info","event":"lead.sent","lead_id":"PC-4F7K","temp":"hot","lang":"ru","chats_ok":1,"chats_failed":0,"tg_ms":412}
```

События: `lead.sent`, `lead.failed`, `lead.duplicate`, `lead.invalid` (только имена полей), `spam.honeypot`, `spam.too_fast`, `rate.limited`, `tg.retry`, `tg.error` (код и `description`), `tg.chat_migrated`, `bot.update` (тип), `bot.unauthorized`, `config.missing`.

**Никогда не пишутся:** имя, телефон, Telegram-ник, комментарий, город, токен, IP.

---

## 10. Локальная разработка (`server.mjs`)

- Раздаёт `public/` и направляет `/api/<name>` в `api/<name>.js`. Подменяет `req.body` (сырой текст) так же, как Vercel Functions.
- Читает `.env` через `process.loadEnvFile` (если файл есть).
- Порт `PORT` или 5230. Конфиг `business-landing` в `.claude/launch.json` уже есть.
- С `TELEGRAM_MOCK=1` можно пройти квиз целиком: сообщение для бота печатается в консоль.
- Проверить бота локально через webhook нельзя (Telegram не достучится до localhost). Обработчик `/api/bot` проверяется тестами (§11) и командой `/test` на production.

---

## 11. Тесты

### 11.1 Модульные (`node --test`, `npm test`)

| Файл | Что проверяет |
|---|---|
| `quiz-schema.test.js` | `stepsFor` для обеих веток; `isValidAnswers`: неизвестные ID, пустые массивы, повторы, чужая ветка, `city` при `region` |
| `validate.test.js` | все правила §5.2, отбрасывание лишних полей, обрезка длинных строк |
| `phone.test.js` | нормализация разных форматов ввода, отказ на 8 и 10 цифр |
| `score.test.js` | все 24 сочетания `timing × budget` |
| `format.test.js` | снимок сообщения для 3 заявок (полная, минимальная, периферия + WhatsApp); экранирование `<script>` и `&` в имени и комментарии; лимит 4096 |
| `lead-id.test.js` | формат `^PC-[2-9A-HJ-NP-Z]{4}$` |
| `ua.test.js` | 10 реальных строк User-Agent (iPhone Safari, Android Chrome, Instagram in-app, Telegram in-app, Windows Edge…) |
| `ratelimit.test.js` | 4-я заявка за 10 минут → 429, дубль `submission_id`, очистка старых записей |
| `lead.test.js` | обработчик целиком с подменённым `fetch`: 200, тихий антиспам, 400, 413, 500 not_configured, 502 после трёх неудачных попыток, 429 с `retry_after` от Telegram, миграция группы |
| `bot.test.js` | неверный секрет → 401; `/start` в личке и в группе; `/test` вне разрешённого чата; `my_chat_member`; ошибка внутри обработчика → всё равно 200 |
| `i18n.test.js` | то же, что `npm run check`: полнота словарей RU/UZ |

### 11.2 Ручная проверка перед релизом

1. iPhone Safari и Android Chrome: квиз на весь экран, клавиатура не перекрывает поля, страница не увеличивается при фокусе.
2. Обе ветки квиза, «Назад», «Пропустить» на каждом шаге, обновление страницы посреди квиза.
3. Повторный визит: квиз не открывается сам, кнопки его открывают.
4. Переключение RU ↔ UZ внутри квиза и на странице.
5. Реальная заявка → сообщение в группе, телефон и ник кликабельны, время ташкентское.
6. Без токена в Vercel: экран ошибки с кнопками связи.
7. Демо на GitHub Pages: заявка не уходит, видна плашка «Демо».
8. Pixel Helper: события из §7.9, у `Lead` есть `eventID`.
9. Lighthouse (мобильный) — цифры из §8.3.
10. Открытие из встроенного браузера Instagram и Telegram.
11. Чертёж: раскладка начинается только после закрытия квиза, играет один раз за сессию; при reduced motion сразу разложен; строка спецификации подсвечивает свою деталь и наоборот.
12. Проверка на шаблонность по DESIGN §11: список запретов, скриншоты 375 / 768 / 1280 px в светлой и тёмной теме.

---

## 12. Этапы работ

| # | Задача | Результат |
|---|---|---|
| 0 | Каркас: структура §2.1, `vercel.json`, `server.mjs` с `/api/*`, `.env.example`, `npm test`, `tokens.css`, шрифты в `public/fonts/` | пустая страница со шрифтами + `/api/health` на Vercel |
| 1 | `quiz-schema.js`, `validate`, `score`, `format`, `lead-id`, `ua`, `ratelimit` + тесты | `npm test` зелёный |
| 2 | `telegram.js`, `/api/lead`, `/api/bot`, `/api/setup` + тесты | заявка через `curl` приходит в Telegram |
| 3 | Владелец создаёт бота и группу (§6.7) | `/test` в группе работает |
| 4 | Квиз: интерфейс, состояния, форма, маска телефона, отправка, экраны результата | заявка проходит из браузера |
| 5 | i18n RU/UZ, attribution, analytics | `npm run check` зелёный, события видны в Pixel Helper |
| 6 | Чертёж `assembly.svg` + `assembly.js`, рисунки деталей `img/parts/` | чертёж раскладывается после квиза, связан со спецификацией |
| 6а | Лендинг: блоки §8.1, SEO, политика конфиденциальности | страница целиком |
| 7 | Ручная проверка §11.2, правки | релиз MVP |
| 8 (этап 2) | Кнопки в боте §6.5, блоки «Товары», «Отзывы», «Бренды» | — |

Этапы 0–2 и 4–6 почти не зависят от ответов на PRD §14: вместо данных магазина ставятся заглушки из `config.js`.

---

## 13. Критерии приёмки MVP

1. С телефона квиз проходится до заявки меньше чем за 60 секунд, на каждом шаге можно пропустить.
2. Заявка приходит в группу «Заявки» меньше чем за 5 секунд и содержит всё из §6.2.
3. Одна заявка = одно сообщение, даже при двойном нажатии и повторной отправке после ошибки.
4. Неверные данные отклоняются сервером, даже если обойти проверку в браузере.
5. Если Telegram недоступен, клиент видит экран ошибки с прямыми контактами, а заявка не теряется молча: событие `lead.failed` есть в логах.
6. Токен не виден в коде, репозитории, ответах API и логах. Имя и телефон клиента не попадают в логи и Pixel.
7. RU и UZ полностью переведены, переключение работает в квизе и на странице.
8. `npm test` и `npm run check` проходят. Lighthouse соответствует §8.3.
9. Push в `main` обновляет и Vercel, и демо на GitHub Pages. Демо не отправляет заявки.
10. Ни один экран не нарушает запреты DESIGN §2; цвет `--kapton` стоит только на выбранном.

---

## 14. Что ждёт ответов (из PRD §14)

Не блокирует разработку, всё вынесено в `config.js` и i18n:

- название и логотип → `config.shopName` (цвета выбраны в DESIGN.md);
- стресс-тест и паспорт сборки → `config.passport`;
- контакты и часы → `config.phone`, `telegram`, `instagram`, `address`, `hours`, `mapEmbedUrl`;
- рассрочка, доставка, гарантия → `config.installment`, `delivery`, `warranty`;
- вариант «Закупка для офиса/клуба» без безнала → убрать `b2b` из схемы или оставить;
- Pixel ID → `config.pixelId`;
- юрлицо → `config.legal`, `privacy.html`.
