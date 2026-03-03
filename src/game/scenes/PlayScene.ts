import { Container, Graphics, Text } from "pixi.js";
import { ObjectPool } from "../../core/ObjectPool";
import { Scene } from "../../core/Scene";
import { FallingObject, type FallingKind } from "../entities/FallingObject";
import { Player } from "../entities/Player";
import { GAME_CONFIG } from "../config";
import { InputController } from "../input/InputController";
import { distanceSquared, randomRange } from "../math";
import type { DifficultySnapshot } from "../services/DifficultyService";
import { Hud } from "../ui/Hud";
import { TextButton } from "../ui/TextButton";
import { GameOverScene } from "./GameOverScene";
import { MenuScene } from "./MenuScene";

/** Background star metadata for parallax-like motion. */
interface Star {
  node: Graphics;
  speed: number;
  phase: number;
}

/** Lightweight particle payload used by transient burst effects. */
interface Particle {
  node: Graphics;
  vx: number;
  vy: number;
  ttl: number;
  life: number;
}

/** Primary gameplay scene containing input, spawning, scoring, FX, and pause flow. */
export class PlayScene extends Scene {
  private readonly background = new Graphics();
  private readonly laneDecor = new Graphics();
  private readonly flashOverlay = new Graphics();
  private readonly levelFlashOverlay = new Graphics();

  private readonly starLayer = new Container();
  private readonly actorLayer = new Container();
  private readonly fxLayer = new Container();

  private readonly player = new Player();
  private readonly hud = new Hud(GAME_CONFIG.title);
  private readonly pauseButton = new TextButton("PAUSE", 126, 44);
  private readonly comboText = new Text({
    text: "",
    style: {
      fill: 0xffe39d,
      fontFamily: "IBM Plex Mono",
      fontSize: 18,
      fontWeight: "500"
    }
  });
  private readonly levelUpText = new Text({
    text: "",
    style: {
      fill: 0xdaf8ff,
      fontFamily: "Chakra Petch",
      fontSize: 46,
      fontWeight: "700",
      letterSpacing: 2
    }
  });

  private readonly pool = new ObjectPool<FallingObject>(
    () => new FallingObject(),
    (item) => item.reset()
  );

  private readonly activeObjects: FallingObject[] = [];
  private readonly stars: Star[] = [];
  private readonly particles: Particle[] = [];
  private readonly pauseOverlay = new Graphics();
  private readonly pauseTitle = new Text({
    text: "Paused",
    style: {
      fill: 0xf2fcff,
      fontFamily: "Chakra Petch",
      fontSize: 54,
      fontWeight: "700"
    }
  });
  private readonly pauseHint = new Text({
    text: "Press Space / P / Esc or tap Resume",
    style: {
      fill: 0xb8d8ff,
      fontFamily: "IBM Plex Mono",
      fontSize: 15
    }
  });
  private readonly resumeButton = new TextButton("RESUME", 220, 56);
  private readonly pauseMenuButton = new TextButton("MAIN MENU", 220, 56);

  private input: InputController | null = null;
  private widthPx = 0;
  private heightPx = 0;

  private elapsed = 0;
  private spawnTimer = 0.5;
  private lives = GAME_CONFIG.baseLives;
  private score = 0;
  private combo = 0;
  private invulnerabilityTimer = 0;
  private shieldTimer = 0;
  private frenzyTimer = 0;
  private nearMissSfxCooldown = 0;
  private flashAlpha = 0;
  private levelFlashAlpha = 0;
  private levelUpTimer = 0;
  private paused = false;
  private pausePulse = 0;
  private level = 1;

