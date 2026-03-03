import { Application, Rectangle } from "pixi.js";
import { Scene } from "./Scene";
import { BootScene } from "../game/scenes/BootScene";
import { DifficultyService } from "../game/services/DifficultyService";
import { StorageService } from "../game/services/StorageService";
import { LeaderboardService } from "../game/services/LeaderboardService";
import { SoundService } from "../game/services/SoundService";
import { WebPlatformBridge, type PlatformBridge } from "../game/platform/PlatformBridge";

/** Shared application-level services available to every scene. */
export interface AppServices {
  difficulty: DifficultyService;
  storage: StorageService;
  leaderboard: LeaderboardService;
  sound: SoundService;
  platform: PlatformBridge;
}

/**
 * Root Pixi application host.
 * Handles renderer initialization, scene lifecycle, resize propagation, and per-frame updates.
 */
export class GameApp {
  readonly app = new Application();

  private readonly storage = new StorageService("pulse-runner");

  readonly services: AppServices = {
    difficulty: new DifficultyService(),
    storage: this.storage,
    leaderboard: new LeaderboardService(this.storage),
    sound: new SoundService(),
    platform: new WebPlatformBridge()
  };

  private currentScene: Scene | null = null;

  /** Initialize the renderer and start the first scene. */
  async init(host: HTMLElement): Promise<void> {
    await this.app.init({
      resizeTo: window,
      antialias: true,
      backgroundAlpha: 0,
      powerPreference: "high-performance"
    });

    host.appendChild(this.app.canvas);

    this.app.stage.eventMode = "static";
    this.app.stage.hitArea = new Rectangle(0, 0, this.width, this.height);

    this.app.ticker.add(this.onTick);
    window.addEventListener("resize", this.onResize);
    this.services.sound.init();

    this.switchScene(new BootScene(this));
    this.onResize();
  }

  get width(): number {
    return this.app.renderer.width;
  }

  get height(): number {
    return this.app.renderer.height;
  }

  /** Replace the active scene with a new scene instance. */
  switchScene(scene: Scene): void {
    if (this.currentScene) {
      this.currentScene.exit();
      this.app.stage.removeChild(this.currentScene.root);
      this.currentScene.destroy();
    }

    this.currentScene = scene;
    this.app.stage.addChild(scene.root);
    scene.enter();
    scene.resize(this.width, this.height);
  }

  private readonly onResize = (): void => {
    this.app.stage.hitArea = new Rectangle(0, 0, this.width, this.height);
    this.currentScene?.resize(this.width, this.height);
  };

  private readonly onTick = (): void => {
    // Clamp large frame steps to keep gameplay deterministic after tab/background stutters.
    const deltaSeconds = Math.min(this.app.ticker.deltaMS / 1000, 0.05);
    this.currentScene?.update(deltaSeconds);
  };
}
