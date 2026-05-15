import { createServer } from "node:http";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { loadEnv } from "./config/env.js";
import { createLogger } from "./infrastructure/LoggerAdapter.js";
import { RoomRegistry } from "./infrastructure/RoomRegistry.js";
import { createHttpApp } from "./presentation/http/createHttpApp.js";
import { GameRoom } from "./rooms/GameRoom.js";
import { LobbyRoom } from "./rooms/LobbyRoom.js";
import type { RoomDependencies } from "./rooms/roomOptions.js";

const main = async (): Promise<void> => {
  const env = loadEnv();
  const logger = createLogger();
  const registry = new RoomRegistry();
  const app = createHttpApp({ registry, version: "0.1.0" });
  const server = createServer(app);
  const gameServer = new Server({ transport: new WebSocketTransport({ server }) });
  const dependencies: RoomDependencies = { env, logger, registry };

  gameServer.define("lobby", LobbyRoom, dependencies);
  gameServer.define("game", GameRoom, dependencies);

  server.listen(env.PORT, () => {
    logger.info("HauntOps backend listening", { port: env.PORT });
  });
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown startup error";
  console.error(message);
  process.exit(1);
});
