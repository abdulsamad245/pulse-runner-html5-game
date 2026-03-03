import { Graphics, Text } from "pixi.js";
import { Scene } from "../../core/Scene";
import { GAME_CONFIG } from "../config";
import { clamp } from "../math";
import type { LeaderboardEntry } from "../services/LeaderboardService";
import { TextButton } from "../ui/TextButton";
import { PlayScene } from "./PlayScene";

/** Main menu scene with title panel, controls hint, and persistent leaderboard. */
export class MenuScene extends Scene {
  private readonly backdrop = new Graphics();
  private readonly skyline = new Graphics();
  private readonly laneGlow = new Graphics();
  private readonly vignette = new Graphics();
  private readonly ambient = new Graphics();
  private readonly panelMask = new Graphics();
  private readonly panel = new Graphics();
  private readonly title = new Text({
    text: GAME_CONFIG.title,
    style: {
      fill: 0xf5ffff,
      fontFamily: "Chakra Petch",
      fontSize: 72,
      fontWeight: "700",
      letterSpacing: 2
    }
  });
  private readonly subtitle = new Text({
    text: "Dodge spikes, chain shards, hunt near-misses, trigger shield rush.",
    style: {
      fill: 0xbfcef0,
      fontFamily: "IBM Plex Mono",
      fontSize: 17,
      align: "center",
      wordWrap: true
    }
  });
  private readonly hint = new Text({
    text: "Move: Mouse / Touch / Arrow Keys / A-D",
    style: {
      fill: 0x8ab4e8,
      fontFamily: "IBM Plex Mono",
      fontSize: 15,
      align: "center",
      wordWrap: true
    }
  });
  private readonly startButton = new TextButton("START RUN");
  private readonly highScore = new Text({
    text: "Best 000000",
    style: {
      fill: 0xffe4ab,
      fontFamily: "IBM Plex Mono",
      fontSize: 20
    }
  });
  private readonly platform = new Text({
    text: "",
    style: {
      fill: 0xa4beec,
      fontFamily: "IBM Plex Mono",
      fontSize: 15
    }
  });
  private readonly cta = new Text({
    text: "Press Enter to start instantly",
    style: {
      fill: 0x7fc8ff,
      fontFamily: "IBM Plex Mono",
      fontSize: 14
    }
  });
  private readonly leaderboardTitle = new Text({
    text: "LEADERBOARD",
    style: {
      fill: 0x7dfddf,
      fontFamily: "IBM Plex Mono",
      fontSize: 16,
      letterSpacing: 1
    }
  });
  private readonly leaderboardRows = Array.from(
    { length: 5 },
    () =>
      new Text({
        text: "--",
        style: {
          fill: 0xd5e8ff,
          fontFamily: "IBM Plex Mono",
          fontSize: 14
        }
      })
  );

  private pulse = 0;
  private widthPx = 0;
  private heightPx = 0;
  private titleBaseY = 0;
  private startButtonBaseY = 0;

  enter(): void {
    this.title.anchor.set(0.5);
    this.subtitle.anchor.set(0.5);
    this.hint.anchor.set(0.5);
    this.highScore.anchor.set(0.5);
    this.platform.anchor.set(0.5);
    this.cta.anchor.set(0.5);
    this.leaderboardTitle.anchor.set(0.5);
    for (const row of this.leaderboardRows) {
      row.anchor.set(0.5);
    }

    this.startButton.on("pointertap", this.onStart);
    window.addEventListener("keydown", this.onKeyDown);
    this.ambient.mask = this.panelMask;

    const best = Math.floor(this.game.services.storage.getNumber("highScore", 0));
    this.highScore.text = `Best ${best.toString().padStart(6, "0")}`;
    this.platform.text = GAME_CONFIG.title;
    this.refreshLeaderboard();

    this.root.addChild(
      this.backdrop,
      this.skyline,
      this.laneGlow,
      this.vignette,
      this.ambient,
      this.panelMask,
      this.panel,
      this.title,
      this.subtitle,
      this.hint,
      this.startButton,
      this.highScore,
      this.platform,
      this.cta,
      this.leaderboardTitle
    );
    this.root.addChild(...this.leaderboardRows);
  }