  enter(): void {
    this.comboText.anchor.set(1, 0);
    this.levelUpText.anchor.set(0.5);
    this.levelUpText.visible = false;
    this.pauseTitle.anchor.set(0.5);
    this.pauseHint.anchor.set(0.5);
    this.pauseOverlay.visible = false;
    this.pauseTitle.visible = false;
    this.pauseHint.visible = false;
    this.resumeButton.visible = false;
    this.pauseMenuButton.visible = false;
    this.pauseButton.on("pointertap", this.onPausePressed);
    this.resumeButton.on("pointertap", this.onResumePressed);
    this.pauseMenuButton.on("pointertap", this.onPauseMenuPressed);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("blur", this.onWindowBlur);

    this.root.addChild(
      this.background,
      this.laneDecor,
      this.starLayer,
      this.actorLayer,
      this.fxLayer,
      this.hud,
      this.pauseButton,
      this.comboText,
      this.levelFlashOverlay,
      this.levelUpText,
      this.flashOverlay,
      this.pauseOverlay,
      this.pauseTitle,
      this.pauseHint,
      this.resumeButton,
      this.pauseMenuButton
    );

    this.createStars();
    this.actorLayer.addChild(this.player);
    this.player.x = this.game.width * 0.5;
    this.player.y = this.game.height * GAME_CONFIG.playerYRatio;

    this.input = new InputController(this.game.app.stage, this.game.width, this.game.height);

    this.hud.updateValues(0, this.lives, 0, "");
    this.hud.resize(this.game.width);
  }

  exit(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("blur", this.onWindowBlur);
    this.pauseButton.off("pointertap", this.onPausePressed);
    this.resumeButton.off("pointertap", this.onResumePressed);
    this.pauseMenuButton.off("pointertap", this.onPauseMenuPressed);
    this.input?.destroy();
    this.input = null;
    this.recycleAllObjects();
    this.clearParticles();
  }

  resize(width: number, height: number): void {
    this.widthPx = width;
    this.heightPx = height;

    this.drawBackground(width, height);
    this.hud.resize(width);
    const compact = width < 760;
    this.pauseButton.setSize(compact ? 96 : 126, compact ? 36 : 44, compact ? 16 : 18);
    this.pauseButton.position.set(width * 0.5, compact ? 34 : 38);
    this.comboText.position.set(width - 20, compact ? 88 : 70);
    this.levelUpText.style.fontSize = compact ? 34 : 46;
    this.levelUpText.position.set(width * 0.5, height * 0.28);

    this.player.y = height * GAME_CONFIG.playerYRatio;
    if (this.player.x <= 0) {
      this.player.x = width * 0.5;
    }

    this.input?.resize(width, height);
    this.layoutPauseOverlay();
  }

  update(deltaSeconds: number): void {
    if (this.paused) {
      this.pulsePauseOverlay(deltaSeconds);
      this.hud.updateValues(Math.floor(this.score), this.lives, this.elapsed, `LVL ${this.level} | PAUSED`);
      return;
    }

    this.elapsed += deltaSeconds;

    const difficulty = this.game.services.difficulty.getForTime(this.elapsed);
    if (difficulty.level > this.level) {
      this.handleLevelUp(difficulty.level);
    } else {
      this.level = difficulty.level;
    }
    const frenzyMultiplier = this.frenzyTimer > 0 ? 1.7 : 1;
    this.score += deltaSeconds * 5 * difficulty.scoreMultiplier * frenzyMultiplier;

    this.updateInput(deltaSeconds);
    this.updateStars(deltaSeconds, difficulty);
    this.spawnLoop(deltaSeconds, difficulty);
    const didFinishRun = this.updateObjects(deltaSeconds, difficulty);
    if (didFinishRun) {
      // Scene has switched during finishRun; stop touching destroyed display objects.
      return;
    }
    this.updateParticles(deltaSeconds);
    this.nearMissSfxCooldown = Math.max(0, this.nearMissSfxCooldown - deltaSeconds);

    this.invulnerabilityTimer = Math.max(0, this.invulnerabilityTimer - deltaSeconds);
    this.shieldTimer = Math.max(0, this.shieldTimer - deltaSeconds);
    this.frenzyTimer = Math.max(0, this.frenzyTimer - deltaSeconds);
    this.player.setInvulnerable(this.invulnerabilityTimer > 0);

    this.flashAlpha = Math.max(0, this.flashAlpha - deltaSeconds * 2.4);
    this.levelFlashAlpha = Math.max(0, this.levelFlashAlpha - deltaSeconds * 1.8);
    this.levelUpTimer = Math.max(0, this.levelUpTimer - deltaSeconds);
    this.renderFlashOverlay();
    this.renderLevelUpEffect();

    this.comboText.text = this.combo >= 2 ? `Chain x${this.combo}` : "";
    this.comboText.alpha = this.combo >= 2 ? 1 : 0;
    const status = this.resolveStatusText(difficulty.level);
    this.hud.updateValues(Math.floor(this.score), this.lives, this.elapsed, status);
  }

