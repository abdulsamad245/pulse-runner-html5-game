import { Graphics, Text } from "pixi.js";
import { Scene } from "../../core/Scene";
import { clamp } from "../math";
import type { LeaderboardEntry } from "../services/LeaderboardService";
import { TextButton } from "../ui/TextButton";
import { MenuScene } from "./MenuScene";
import { PlayScene } from "./PlayScene";

/** Final run summary passed from gameplay scene into the game-over scene. */
export interface GameOverData {
  score: number;
  bestScore: number;
  survivalTime: number;
  playerName: string;
  leaderboard: LeaderboardEntry[];
}

/** End-of-run modal scene with replay/menu actions and leaderboard preview. */
export class GameOverScene extends Scene {
  private readonly ambient = new Graphics();
  private readonly overlay = new Graphics();
  private readonly panel = new Graphics();
  private readonly title = new Text({
    text: "Game Over",
    style: {
      fill: 0xf3fdff,
      fontFamily: "Chakra Petch",
      fontSize: 62,
      fontWeight: "700",
      letterSpacing: 2
    }
  });
  private readonly scoreText = new Text({
    text: "",
    style: {
      fill: 0xffe3a4,
      fontFamily: "IBM Plex Mono",
      fontSize: 21,
      align: "center",
      wordWrap: true
    }
  });
  private readonly bestText = new Text({
    text: "",
    style: {
      fill: 0xbee7ff,
      fontFamily: "IBM Plex Mono",
      fontSize: 18
    }
  });
  private readonly quickHint = new Text({
    text: "Enter: Run again | M: Main menu",
    style: {
      fill: 0x7bc7ff,
      fontFamily: "IBM Plex Mono",
      fontSize: 13
    }
  });
  private readonly leaderboardTitle = new Text({
    text: "Top Runs",
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
  private readonly restart = new TextButton("PLAY AGAIN");
  private readonly menu = new TextButton("MAIN MENU");
  private pulse = 0;
  private widthPx = 0;
  private heightPx = 0;
  private titleBaseY = 0;
  private visibleLeaderboardRows = 5;
  private relayoutRafId = 0;
  private warmupLayoutFrames = 0;

  constructor(game: Scene["game"], private readonly data: GameOverData) {
    super(game);
  }

  enter(): void {
    this.title.anchor.set(0.5);
    this.scoreText.anchor.set(0.5);
    this.bestText.anchor.set(0.5);
    this.quickHint.anchor.set(0.5);
    this.leaderboardTitle.anchor.set(0.5);
    for (const row of this.leaderboardRows) {
      row.anchor.set(0.5);
    }

    this.scoreText.text = `Player ${this.data.playerName}\nScore ${this.data.score
      .toString()
      .padStart(6, "0")}  |  Time ${Math.floor(this.data.survivalTime)}s`;
    this.bestText.text = `Best ${this.data.bestScore.toString().padStart(6, "0")}`;

    this.restart.on("pointertap", this.onRestart);
    this.menu.on("pointertap", this.onMenu);
    window.addEventListener("keydown", this.onKeyDown);
    this.renderLeaderboard();

    this.root.addChild(
      this.ambient,
      this.overlay,
      this.panel,
      this.title,
      this.scoreText,
      this.bestText,
      this.quickHint,
      this.leaderboardTitle,
      this.restart,
      this.menu
    );
    this.root.addChild(...this.leaderboardRows);

    this.warmupLayoutFrames = 20;
    this.resize(this.game.width, this.game.height);
    this.scheduleRelayout();
  }

  exit(): void {
    this.restart.off("pointertap", this.onRestart);
    this.menu.off("pointertap", this.onMenu);
    window.removeEventListener("keydown", this.onKeyDown);
    if (this.relayoutRafId) {
      cancelAnimationFrame(this.relayoutRafId);
      this.relayoutRafId = 0;
    }
  }

  resize(width: number, height: number): void {
    this.widthPx = width;
    this.heightPx = height;
    this.layout();
  }

  update(deltaSeconds: number): void {
    if (this.warmupLayoutFrames > 0) {
      // Re-layout for a few frames to absorb late renderer/font sizing updates.
      const liveWidth = this.game.width || window.innerWidth;
      const liveHeight = this.game.height || window.innerHeight;
      if (liveWidth !== this.widthPx || liveHeight !== this.heightPx) {
        this.resize(liveWidth, liveHeight);
      } else {
        this.layout();
      }
      this.warmupLayoutFrames -= 1;
    }

    this.pulse += deltaSeconds;
    this.title.position.y = this.titleBaseY + Math.sin(this.pulse * 1.8) * 2.2;
    this.drawAmbient();
  }

  private readonly onRestart = (): void => {
    this.game.services.sound.play("uiTap");
    this.game.switchScene(new PlayScene(this.game));
  };

  private readonly onMenu = (): void => {
    this.game.services.sound.play("uiTap");
    this.game.switchScene(new MenuScene(this.game));
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.code === "Enter" || event.code === "Space") {
      event.preventDefault();
      this.onRestart();
      return;
    }
    if (event.code === "KeyM") {
      event.preventDefault();
      this.onMenu();
    }
  };

  private layout(): void {
    const compact = this.widthPx < 760 || this.heightPx < 640;
    const uiScale = clamp(Math.min(this.widthPx / 1280, this.heightPx / 720), 0.62, 1);
    this.visibleLeaderboardRows = compact ? 3 : 5;
    this.renderLeaderboard();

    this.title.style.fontSize = compact ? 42 : 62;
    this.scoreText.style.fontSize = compact ? 12 : 21;
    this.bestText.style.fontSize = compact ? 15 : 18;
    this.quickHint.style.fontSize = compact ? 11 : 13;
    this.leaderboardTitle.style.fontSize = compact ? 13 : 16;

    for (const row of this.leaderboardRows) {
      row.style.fontSize = compact ? 11 : 14;
    }

    this.restart.setSize(compact ? 180 : 220, compact ? 46 : 58, compact ? 18 : 24);
    this.menu.setSize(compact ? 180 : 220, compact ? 46 : 58, compact ? 18 : 24);

    const panelWidth = Math.min(this.widthPx * 0.94, 840);
    const panelHeight = compact ? Math.min(this.heightPx * 0.8, 520) : Math.min(this.heightPx * 0.74, 560);
    const panelX = this.widthPx * 0.5 - panelWidth * 0.5;
    const panelY = this.heightPx * 0.56 - panelHeight * 0.5;
    const contentWidth = panelWidth - (compact ? 36 : 70);
    this.scoreText.style.wordWrapWidth = contentWidth;

    this.overlay.clear();
    this.overlay.rect(0, 0, this.widthPx, this.heightPx).fill({ color: 0x03070f, alpha: 0.66 });

    this.panel.clear();
    this.panel
      .roundRect(panelX, panelY, panelWidth, panelHeight, 22)
      .fill({ color: 0x0a1935, alpha: 0.9 })
      .stroke({ color: 0x7dfddf, alpha: 0.62, width: compact ? 1.5 : 2 });

    this.titleBaseY = panelY + panelHeight * 0.13;
    this.title.position.set(this.widthPx * 0.5, this.titleBaseY);
    this.scoreText.position.set(this.widthPx * 0.5, panelY + panelHeight * 0.25);
    this.bestText.position.set(this.widthPx * 0.5, panelY + panelHeight * 0.34);
    this.quickHint.position.set(this.widthPx * 0.5, panelY + panelHeight * 0.4);
    this.leaderboardTitle.position.set(this.widthPx * 0.5, panelY + panelHeight * 0.49);

    const rowsStartY = panelY + panelHeight * 0.55;
    const rowSpacing = compact ? 24 : 30;
    for (let i = 0; i < this.leaderboardRows.length; i += 1) {
      this.leaderboardRows[i].visible = i < this.visibleLeaderboardRows;
      this.leaderboardRows[i].position.set(this.widthPx * 0.5, rowsStartY + i * rowSpacing);
    }

    const footerY = panelY + panelHeight - (compact ? 72 : 58);
    this.restart.position.set(this.widthPx * 0.38, footerY);
    this.menu.position.set(this.widthPx * 0.62, footerY);

    if (compact) {
      this.restart.position.set(this.widthPx * 0.5, footerY - 30);
      this.menu.position.set(this.widthPx * 0.5, footerY + 24);
    }

    this.ambient.scale.set(uiScale);
    this.drawAmbient();
  }

  private renderLeaderboard(): void {
    for (let i = 0; i < this.leaderboardRows.length; i += 1) {
      const row = this.leaderboardRows[i];
      if (i >= this.visibleLeaderboardRows) {
        row.visible = false;
        continue;
      }
      const entry = this.data.leaderboard[i];
      if (!entry) {
        row.text = `${i + 1}. ---`;
        row.alpha = 0.5;
        row.visible = true;
        continue;
      }

      row.alpha = 1;
      row.visible = true;
      const tag = entry.name.toUpperCase().slice(0, 10).padEnd(10, " ");
      row.text = `${i + 1}. ${tag} ${entry.score.toString().padStart(6, "0")} (${Math.floor(entry.survivalTime)}s)`;
    }
  }

  private drawAmbient(): void {
    this.ambient.clear();
    const pulse = 0.7 + Math.sin(this.pulse * 1.5) * 0.2;
    this.ambient.circle(this.widthPx * 0.16, this.heightPx * 0.18, 160).fill({
      color: 0x6af9dc,
      alpha: 0.06 * pulse
    });
    this.ambient.circle(this.widthPx * 0.84, this.heightPx * 0.2, 170).fill({
      color: 0xffdb8c,
      alpha: 0.05 * pulse
    });
    this.ambient.circle(this.widthPx * 0.76, this.heightPx * 0.84, 150).fill({
      color: 0x78b8ff,
      alpha: 0.05 * pulse
    });
  }

  private scheduleRelayout(): void {
    let remainingFrames = 3;

    const relayout = (): void => {
      this.layout();
      remainingFrames -= 1;
      if (remainingFrames > 0) {
        this.relayoutRafId = requestAnimationFrame(relayout);
      } else {
        this.relayoutRafId = 0;
      }
    };

    this.relayoutRafId = requestAnimationFrame(relayout);

    // Ensure final text metrics after webfonts are ready.
    if ("fonts" in document) {
      void document.fonts.ready.then(() => {
        this.layout();
        this.warmupLayoutFrames = Math.max(this.warmupLayoutFrames, 10);
      });
    }
  }
}
