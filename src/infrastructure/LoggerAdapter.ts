import pino from "pino";
import type { Logger } from "../domain/ports.js";

export const createLogger = (): Logger => {
  const logger = pino({
    level: process.env.NODE_ENV === "test" ? "silent" : "info",
  });

  return {
    info: (message, meta) => logger.info(meta ?? {}, message),
    warn: (message, meta) => logger.warn(meta ?? {}, message),
    error: (message, meta) => logger.error(meta ?? {}, message),
  };
};
