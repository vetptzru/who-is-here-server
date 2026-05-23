import test from "node:test";
import assert from "node:assert/strict";
import { GameSession } from "../application/GameSession.js";
import { EvidenceSystem } from "../application/EvidenceSystem.js";
import { HuntSystem } from "../application/HuntSystem.js";
import { InteractionSystem } from "../application/InteractionSystem.js";
import { MatchController } from "../application/MatchController.js";
import { loadEnv } from "../config/env.js";
import type { GameModel } from "../domain/models.js";
import type { GameEventPublisher, GhostTypeRepository, Logger, MapRepository, RandomSource } from "../domain/ports.js";
import { moveSchema } from "../messages/clientMessages.js";

const logger: Logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

class FakeRandom implements RandomSource {
  public nextInt(): number {
    return 0;
  }

  public pick<T>(items: readonly T[]): T {
    return items[0];
  }

  public pickMany<T>(items: readonly T[], count: number): T[] {
    return items.slice(0, count);
  }
}

const createEvents = (): GameEventPublisher & { emitted: string[] } => ({
  emitted: [],
  ghostEvent() {
    this.emitted.push("ghost_event");
  },
  huntStarted() {
    this.emitted.push("hunt_started");
  },
  huntEnded() {
    this.emitted.push("hunt_ended");
  },
  playerDead() {
    this.emitted.push("player_dead");
  },
  evidenceFound() {
    this.emitted.push("evidence_found");
  },
  missionFinished() {
    this.emitted.push("mission_finished");
  },
});

const createState = (): GameModel => ({
  players: new Map([
    [
      "p1",
      {
        id: "p1",
        name: "Player",
        position: { x: 3, y: 1, z: 5 },
        rotY: 0,
        lookPitch: 0,
        sanity: 35,
        isAlive: true,
        isReady: true,
        isInHouse: true,
        inventory: ["flashlight", "emf", "thermometer", "camera"],
        flashlightOn: false,
      },
    ],
  ]),
  ghost: {
    ghostType: "shade",
    state: "idle",
    roomId: "living_room",
    aggression: 1,
    activity: 1,
    huntSanityThreshold: 40,
    position: { x: 3, y: 1, z: 5 },
    targetPlayerId: "",
    evidence: ["emf", "freezing"],
  },
  doors: new Map([
    [
      "door_front",
      {
        id: "door_front",
        roomA: "outside",
        roomB: "living_room",
        isOpen: false,
        isLocked: false,
        isLockedDuringHunt: true,
      },
    ],
  ]),
  lights: new Map([
    [
      "living_room_light",
      {
        id: "living_room_light",
        roomId: "living_room",
        switchId: "living_room_switch",
        isOn: true,
      },
    ],
  ]),
  worldItems: new Map(),
  matchPhase: "active",
  matchTimeSec: 0,
  mapId: "house_01",
  map: {
    id: "house_01",
    name: "House 01",
    spawnPoints: [{ id: "spawn_1", position: { x: 0, y: 1, z: 0 } }],
    rooms: [{ id: "living_room", name: "Living Room", center: { x: 0, y: 1, z: 0 }, radius: 7 }],
    sanityZones: [{ id: "living_room_sanity_zone", center: { x: 0, y: 1, z: 0 }, radius: 10, drainPerSec: 0.2 }],
    doors: [],
    lights: [],
    hidingSpots: [],
    items: [],
    evidenceSpots: [
      {
        id: "living_room_emf",
        roomId: "living_room",
        evidenceType: "emf",
        position: { x: 3, y: 1, z: 5 },
      },
    ],
    exitZone: { id: "exit_zone", position: { x: -10, y: 1, z: 0 }, radius: 3 },
  },
  discoveredEvidence: [],
  activeHuntUntilMs: 0,
  huntCooldownUntilMs: 0,
});

test("env validation applies defaults", () => {
  const env = loadEnv({});
  assert.equal(env.PORT, 2567);
  assert.equal(env.DEFAULT_MAP_ID, "house_01");
});

test("message validation rejects invalid move payload", () => {
  assert.throws(() => moveSchema.parse({ x: 1, y: 1, z: "bad", rotY: 0 }));
});

test("match controller finishes mission with correct evidence", () => {
  const state = createState();
  const events = createEvents();
  const controller = new MatchController(state, events, logger);

  controller.finishMission(["emf", "freezing"]);

  assert.equal(state.matchPhase, "finished");
  assert.deepEqual(events.emitted, ["mission_finished"]);
});

