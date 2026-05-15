import type { Vector3 } from "./types.js";

export const distanceSq = (a: Vector3, b: Vector3): number => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
};

export const isWithinDistance = (a: Vector3, b: Vector3, maxDistance: number): boolean =>
  distanceSq(a, b) <= maxDistance * maxDistance;

export const moveTowards = (from: Vector3, to: Vector3, maxStep: number): Vector3 => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const length = Math.sqrt(dx * dx + dy * dy + dz * dz);

  if (length === 0 || length <= maxStep) {
    return { ...to };
  }

  const scale = maxStep / length;
  return {
    x: from.x + dx * scale,
    y: from.y + dy * scale,
    z: from.z + dz * scale,
  };
};
