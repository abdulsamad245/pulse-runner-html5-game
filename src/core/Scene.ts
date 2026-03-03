import { Container } from "pixi.js";
import type { GameApp } from "./GameApp";

/**
 * Base scene contract used by the scene manager in `GameApp`.
 * Subclasses override lifecycle methods as needed.
 */
export abstract class Scene {
  readonly root = new Container();

  constructor(protected readonly game: GameApp) {}

  /** Called once after the scene is attached to the stage. */
  enter(): void {}

  /** Called before the scene is removed from the stage. */
  exit(): void {}

  /** Called whenever the renderer size changes. */
  resize(_width: number, _height: number): void {}

  /** Called on every frame tick with a clamped delta in seconds. */
  update(_deltaSeconds: number): void {}

  /** Destroys the scene container and all children. */
  destroy(): void {
    this.root.destroy({ children: true });
  }
}