  private updateInput(deltaSeconds: number): void {
    const pointerX = this.input?.getPointerX() ?? this.widthPx * 0.5;
    const axis = this.input?.getHorizontalAxis() ?? 0;

    this.player.setPointerX(pointerX);
    this.player.update(deltaSeconds, axis, this.widthPx);
  }

  private spawnLoop(deltaSeconds: number, difficulty: DifficultySnapshot): void {
    this.spawnTimer -= deltaSeconds;

    // Catch up if a frame took longer than expected while respecting active object caps.
    while (this.spawnTimer <= 0 && this.activeObjects.length < GAME_CONFIG.maxActiveObjects) {
      this.spawnObject(difficulty);
      this.spawnTimer += difficulty.spawnInterval * randomRange(0.85, 1.15);
    }
  }

  private spawnObject(difficulty: DifficultySnapshot): void {
    const object = this.pool.acquire();
    const roll = Math.random();
    const boostChance = 0.08;
    const kind: FallingKind =
      roll < difficulty.enemyWeight ? "enemy" : roll < difficulty.enemyWeight + boostChance ? "boost" : "energy";
    const x = randomRange(GAME_CONFIG.horizontalPadding, this.widthPx - GAME_CONFIG.horizontalPadding);
    const speed = difficulty.fallSpeed * randomRange(0.86, 1.14);

    object.configure(kind, x, GAME_CONFIG.spawnTopOffset, speed);
    this.activeObjects.push(object);
    this.actorLayer.addChild(object);
  }

  private updateObjects(deltaSeconds: number, difficulty: DifficultySnapshot): boolean {
    const frenzyMultiplier = this.frenzyTimer > 0 ? 1.7 : 1;

    for (let i = this.activeObjects.length - 1; i >= 0; i -= 1) {
      const object = this.activeObjects[i];
      object.tick(deltaSeconds);

      const collides =
        distanceSquared(this.player.x, this.player.y, object.x, object.y) <
        (this.player.radius + object.radius) ** 2;

      if (collides) {
        if (object.kind === "enemy") {
          if (this.shieldTimer > 0) {
            this.score += 25 * difficulty.scoreMultiplier * frenzyMultiplier;
            this.emitBurst(object.x, object.y, 0x7db8ff, 10);
            this.game.services.sound.play("shieldBlock");
          } else if (this.invulnerabilityTimer <= 0) {
            this.lives -= 1;
            this.combo = 0;
            this.invulnerabilityTimer = 0.9;
            this.flashAlpha = 0.38;
            this.emitBurst(object.x, object.y, 0xff5a7a, 9);
            this.game.services.sound.play("hit");
            if (this.lives <= 0) {
              this.finishRun();
              return true;
            }
          }
        } else {
          if (object.kind === "boost") {
            this.shieldTimer = Math.min(8, this.shieldTimer + 4.5);
            this.frenzyTimer = Math.min(8, this.frenzyTimer + 4.5);
            this.score += 36 * difficulty.scoreMultiplier * frenzyMultiplier;
            this.emitBurst(object.x, object.y, 0x7db8ff, 11);
            this.game.services.sound.play("boost");
          } else {
            this.combo = Math.min(9, this.combo + 1);
            this.score +=
              18 * difficulty.scoreMultiplier * frenzyMultiplier * (1 + this.combo * 0.15);
            this.emitBurst(object.x, object.y, 0xffdc7c, 8);
            this.game.services.sound.play("collect");
          }
        }

        this.recycleAtIndex(i);
        continue;
      }

      if (
        object.kind === "enemy" &&
        !object.nearMissAwarded &&
        object.y > this.player.y - 10 &&
        Math.abs(object.x - this.player.x) < this.player.radius + object.radius + 8
      ) {
        // Near-miss rewards precision/risk without requiring direct contact.
        object.nearMissAwarded = true;
        this.combo = Math.min(9, this.combo + 1);
        this.score += 10 * difficulty.scoreMultiplier * frenzyMultiplier * (1 + this.combo * 0.1);
        this.emitBurst(object.x, this.player.y - 6, 0xffc27b, 4);
        if (this.nearMissSfxCooldown <= 0) {
          this.game.services.sound.play("nearMiss");
          this.nearMissSfxCooldown = 0.12;
        }
      }

      if (object.y - object.radius > this.heightPx + 36) {
        if (object.kind !== "enemy") {
          this.combo = 0;
        }
        this.recycleAtIndex(i);
      }
    }

    return false;
  }

