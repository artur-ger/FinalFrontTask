# GigaChat Frontend Chat

Чат-приложение на React + TypeScript с интерфейсом в стиле ChatGPT и интеграцией с GigaChat API через backend-proxy.

## Возможности

- Главный экран чата: сообщения + поле ввода.
- Разделение сообщений пользователя и ассистента.
- Markdown-рендеринг ответов с подсветкой кода.
- Потоковая генерация (SSE), кнопка остановки ответа.
- Копирование ответа ассистента.
- Автопрокрутка к последнему сообщению.
- Sidebar со списком чатов.
- Создание чата и автогенерация названия по первому сообщению.
- Переименование, удаление с подтверждением, поиск по чатам.
- Сохранение истории: IndexedDB + localStorage.
- Поддержка изображений в сообщениях пользователя.

## Стек

- React 19 + TypeScript
- Redux Toolkit + React Redux
- Vite
- Express
- idb (IndexedDB)
- react-markdown, remark-gfm, rehype-highlight, rehype-sanitize

## Структура проекта

- `src/features` — логика чатов и стриминга.
- `src/widgets` — UI-компоненты.
- `src/shared` — API, хранилище, типы.
- `src/app` — конфигурация приложения.
- `server` — OAuth и прокси к GigaChat API.

## Запуск

1. Установить зависимости:

```bash
npm install
```

2. Создать `.env`:

```bash
cp .env.example .env
```

PowerShell:

```powershell
Copy-Item .env.example .env
```

3. Запустить frontend + backend:

```bash
npm run dev:full
```

4. Открыть:
- `http://localhost:5173` — frontend
- `http://localhost:43123/api/health` — backend healthcheck

## Переменные окружения

| Переменная | Назначение |
|---|---|
| `VITE_API_PROXY_TARGET` | Адрес backend-прокси для `/api/*`. |
| `VITE_USE_MOCK_FALLBACK` | Локальный fallback-ответ при сбое сети (`true/false`). |
| `PORT` | Порт backend-сервера. |
| `GIGACHAT_CLIENT_ID` | OAuth client id (если используется пара id/secret). |
| `GIGACHAT_CLIENT_SECRET` | OAuth client secret (если используется пара id/secret). |
| `GIGACHAT_AUTHORIZATION_KEY` | Готовый ключ вида `Basic ...` для OAuth. |
| `GIGACHAT_SCOPE` | Scope токена (`GIGACHAT_API_PERS`, `GIGACHAT_API_B2B`, `GIGACHAT_API_CORP`). |
| `GIGACHAT_AUTH_URL` | OAuth endpoint. |
| `GIGACHAT_API_URL` | Базовый URL GigaChat API. |
| `GIGACHAT_ALLOW_UNSAFE_TLS` | Режим для локальной диагностики TLS (`true/false`). |

Для OAuth используйте один вариант:
- `GIGACHAT_AUTHORIZATION_KEY`, или
- `GIGACHAT_CLIENT_ID` + `GIGACHAT_CLIENT_SECRET`.

## Скрипты

- `npm run dev` — frontend.
- `npm run dev:server` — backend.
- `npm run dev:full` — frontend + backend.
- `npm run build` — production build.
- `npm run preview` — предпросмотр сборки.
- `npm run lint` — проверка ESLint.

## API backend-proxy

- `GET /api/health`
- `GET /api/v1/models`
- `POST /api/v1/chat/completions`

## Демо

- Видео работы приложения: [Итоговое задание Чепурных Артур.webm](https://drive.google.com/file/d/1Kyua21_7B0lO5iZTHXLuR2VkQIf9cYnf/view?usp=drive_link)
- Скриншоты: `docs/demo/`

