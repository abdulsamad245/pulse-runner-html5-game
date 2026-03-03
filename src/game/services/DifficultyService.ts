import { clamp, lerp } from "../math";

/** Runtime difficulty values sampled every frame. */
export interface DifficultySnapshot {
  level: number;
  ramp: number;
  spawnInterval: number;
  fallSpeed: number;
  enemyWeight: number;
  scoreMultiplier: number;
}

/**
 * Converts elapsed run time into deterministic spawn/speed/score tuning parameters.
 */
export class DifficultyService {
  /** Compute a difficulty snapshot for the current run time in seconds. */
  getForTime(elapsedSeconds: number): DifficultySnapshot {
    const ramp = clamp(elapsedSeconds / 120, 0, 1);
    const level = 1 + Math.floor(elapsedSeconds / 20);
    const levelBoost = 1 + (level - 1) * 0.07;

    return {
      level,
      ramp,
      spawnInterval: Math.max(0.17, lerp(0.95, 0.42, ramp) / levelBoost),
      fallSpeed: lerp(180, 360, ramp) * levelBoost,
      enemyWeight: clamp(lerp(0.56, 0.78, ramp) + (level - 1) * 0.008, 0.56, 0.9),
      scoreMultiplier: lerp(1, 1.95, ramp) + (level - 1) * 0.12
    };
  }
}
