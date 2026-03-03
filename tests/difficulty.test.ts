import { describe, expect, it } from "vitest";
import { DifficultyService } from "../src/game/services/DifficultyService";

describe("DifficultyService", () => {
  it("ramps challenge over time", () => {
    const service = new DifficultyService();
    const early = service.getForTime(0);
    const late = service.getForTime(120);

    expect(late.spawnInterval).toBeLessThan(early.spawnInterval);
    expect(late.fallSpeed).toBeGreaterThan(early.fallSpeed);
    expect(late.enemyWeight).toBeGreaterThan(early.enemyWeight);
    expect(late.scoreMultiplier).toBeGreaterThan(early.scoreMultiplier);
    expect(late.level).toBeGreaterThan(early.level);
  });

  it("keeps increasing speed/level over long sessions", () => {
    const service = new DifficultyService();
    const mid = service.getForTime(120);
    const late = service.getForTime(360);

    expect(late.level).toBeGreaterThan(mid.level);
    expect(late.fallSpeed).toBeGreaterThan(mid.fallSpeed);
    expect(late.spawnInterval).toBeLessThan(mid.spawnInterval);
  });

  it("respects hard balancing bounds", () => {
    const service = new DifficultyService();
    const extreme = service.getForTime(9999);

    expect(extreme.spawnInterval).toBeGreaterThanOrEqual(0.17);
    expect(extreme.enemyWeight).toBeLessThanOrEqual(0.9);
    expect(extreme.level).toBeGreaterThan(1);
  });
});
