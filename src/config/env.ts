import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(2567),
  COLYSEUS_MONITOR_ENABLED: z.coerce.boolean().default(true),
  MAX_PLAYERS_PER_ROOM: z.coerce.number().int().min(1).max(4).default(4),
  DEFAULT_MAP_ID: z.string().min(1).default("house_01"),
  TICK_RATE: z.coerce.number().int().positive().default(20),
  GHOST_EVENT_INTERVAL_MS: z.coerce.number().int().positive().default(5000),
  HUNT_DURATION_SEC: z.coerce.number().int().positive().default(45),
  HUNT_COOLDOWN_SEC: z.coerce.number().int().positive().default(60),
});

export type Env = z.infer<typeof envSchema>;

export const loadEnv = (source: NodeJS.ProcessEnv = process.env): Env => envSchema.parse(source);
