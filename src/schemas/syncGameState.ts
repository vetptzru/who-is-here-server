import type { GameModel } from "../domain/models.js";
import { DoorState } from "./DoorState.js";
import { GameState } from "./GameState.js";
import { LightState } from "./LightState.js";
import { PlayerState } from "./PlayerState.js";

export const syncGameState = (target: GameState, source: GameModel): void => {
  target.matchPhase = source.matchPhase;
  target.matchTimeSec = source.matchTimeSec;
  target.mapId = source.mapId;

  for (const playerId of Array.from(target.players.keys())) {
    if (!source.players.has(playerId)) {
      target.players.delete(playerId);
    }
  }

  for (const player of source.players.values()) {
    const state = target.players.get(player.id) ?? new PlayerState();
    state.id = player.id;
    state.name = player.name;
    state.x = player.position.x;
    state.y = player.position.y;
    state.z = player.position.z;
    state.rotY = player.rotY;
    state.sanity = player.sanity;
    state.isAlive = player.isAlive;
    state.isReady = player.isReady;
    state.isInHouse = player.isInHouse;
    state.inventory.clear();
    state.inventory.push(...player.inventory);
    target.players.set(player.id, state);
  }

  target.ghost.ghostType = source.ghost.ghostType;
  target.ghost.state = source.ghost.state;
  target.ghost.roomId = source.ghost.roomId;
  target.ghost.aggression = source.ghost.aggression;
  target.ghost.activity = source.ghost.activity;
  target.ghost.x = source.ghost.position.x;
  target.ghost.y = source.ghost.position.y;
  target.ghost.z = source.ghost.position.z;
  target.ghost.targetPlayerId = source.ghost.targetPlayerId;
  target.ghost.discoveredEvidence.clear();
  target.ghost.discoveredEvidence.push(...source.discoveredEvidence);

  for (const door of source.doors.values()) {
    const state = target.doors.get(door.id) ?? new DoorState();
    state.id = door.id;
    state.roomA = door.roomA;
    state.roomB = door.roomB;
    state.isOpen = door.isOpen;
    state.isLocked = door.isLocked;
    target.doors.set(door.id, state);
  }

  for (const light of source.lights.values()) {
    const state = target.lights.get(light.id) ?? new LightState();
    state.id = light.id;
    state.roomId = light.roomId;
    state.switchId = light.switchId;
    state.isOn = light.isOn;
    target.lights.set(light.id, state);
  }
};
