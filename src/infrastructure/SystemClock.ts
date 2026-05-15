import type { Clock } from "../domain/ports.js";

export class SystemClock implements Clock {
  public nowMs(): number {
    return Date.now();
  }
}
