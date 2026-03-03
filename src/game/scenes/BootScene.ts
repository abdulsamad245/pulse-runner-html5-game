import { Graphics, Text } from "pixi.js";
import { Scene } from "../../core/Scene";
import { GAME_CONFIG } from "../config";
import { MenuScene } from "./MenuScene";

/** Lightweight startup scene that initializes platform services before menu load. */
export class BootScene extends Scene {
  private readonly backdrop = new Graphics();
  private readonly title = new Text({
    text: GAME_CONFIG.title,
    style: {
      fill: 0xf4fdff,
      fontFamily: "Chakra Petch",
      fontWeight: "700",
      fontSize: 64,
      letterSpacing: 3
    }
  });
  private readonly status = new Text({
    text: "Initializing platform bridge",
    style: {
      fill: 0xbad3f3,
      fontFamily: "IBM Plex Mono",
      fontSize: 17
    }
  });
  private elapsed = 0;
  private cancelled = false;

  enter(): void {
    this.title.anchor.set(0.5);
    this.status.anchor.set(0.5);

    this.root.addChild(this.backdrop, this.title, this.status);
    void this.bootstrap();
  }

  exit(): void {
    this.cancelled = true;
  }

  resize(width: number, height: number): void {
    this.backdrop.clear();
    this.backdrop
      .roundRect(width * 0.5 - 320, height * 0.5 - 120, 640, 240, 18)
      .fill({ color: 0x0c1f43, alpha: 0.85 })
      .stroke({ color: 0x68ffd8, width: 2, alpha: 0.65 });

    this.title.position.set(width * 0.5, height * 0.5 - 28);
    this.status.position.set(width * 0.5, height * 0.5 + 42);
  }

  update(deltaSeconds: number): void {
    this.elapsed += deltaSeconds;
    const dots = ".".repeat(1 + (Math.floor(this.elapsed * 3.5) % 3));
    this.status.text = `Initializing platform bridge${dots}`;
  }

  private async bootstrap(): Promise<void> {
    await this.game.services.platform.init();
    await new Promise((resolve) => window.setTimeout(resolve, 500));
    if (!this.cancelled) {
      this.game.switchScene(new MenuScene(this.game));
    }
  }
}
