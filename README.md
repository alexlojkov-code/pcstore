# pcstore

Лендинг магазина комплектующих и периферии для ПК: квиз при входе, заявки с ответами и данными клиента уходят в Telegram-группу менеджеров.

Документы: [PRD.md](PRD.md) — что делаем, [SPEC.md](SPEC.md) — как устроено, [DESIGN.md](DESIGN.md) — визуальный стиль и запреты против шаблонного дизайна.

## Ссылки

- Боевой сайт: https://pcstore-uz.vercel.app (Vercel-проект `pcstore`; push в `main` публикует сам)
- Демо: https://alexlojkov-code.github.io/pcstore/ (GitHub Pages; заявки не отправляет)
- Репозиторий: https://github.com/alexlojkov-code/pcstore

## Устройство

- `public/` — статика без сборки: `index.html`, `privacy.html`, `css/`, `js/`, `fonts/`, `img/`.
- `public/js/config.js` — **все данные магазина**: название, телефон, Telegram, адрес, часы, рассрочка, доставка, паспорт сборки, Pixel ID, юрлицо. Пустые значения скрывают элемент.
- `public/js/quiz-schema.js` — вопросы квиза; общий файл для браузера и сервера.
- `public/js/i18n.js` — тексты RU/UZ. UZ — черновой перевод, нужна вычитка носителем.
- `api/` — функции Vercel на Node.js 22 без зависимостей: `lead.js` (заявка → Telegram), `bot.js` (webhook бота), `setup.js` (подключение бота), `health.js`.
- `scripts/build-assembly.mjs` — генератор сборочного чертежа и иконок деталей (`npm run assembly`).

## Локально

```bash
node server.mjs
```

Сайт откроется на http://localhost:5230. Создайте `.env` по образцу `.env.example`: с `TELEGRAM_MOCK=1` заявки печатаются в консоль вместо Telegram.

```bash
npm test
```

```bash
npm run check
```

`npm test` — модульные тесты сервера и бота, `npm run check` — полнота словарей RU/UZ.

## Подключение Telegram-бота (делает владелец)

1. В @BotFather: `/newbot` → имя и username → скопировать токен.
2. В @BotFather: `/setprivacy` → бот → `Enable`.
3. Vercel → проект `pcstore` → Settings → Environment Variables → `TELEGRAM_BOT_TOKEN` (тип Sensitive, Production + Preview) → Save → Redeploy.
4. Открыть https://pcstore-uz.vercel.app/api/setup — должно быть `"ok": true`.
5. Создать группу «Заявки», добавить менеджеров и бота — бот пришлёт ID группы.
6. ID группы — в `TELEGRAM_CHAT_ID` (Production) → Redeploy.
7. В группе отправить `/test` — придёт пример заявки.

Пока токена и ID нет, сайт работает, но вместо отправки заявки показывает экран «Не получилось отправить» с прямыми контактами.

## Шрифты

В `public/fonts/` лежат урезанные Roboto Flex (оси `wdth 100–151`, `wght 400–640`, `opsz 14–60`, латиница + кириллица, 56 КБ) и Syncopate Bold (только латиница, 7 КБ). Пересобрать — fonttools на машине разработчика:

```bash
fonttools varLib.instancer RobotoFlex.ttf GRAD=0 XOPQ=drop XTRA=drop YOPQ=drop YTAS=drop YTDE=drop YTFI=drop YTLC=drop YTUC=drop slnt=0 opsz=14:60 wdth=100:151 wght=400:640 -o rf.ttf
```

```bash
pyftsubset rf.ttf --unicodes="U+0020-007E,U+00A0,U+00A9,U+00AB,U+00B0,U+00BB,U+00D7,U+02BB,U+02BC,U+0401,U+0410-044F,U+0451,U+2009,U+2013,U+2014,U+2018,U+2019,U+201C,U+201D,U+201E,U+2026,U+2116,U+202F,U+2212" --layout-features='kern,liga,calt,tnum,lnum,case,locl' --flavor=woff2 --output-file=public/fonts/roboto-flex.woff2
```
