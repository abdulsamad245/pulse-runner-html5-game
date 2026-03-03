import { StorageService } from "./StorageService";

/** Serialized leaderboard row stored in local persistence. */
export interface LeaderboardEntry {
  runId: string;
  name: string;
  score: number;
  survivalTime: number;
  levelReached: number;
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

  /** Update display name for a specific run and persist sorted results. */
  updateRunName(runId: string, preferredName: string, fallbackName: string, limit = 10): LeaderboardEntry[] {
    const all = this.readAll();
    const sanitizedName = this.normalizeName(preferredName, fallbackName);
    const target = all.find((entry) => entry.runId === runId);

    if (!target) {
      return all.slice(0, limit);
    }

    target.name = sanitizedName;
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
    const runId = typeof candidate.runId === "string" ? candidate.runId.trim() : "";
    const score = Number(candidate.score);
    const survivalTime = Number(candidate.survivalTime);
    const levelReachedRaw = Number(candidate.levelReached);
    const dateISO = typeof candidate.dateISO === "string" ? candidate.dateISO : "";
    const name = typeof candidate.name === "string" ? candidate.name : "";
    const platform = typeof candidate.platform === "string" ? candidate.platform.trim() : "";

    if (!Number.isFinite(score) || !Number.isFinite(survivalTime)) {
      return null;
    }

    const inferredLevel = 1 + Math.floor(Math.max(0, survivalTime) / 20);
    const levelReached = Number.isFinite(levelReachedRaw) ? levelReachedRaw : inferredLevel;

    return {
      runId: runId || dateISO || `legacy-${Math.floor(score)}-${Math.floor(survivalTime)}`,
      name: this.normalizeName(name, "Player"),
      score: Math.max(0, Math.floor(score)),
      survivalTime: Math.max(0, survivalTime),
      levelReached: Math.max(1, Math.floor(levelReached)),
      platform: platform || "Web",
      dateISO: dateISO || new Date(0).toISOString()
    };
  }

  private normalizeName(preferredName: string, fallbackName: string): string {
    const clean = preferredName
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 16);
    if (clean) {
      return clean;
    }
    const fallback = fallbackName
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 16);
    return fallback || "Player";
  }
}
