import { describe, expect, it } from "vitest";
import { LeaderboardService } from "../src/game/services/LeaderboardService";

class MockStorage {
  private data = new Map<string, unknown>();

  getObject<T>(key: string, fallback: T): T {
    return (this.data.get(key) as T | undefined) ?? fallback;
  }

  setObject<T>(key: string, value: T): void {
    this.data.set(key, value);
  }
}

describe("LeaderboardService", () => {
  it("sorts by score and trims to limit", () => {
    const storage = new MockStorage();
    const service = new LeaderboardService(storage as never);

    service.record(
      {
        runId: "run-a",
        name: "A",
        score: 120,
        survivalTime: 20,
        levelReached: 2,
        platform: "Web",
        dateISO: "2026-01-01T00:00:00.000Z"
      },
      3
    );
    service.record(
      {
        runId: "run-b",
        name: "B",
        score: 540,
        survivalTime: 15,
        levelReached: 2,
        platform: "Web",
        dateISO: "2026-01-02T00:00:00.000Z"
      },
      3
    );
    service.record(
      {
        runId: "run-c",
        name: "C",
        score: 320,
        survivalTime: 18,
        levelReached: 2,
        platform: "Web",
        dateISO: "2026-01-03T00:00:00.000Z"
      },
      3
    );
    const result = service.record(
      {
        runId: "run-d",
        name: "D",
        score: 40,
        survivalTime: 40,
        levelReached: 2,
        platform: "Web",
        dateISO: "2026-01-04T00:00:00.000Z"
      },
      3
    );

    expect(result).toHaveLength(3);
    expect(result.map((entry) => entry.name)).toEqual(["B", "C", "A"]);
  });

  it("supports optional player names with fallback defaults", () => {
    const storage = new MockStorage();
    const service = new LeaderboardService(storage as never);
    service.record(
      {
        runId: "run-fallback",
        name: "Player",
        score: 200,
        survivalTime: 20,
        levelReached: 4,
        platform: "Web",
        dateISO: "2026-01-05T00:00:00.000Z"
      },
      5
    );

    const updated = service.updateRunName("run-fallback", "   ", "Guest");
    expect(updated[0]?.name).toBe("Guest");
  });
});
