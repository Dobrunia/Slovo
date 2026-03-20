# Slovo

## Quick Start

### Prerequisites

- Node.js 24+
- npm
- Docker

### Local Run

1. Поднимите MySQL:

```bash
docker compose up -d mysql
```

2. Установите server-зависимости, сгенерируйте Prisma client и примените миграции:

```bash
cd server
npm install
npx prisma generate
npx prisma migrate deploy
```

3. Запустите сервер:

```bash
cd server
npm run dev
```

4. Установите client-зависимости и запустите Vite:

```bash
cd client
npm install
npm run dev
```

### Verification

```bash
cd server && npm test
cd server && npm run build
cd client && npm test
cd client && npm run build
```

## MVP Scenarios

- регистрация, логин и загрузка `me`;
- создание сервера и загрузка списка серверов пользователя;
- поиск публичных серверов, вход по invite-ссылке и вступление в сервер;
- редактирование профиля пользователя и метаданных сервера;
- owner-only управление каналами, invite link, kick/ban и удаление сервера;
- join / leave / move между voice-каналами;
- mute / deafen / выбор устройства ввода;
- start / stop screen share и просмотр активной демонстрации в канале;
- forced disconnect при kick / ban / delete server;
- reconnect / disconnect поведение:
  - refresh, `pagehide`, offline и realtime transport disconnect снимают пользователя с voice presence;
  - после восстановления соединения live snapshot переснимается, но пользователь не входит в канал автоматически;
  - для возврата в voice канал нужен явный повторный `join`.

## Architecture

- `GraphQL + StrictQL + Yoga`:
  - auth;
  - initial load;
  - обычный CRUD, где live-команда не нужна напрямую.
- `LiveRail`:
  - presence;
  - live-команды;
  - live-события;
  - signaling между client и media-layer.
- `MediaSoup`:
  - SFU voice;
  - screen share;
  - producer / consumer lifecycle.
- `DobruniaUI Vue`:
  - весь UI, utility-классы и design tokens.
- `MySQL + Prisma + Docker`:
  - постоянное хранение пользователей, серверов, каналов, membership и ban state.

## LiveRail

Для realtime-слоя в проекте зафиксированы npm-пакеты:

- `dobrunia-liverail-client`
- `dobrunia-liverail-contracts`
- `dobrunia-liverail-server`

Официальная документация API: <https://github.com/Dobrunia/liverail/tree/main/docs/api>

## DobruniaUI Vue

Для UI используем `dobruniaui-vue`, но не подключаем библиотеку глобально через `app.use(...)`. Предпочтительный способ: импортировать только конкретные компоненты, которые реально нужны, чтобы сохранялся tree shaking. Глобально подключаем только `dobruniaui-vue/styles.css`, если нужны utility-классы и токены.

Основной и более подробный референс по библиотеке:
<https://github.com/Dobrunia/DobruniaUI-vue/blob/main/LLM_INSTRUCTIONS.md>

## Environment

- клиент читает значения напрямую из `import.meta.env` с локальными дефолтами из констант;
- сервер читает значения напрямую из `process.env` с локальными дефолтами из констант;
- `dotenv` нужен только на сервере, чтобы подхватить `server/.env`, если файл существует.

## Shared Code

Общие нейтральные константы и имена контрактов можно хранить в корневой директории `shared/`. Сейчас оттуда переиспользуются имена realtime-команд, событий и каналов. `shared/` не собирается как отдельный пакет: клиент забирает эти файлы в Vite bundle, а сервер включает их в свой `tsc` build.

Важно: в `shared/` стоит держать только dependency-light код, например строки имен, простые типы и константы. Библиотечно-специфичные схемы `zod`, `StrictQL` и `LiveRail` лучше собирать уже внутри `client/` и `server/`.

## Docker MySQL

Локальная MySQL хранит данные во внутреннем Docker named volume `slovo-mysql-data`, а не в папке репозитория. Для локального старта используйте:

```bash
docker compose up -d mysql
```
