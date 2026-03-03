import { Container, Graphics } from "pixi.js";
import { clamp } from "../math";

/** Player ship actor with pointer/keyboard blended movement. */
export class Player extends Container {
  readonly radius = 22;
  private readonly trail = new Graphics();
  private readonly glow = new Graphics();
  private readonly body = new Graphics();
  private readonly cockpit = new Graphics();
  private pointerX = 0;
  private readonly speed = 520;
  private bank = 0;
  private animTime = 0;

  constructor() {
    super();
    this.addChild(this.trail, this.glow, this.body, this.cockpit);
    this.draw();
  }

  setPointerX(pointerX: number): void {
    this.pointerX = pointerX;
  }

  /** Move the player within horizontal bounds. */
  update(deltaSeconds: number, inputAxis: number, width: number, pointerControlActive: boolean): void {
    const startX = this.x;
    const manualTarget = this.x + inputAxis * this.speed * deltaSeconds;
    const pointerTarget = this.pointerX;
    const shouldFollowPointer = pointerControlActive && inputAxis === 0;
    const desiredX = shouldFollowPointer ? pointerTarget : manualTarget;
    const smoothing = shouldFollowPointer ? 1 - Math.exp(-16 * deltaSeconds) : 1;

    this.x += (desiredX - this.x) * smoothing;
    this.x = clamp(this.x, this.radius + 24, width - this.radius - 24);

    const velocityX = (this.x - startX) / Math.max(0.0001, deltaSeconds);
    const normalizedVelocity = clamp(velocityX / this.speed, -1, 1);
    const bankSmoothing = 1 - Math.exp(-12 * deltaSeconds);
    this.bank += (normalizedVelocity - this.bank) * bankSmoothing;
    this.rotation = this.bank * 0.16;

    this.animTime += deltaSeconds;
    this.animateShip(Math.abs(normalizedVelocity));
  }

  /** Visual feedback used during short invulnerability windows. */
  setInvulnerable(active: boolean): void {
    this.alpha = active ? 0.5 : 1;
    this.glow.alpha = active ? 0.55 : 1;
  }

  private draw(): void {
    this.trail.clear();
    this.redrawTrail(0.1);

    this.glow
      .ellipse(0, 4, this.radius + 13, this.radius + 7)
      .fill({ color: 0x64ffe1, alpha: 0.16 })
      .stroke({ color: 0x7ffff0, width: 1.5, alpha: 0.42 });

    this.body
      .poly([-30, 2, -17, -12, 0, -20, 17, -12, 30, 2, 17, 17, 0, 22, -17, 17])
      .fill(0x61f7d7)
      .stroke({ color: 0xc8fff2, width: 2, alpha: 0.92 });
    this.body
      .poly([-23, 9, -31, 16, -15, 14])
      .fill({ color: 0x37c8b2, alpha: 0.95 });
    this.body
      .poly([23, 9, 31, 16, 15, 14])
      .fill({ color: 0x37c8b2, alpha: 0.95 });
    this.body
      .roundRect(-8, 3, 16, 11, 5)
      .fill({ color: 0x15363d, alpha: 0.78 });

    this.cockpit.clear();
    this.cockpit
      .poly([-11, -4, 0, -15, 11, -4, 7, 7, -7, 7])
      .fill(0x123649)
      .stroke({ color: 0x9deaff, width: 1.6, alpha: 0.85 });
    this.cockpit
      .poly([-3, -8, 0, -11.5, 3, -8, 2, -3, -2, -3])
      .fill({ color: 0xf0feff, alpha: 0.85 });
  }

  private animateShip(speedFactor: number): void {
    const pulse = 0.94 + Math.sin(this.animTime * 8) * 0.06;
    this.glow.scale.set(1 + speedFactor * 0.08 + (pulse - 0.94) * 0.5);
    this.cockpit.alpha = 0.88 + Math.sin(this.animTime * 10) * 0.08;
    this.redrawTrail(speedFactor);
  }

  private redrawTrail(speedFactor: number): void {
    const length = 14 + speedFactor * 22;
    const width = 7 + speedFactor * 5;
    this.trail.clear();
    this.trail
      .poly([-width * 0.45, 14, width * 0.45, 14, width, 14 + length, 0, 22 + length, -width, 14 + length])
      .fill({ color: 0x5df6d2, alpha: 0.3 + speedFactor * 0.2 });
    this.trail
      .poly([-width * 0.22, 15, width * 0.22, 15, width * 0.5, 13 + length * 0.84, 0, 18 + length, -width * 0.5, 13 + length * 0.84])
      .fill({ color: 0xcbfff1, alpha: 0.36 + speedFactor * 0.25 });
  }
}
