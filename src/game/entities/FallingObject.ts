import { Container, Graphics } from "pixi.js";

/** Collectible and hazard variants spawned during gameplay. */
export type FallingKind =
  | "enemy"
  | "mine"
  | "dart"
  | "energy"
  | "boost"
  | "shield"
  | "slow"
  | "life";

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

  private readonly aura = new Graphics();
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
    this.addChild(this.aura, this.body);
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
    this.scale.set(1);
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

    this.animateVisuals();
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
    this.scale.set(1);
  }

  private draw(): void {
    this.aura.clear();
    this.body.clear();

    if (this.kind === "enemy") {
      this.radius = 18;
      this.body
        .star(0, 0, this.radius, this.radius * 0.62, 6, -Math.PI / 2)
        .fill(0xff5a7a)
        .stroke({ color: 0xff9db1, width: 2, alpha: 0.85 });
      this.body.circle(0, 0, 4.2).fill({ color: 0xfff0f3, alpha: 0.9 });
      return;
    }

    if (this.kind === "mine") {
      this.radius = 24;
      this.body
        .circle(0, 0, this.radius * 0.68)
        .fill(0xb51634)
        .stroke({ color: 0xff8aa1, width: 2, alpha: 0.9 });
      for (let i = 0; i < 8; i += 1) {
        const angle = (i / 8) * Math.PI * 2 + Math.PI / 8;
        const innerX = Math.cos(angle) * (this.radius * 0.62);
        const innerY = Math.sin(angle) * (this.radius * 0.62);
        const outerX = Math.cos(angle) * this.radius;
        const outerY = Math.sin(angle) * this.radius;
        this.body
          .moveTo(innerX, innerY)
          .lineTo(outerX, outerY)
          .stroke({ color: 0xffa1b3, width: 2, alpha: 0.84 });
      }
      this.body.circle(0, 0, 6).fill({ color: 0xffd5de, alpha: 0.95 });
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
      this.body
        .poly([0, this.radius * 0.2, 0, this.radius * 1.42, this.radius * 0.38, this.radius * 1.1, -this.radius * 0.38, this.radius * 1.1])
        .fill({ color: 0xffd0c4, alpha: 0.85 });
      return;
    }

    if (this.kind === "energy") {
      this.radius = 14;
      this.body
        .poly([
          0,
          -this.radius * 1.15,
          this.radius * 0.55,
          -this.radius * 0.44,
          this.radius * 0.84,
          this.radius * 0.12,
          0,
          this.radius * 0.18,
          -this.radius * 0.84,
          this.radius * 0.12,
          -this.radius * 0.55,
          -this.radius * 0.44
        ])
        .fill(0xf6b95f)
        .stroke({ color: 0xffe3a2, width: 2, alpha: 0.92 });
      this.body
        .poly([
          0,
          -this.radius * 0.76,
          this.radius * 0.28,
          -this.radius * 0.22,
          0,
          this.radius * 0.44,
          -this.radius * 0.28,
          -this.radius * 0.22
        ])
        .fill({ color: 0xfff4d1, alpha: 0.75 });
      this.body
        .poly([
          0,
          -this.radius * 0.98,
          this.radius * 0.3,
          -this.radius * 0.22,
          -this.radius * 0.3,
          -this.radius * 0.22
        ])
        .fill({ color: 0xffffff, alpha: 0.34 });
      this.body
        .poly([0, -this.radius * 1.22, this.radius * 0.08, -this.radius * 1.02, -this.radius * 0.08, -this.radius * 1.02])
        .fill({ color: 0xffffff, alpha: 0.9 });
      return;
    }

    if (this.kind === "boost") {
      this.radius = 15;
      this.drawAura(0x7db8ff, 25, 0.2);
      this.body
        .roundRect(-13, -13, 26, 26, 9)
        .fill(0x6faeff)
        .stroke({ color: 0xd8edff, width: 2, alpha: 0.92 });
      this.body
        .poly([-4, -8, 2, -8, -1, -1, 6, -1, -4, 9, -1, 2, -7, 2])
        .fill({ color: 0xffffff, alpha: 0.94 });
      return;
    }

    if (this.kind === "shield") {
      this.radius = 15;
      this.drawAura(0x79d7ff, 24, 0.2);
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
      this.drawAura(0x73fff0, 23, 0.19);
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

    if (this.kind === "life") {
      this.radius = 13;
      this.drawAura(0xff7ea0, 24, 0.2);
      this.body
        .circle(-5, -3, 7.2)
        .fill(0xff6c8f)
        .circle(5, -3, 7.2)
        .fill(0xff6c8f)
        .poly([0, 13, -11, 0, 11, 0])
        .fill(0xff6c8f)
        .stroke({ color: 0xffd2df, width: 2, alpha: 0.85 });
      this.body
        .rect(-1.5, -7, 3, 14)
        .fill({ color: 0xffffff, alpha: 0.88 });
      this.body
        .rect(-7, -1.5, 14, 3)
        .fill({ color: 0xffffff, alpha: 0.88 });
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

  private drawAura(color: number, radius: number, alpha: number): void {
    this.aura.circle(0, 0, radius).fill({ color, alpha });
  }

  private animateVisuals(): void {
    const pulseFast = Math.sin(this.age * 8 + this.driftPhase);
    const pulseSlow = Math.sin(this.age * 4 + this.driftPhase);
    const isHazard = this.kind === "enemy" || this.kind === "mine" || this.kind === "dart";

    if (isHazard) {
      this.scale.set(1 + pulseFast * 0.028);
      this.aura.alpha = 0.9 + pulseSlow * 0.12;
      return;
    }

    this.scale.set(1 + pulseFast * 0.055);
    this.aura.alpha = 0.94 + pulseSlow * 0.16;
  }
}
