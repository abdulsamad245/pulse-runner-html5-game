/** Host platform abstraction used by scenes/services. */
export interface PlatformBridge {
  readonly name: string;
  /** Perform asynchronous host SDK initialization/handshake. */
  init(): Promise<void>;
  /** Resolve player display name from host metadata. */
  getUserDisplayName(): string;
  /** Report score to host platform APIs. */
  reportScore(score: number): Promise<void>;
}

/**
 * Browser-only fallback implementation.
 * Useful during local development and for SDK contract testing.
 */
export class WebPlatformBridge implements PlatformBridge {
  private platformName = "Web";
  private userName = "Player";

  get name(): string {
    return this.platformName;
  }

  /** Reads optional query params: `platform` and `user`. */
  async init(): Promise<void> {
    const params = new URLSearchParams(window.location.search);
    const platform = params.get("platform");
    const user = params.get("user");

    if (platform && platform.trim()) {
      this.platformName = platform.trim();
    }
    if (user && user.trim()) {
      this.userName = user.trim();
    }
  }

  getUserDisplayName(): string {
    return this.userName;
  }

  /** Stubbed score reporter that logs to console in web mode. */
  async reportScore(score: number): Promise<void> {
    console.info(`[PlatformBridge:${this.platformName}] score=${score}`);
  }
}
