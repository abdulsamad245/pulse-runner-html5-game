import { Container, Graphics, Text } from "pixi.js";

/** Reusable interactive text button for scene UI flows. */
export class TextButton extends Container {
  private readonly background = new Graphics();
  private readonly labelText: Text;
  private widthPx: number;
  private heightPx: number;

  constructor(label: string, width = 220, height = 58) {
    super();
    this.widthPx = width;
    this.heightPx = height;

    this.labelText = new Text({
      text: label,
      style: {
        fill: 0xe8f6ff,
        fontFamily: "Chakra Petch",
        fontWeight: "700",
        fontSize: 24,
        letterSpacing: 1
      }
    });
    this.labelText.anchor.set(0.5);

    this.eventMode = "static";
    this.cursor = "pointer";
    this.addChild(this.background, this.labelText);

    this.redraw(0x182846, 0x6effdc);

    this.on("pointerover", () => this.redraw(0x223c69, 0xb5ffe8));
    this.on("pointerout", () => this.redraw(0x182846, 0x6effdc));
    this.on("pointerdown", () => {
      this.scale.set(0.98);
    });
    this.on("pointerup", () => {
      this.scale.set(1);
    });
    this.on("pointerupoutside", () => {
      this.scale.set(1);
    });
  }

  /** Update the visible button label. */
  setLabel(label: string): void {
    this.labelText.text = label;
  }

  /** Resize button bounds and text for responsive layouts. */
  setSize(width: number, height: number, fontSize = 24): void {
    this.widthPx = width;
    this.heightPx = height;
    this.labelText.style.fontSize = fontSize;
    this.redraw(0x182846, 0x6effdc);
  }

  private redraw(bgColor: number, borderColor: number): void {
    this.background.clear();
    this.background
      .roundRect(-this.widthPx * 0.5, -this.heightPx * 0.5, this.widthPx, this.heightPx, 14)
      .fill({ color: bgColor, alpha: 0.95 })
      .stroke({ color: borderColor, alpha: 0.9, width: 2 });

    this.labelText.position.set(0, 0);
  }
}
