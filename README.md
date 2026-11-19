# business-landing

Лендинг для бизнеса. Статика в `public/` (HTML + CSS, без сборки).

Сейчас в тексте — заглушки: название, услуги, цены (в сумах), контакты (Telegram `username`, телефон `+998 00 000-00-00`), адрес.

## Запуск локально

```bash
node server.mjs
```

Откроется на http://localhost:5230 (порт меняется переменной `PORT`).

## Публикация

- Боевой сайт — https://business-landing-uz.vercel.app (Vercel-проект `business-landing`; адрес business-landing.vercel.app занят чужим сайтом), связан с GitHub: push в `main` публикует сам.
- Демо — https://alexlojkov-code.github.io/business-landing/ (GitHub Pages, workflow `.github/workflows/pages.yml`), тоже обновляется при push в `main`.
- Репозиторий: https://github.com/alexlojkov-code/business-landing
