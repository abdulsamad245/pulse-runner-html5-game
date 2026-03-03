import { Container, Graphics } from "pixi.js";

/** Collectible and hazard variants spawned during gameplay. */
export type FallingKind =
  | "enemy"
  | "mine"
  | "dart"
  | "energy"
  | "boost"
  | "shield"
  | "slow";

/** Optional motion tuning applied per spawned object kind. */
export interface FallingMotionOptions {
  lateralVelocity?: number;
  driftAmplitude?: number;
  driftFrequency?: number;
  driftPhase?: number;
  spinSpeed?: number;
  initialRotation?: number;
}

/** Renderable falling actor that can be reconfigured and pooled. */
export class FallingObject extends Container {
  kind: FallingKind = "enemy";
  radius = 16;
  speed = 180;
  nearMissAwarded = false;

  private readonly body = new Graphics();
  private age = 0;
  private baseX = 0;
  private lateralVelocity = 0;
  private driftAmplitude = 0;
  private driftFrequency = 0;
  private driftPhase = 0;
  private spinSpeed = 0;

  constructor() {
    super();
    this.addChild(this.body);
  }

  /** Configure the visual type and motion values before activation. */
  configure(kind: FallingKind, x: number, y: number, speed: number, motion: FallingMotionOptions = {}): void {
    this.kind = kind;
    this.x = x;
    this.baseX = x;
    this.y = y;
    this.speed = speed;
    this.nearMissAwarded = false;
    this.visible = true;
    this.alpha = 1;
    this.age = 0;
    this.lateralVelocity = motion.lateralVelocity ?? 0;
    this.driftAmplitude = motion.driftAmplitude ?? 0;
    this.driftFrequency = motion.driftFrequency ?? 0;
    this.driftPhase = motion.driftPhase ?? 0;
    this.spinSpeed = motion.spinSpeed ?? 0;
    this.rotation = motion.initialRotation ?? 0;
    this.draw();
  }

  tick(deltaSeconds: number, speedMultiplier = 1): void {
    this.age += deltaSeconds;
    this.y += this.speed * deltaSeconds * speedMultiplier;
    this.baseX += this.lateralVelocity * deltaSeconds * speedMultiplier;

    if (this.driftAmplitude > 0.001 && this.driftFrequency > 0.001) {
      this.x = this.baseX + Math.sin(this.age * this.driftFrequency + this.driftPhase) * this.driftAmplitude;
    } else {
      this.x = this.baseX;
    }

    if (this.spinSpeed !== 0) {
      this.rotation += this.spinSpeed * deltaSeconds;
    }
  }

  /** Reset runtime state when returned to the object pool. */
  reset(): void {
    this.visible = false;
    this.alpha = 1;
    this.age = 0;
    this.baseX = 0;
    this.lateralVelocity = 0;
    this.driftAmplitude = 0;
    this.driftFrequency = 0;
    this.driftPhase = 0;
    this.spinSpeed = 0;
    this.rotation = 0;
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

    if (this.kind === "mine") {
      this.radius = 24;
      this.body
        .poly([
          0,
          -this.radius,
          this.radius * 0.74,
          -this.radius * 0.38,
          this.radius * 0.95,
          this.radius * 0.28,
          0,
          this.radius,
          -this.radius * 0.95,
          this.radius * 0.28,
          -this.radius * 0.74,
          -this.radius * 0.38
        ])
        .fill(0xb51634)
        .stroke({ color: 0xff8aa1, width: 2, alpha: 0.9 });
      this.body.circle(0, 0, 6).fill(0xffc5d1);
      return;
    }

    if (this.kind === "dart") {
      this.radius = 12;
      this.body
        .poly([
          0,
          -this.radius * 1.25,
          this.radius * 0.95,
          this.radius,
          0,
          this.radius * 0.62,
          -this.radius * 0.95,
          this.radius
        ])
        .fill(0xff7154)
        .stroke({ color: 0xffc2b8, width: 2, alpha: 0.88 });
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

    if (this.kind === "shield") {
      this.radius = 15;
      this.body
        .poly([
          0,
          -this.radius,
          this.radius * 0.9,
          -this.radius * 0.25,
          this.radius * 0.56,
          this.radius,
          -this.radius * 0.56,
          this.radius,
          -this.radius * 0.9,
          -this.radius * 0.25
        ])
        .fill(0x74ceff)
        .stroke({ color: 0xe3f8ff, width: 2, alpha: 0.9 });
      this.body
        .poly([0, -6, 5, -1, 3, 7, -3, 7, -5, -1])
        .fill({ color: 0xffffff, alpha: 0.9 });
      return;
    }

    if (this.kind === "slow") {
      this.radius = 13;
      this.body
        .circle(0, 0, this.radius)
        .fill(0x73fff0)
        .stroke({ color: 0xd8fffb, width: 2, alpha: 0.88 });
      this.body
        .circle(0, 0, this.radius - 5)
        .stroke({ color: 0x0f4357, width: 2, alpha: 0.95 });
      this.body
        .moveTo(0, 0)
        .lineTo(0, -6)
        .lineTo(4, -2)
        .stroke({ color: 0x0f4357, width: 2, alpha: 0.95 });
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
