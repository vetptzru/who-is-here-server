# Техническое задание: Backend MVP для HauntOps

## 1. Цель backend

Backend должен обеспечивать авторитетную multiplayer-сессию для кооперативного paranormal horror:

* создание и подключение к комнате;
* синхронизация игроков;
* состояние карты;
* состояние дверей и света;
* логику призрака;
* выдачу улик;
* запуск и завершение охоты;
* смерть игроков;
* завершение миссии.

Backend **не должен** на MVP включать аккаунты, магазин, экономику, голосовой чат и постоянное хранение прогресса.

---

## 2. Технологический стек

```text
Node.js 22+
TypeScript
Colyseus
Express
Zod
dotenv
tsx / ts-node-dev для разработки
```

Опционально:

```text
@colyseus/monitor
pino или winston для логов
```

---

## 3. Архитектура

```text
backend/
├── src/
│   ├── index.ts
│   ├── config/
│   │   └── env.ts
│   ├── rooms/
│   │   ├── LobbyRoom.ts
│   │   └── GameRoom.ts
│   ├── state/
│   │   ├── GameState.ts
│   │   ├── PlayerState.ts
│   │   ├── GhostState.ts
│   │   ├── DoorState.ts
│   │   └── LightState.ts
│   ├── systems/
│   │   ├── MatchController.ts
│   │   ├── GhostDirector.ts
│   │   ├── EvidenceSystem.ts
│   │   ├── InteractionSystem.ts
│   │   ├── SanitySystem.ts
│   │   └── HuntSystem.ts
│   ├── data/
│   │   ├── maps/
│   │   │   └── house_01.json
│   │   ├── ghostTypes.json
│   │   └── items.json
│   ├── messages/
│   │   ├── clientMessages.ts
│   │   └── serverMessages.ts
│   └── utils/
│       ├── random.ts
│       └── math.ts
├── package.json
├── tsconfig.json
└── .env.example
```

---

## 4. Комнаты Colyseus

### 4.1 `LobbyRoom`

Назначение:

* подключение игроков до старта;
* выбор ника;
* готовность игроков;
* старт матча.

Ограничения:

```text
minPlayers: 1
maxPlayers: 4
```

События:

```text
set_name
set_ready
start_match
```

---

### 4.2 `GameRoom`

Назначение:

* основная игровая сессия;
* авторитетное состояние матча;
* обработка действий игроков;
* GhostDirector;
* завершение миссии.

Сервер отвечает за логику, которая уже была определена как авторитетная: начало охоты, позиция/состояние призрака, улики и смерть игроков .

---

## 5. Состояние игры

### 5.1 `GameState`

```ts
class GameState extends Schema {
  @type({ map: PlayerState })
  players = new MapSchema<PlayerState>();

  @type(GhostState)
  ghost = new GhostState();

  @type({ map: DoorState })
  doors = new MapSchema<DoorState>();

  @type({ map: LightState })
  lights = new MapSchema<LightState>();

  @type("string")
  matchPhase: MatchPhase = "waiting";

  @type("number")
  matchTimeSec = 0;

  @type("string")
  mapId = "house_01";
}
```

### 5.2 `PlayerState`

```ts
class PlayerState extends Schema {
  @type("string") id = "";
  @type("string") name = "";

  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") z = 0;

  @type("number") rotY = 0;

  @type("number") sanity = 100;

  @type("boolean") isAlive = true;
  @type("boolean") isReady = false;
  @type("boolean") isInHouse = false;

  @type(["string"])
  inventory = new ArraySchema<string>();
}
```

### 5.3 `GhostState`

```ts
type GhostMode =
  | "idle"
  | "light_activity"
  | "interaction"
  | "manifest"
  | "hunt"
  | "cooldown";

class GhostState extends Schema {
  @type("string") ghostType = "default";
  @type("string") state: GhostMode = "idle";
  @type("string") roomId = "";

  @type("number") aggression = 1;
  @type("number") activity = 1;

  @type("number") x = 0;
  @type("number") y = 0;
  @type("number") z = 0;

  @type("string") targetPlayerId = "";
}
```

---

## 6. Клиент → сервер

### 6.1 Движение игрока