  private finishRun(): void {
    const finalScore = Math.floor(this.score);
    const best = Math.max(finalScore, Math.floor(this.game.services.storage.getNumber("highScore", 0)));
    this.game.services.storage.setNumber("highScore", best);
    const playerName = this.game.services.platform.getUserDisplayName();
    const leaderboard = this.game.services.leaderboard.record({
      name: playerName,
      score: finalScore,
      survivalTime: this.elapsed,
      platform: this.game.services.platform.name,
      dateISO: new Date().toISOString()
    });
    this.game.services.sound.play("gameOver");
    void this.game.services.platform.reportScore(finalScore);

    this.game.switchScene(
      new GameOverScene(this.game, {
        score: finalScore,
        bestScore: best,
        survivalTime: this.elapsed,
        leaderboard: leaderboard.slice(0, 5),
        playerName
      })
    );
  }

  private updateStars(deltaSeconds: number, difficulty: DifficultySnapshot): void {
    for (const star of this.stars) {
      const speedBoost = this.frenzyTimer > 0 ? 1.35 : 1;
      star.node.y += star.speed * deltaSeconds * (1 + difficulty.ramp * 0.5) * speedBoost;
      if (star.node.y > this.heightPx + 8) {
        star.node.y = -8;
        star.node.x = Math.random() * this.widthPx;
      }
      star.phase += deltaSeconds;
      star.node.alpha = 0.25 + Math.sin(star.phase * 3.2) * 0.12;
    }
  }

