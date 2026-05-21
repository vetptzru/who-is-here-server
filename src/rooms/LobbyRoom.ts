import { Client, Room } from "colyseus";
import { setNameSchema, setReadySchema } from "../messages/clientMessages.js";
import { LobbyPlayerState, LobbyState } from "../schemas/LobbyState.js";
import type { RoomDependencies } from "./roomOptions.js";

export class LobbyRoom extends Room<LobbyState> {
  private dependencies!: RoomDependencies;

  public onCreate(options: Partial<RoomDependencies>): void {
    this.dependencies = this.requireDependencies(options);
    this.maxClients = this.dependencies.env.MAX_PLAYERS_PER_ROOM;
    this.setState(new LobbyState());

    this.onMessage("set_name", (client, payload: unknown) => {
      const message = setNameSchema.parse(payload);
      const player = this.state.players.get(client.sessionId);
      if (player) {
        player.name = message.name;
        this.updateRegistry();
        this.emitLobbyState();
      }
    });

    this.onMessage("set_ready", (client, payload: unknown) => {
      const message = setReadySchema.parse(payload);
      const player = this.state.players.get(client.sessionId);
      if (player) {
        player.isReady = message.isReady;
        this.updateRegistry();
        this.emitLobbyState();
      }
    });

    this.onMessage("start_match", (client) => this.startMatch(client));
    this.onMessage("start_game", (client) => this.startMatch(client));
  }

  public onJoin(client: Client): void {
    const player = new LobbyPlayerState();
    player.id = client.sessionId;
    player.name = `Player ${this.state.players.size + 1}`;
    player.isHost = this.state.players.size === 0;
    this.state.players.set(client.sessionId, player);
    this.dependencies.logger.info("Lobby player joined", { roomId: this.roomId, playerId: client.sessionId });
    this.updateRegistry();
    this.emitLobbyState();
  }

  public onLeave(client: Client): void {
    this.state.players.delete(client.sessionId);
    const firstPlayer = this.state.players.values().next().value as LobbyPlayerState | undefined;
    if (firstPlayer) {
      firstPlayer.isHost = true;
    }
    this.updateRegistry();
    this.emitLobbyState();
  }

  public onDispose(): void {
    this.dependencies.registry.remove(this.roomId);
  }

  private canStart(clientId: string): boolean {
    const players = Array.from(this.state.players.values());
    const host = this.state.players.get(clientId);
    return Boolean(host?.isHost) && players.length > 0 && players.every((player) => player.isReady);
  }

  private startMatch(client: Client): void {
    if (!this.canStart(client.sessionId)) {
      client.send("start_match_result", {
        ok: false,
        reason: this.getStartBlockedReason(client.sessionId),
      });
      this.emitLobbyState();
      return;
    }

    this.state.status = "starting";
    client.send("start_match_result", {
      ok: true,
      roomName: "game",
    });
    this.broadcast("match_ready", {
      roomName: "game",
      players: Array.from(this.state.players.values()).map((player) => ({
        id: player.id,
        name: player.name,
      })),
    });
    this.updateRegistry();
    this.emitLobbyState();
  }

  private emitLobbyState(): void {
    const players = Array.from(this.state.players.values()).map((player) => ({
      sessionId: player.id,
      name: player.name,
      ready: player.isReady,
    }));

    this.clients.forEach((client) => {
      client.send("lobby_state", {
        players,
        mapId: this.dependencies.env.DEFAULT_MAP_ID,
        canStart: this.canStart(client.sessionId),
      });
    });
  }

  private getStartBlockedReason(clientId: string): string {
    const players = Array.from(this.state.players.values());
    const requester = this.state.players.get(clientId);
    if (!requester?.isHost) {
      return "only_host_can_start";
    }
    if (players.length === 0) {
      return "no_players";
    }
    if (players.some((player) => !player.isReady)) {
      return "players_not_ready";
    }

    return "unknown";
  }

  private updateRegistry(): void {
    this.dependencies.registry.upsert({
      roomId: this.roomId,
      name: "lobby",
      clients: this.clients.length,
      maxClients: this.maxClients,
      metadata: { phase: this.state.status },
    });
  }

  private requireDependencies(options: Partial<RoomDependencies>): RoomDependencies {
    if (!options.env || !options.logger || !options.registry) {
      throw new Error("LobbyRoom dependencies are required");
    }

    return {
      env: options.env,
      logger: options.logger,
      registry: options.registry,
    };
  }
}