```ts
type ClientMoveMessage = {
  x: number;
  y: number;
  z: number;
  rotY: number;
};
```

Правила:

* сервер принимает позицию;
* сервер может ограничивать частоту;
* на MVP допускается мягкая валидация;
* позже добавить античит и проверку скорости.

---

### 6.2 Взаимодействие

```ts
type ClientInteractMessage = {
  objectId: string;
  interactionType: "use" | "open" | "close" | "toggle" | "pickup";
};
```

Объекты:

```text
door
light_switch
generator
item
evidence_spot
exit_zone
hiding_spot
```

---

### 6.3 Использование предмета

```ts
type ClientUseItemMessage = {
  itemId: "flashlight" | "emf" | "thermometer" | "camera";
  action: "primary" | "secondary";
};
```

---

### 6.4 Выбор улик в журнале

```ts
type ClientSubmitEvidenceMessage = {
  evidence: Array<"emf" | "freezing" | "fingerprints">;
};
```

---

### 6.5 Эвакуация / завершение миссии

```ts
type ClientRequestEscapeMessage = {
  confirm: boolean;
};
```

---

## 7. Сервер → клиент

### 7.1 Событие призрака

```ts
type ServerGhostEventMessage = {
  eventId: string;
  eventType:
    | "sound"
    | "flicker_light"
    | "door_touch"
    | "object_move"
    | "emf_spike"
    | "manifest";
  roomId: string;
  intensity: number;
  position?: { x: number; y: number; z: number };
};
```

---

### 7.2 Охота началась

```ts
type ServerHuntStartedMessage = {
  targetPlayerId: string;
  durationSec: number;
};
```

---

### 7.3 Охота закончилась

```ts
type ServerHuntEndedMessage = {
  reason: "timeout" | "all_players_dead" | "manual";
};
```

---

### 7.4 Игрок умер

```ts
type ServerPlayerDeadMessage = {
  playerId: string;
  reason: "ghost_contact";
};
```

---

### 7.5 Улика обнаружена

```ts
type ServerEvidenceFoundMessage = {
  evidenceType: "emf" | "freezing" | "fingerprints";
  roomId: string;
};
```

---

### 7.6 Миссия завершена

```ts
type ServerMissionFinishedMessage = {
  success: boolean;
  correctEvidence: boolean;
  survivedPlayers: string[];
  reward: number;
};
```

---

## 8. GhostDirector

GhostDirector — ключевая backend-система. В проектном документе она уже определена как ядро игры, со стадиями `Idle → Light Activity → Interaction → Manifest → Hunt → Cooldown` .

### 8.1 Обязанности

GhostDirector должен:

* выбирать активную комнату призрака;
* считать средний sanity игроков;
* запускать paranormal events;
* повышать активность при низком sanity;
* запускать охоту;
* выбирать цель охоты;
* завершать охоту;
* отправлять события клиентам.

### 8.2 Упрощённый алгоритм

```ts
class GhostDirector {
  update(dt: number) {
    const avgSanity = this.getAverageSanity();

    if (avgSanity < 70) {
      this.increaseActivity();
    }

    if (avgSanity < 40) {
      this.allowHunt = true;
    }

    if (this.shouldTriggerEvent()) {
      this.triggerRandomGhostEvent();
    }

    if (this.allowHunt && this.shouldStartHunt()) {
      this.startHunt();
    }
  }
}
```

---

## 9. HuntSystem

### 9.1 Условия начала охоты

Охота может начаться, если:

* фаза матча `active`;
* нет текущей охоты;
* средний sanity ниже порога;
* cooldown завершён;
* хотя бы один живой игрок находится внутри дома.

### 9.2 При старте охоты

Сервер должен:

* перевести ghost.state в `hunt`;
* выбрать цель;
* закрыть входную дверь;
* отключить часть света;
* отправить `hunt_started`;
* запустить таймер охоты.

### 9.3 Во время охоты

Сервер должен:

* обновлять позицию призрака;
* проверять дистанцию до цели;
* убивать игрока при контакте;
* переключать цель, если текущая цель умерла или недоступна.

### 9.4 Завершение охоты

Охота заканчивается:

* по таймеру;
* если все игроки мертвы;
* если матч завершён.

