import type { Env } from "../config/env.js";
import type { Logger } from "../domain/ports.js";
import type { RoomRegistry } from "../infrastructure/RoomRegistry.js";

export type RoomDependencies = {
  env: Env;
  logger: Logger;
  registry: RoomRegistry;
};
