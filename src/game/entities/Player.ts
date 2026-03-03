import { Container, Graphics } from "pixi.js";
import { clamp } from "../math";

/** Player ship actor with pointer/keyboard blended movement. */
export class Player extends Container {
  readonly radius = 22;
  private readonly body = new Graphics();
  private readonly glow = new Graphics();
  private pointerX = 0;
  private readonly speed = 520;

  constructor() {
    super();
    this.addChild(this.glow, this.body);
    this.draw();
  }

  setPointerX(pointerX: number): void {
    this.pointerX = pointerX;
  }

  /** Move the player within horizontal bounds. */
  update(deltaSeconds: number, inputAxis: number, width: number): void {
    const manualTarget = this.x + inputAxis * this.speed * deltaSeconds;
    const pointerTarget = this.pointerX;
    const desiredX = inputAxis === 0 ? pointerTarget : manualTarget;
    const smoothing = inputAxis === 0 ? 1 - Math.exp(-16 * deltaSeconds) : 1;

    this.x += (desiredX - this.x) * smoothing;
    this.x = clamp(this.x, this.radius + 24, width - this.radius - 24);
  }

  /** Visual feedback used during short invulnerability windows. */
  setInvulnerable(active: boolean): void {
    this.alpha = active ? 0.5 : 1;
  }

  private draw(): void {
    this.glow
      .circle(0, 0, this.radius + 8)
      .fill({ color: 0x68ffd8, alpha: 0.22 })
      .stroke({ color: 0x68ffd8, width: 1, alpha: 0.35 });

    this.body
      .roundRect(-28, -16, 56, 32, 10)
      .fill(0x68ffd8)
      .stroke({ color: 0xb4ffe9, width: 2, alpha: 0.8 });

    this.body
      .moveTo(-10, -7)
      .lineTo(10, 0)
      .lineTo(-10, 7)
      .closePath()
      .fill(0x0f1930);
  }
}