---

## 10. EvidenceSystem

### 10.1 Улики MVP

На MVP используются только:

```text
emf
freezing
fingerprints
```

Это соответствует уже зафиксированному MVP-ограничению на 3 типа улик .

### 10.2 Выбор улик

При старте матча сервер:

* выбирает ghostType;
* выбирает 2 активные улики;
* привязывает улики к комнате призрака;
* не раскрывает их клиенту напрямую.

### 10.3 Обнаружение

Клиент отправляет `use_item`.

Сервер проверяет:

* игрок жив;
* предмет есть в инвентаре;
* игрок рядом с нужной зоной;
* улика активна для текущего матча.

Если всё верно:

```text
server → evidence_found
```

---

## 11. InteractionSystem

Система обрабатывает:

* двери;
* выключатели света;
* генератор;
* подбор предметов;
* укрытия;
* exit zone.

### 11.1 Валидация

Для каждого interaction:

* игрок жив;
* объект существует;
* объект доступен;
* игрок находится на допустимой дистанции;
* действие разрешено текущей фазой матча.

---

## 12. MatchController

### Фазы матча

```ts
type MatchPhase =
  | "waiting"
  | "preparing"
  | "active"
  | "hunt"
  | "finished";
```

### Переходы

```text
waiting → preparing
preparing → active
active → hunt
hunt → active
active → finished
hunt → finished
```

---

## 13. REST API

REST API нужен минимальный, только для healthcheck и служебной информации.

### `GET /health`

Ответ:

```json
{
  "ok": true,
  "service": "hauntops-backend"
}
```

### `GET /version`

```json
{
  "name": "hauntops-backend",
  "version": "0.1.0"
}
```

### `GET /rooms`

Для отладки.

```json
{
  "rooms": [
    {
      "roomId": "abc",
      "clients": 2,
      "maxClients": 4,
      "metadata": {
        "mapId": "house_01",
        "phase": "active"
      }
    }
  ]
}
```

---

## 14. Конфигурация `.env`

```env
NODE_ENV=development
PORT=2567
COLYSEUS_MONITOR_ENABLED=true
MAX_PLAYERS_PER_ROOM=4
DEFAULT_MAP_ID=house_01
TICK_RATE=20
GHOST_EVENT_INTERVAL_MS=5000
HUNT_DURATION_SEC=45
HUNT_COOLDOWN_SEC=60
```

---

## 15. Данные карты `house_01.json`

```json
{
  "id": "house_01",
  "name": "House 01",
  "spawnPoints": [
    { "id": "spawn_1", "x": 0, "y": 1, "z": 0 },
    { "id": "spawn_2", "x": 1, "y": 1, "z": 0 }
  ],
  "rooms": [
    {
      "id": "living_room",
      "name": "Living Room",
      "center": { "x": 3, "y": 1, "z": 5 },
      "radius": 4
    }
  ],
  "doors": [
    {
      "id": "front_door",
      "roomA": "outside",
      "roomB": "living_room",
      "isLockedDuringHunt": true
    }
  ],
  "lights": [
    {
      "id": "living_room_light",
      "roomId": "living_room",
      "switchId": "living_room_switch"
    }
  ],
  "hidingSpots": [
    {
      "id": "closet_01",
      "roomId": "bedroom",
      "position": { "x": 5, "y": 1, "z": 8 }
    }
  ]
}
```

---

## 16. Definition of Done для MVP backend

Backend считается готовым, если:

* можно создать комнату на 1–4 игроков;
* клиенты подключаются через Colyseus;
* игроки видят синхронизированные позиции друг друга;
* сервер хранит состояние игроков;
* сервер хранит состояние дверей и света;
* работает `interact` для двери и света;
* сервер выбирает комнату призрака;
* GhostDirector генерирует события;
* EMF/температура/отпечатки определяются сервером;
* запускается охота;
* призрак выбирает цель;
* игрок может умереть;
* миссия может завершиться;
* есть `/health`;
* есть логирование ключевых событий;
* проект запускается одной командой.

---

## 17. Команды запуска

```bash
npm install
npm run dev
```

Скрипты:

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "lint": "tsc --noEmit"
  }
}
```
