import type { GameModel } from "../domain/models.js";
import { isWithinDistance } from "../domain/geometry.js";

export class SanitySystem {
  public constructor(private readonly state: GameModel) {}

  public averageSanity(): number {
    const alivePlayers = Array.from(this.state.players.values()).filter((player) => player.isAlive);
    if (alivePlayers.length === 0) {
      return 0;
    }

    const total = alivePlayers.reduce((sum, player) => sum + player.sanity, 0);
    return total / alivePlayers.length;
  }

  public tick(dtSec: number): void {
    if (this.state.matchPhase !== "active" && this.state.matchPhase !== "hunt") {
      return;
    }

    const sanityZones = this.state.map?.sanityZones ?? [];
    if (sanityZones.length === 0) {
      return;
    }

    for (const player of this.state.players.values()) {
      if (!player.isAlive) {
        continue;
      }

      let drainPerSec = 0;
      for (const zone of sanityZones) {
        if (isWithinDistance(player.position, zone.center, zone.radius)) {
          drainPerSec = Math.max(drainPerSec, zone.drainPerSec);
        }
      }

      if (drainPerSec > 0) {
        player.sanity = Math.max(0, player.sanity - dtSec * drainPerSec);
      }
    }
  }
}
