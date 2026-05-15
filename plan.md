# План реализации Backend MVP

## Контекст

Источник требований: `project.md`. Backend создается как TypeScript MVP для авторитетной multiplayer-сессии HauntOps.

Ключевые ограничения:

- Colyseus и Express находятся только во внешнем adapter-слое.
- Игровая логика живет в domain/application и не импортирует транспортные фреймворки.
- Код тестируемый, без singleton и глобального mutable state.
- Сервер отвечает за комнаты, игроков, двери, свет, улики, GhostDirector, охоту, смерть и завершение миссии.

## Этапы

1. Создать npm/TypeScript bootstrap: `package.json`, `tsconfig.json`, `.env.example`, `src/index.ts`.
2. Реализовать env validation через Zod и HTTP endpoints `/health`, `/version`, `/rooms`.
3. Описать client/server message contracts и Zod-валидацию входящих сообщений.
4. Разделить domain state и Colyseus schemas: schemas являются синхронизационной проекцией.
5. Добавить MVP данные `house_01`, ghost types и items.
6. Реализовать `LobbyRoom` для имени, ready-state и старта.
7. Реализовать тонкий `GameRoom` adapter, который вызывает application services.
8. Реализовать `MatchController` и фазовые переходы.
9. Реализовать `InteractionSystem` для дверей, света, предметов, укрытий и выхода.
10. Реализовать `EvidenceSystem` для `emf`, `freezing`, `fingerprints`.
11. Реализовать `SanitySystem` и `GhostDirector`.
12. Реализовать `HuntSystem`: старт, цель, контакт, смерть, завершение.
13. Добавить логирование ключевых событий.
14. Добавить минимальные проверки и пройти `build`/`lint`.

## Definition of Done

- Проект запускается одной командой.
- Можно создать комнату на 1-4 игроков.
- Позиции игроков синхронизируются.
- Сервер хранит состояние игроков, дверей и света.
- Работает interaction для двери и света.
- GhostDirector генерирует события.
- Улики определяются сервером и не раскрываются напрямую.
- Охота запускается, завершается и может убить игрока.
- Миссия может завершиться.
- Есть `/health`, `/version`, `/rooms`.
