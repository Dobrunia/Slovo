# Slovo

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
