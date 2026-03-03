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
      { name: "A", score: 120, survivalTime: 20, platform: "Web", dateISO: "2026-01-01T00:00:00.000Z" },
      3
    );
    service.record(
      { name: "B", score: 540, survivalTime: 15, platform: "Web", dateISO: "2026-01-02T00:00:00.000Z" },
      3
    );
    service.record(
      { name: "C", score: 320, survivalTime: 18, platform: "Web", dateISO: "2026-01-03T00:00:00.000Z" },
      3
    );
    const result = service.record(
      { name: "D", score: 40, survivalTime: 40, platform: "Web", dateISO: "2026-01-04T00:00:00.000Z" },
      3
    );

    expect(result).toHaveLength(3);
    expect(result.map((entry) => entry.name)).toEqual(["B", "C", "A"]);
  });
});
