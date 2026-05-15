import express, { type Express } from "express";
import type { RoomRegistry } from "../../infrastructure/RoomRegistry.js";

export type HttpAppOptions = {
  registry: RoomRegistry;
  version: string;
};

export const createHttpApp = ({ registry, version }: HttpAppOptions): Express => {
  const app = express();
  app.use(express.json());

  app.get("/health", (_request, response) => {
    response.json({ ok: true, service: "hauntops-backend" });
  });

  app.get("/version", (_request, response) => {
    response.json({ name: "hauntops-backend", version });
  });

  app.get("/rooms", (_request, response) => {
    response.json({ rooms: registry.list() });
  });

  return app;
};
