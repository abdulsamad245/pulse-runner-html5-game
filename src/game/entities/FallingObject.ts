import { Container, Graphics } from "pixi.js";

/** Collectible and hazard variants spawned during gameplay. */
export type FallingKind = "enemy" | "energy" | "boost";

/** Renderable falling actor that can be reconfigured and pooled. */
export class FallingObject extends Container {
  kind: FallingKind = "enemy";
  radius = 16;
  speed = 180;
  nearMissAwarded = false;

  private readonly body = new Graphics();

  constructor() {
    super();
    this.addChild(this.body);
  }

  /** Configure the visual type and motion values before activation. */
  configure(kind: FallingKind, x: number, y: number, speed: number): void {
    this.kind = kind;
    this.x = x;
    this.y = y;
    this.speed = speed;
    this.nearMissAwarded = false;
    this.visible = true;
    this.alpha = 1;
    this.draw();
  }

  tick(deltaSeconds: number): void {
    this.y += this.speed * deltaSeconds;
  }

  /** Reset runtime state when returned to the object pool. */
  reset(): void {
    this.visible = false;
    this.alpha = 1;
  }

  private draw(): void {
    this.body.clear();

    if (this.kind === "enemy") {
      this.radius = 18;
      this.body
        .star(0, 0, this.radius, this.radius * 0.62, 6, -Math.PI / 2)
        .fill(0xff5a7a)
        .stroke({ color: 0xff9db1, width: 2, alpha: 0.85 });
      return;
    }

    if (this.kind === "energy") {
      this.radius = 14;
      this.body
        .poly([
          0,
          -this.radius,
          this.radius * 0.72,
          0,
          0,
          this.radius,
          -this.radius * 0.72,
          0
        ])
        .fill(0xffdc7c)
        .stroke({ color: 0xfff1c5, width: 2, alpha: 0.85 });
      return;
    }

    this.radius = 15;
    this.body
      .circle(0, 0, this.radius)
      .fill(0x7db8ff)
      .stroke({ color: 0xcfecff, width: 2, alpha: 0.9 });
    this.body
      .poly([0, -10, 8, 0, 0, 10, -8, 0])
      .fill(0xffffff);
  }
}