  exit(): void {
    this.startButton.off("pointertap", this.onStart);
    window.removeEventListener("keydown", this.onKeyDown);
    this.ambient.mask = null;
  }

  resize(width: number, height: number): void {
    this.widthPx = width;
    this.heightPx = height;
    this.layout();
  }

  update(deltaSeconds: number): void {
    this.pulse += deltaSeconds;
    const breathing = 1 + Math.sin(this.pulse * 2.4) * 0.02;
    this.startButton.scale.set(breathing);
    this.title.position.y = this.titleBaseY + Math.sin(this.pulse * 1.5) * 2.2;
    this.startButton.position.y = this.startButtonBaseY + Math.sin(this.pulse * 2.4) * 0.8;
    this.laneGlow.alpha = 0.72 + Math.sin(this.pulse * 1.2) * 0.12;
    this.redrawAmbient();
  }

  private readonly onStart = (): void => {
    this.game.services.sound.play("uiTap");
    this.game.switchScene(new PlayScene(this.game));
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.code === "Enter" || event.code === "Space") {
      event.preventDefault();
      this.onStart();
    }
  };

  private refreshLeaderboard(): void {
    const entries = this.game.services.leaderboard.list(5);
    this.renderLeaderboard(entries);
  }

  /** Render fixed-length leaderboard rows with placeholders for empty slots. */
  private renderLeaderboard(entries: LeaderboardEntry[]): void {
    for (let i = 0; i < this.leaderboardRows.length; i += 1) {
      const row = this.leaderboardRows[i];
      const entry = entries[i];
      if (!entry) {
        row.text = `${i + 1}. ---`;
        row.alpha = 0.5;
        continue;
      }

      row.alpha = 1;
      const compact = this.widthPx < 760 || this.heightPx < 640;
      const tag = entry.name
        .toUpperCase()
        .slice(0, compact ? 7 : 10)
        .padEnd(compact ? 7 : 10, " ");
      row.text = `${i + 1}. ${tag} ${entry.score.toString().padStart(6, "0")} L${entry.levelReached
        .toString()
        .padStart(2, "0")}`;
    }
  }

  private layout(): void {
    const compact = this.widthPx < 760 || this.heightPx < 640;
    const uiScale = clamp(Math.min(this.widthPx / 1280, this.heightPx / 720), 0.62, 1);
    this.drawBackdrop();

    this.title.style.fontSize = compact ? 44 : 72;
    this.subtitle.style.fontSize = compact ? 13 : 17;
    this.hint.style.fontSize = compact ? 12 : 15;
    this.highScore.style.fontSize = compact ? 16 : 20;
    this.platform.style.fontSize = compact ? 12 : 15;
    this.cta.style.fontSize = compact ? 11 : 14;
    this.leaderboardTitle.style.fontSize = compact ? 13 : 16;

    for (const row of this.leaderboardRows) {
      row.style.fontSize = compact ? 11 : 14;
    }

    this.startButton.setSize(compact ? 190 : 240, compact ? 48 : 62, compact ? 20 : 24);

    const panelWidth = Math.min(this.widthPx * 0.94, 820);
    const panelHeight = compact ? Math.min(this.heightPx * 0.77, 520) : Math.min(this.heightPx * 0.75, 560);
    const panelX = this.widthPx * 0.5 - panelWidth * 0.5;
    const panelY = this.heightPx * 0.53 - panelHeight * 0.5;
    const contentWidth = panelWidth - (compact ? 44 : 70);

    this.subtitle.style.wordWrapWidth = contentWidth;
    this.hint.style.wordWrapWidth = contentWidth;

    this.panelMask.clear();
    this.panelMask.roundRect(panelX, panelY, panelWidth, panelHeight, 24).fill(0xffffff);

    this.panel.clear();
    this.panel
      .roundRect(panelX, panelY, panelWidth, panelHeight, 24)
      .fill({ color: 0x091a38, alpha: 0.86 })
      .stroke({ color: 0x64f8d6, width: compact ? 1.5 : 2, alpha: 0.68 });

    this.titleBaseY = panelY + panelHeight * 0.12;
    this.title.position.set(this.widthPx * 0.5, this.titleBaseY);
    const subtitleTop = panelY + panelHeight * 0.25;
    this.subtitle.position.set(this.widthPx * 0.5, subtitleTop);
    this.hint.position.set(this.widthPx * 0.5, subtitleTop + this.subtitle.height * 0.5 + (compact ? 16 : 18));
    this.startButtonBaseY = panelY + panelHeight * (compact ? 0.43 : 0.41);
    this.startButton.position.set(this.widthPx * 0.5, this.startButtonBaseY);
    const buttonBottomGap = compact ? 54 : 68;
    this.highScore.position.set(this.widthPx * 0.5, this.startButtonBaseY + buttonBottomGap);
    this.platform.position.set(this.widthPx * 0.5, this.startButtonBaseY + buttonBottomGap + (compact ? 28 : 34));
    this.cta.position.set(this.widthPx * 0.5, this.startButtonBaseY + buttonBottomGap + (compact ? 54 : 66));

    this.leaderboardTitle.position.set(this.widthPx * 0.5, panelY + panelHeight * 0.71);
    for (let i = 0; i < this.leaderboardRows.length; i += 1) {
      this.leaderboardRows[i].position.set(this.widthPx * 0.5, panelY + panelHeight * (0.76 + i * 0.045));
    }

    this.ambient.scale.set(uiScale);
    this.redrawAmbient();
  }

  private redrawAmbient(): void {
    this.ambient.clear();
    const pulse = 0.6 + Math.sin(this.pulse * 1.2) * 0.18;
    this.ambient.circle(this.widthPx * 0.18, this.heightPx * 0.2, 210).fill({
      color: 0x5af6d0,
      alpha: 0.08 * pulse
    });
    this.ambient.circle(this.widthPx * 0.84, this.heightPx * 0.14, 160).fill({
      color: 0xffd980,
      alpha: 0.06 * pulse
    });
    this.ambient.circle(this.widthPx * 0.86, this.heightPx * 0.85, 190).fill({
      color: 0x78bfff,
      alpha: 0.05 * pulse
    });
  }

  /** Draw a layered stylized backdrop to add depth behind the menu card. */
  private drawBackdrop(): void {
    this.backdrop.clear();
    this.backdrop
      .rect(0, 0, this.widthPx, this.heightPx)
      .fill(0x050c15)
      .rect(0, this.heightPx * 0.58, this.widthPx, this.heightPx * 0.42)
      .fill(0x071221)
      .rect(0, this.heightPx * 0.48, this.widthPx, this.heightPx * 0.12)
      .fill({ color: 0x0a1d33, alpha: 0.7 });

    this.skyline.clear();
    const columnCount = Math.max(10, Math.floor(this.widthPx / 90));
    const step = this.widthPx / columnCount;
    for (let i = 0; i < columnCount; i += 1) {
      const x = i * step;
      const h = 30 + ((i * 31) % 120);
      this.skyline
        .rect(x, this.heightPx * 0.58 - h, step - 2, h)
        .fill({ color: 0x0f2742, alpha: 0.42 });
    }

    this.laneGlow.clear();
    this.laneGlow
      .poly([
        this.widthPx * 0.08,
        this.heightPx,
        this.widthPx * 0.45,
        this.heightPx * 0.49,
        this.widthPx * 0.55,
        this.heightPx * 0.49,
        this.widthPx * 0.92,
        this.heightPx
      ])
      .fill({ color: 0x0b2845, alpha: 0.44 });

    this.laneGlow
      .moveTo(this.widthPx * 0.2, this.heightPx)
      .lineTo(this.widthPx * 0.48, this.heightPx * 0.52)
      .stroke({ color: 0x5ce7cb, alpha: 0.23, width: 2 });
    this.laneGlow
      .moveTo(this.widthPx * 0.8, this.heightPx)
      .lineTo(this.widthPx * 0.52, this.heightPx * 0.52)
      .stroke({ color: 0x7bc2ff, alpha: 0.24, width: 2 });

    this.vignette.clear();
    this.vignette
      .rect(0, 0, this.widthPx, this.heightPx)
      .fill({ color: 0x000000, alpha: 0.2 })
      .cut();
    this.vignette.circle(this.widthPx * 0.5, this.heightPx * 0.45, this.widthPx * 0.48).fill(0x000000);
    this.vignette.alpha = 0.22;
  }
}
