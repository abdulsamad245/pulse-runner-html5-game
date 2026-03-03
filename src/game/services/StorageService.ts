/**
 * LocalStorage adapter with namespace scoping and safe fallbacks.
 * Keeps storage failures from crashing gameplay in restricted environments.
 */
export class StorageService {
  constructor(private readonly namespace: string) {}

  /** Read a numeric value or return fallback on parse/missing errors. */
  getNumber(key: string, fallback = 0): number {
    try {
      const raw = localStorage.getItem(this.keyOf(key));
      if (raw === null) {
        return fallback;
      }
      const value = Number.parseFloat(raw);
      return Number.isFinite(value) ? value : fallback;
    } catch {
      return fallback;
    }
  }

  /** Persist a numeric value under the namespaced key. */
  setNumber(key: string, value: number): void {
    try {
      localStorage.setItem(this.keyOf(key), value.toString());
    } catch {
      // Ignore storage failures in restricted environments.
    }
  }

  /** Read and parse a JSON value with a typed fallback. */
  getObject<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(this.keyOf(key));
      if (raw === null) {
        return fallback;
      }
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  /** Serialize and persist a JSON value under the namespaced key. */
  setObject<T>(key: string, value: T): void {
    try {
      localStorage.setItem(this.keyOf(key), JSON.stringify(value));
    } catch {
      // Ignore storage failures in restricted environments.
    }
  }

  private keyOf(key: string): string {
    return `${this.namespace}:${key}`;
  }
}
