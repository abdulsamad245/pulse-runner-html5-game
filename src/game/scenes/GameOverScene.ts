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
  levelReached: number;
  runId: string;
  defaultPlayerName: string;
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
    text: "Enter: Run again | M: Main menu | Name is optional",
    style: {
      fill: 0x7bc7ff,
      fontFamily: "IBM Plex Mono",
      fontSize: 13
    }
  });
  private readonly nameLabel = new Text({
    text: "Leaderboard name",
    style: {
      fill: 0x9de6ff,
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
  private readonly saveName = new TextButton("SAVE NAME", 160, 42);
  private pulse = 0;
  private widthPx = 0;
  private heightPx = 0;
  private titleBaseY = 0;
  private visibleLeaderboardRows = 5;
  private relayoutRafId = 0;
  private warmupLayoutFrames = 0;
  private nameInput: HTMLInputElement | null = null;

  constructor(game: Scene["game"], private readonly data: GameOverData) {
    super(game);
  }

  enter(): void {
    this.title.anchor.set(0.5);
    this.scoreText.anchor.set(0.5);
    this.bestText.anchor.set(0.5);
    this.quickHint.anchor.set(0.5);
    this.nameLabel.anchor.set(0.5);
    this.leaderboardTitle.anchor.set(0.5);
    for (const row of this.leaderboardRows) {
      row.anchor.set(0.5);
    }

    this.scoreText.text = `${this.getDisplayPlayerName()}\nScore ${this.data.score
      .toString()
      .padStart(6, "0")}  |  Time ${Math.floor(this.data.survivalTime)}s  |  Level ${this.data.levelReached}`;
    this.bestText.text = `Best ${this.data.bestScore.toString().padStart(6, "0")}`;

    this.restart.on("pointertap", this.onRestart);
    this.menu.on("pointertap", this.onMenu);
    this.saveName.on("pointertap", this.onSaveName);
    window.addEventListener("keydown", this.onKeyDown);
    this.renderLeaderboard();
    this.mountNameInput();

    this.root.addChild(
      this.ambient,
      this.overlay,
      this.panel,
      this.title,
      this.scoreText,
      this.bestText,
      this.quickHint,
      this.nameLabel,
      this.saveName,
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
    this.saveName.off("pointertap", this.onSaveName);
    window.removeEventListener("keydown", this.onKeyDown);
    if (this.relayoutRafId) {
      cancelAnimationFrame(this.relayoutRafId);
      this.relayoutRafId = 0;
    }
    this.clearNameInput();
    this.unmountNameInput();
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
    this.persistName(false, true);
    this.game.services.sound.play("uiTap");
    this.game.switchScene(new PlayScene(this.game));
  };

  private readonly onMenu = (): void => {
    this.persistName(false, true);
    this.game.services.sound.play("uiTap");
    this.game.switchScene(new MenuScene(this.game));
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (this.nameInput && document.activeElement === this.nameInput) {
      if (event.code === "Enter") {
        event.preventDefault();
        this.onSaveName();
      }
      return;
    }

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
    const ultraCompact = this.widthPx < 420 || this.heightPx < 560;
    const uiScale = clamp(Math.min(this.widthPx / 1280, this.heightPx / 720), 0.62, 1);
    this.visibleLeaderboardRows = ultraCompact ? 1 : compact ? 2 : 4;
    this.renderLeaderboard();

    this.title.style.fontSize = ultraCompact ? 34 : compact ? 42 : 62;
    this.scoreText.style.fontSize = ultraCompact ? 11 : compact ? 12 : 21;
    this.bestText.style.fontSize = ultraCompact ? 12 : compact ? 15 : 18;
    this.quickHint.style.fontSize = compact ? 11 : 13;
    this.nameLabel.style.fontSize = ultraCompact ? 10 : compact ? 11 : 13;
    this.leaderboardTitle.style.fontSize = ultraCompact ? 12 : compact ? 13 : 16;
    this.quickHint.visible = !ultraCompact;

    for (const row of this.leaderboardRows) {
      row.style.fontSize = ultraCompact ? 10 : compact ? 11 : 14;
    }

    const actionButtonWidth = ultraCompact ? 160 : compact ? 180 : 220;
    const actionButtonHeight = ultraCompact ? 42 : compact ? 46 : 58;
    const actionButtonFont = ultraCompact ? 16 : compact ? 18 : 24;
    const saveButtonWidth = ultraCompact ? 124 : compact ? 136 : 160;
    const saveButtonHeight = ultraCompact ? 32 : compact ? 34 : 42;
    const saveButtonFont = ultraCompact ? 12 : compact ? 13 : 16;

    this.restart.setSize(actionButtonWidth, actionButtonHeight, actionButtonFont);
    this.menu.setSize(actionButtonWidth, actionButtonHeight, actionButtonFont);
    this.saveName.setSize(saveButtonWidth, saveButtonHeight, saveButtonFont);

    const panelWidth = Math.min(this.widthPx * 0.94, 840);
    const panelHeight = ultraCompact
      ? Math.min(this.heightPx * 0.9, 500)
      : compact
        ? Math.min(this.heightPx * 0.8, 520)
        : Math.min(this.heightPx * 0.74, 560);
    const panelX = this.widthPx * 0.5 - panelWidth * 0.5;
    const panelY = this.heightPx * (ultraCompact ? 0.53 : 0.56) - panelHeight * 0.5;
    const contentWidth = panelWidth - (compact ? 36 : 70);
    this.scoreText.style.wordWrapWidth = contentWidth;

    this.overlay.clear();
    this.overlay.rect(0, 0, this.widthPx, this.heightPx).fill({ color: 0x03070f, alpha: 0.66 });

    this.panel.clear();
    this.panel
      .roundRect(panelX, panelY, panelWidth, panelHeight, 22)
      .fill({ color: 0x0a1935, alpha: 0.9 })
      .stroke({ color: 0x7dfddf, alpha: 0.62, width: compact ? 1.5 : 2 });

    const panelCenterX = panelX + panelWidth * 0.5;
    const sidePadding = compact ? 18 : 30;
    const nameRowY = panelY + panelHeight * (ultraCompact ? 0.47 : compact ? 0.53 : 0.52);
    const saveButtonX = compact ? panelCenterX : panelX + panelWidth - sidePadding - saveButtonWidth * 0.5;
    const saveGap = compact ? 0 : 12;
    const inputWidth = compact
      ? Math.min(panelWidth - sidePadding * 2, 250)
      : Math.max(160, panelWidth - sidePadding * 2 - saveButtonWidth - saveGap);
    const inputLeft = compact
      ? panelCenterX - inputWidth * 0.5
      : panelX + sidePadding;
    const footerY = panelY + panelHeight - (ultraCompact ? 46 : compact ? 64 : 50);
    const actionGap = compact ? 0 : 24;
    const actionCenterDistance = compact ? 0 : actionButtonWidth * 0.5 + actionGap * 0.5;
    const rowsStartY = panelY + panelHeight * (ultraCompact ? 0.64 : 0.64);
    const rowSpacing = ultraCompact ? 21 : compact ? 24 : 30;

    this.titleBaseY = panelY + panelHeight * (ultraCompact ? 0.11 : 0.13);
    this.title.position.set(this.widthPx * 0.5, this.titleBaseY);
    this.scoreText.position.set(this.widthPx * 0.5, panelY + panelHeight * (ultraCompact ? 0.22 : 0.25));
    this.bestText.position.set(this.widthPx * 0.5, panelY + panelHeight * (ultraCompact ? 0.3 : 0.34));
    this.quickHint.position.set(this.widthPx * 0.5, panelY + panelHeight * 0.4);
    this.nameLabel.position.set(this.widthPx * 0.5, panelY + panelHeight * (ultraCompact ? 0.39 : 0.46));
    this.saveName.position.set(saveButtonX, compact ? nameRowY + (ultraCompact ? 34 : 38) : nameRowY);
    this.leaderboardTitle.position.set(this.widthPx * 0.5, panelY + panelHeight * (ultraCompact ? 0.57 : 0.58));

    for (let i = 0; i < this.leaderboardRows.length; i += 1) {
      this.leaderboardRows[i].visible = i < this.visibleLeaderboardRows;
      this.leaderboardRows[i].position.set(this.widthPx * 0.5, rowsStartY + i * rowSpacing);
    }

    if (compact) {
      this.restart.position.set(panelCenterX, footerY - 28);
      this.menu.position.set(panelCenterX, footerY + 24);
    } else {
      this.restart.position.set(panelCenterX - actionCenterDistance, footerY);
      this.menu.position.set(panelCenterX + actionCenterDistance, footerY);
    }

    this.layoutNameInput(inputLeft, nameRowY, inputWidth, compact, ultraCompact);

    this.ambient.scale.set(uiScale);
    this.drawAmbient();
  }

  private renderLeaderboard(): void {
    const compact = this.widthPx < 760 || this.heightPx < 640;
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
      const tagSize = compact ? 7 : 9;
      const tag = entry.name.toUpperCase().slice(0, tagSize).padEnd(tagSize, " ");
      const level = `L${entry.levelReached.toString().padStart(2, "0")}`;
      row.text = compact
        ? `${i + 1}. ${tag} ${entry.score.toString().padStart(6, "0")} ${level}`
        : `${i + 1}. ${tag} ${entry.score.toString().padStart(6, "0")} ${level} (${Math.floor(entry.survivalTime)}s)`;
    }
  }

  private mountNameInput(): void {
    const host = document.querySelector<HTMLDivElement>("#app");
    if (!host) {
      return;
    }

    const input = document.createElement("input");
    input.type = "text";
    input.maxLength = 16;
    input.placeholder = "Enter your name";
    input.value = this.data.playerName === this.data.defaultPlayerName ? "" : this.data.playerName;
    input.className = "leaderboard-name-input";
    input.autocomplete = "name";
    input.spellcheck = false;
    input.addEventListener("keydown", this.onNameInputKeyDown);
    host.appendChild(input);
    this.nameInput = input;
  }

  private unmountNameInput(): void {
    if (!this.nameInput) {
      return;
    }
    this.nameInput.removeEventListener("keydown", this.onNameInputKeyDown);
    this.nameInput.remove();
    this.nameInput = null;
  }

  private layoutNameInput(
    left: number,
    rowY: number,
    inputWidth: number,
    compact: boolean,
    ultraCompact: boolean
  ): void {
    if (!this.nameInput) {
      return;
    }

    const top = rowY - (compact ? (ultraCompact ? 45 : 49) : 16);

    this.nameInput.style.position = "absolute";
    this.nameInput.style.left = `${Math.round(left)}px`;
    this.nameInput.style.top = `${Math.round(top)}px`;
    this.nameInput.style.width = `${Math.round(inputWidth)}px`;
    this.nameInput.style.height = compact ? "30px" : "34px";
    this.nameInput.style.fontSize = compact ? "12px" : "14px";
  }

  private readonly onNameInputKeyDown = (event: KeyboardEvent): void => {
    if (event.code === "Enter") {
      event.preventDefault();
      this.onSaveName();
    }
  };

  private readonly onSaveName = (): void => {
    this.persistName(true, true);
  };

  private persistName(playSound: boolean, clearInputAfter = false): void {
    const preferredName = this.nameInput?.value ?? "";
    const fallbackName = this.data.defaultPlayerName;
    const updated = this.game.services.leaderboard.updateRunName(
      this.data.runId,
      preferredName,
      fallbackName,
      10
    );
    this.game.services.storage.setObject("playerAlias", preferredName.trim());
    const current = updated.find((entry) => entry.runId === this.data.runId);
    const appliedName = current?.name ?? (preferredName.trim() || fallbackName);
    this.data.playerName = appliedName;
    this.data.leaderboard = updated.slice(0, 5);
    this.scoreText.text = `${this.getDisplayPlayerName()}\nScore ${this.data.score
      .toString()
      .padStart(6, "0")}  |  Time ${Math.floor(this.data.survivalTime)}s  |  Level ${this.data.levelReached}`;
    this.renderLeaderboard();
    if (clearInputAfter) {
      this.clearNameInput();
    }
    if (playSound) {
      this.game.services.sound.play("nameSaved");
    }
  }

  private clearNameInput(): void {
    if (!this.nameInput) {
      return;
    }
    this.nameInput.value = "";
    this.nameInput.blur();
  }

  private getDisplayPlayerName(): string {
    const name = this.data.playerName.trim();
    const fallback = this.data.defaultPlayerName.trim() || "Player";
    return name || fallback;
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
