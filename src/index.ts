import { Server } from "colyseus";
import { createRouter, type Router } from "@colyseus/better-call";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { loadEnv } from "./config/env.js";
import { createLogger } from "./infrastructure/LoggerAdapter.js";
import { RoomRegistry } from "./infrastructure/RoomRegistry.js";
import { createHttpApp } from "./presentation/http/createHttpApp.js";
import { GameRoom } from "./rooms/GameRoom.js";
import { LobbyRoom } from "./rooms/LobbyRoom.js";
import type { RoomDependencies } from "./rooms/roomOptions.js";

const getCorsHeaders = (request: Request): Record<string, string> => {
  const origin = request.headers.get("origin");
  return {
    ...(origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}),
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Requested-With",
    "Access-Control-Max-Age": "86400",
  };
};

const withCors = <T extends Router>(router: T): T => ({
  ...router,
  handler: async (request: Request): Promise<Response> => {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: getCorsHeaders(request) });
    }

    const response = await router.handler(request);
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(getCorsHeaders(request))) {
      headers.set(key, value);
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
  extend: (endpoints: Record<string, never>) => withCors(router.extend(endpoints)),
});

const main = async (): Promise<void> => {
  const env = loadEnv();
  const logger = createLogger();
  const registry = new RoomRegistry();
  const app = createHttpApp({ registry, version: "0.1.0" });
  const gameServer = new Server({
    transport: new WebSocketTransport({
      verifyClient: () => true,
    }),
    express: (expressApp) => {
      expressApp.use(app);
    },
  });
  const dependencies: RoomDependencies = { env, logger, registry };

  gameServer.router = withCors(createRouter({}, { openapi: { disabled: true } })) as typeof gameServer.router;
  gameServer.define("lobby", LobbyRoom, dependencies);
  gameServer.define("game", GameRoom, dependencies);

  await gameServer.listen(env.PORT, undefined, undefined, () => {
    logger.info("HauntOps backend listening", { port: env.PORT });
  });
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown startup error";
  console.error(message);
  process.exit(1);
});
