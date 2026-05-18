import { Client, Room } from "colyseus";
import { EvidenceSystem } from "../application/EvidenceSystem.js";
import { GameSession } from "../application/GameSession.js";
import { GhostDirector } from "../application/GhostDirector.js";
import { HuntSystem } from "../application/HuntSystem.js";
import { InteractionSystem } from "../application/InteractionSystem.js";
import { MatchController } from "../application/MatchController.js";
import { SanitySystem } from "../application/SanitySystem.js";
import { JsonGhostTypeRepository } from "../infrastructure/JsonGhostTypeRepository.js";
import { JsonMapRepository } from "../infrastructure/JsonMapRepository.js";
import { SeededRandom } from "../infrastructure/SeededRandom.js";
import { SystemClock } from "../infrastructure/SystemClock.js";
import {
  interactSchema,
  moveSchema,
  requestEscapeSchema,
  setNameSchema,
  setReadySchema,
  submitEvidenceSchema,
  useItemSchema,
} from "../messages/clientMessages.js";
import { GameState } from "../schemas/GameState.js";
import { syncGameState } from "../schemas/syncGameState.js";
import { ColyseusEventPublisher } from "./ColyseusEventPublisher.js";
import type { RoomDependencies } from "./roomOptions.js";

export class GameRoom extends Room<GameState> {
  private dependencies!: RoomDependencies;
  private session!: GameSession;
  private matchController!: MatchController;
  private interactionSystem!: InteractionSystem;
  private evidenceSystem!: EvidenceSystem;
  private sanitySystem!: SanitySystem;
  private huntSystem!: HuntSystem;
  private ghostDirector!: GhostDirector;

  public async onCreate(options: Partial<RoomDependencies>): Promise<void> {
    this.dependencies = this.requireDependencies(options);
    this.maxClients = this.dependencies.env.MAX_PLAYERS_PER_ROOM;
    this.setState(new GameState());

    const eventPublisher = new ColyseusEventPublisher(this);
    const clock = new SystemClock();
    const random = new SeededRandom();
    this.session = new GameSession({
      mapId: this.dependencies.env.DEFAULT_MAP_ID,
      mapRepository: new JsonMapRepository(),
      ghostTypeRepository: new JsonGhostTypeRepository(),
      random,
    });
    await this.session.initialize();

    this.matchController = new MatchController(this.session.snapshot, eventPublisher, this.dependencies.logger);
    this.interactionSystem = new InteractionSystem(this.session.snapshot, this.dependencies.logger);
    this.evidenceSystem = new EvidenceSystem(this.session.snapshot, eventPublisher, this.dependencies.logger);
    this.sanitySystem = new SanitySystem(this.session.snapshot);
    this.huntSystem = new HuntSystem(
      this.session.snapshot,
      this.matchController,
      eventPublisher,
      clock,
      random,
      this.dependencies.logger,
      {
        durationSec: this.dependencies.env.HUNT_DURATION_SEC,
        cooldownSec: this.dependencies.env.HUNT_COOLDOWN_SEC,
      },
    );
    this.ghostDirector = new GhostDirector(
      this.session.snapshot,
      this.sanitySystem,
      this.huntSystem,
      eventPublisher,
      clock,
      random,
      this.dependencies.logger,
      { ghostEventIntervalMs: this.dependencies.env.GHOST_EVENT_INTERVAL_MS },
    );

    this.registerMessages();
    this.setSimulationInterval((dtMs) => this.tick(dtMs / 1000), 1000 / this.dependencies.env.TICK_RATE);
    this.sync();
    this.updateRegistry();
  }

  public onJoin(client: Client, options?: { name?: string }): void {
    const player = this.session.addPlayer(client.sessionId, options?.name);
    this.dependencies.logger.info("Game player joined", { roomId: this.roomId, playerId: player.id });
    this.sync();
    this.updateRegistry();
  }

  public onLeave(client: Client): void {
    this.session.removePlayer(client.sessionId);
    this.sync();
    this.updateRegistry();
  }

  public onDispose(): void {
    this.dependencies.registry.remove(this.roomId);
  }

  private registerMessages(): void {
    this.onMessage("set_name", (client, payload: unknown) => {
      const message = setNameSchema.parse(payload);
      this.session.renamePlayer(client.sessionId, message.name);
      this.sync();
    });

    this.onMessage("set_ready", (client, payload: unknown) => {
      const message = setReadySchema.parse(payload);
      this.session.setReady(client.sessionId, message.isReady);
      if (this.matchController.canStart()) {
        this.matchController.startPreparing();
        this.matchController.startActive();
      }
      this.sync();
    });

    this.onMessage("move", (client, payload: unknown) => {
      const message = moveSchema.parse(payload);
      this.session.movePlayer(
        client.sessionId,
        { x: message.x, y: message.y, z: message.z },
        message.rotY,
        message.lookPitch,
      );
      this.sync();
    });

    this.onMessage("interact", (client, payload: unknown) => {
      const message = interactSchema.parse(payload);
      this.interactionSystem.interact(client.sessionId, message.objectId, message.interactionType);
      this.sync();
    });

    this.onMessage("use_item", (client, payload: unknown) => {
      const message = useItemSchema.parse(payload);
      if (message.action === "primary") {
        if (message.itemId === "flashlight") {
          this.session.toggleFlashlight(client.sessionId);
        } else {
          this.evidenceSystem.useItem(client.sessionId, message.itemId);
        }
      }
      this.sync();
    });

    this.onMessage("submit_evidence", (_client, payload: unknown) => {
      const message = submitEvidenceSchema.parse(payload);
      this.matchController.finishMission(message.evidence);
      this.sync();
    });

    this.onMessage("request_escape", (_client, payload: unknown) => {
      const message = requestEscapeSchema.parse(payload);
      if (message.confirm) {
        this.matchController.finishMission(this.session.snapshot.discoveredEvidence);
      }
      this.sync();
    });
  }

  private tick(dtSec: number): void {
    this.matchController.tick(dtSec);
    this.sanitySystem.tick(dtSec);
    this.ghostDirector.tick();
    this.huntSystem.tick(dtSec);
    this.sync();
    this.updateRegistry();
  }

  private sync(): void {
    syncGameState(this.state, this.session.snapshot);
  }

  private updateRegistry(): void {
    this.dependencies.registry.upsert({
      roomId: this.roomId,
      name: "game",
      clients: this.clients.length,
      maxClients: this.maxClients,
      metadata: {
        mapId: this.session.snapshot.mapId,
        phase: this.session.snapshot.matchPhase,
      },
    });
  }

  private requireDependencies(options: Partial<RoomDependencies>): RoomDependencies {
    if (!options.env || !options.logger || !options.registry) {
      throw new Error("GameRoom dependencies are required");
    }

    return {
      env: options.env,
      logger: options.logger,
      registry: options.registry,
    };
  }
}
