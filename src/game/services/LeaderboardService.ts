import { StorageService } from "./StorageService";

/** Serialized leaderboard row stored in local persistence. */
export interface LeaderboardEntry {
  name: string;
  score: number;
  survivalTime: number;
  platform: string;
  dateISO: string;
}

/** Handles leaderboard persistence, sanitization, ordering, and trimming. */
export class LeaderboardService {
  private readonly storageKey = "leaderboard";

  constructor(private readonly storage: StorageService) {}

  /** Read top entries sorted by score/survival time. */
  list(limit = 5): LeaderboardEntry[] {
    return this.readAll().slice(0, limit);
  }

  /** Insert an entry, persist sorted results, and return the trimmed leaderboard. */
  record(entry: LeaderboardEntry, limit = 10): LeaderboardEntry[] {
    const all = this.readAll();
    all.push(entry);
    all.sort((a, b) => b.score - a.score || b.survivalTime - a.survivalTime);
    const trimmed = all.slice(0, limit);
    this.storage.setObject(this.storageKey, trimmed);
    return trimmed;
  }

  private readAll(): LeaderboardEntry[] {
    const raw = this.storage.getObject<unknown[]>(this.storageKey, []);
    return raw
      .map((value) => this.safeEntry(value))
      .filter((entry): entry is LeaderboardEntry => entry !== null)
      .sort((a, b) => b.score - a.score || b.survivalTime - a.survivalTime);
  }

  private safeEntry(value: unknown): LeaderboardEntry | null {
    if (!value || typeof value !== "object") {
      return null;
    }

    const candidate = value as Partial<LeaderboardEntry>;
    const score = Number(candidate.score);
    const survivalTime = Number(candidate.survivalTime);
    const dateISO = typeof candidate.dateISO === "string" ? candidate.dateISO : "";
    const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
    const platform = typeof candidate.platform === "string" ? candidate.platform.trim() : "";

    if (!Number.isFinite(score) || !Number.isFinite(survivalTime)) {
      return null;
    }

    return {
      name: name || "Player",
      score: Math.max(0, Math.floor(score)),
      survivalTime: Math.max(0, survivalTime),
      platform: platform || "Web",
      dateISO: dateISO || new Date(0).toISOString()
    };
  }
}
