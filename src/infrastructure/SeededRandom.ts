import type { RandomSource } from "../domain/ports.js";

export class SeededRandom implements RandomSource {
  private state: number;

  public constructor(seed = Date.now()) {
    this.state = seed >>> 0;
  }

  public nextInt(maxExclusive: number): number {
    if (maxExclusive <= 0) {
      throw new Error("maxExclusive must be positive");
    }

    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state % maxExclusive;
  }

  public pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error("Cannot pick from empty array");
    }

    return items[this.nextInt(items.length)];
  }

  public pickMany<T>(items: readonly T[], count: number): T[] {
    const pool = [...items];
    const picked: T[] = [];
    while (picked.length < count && pool.length > 0) {
      const index = this.nextInt(pool.length);
      const [item] = pool.splice(index, 1);
      picked.push(item);
    }

    return picked;
  }
}
