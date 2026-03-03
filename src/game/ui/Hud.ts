import { Container, Text } from "pixi.js";

/** Create a monospace HUD text node with consistent styling. */
const makeHudText = (value: string): Text =>
  new Text({
    text: value,
    style: {
      fill: 0xe3f6ff,
      fontFamily: "IBM Plex Mono",
      fontWeight: "500",
      fontSize: 18
    }
  });

/** In-game overlay for score, lives, timer, status, and platform label. */
export class Hud extends Container {
  private readonly score = makeHudText("Score 000000");
  private readonly lives = makeHudText("Lives 03");
  private readonly timer = makeHudText("Time 00s");
  private readonly status = makeHudText("");
  private readonly platform: Text;
  private widthPx = 0;

  constructor(appName: string) {
    super();
    this.platform = makeHudText(appName);
    this.addChild(this.score, this.lives, this.timer, this.status, this.platform);
  }

  /** Update all HUD value strings for the current frame. */
  updateValues(score: number, lives: number, elapsedSeconds: number, status: string): void {
    this.score.text = `Score ${score.toString().padStart(6, "0")}`;
    this.lives.text = `Lives ${lives.toString().padStart(2, "0")}`;
    this.timer.text = `Time ${Math.floor(elapsedSeconds)
      .toString()
      .padStart(2, "0")}s`;
    this.status.text = status;
  }

  /** Reflow and resize HUD typography for responsive breakpoints. */
  resize(width: number): void {
    this.widthPx = width;
    const compact = width < 780;
    const fontSize = compact ? 14 : 18;
    const left = compact ? 12 : 20;
    const top = compact ? 10 : 16;
    const rowHeight = compact ? 20 : 26;

    this.score.style.fontSize = fontSize;
    this.lives.style.fontSize = fontSize;
    this.timer.style.fontSize = fontSize;
    this.status.style.fontSize = compact ? 13 : 16;
    this.platform.style.fontSize = compact ? 12 : 15;

    this.score.position.set(left, top);
    this.lives.position.set(left, top + rowHeight);
    this.timer.position.set(left, top + rowHeight * 2);
    this.status.position.set(left, top + rowHeight * 3 + (compact ? 0 : 2));
    this.platform.position.set(this.widthPx - this.platform.width - left, top);
  }
}
