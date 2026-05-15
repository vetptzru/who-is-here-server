import express, { type Express } from "express";
import type { RoomRegistry } from "../../infrastructure/RoomRegistry.js";

export type HttpAppOptions = {
  registry: RoomRegistry;
  version: string;
};

export const createHttpApp = ({ registry, version }: HttpAppOptions): Express => {
  const app = express();
  app.use((request, response, next) => {
    const origin = request.headers.origin;

    if (origin) {
      response.setHeader("Access-Control-Allow-Origin", origin);
      response.setHeader("Vary", "Origin");
    }

    response.setHeader("Access-Control-Allow-Credentials", "true");
    response.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,X-Requested-With");
    response.setHeader("Access-Control-Max-Age", "86400");

    if (request.method === "OPTIONS") {
      response.sendStatus(204);
      return;
    }

    next();
  });
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