  private createStars(): void {
    for (let i = 0; i < GAME_CONFIG.backgroundStars; i += 1) {
      const starNode = new Graphics();
      const size = randomRange(0.9, 2.2);

      starNode.circle(0, 0, size).fill(0xb3d2ff);
      starNode.x = Math.random() * this.game.width;
      starNode.y = Math.random() * this.game.height;
      starNode.alpha = randomRange(0.15, 0.45);
      this.starLayer.addChild(starNode);

      this.stars.push({
        node: starNode,
        speed: randomRange(18, 95),
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  private emitBurst(x: number, y: number, color: number, count: number): void {
    for (let i = 0; i < count; i += 1) {
      const angle = randomRange(0, Math.PI * 2);
      const speed = randomRange(65, 170);
      const ttl = randomRange(0.3, 0.62);

      const node = new Graphics();
      node.circle(0, 0, randomRange(1.6, 3.6)).fill(color);
      node.position.set(x, y);
      this.fxLayer.addChild(node);

      this.particles.push({
        node,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        ttl,
        life: ttl
      });
    }
  }

  private updateParticles(deltaSeconds: number): void {
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const particle = this.particles[i];
      particle.life -= deltaSeconds;

      if (particle.life <= 0) {
        this.particles.splice(i, 1);
        particle.node.destroy();
        continue;
      }

      particle.vy += 210 * deltaSeconds;
      particle.node.x += particle.vx * deltaSeconds;
      particle.node.y += particle.vy * deltaSeconds;
      particle.node.alpha = particle.life / particle.ttl;
    }
  }

  private clearParticles(): void {
    for (const particle of this.particles) {
      particle.node.destroy();
    }
    this.particles.length = 0;
  }

  private recycleAtIndex(index: number): void {
    const [object] = this.activeObjects.splice(index, 1);
    if (!object) {
      return;
    }
    this.actorLayer.removeChild(object);
    this.pool.release(object);
  }

  private recycleAllObjects(): void {
    while (this.activeObjects.length > 0) {
      this.recycleAtIndex(this.activeObjects.length - 1);
    }
  }

  private drawBackground(width: number, height: number): void {
    this.background.clear();
    this.background.rect(0, 0, width, height).fill(0x060d1f);

    const stripeCount = 5;
    for (let i = 0; i < stripeCount; i += 1) {
      const y = (height / stripeCount) * i;
      this.background
        .rect(0, y, width, 2)
        .fill({ color: 0x12305e, alpha: 0.35 - i * 0.05 });
    }

    this.laneDecor.clear();
    this.laneDecor
      .moveTo(width * 0.2, 0)
      .lineTo(width * 0.47, height)
      .stroke({ color: 0x1d3f78, width: 2, alpha: 0.38 });
    this.laneDecor
      .moveTo(width * 0.8, 0)
      .lineTo(width * 0.53, height)
      .stroke({ color: 0x1d3f78, width: 2, alpha: 0.38 });
  }

  private renderFlashOverlay(): void {
    this.flashOverlay.clear();
    if (this.flashAlpha <= 0) {
      if (this.frenzyTimer <= 0) {
        return;
      }
      this.flashOverlay.rect(0, 0, this.widthPx, this.heightPx).fill({
        color: 0x5f8bff,
        alpha: 0.06 + Math.sin(this.elapsed * 7) * 0.02
      });
      return;
    }
    this.flashOverlay.rect(0, 0, this.widthPx, this.heightPx).fill({
      color: 0xff4d6f,
      alpha: this.flashAlpha
    });
  }

  private renderLevelUpEffect(): void {
    this.levelFlashOverlay.clear();
    if (this.levelFlashAlpha > 0) {
      this.levelFlashOverlay.rect(0, 0, this.widthPx, this.heightPx).fill({
        color: 0x7ee5ff,
        alpha: this.levelFlashAlpha
      });
    }

    if (this.levelUpTimer <= 0) {
      this.levelUpText.visible = false;
      return;
    }

    const total = 1.1;
    const progress = 1 - this.levelUpTimer / total;
    const fade = this.levelUpTimer > 0.32 ? 1 : this.levelUpTimer / 0.32;
    this.levelUpText.visible = true;
    this.levelUpText.text = `LEVEL ${this.level}`;
    this.levelUpText.alpha = fade;
    this.levelUpText.scale.set(1 + Math.sin(progress * Math.PI) * 0.08);
    this.levelUpText.position.set(this.widthPx * 0.5, this.heightPx * 0.28 - progress * 24);
  }

  private resolveStatusText(level: number): string {
    const prefix = `LVL ${level}`;
    if (this.shieldTimer > 0 && this.frenzyTimer > 0) {
      return `${prefix} | SHIELD ${this.shieldTimer.toFixed(1)}s | FRENZY ${this.frenzyTimer.toFixed(1)}s`;
    }
    if (this.shieldTimer > 0) {
      return `${prefix} | SHIELD ${this.shieldTimer.toFixed(1)}s`;
    }
    if (this.frenzyTimer > 0) {
      return `${prefix} | FRENZY ${this.frenzyTimer.toFixed(1)}s`;
    }
    return this.combo >= 2 ? `${prefix} | CHAIN BONUS x${this.combo}` : prefix;
  }

  private layoutPauseOverlay(): void {
    const compact = this.widthPx < 760 || this.heightPx < 640;
    const panelWidth = Math.min(this.widthPx * 0.86, compact ? 360 : 460);
    const panelHeight = compact ? 280 : 320;
    const panelX = this.widthPx * 0.5 - panelWidth * 0.5;
    const panelY = this.heightPx * 0.5 - panelHeight * 0.5;

    this.pauseOverlay.clear();
    this.pauseOverlay.rect(0, 0, this.widthPx, this.heightPx).fill({ color: 0x02060f, alpha: 0.62 });
    this.pauseOverlay
      .roundRect(panelX, panelY, panelWidth, panelHeight, 22)
      .fill({ color: 0x0a1d3c, alpha: 0.96 })
      .stroke({ color: 0x78f4da, alpha: 0.75, width: compact ? 1.5 : 2 });

    this.pauseTitle.style.fontSize = compact ? 40 : 54;
    this.pauseHint.style.fontSize = compact ? 13 : 15;
    this.resumeButton.setSize(compact ? 180 : 220, compact ? 48 : 56, compact ? 18 : 22);
    this.pauseMenuButton.setSize(compact ? 180 : 220, compact ? 48 : 56, compact ? 18 : 22);

    this.pauseTitle.position.set(this.widthPx * 0.5, panelY + panelHeight * 0.25);
    this.pauseHint.position.set(this.widthPx * 0.5, panelY + panelHeight * 0.38);
    this.resumeButton.position.set(this.widthPx * 0.5, panelY + panelHeight * 0.57);
    this.pauseMenuButton.position.set(this.widthPx * 0.5, panelY + panelHeight * 0.76);
  }

  private setPaused(next: boolean): void {
    if (this.paused === next) {
      return;
    }
    this.paused = next;

    this.pauseOverlay.visible = next;
    this.pauseTitle.visible = next;
    this.pauseHint.visible = next;
    this.resumeButton.visible = next;
    this.pauseMenuButton.visible = next;
    this.pauseButton.visible = !next;

    this.game.services.sound.play(next ? "pause" : "resume");
  }

  private pulsePauseOverlay(deltaSeconds: number): void {
    this.pausePulse += deltaSeconds;
    const pulse = 1 + Math.sin(this.pausePulse * 5) * 0.01;
    this.pauseTitle.scale.set(pulse);
  }

  private readonly onPausePressed = (): void => {
    this.game.services.sound.play("uiTap");
    this.setPaused(true);
  };

  private handleLevelUp(nextLevel: number): void {
    this.level = nextLevel;
    this.levelUpTimer = 1.1;
    this.levelFlashAlpha = 0.24;
    this.emitBurst(this.widthPx * 0.5, this.heightPx * 0.4, 0x8deeff, 18);
    this.game.services.sound.play("levelUp");
  }

  private readonly onResumePressed = (): void => {
    this.game.services.sound.play("uiTap");
    this.setPaused(false);
  };

  private readonly onPauseMenuPressed = (): void => {
    this.game.services.sound.play("uiTap");
    this.game.switchScene(new MenuScene(this.game));
  };

  private readonly onWindowBlur = (): void => {
    this.setPaused(true);
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat && (event.code === "KeyP" || event.code === "Space")) {
      return;
    }

    if (event.code === "Space" || event.code === "KeyP" || event.code === "Escape") {
      event.preventDefault();
      this.setPaused(!this.paused);
      return;
    }
    if (this.paused && event.code === "Enter") {
      event.preventDefault();
      this.setPaused(false);
    }
  };
}
