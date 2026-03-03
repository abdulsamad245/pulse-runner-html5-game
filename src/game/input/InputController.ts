import { Rectangle, type Container, type FederatedPointerEvent } from "pixi.js";

/**
 * Unifies pointer and keyboard movement input into a single horizontal control API.
 */
export class InputController {
  private pointerX = 0;
  private leftPressed = false;
  private rightPressed = false;
  private pointerControlActive = true;

  constructor(private readonly stage: Container, initialWidth: number, initialHeight: number) {
    this.pointerX = initialWidth * 0.5;
    this.stage.eventMode = "static";
    this.stage.hitArea = new Rectangle(0, 0, initialWidth, initialHeight);
    this.stage.on("pointermove", this.onPointerMove);
    this.stage.on("pointerdown", this.onPointerMove);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
  }

  resize(width: number, height: number): void {
    this.stage.hitArea = new Rectangle(0, 0, width, height);
  }

  /** Latest pointer x-coordinate in world space. */
  getPointerX(): number {
    return this.pointerX;
  }

  /** Keyboard-only axis value in the `[-1, 1]` range. */
  getHorizontalAxis(): number {
    const left = this.leftPressed ? -1 : 0;
    const right = this.rightPressed ? 1 : 0;
    return left + right;
  }

  /** True when pointer/mouse is the active control source. */
  isPointerControlActive(): boolean {
    return this.pointerControlActive;
  }

  destroy(): void {
    this.stage.off("pointermove", this.onPointerMove);
    this.stage.off("pointerdown", this.onPointerMove);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
  }

  private readonly onPointerMove = (event: FederatedPointerEvent): void => {
    this.pointerX = event.global.x;
    this.pointerControlActive = true;
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.code === "ArrowLeft" || event.code === "KeyA") {
      this.leftPressed = true;
      this.pointerControlActive = false;
    }
    if (event.code === "ArrowRight" || event.code === "KeyD") {
      this.rightPressed = true;
      this.pointerControlActive = false;
    }
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    if (event.code === "ArrowLeft" || event.code === "KeyA") {
      this.leftPressed = false;
    }
    if (event.code === "ArrowRight" || event.code === "KeyD") {
      this.rightPressed = false;
    }
  };
}