test("interaction system toggles a door", () => {
  const state = createState();
  const interactions = new InteractionSystem(state, logger);

  assert.equal(interactions.interact("p1", "door_front", "toggle"), true);
  assert.equal(state.doors.get("door_front")?.isOpen, true);
});

test("evidence system discovers server-selected evidence", () => {
  const state = createState();
  const events = createEvents();
  const system = new EvidenceSystem(state, events, logger);

  assert.equal(system.useItem("p1", "emf"), true);
  assert.deepEqual(state.discoveredEvidence, ["emf"]);
  assert.deepEqual(events.emitted, ["evidence_found"]);
});

test("hunt system starts, locks door and kills target on contact", () => {
  const state = createState();
  const events = createEvents();
  const clock = { nowMs: () => 1000 };
  const matchController = new MatchController(state, events, logger);
  const hunt = new HuntSystem(state, matchController, events, clock, new FakeRandom(), logger, {
    durationSec: 45,
    cooldownSec: 60,
  });

  assert.equal(hunt.canStart(35), true);
  assert.equal(hunt.start(), true);
  hunt.tick(0.1);

  assert.equal(state.matchPhase, "hunt");
  assert.equal(state.doors.get("door_front")?.isLocked, true);
  assert.equal(state.players.get("p1")?.isAlive, false);
  assert.ok(events.emitted.includes("hunt_started"));
  assert.ok(events.emitted.includes("player_dead"));
});

test("hunt system does not start when all alive players are outside rooms", () => {
  const state = createState();
  const events = createEvents();
  const clock = { nowMs: () => 1000 };
  const matchController = new MatchController(state, events, logger);
  const hunt = new HuntSystem(state, matchController, events, clock, new FakeRandom(), logger, {
    durationSec: 45,
    cooldownSec: 60,
  });

  const player = state.players.get("p1");
  assert.ok(player);
  player.isInHouse = false;

  assert.equal(hunt.canStart(35), false);
  assert.equal(hunt.start(), false);
  assert.equal(state.matchPhase, "active");
  assert.deepEqual(events.emitted, []);
});

test("hunt system can start when at least one alive player is inside room", () => {
  const state = createState();
  const events = createEvents();
  const clock = { nowMs: () => 1000 };
  const matchController = new MatchController(state, events, logger);
  const hunt = new HuntSystem(state, matchController, events, clock, new FakeRandom(), logger, {
    durationSec: 45,
    cooldownSec: 60,
  });

  state.players.set("p2", {
    id: "p2",
    name: "Player 2",
    position: { x: 100, y: 1, z: 100 },
    rotY: 0,
    lookPitch: 0,
    sanity: 35,
    isAlive: true,
    isReady: true,
    isInHouse: true,
    inventory: ["flashlight"],
    flashlightOn: false,
  });

  const player = state.players.get("p1");
  assert.ok(player);
  player.isInHouse = false;

  assert.equal(hunt.canStart(35), true);
  assert.equal(hunt.start(), true);
  assert.equal(state.matchPhase, "hunt");
  assert.equal(state.ghost.targetPlayerId, "p2");
  assert.ok(events.emitted.includes("hunt_started"));
});

test("game session marks player as in-house by room radius on XZ", async () => {
  const mapRepository: MapRepository = {
    getById: async () => ({
      id: "house_01",
      name: "House 01",
      spawnPoints: [{ id: "spawn_1", position: { x: 0, y: 1, z: 0 } }],
      rooms: [{ id: "living_room", name: "Living Room", center: { x: 0, y: 100, z: 0 }, radius: 5 }],
      sanityZones: [],
      doors: [],
      lights: [],
      hidingSpots: [],
      items: [],
      evidenceSpots: [],
      exitZone: { id: "exit_zone", position: { x: -10, y: 1, z: 0 }, radius: 3 },
    }),
  };
  const ghostTypeRepository: GhostTypeRepository = {
    getAll: async () => [
      {
        id: "shade",
        name: "Shade",
        evidencePool: ["emf", "freezing", "fingerprints"],
        aggression: 1,
        activity: 1,
        huntSanityThreshold: 40,
      },
    ],
  };
  const session = new GameSession({
    mapId: "house_01",
    mapRepository,
    ghostTypeRepository,
    random: new FakeRandom(),
  });

  session.addPlayer("p1", "Player");
  await session.initialize();

  session.movePlayer("p1", { x: 3, y: -999, z: 4 }, 0, 0);
  assert.equal(session.snapshot.players.get("p1")?.isInHouse, true);

  session.movePlayer("p1", { x: 6.5, y: 0, z: 0 }, 0, 0);
  assert.equal(session.snapshot.players.get("p1")?.isInHouse, false);
});
