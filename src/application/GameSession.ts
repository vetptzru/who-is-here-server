import type { GameModel, GhostTypeDefinition, Player } from "../domain/models.js";
import type { GhostTypeRepository, MapRepository, NavGridRepository, RandomSource } from "../domain/ports.js";
import type { ItemId, Vector3 } from "../domain/types.js";

export type GameSessionOptions = {
  mapId: string;
  mapRepository: MapRepository;
  navGridRepository?: NavGridRepository;
  ghostTypeRepository: GhostTypeRepository;
  random: RandomSource;
};

export class GameSession {
  private readonly state: GameModel;

  public constructor(private readonly options: GameSessionOptions) {
    this.state = {
      players: new Map(),
      ghost: {
        ghostType: "default",
        state: "idle",
        roomId: "",
        aggression: 1,
        activity: 1,
        huntSanityThreshold: 40,
        position: { x: 0, y: 1, z: 0 },
        targetPlayerId: "",
        evidence: [],
        debugPath: [],
      },
      doors: new Map(),
      lights: new Map(),
      worldItems: new Map(),
      matchPhase: "waiting",
      matchTimeSec: 0,
      mapId: options.mapId,
      discoveredEvidence: [],
      activeHuntUntilMs: 0,
      huntCooldownUntilMs: 0,
    };
  }

  public get snapshot(): GameModel {
    return this.state;
  }

  public addPlayer(id: string, name = "Investigator"): Player {
    const spawn = this.state.map?.spawnPoints[this.state.players.size]?.position ?? { x: 0, y: 1, z: 0 };
    const player: Player = {
      id,
      name,
      position: { ...spawn },
      rotY: 0,
      lookPitch: 0,
      sanity: 100,
      isAlive: true,
      isReady: false,
      isInHouse: false,
      inventory: [],
      flashlightOn: false,
    };

    this.state.players.set(id, player);
    return player;
  }

  public removePlayer(id: string): void {
    this.state.players.delete(id);
    if (this.state.ghost.targetPlayerId === id) {
      this.state.ghost.targetPlayerId = "";
    }
  }

  public renamePlayer(id: string, name: string): void {
    const player = this.requirePlayer(id);
    player.name = name;
  }

  public setReady(id: string, isReady: boolean): void {
    const player = this.requirePlayer(id);
    player.isReady = isReady;
  }

  public movePlayer(id: string, position: Vector3, rotY: number, lookPitch = 0): void {
    const player = this.requirePlayer(id);
    if (!player.isAlive || this.state.matchPhase === "finished") {
      return;
    }

    player.position = position;
    player.rotY = rotY;
    player.lookPitch = lookPitch;
    player.isInHouse = this.isInsideAnyRoomXZ(position);
  }

  public toggleFlashlight(id: string): void {
    const player = this.requirePlayer(id);
    if (!player.isAlive || this.state.matchPhase === "finished") {
      return;
    }
    if (!player.inventory.includes("flashlight")) {
      return;
    }
    player.flashlightOn = !player.flashlightOn;
  }

  public hasItem(playerId: string, itemId: ItemId): boolean {
    return this.requirePlayer(playerId).inventory.includes(itemId);
  }

  public async initialize(): Promise<void> {
    const [map, ghostTypes] = await Promise.all([
      this.options.mapRepository.getById(this.options.mapId),
      this.options.ghostTypeRepository.getAll(),
    ]);
    const navGrid = this.options.navGridRepository
      ? await this.options.navGridRepository.getByMapId(this.options.mapId)
      : null;
    if (navGrid && navGrid.mapId !== map.id) {
      throw new Error(`Navgrid mapId mismatch: expected ${map.id}, got ${navGrid.mapId}`);
    }
    const ghostType = this.pickGhostType(ghostTypes);
    const ghostRoom = this.options.random.pick(map.rooms);

    this.state.map = map;
    this.state.navGrid = navGrid ?? undefined;
    this.state.mapId = map.id;
    this.state.doors = new Map(map.doors.map((door) => [door.id, { ...door }]));
    this.state.lights = new Map(map.lights.map((light) => [light.id, { ...light }]));
    this.state.worldItems = new Map(
      map.items.map((item) => [
        item.id,
        {
          ...item,
          position: { ...item.position },
          state: "world",
          holderPlayerId: undefined,
        },
      ]),
    );
    this.state.ghost = {
      ghostType: ghostType.id,
      state: "idle",
      roomId: ghostRoom.id,
      aggression: ghostType.aggression,
      activity: ghostType.activity,
      huntSanityThreshold: ghostType.huntSanityThreshold,
      position: { ...ghostRoom.center },
      targetPlayerId: "",
      evidence: this.options.random.pickMany(ghostType.evidencePool, 2),
      debugPath: [],
    };

    for (const [index, player] of Array.from(this.state.players.values()).entries()) {
      const spawn = map.spawnPoints[index % map.spawnPoints.length]?.position ?? { x: 0, y: 1, z: 0 };
      player.position = { ...spawn };
    }
  }

  private pickGhostType(ghostTypes: GhostTypeDefinition[]): GhostTypeDefinition {
    if (ghostTypes.length === 0) {
      throw new Error("No ghost types configured");
    }

    return this.options.random.pick(ghostTypes);
  }

  private requirePlayer(id: string): Player {
    const player = this.state.players.get(id);
    if (!player) {
      throw new Error(`Player ${id} not found`);
    }

    return player;
  }

  private isInsideAnyRoomXZ(position: Vector3): boolean {
    if (!this.state.map || this.state.map.rooms.length === 0) {
      return false;
    }

    return this.state.map.rooms.some((room) => {
      const dx = position.x - room.center.x;
      const dz = position.z - room.center.z;
      return dx * dx + dz * dz <= room.radius * room.radius;
    });
  }
}
