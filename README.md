# Сайт-визитка студии

Astro 7 + Tailwind 4 + React (форма). Требования — в [PRD.md](PRD.md).

## Запуск

```sh
npm install
cp .env.example .env   # заполнить по необходимости, для локального запуска можно оставить пустым
npm run dev            # http://localhost:4321
```

| Команда | Что делает |
|---|---|
| `npm run dev` | Dev-сервер |
| `npm run build` | Сборка в `dist/` |
| `npm run preview` | Предпросмотр сборки |
| `npm run check` | Проверка типов |

## Где что лежит

```
src/
  data/site.ts            ← тексты главной: услуги, процесс, цифры, FAQ, реквизиты
  content/cases/*.mdx     ← кейсы (1 файл = 1 страница /cases/<имя-файла>)
  components/sections/    ← блоки главной
  components/ContactForm.tsx
  pages/api/lead.ts       ← приём заявок
  lib/                    ← БД, Telegram, капча, rate limit, аналитика
```

**Добавить кейс:** скопировать любой файл из `src/content/cases/`, поменять frontmatter и текст.

## Заявки

1. Форма → `POST /api/lead` → валидация (Zod), honeypot, SmartCaptcha, rate limit (5 заявок / 10 мин с IP).
2. Заявка сохраняется в SQLite (`data/leads.db`), вложение — в `data/uploads/`.
3. Отправка в Telegram. Если не удалась — повтор каждые 5 минут.

Посмотреть недоставленные заявки:

```sh
node -e "const {DatabaseSync}=require('node:sqlite');console.table(new DatabaseSync('data/leads.db').prepare('select * from leads where delivered=0').all())"
```

## Деплой (VPS в РФ)

```sh
docker build -t studio-site .
docker run -d --restart unless-stopped -p 127.0.0.1:4321:4321 \
  --env-file .env -v /srv/studio-data:/app/data studio-site
```

Перед контейнером — Nginx с HTTPS (Let's Encrypt). Nginx обязательно должен выставлять `X-Real-IP` (по нему работает rate limit), контейнер — слушать только `127.0.0.1`:

```nginx
location / {
    proxy_pass http://127.0.0.1:4321;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    client_max_body_size 12m;
}
```

Папка `data/` содержит персональные данные — делать бэкапы, не коммитить.
