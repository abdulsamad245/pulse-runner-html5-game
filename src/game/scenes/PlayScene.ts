import { Container, Graphics, Text } from "pixi.js";
import { ObjectPool } from "../../core/ObjectPool";
import { Scene } from "../../core/Scene";
import { FallingObject, type FallingKind, type FallingMotionOptions } from "../entities/FallingObject";
import { Player } from "../entities/Player";
import { GAME_CONFIG } from "../config";
import { InputController } from "../input/InputController";
import { clamp, distanceSquared, randomRange } from "../math";
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
  private lives: number = GAME_CONFIG.baseLives;
  private score = 0;
  private combo = 0;
  private invulnerabilityTimer = 0;
  private shieldTimer = 0;
  private frenzyTimer = 0;
  private slowFieldTimer = 0;
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
    this.game.services.sound.startGameplayLoop();
    this.game.services.sound.setGameplayPaused(false);
    this.game.services.sound.setGameplayIntensity(0);

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
    this.game.services.sound.stopGameplayLoop();
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
      this.game.services.sound.setGameplayPaused(true);
      this.pulsePauseOverlay(deltaSeconds);
      this.hud.updateValues(Math.floor(this.score), this.lives, this.elapsed, `LVL ${this.level} | PAUSED`);
      return;
    }
    this.game.services.sound.setGameplayPaused(false);

    this.elapsed += deltaSeconds;

    const difficulty = this.game.services.difficulty.getForTime(this.elapsed);
    if (difficulty.level > this.level) {
      this.handleLevelUp(difficulty.level);
    } else {
      this.level = difficulty.level;
    }
    const frenzyMultiplier = this.frenzyTimer > 0 ? 1.7 : 1;
    const ambienceIntensity = Math.min(1, difficulty.ramp * 0.82 + (this.frenzyTimer > 0 ? 0.18 : 0));
    this.game.services.sound.setGameplayIntensity(ambienceIntensity);
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
    this.slowFieldTimer = Math.max(0, this.slowFieldTimer - deltaSeconds);
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
    const pointerControlActive = this.input?.isPointerControlActive() ?? false;

    this.player.setPointerX(pointerX);
    this.player.update(deltaSeconds, axis, this.widthPx, pointerControlActive);
  }

  private spawnLoop(deltaSeconds: number, difficulty: DifficultySnapshot): void {
    this.spawnTimer -= deltaSeconds;
    const activeCap = this.getActiveObjectCap(difficulty.level);

    // Catch up if a frame took longer than expected while respecting active object caps.
    while (this.spawnTimer <= 0 && this.activeObjects.length < activeCap) {
      this.spawnObject(difficulty);
      this.spawnTimer += difficulty.spawnInterval * randomRange(0.85, 1.15);
    }
  }

  private spawnObject(difficulty: DifficultySnapshot): void {
    const object = this.pool.acquire();
    const kind = this.pickSpawnKind(difficulty);
    const motion = this.buildMotionForKind(kind, difficulty.level);
    const amplitudePad = Math.max(0, motion.driftAmplitude ?? 0);
    const sidePad = GAME_CONFIG.horizontalPadding + 16 + amplitudePad;
    const minX = sidePad;
    const maxX = this.widthPx - sidePad;
    const x = minX < maxX ? randomRange(minX, maxX) : this.widthPx * 0.5;
    const speed = this.resolveSpawnSpeed(kind, difficulty);

    object.configure(kind, x, GAME_CONFIG.spawnTopOffset, speed, motion);
    this.activeObjects.push(object);
    this.actorLayer.addChild(object);
  }

  private getActiveObjectCap(level: number): number {
    if (level <= 2) {
      return GAME_CONFIG.maxActiveObjects - 9 + (level - 1) * 2;
    }
    if (level <= 4) {
      return GAME_CONFIG.maxActiveObjects - 3 + (level - 3) * 3;
    }
    return GAME_CONFIG.maxActiveObjects + 3 + Math.min(28, (level - 5) * 4);
  }

  private pickSpawnKind(difficulty: DifficultySnapshot): FallingKind {
    const weights = this.buildSpawnWeights(difficulty.level, difficulty.enemyWeight);
    const total = weights.reduce((sum, entry) => sum + entry.weight, 0);
    const roll = Math.random() * total;
    let cursor = 0;

    for (const entry of weights) {
      cursor += entry.weight;
      if (roll <= cursor) {
        return entry.kind;
      }
    }

    return "energy";
  }

  private buildSpawnWeights(level: number, enemyBaseWeight: number): ReadonlyArray<{ kind: FallingKind; weight: number }> {
    // Softer onboarding up to level 4, then escalate hazard density from level 5 onward.
    const spikeRamp = clamp((level - 5) / 5, 0, 1);
    const earlyEase = clamp((5 - level) / 4, 0, 1);
    const enemyWeight = clamp(enemyBaseWeight * (0.68 + spikeRamp * 0.3 - earlyEase * 0.11), 0.34, 0.9);
    const mineWeight = level < 4 ? 0 : clamp(0.024 + (level - 4) * 0.014 + spikeRamp * 0.04, 0.024, 0.16);
    const dartWeight = level < 5 ? 0 : clamp(0.06 + (level - 5) * 0.02 + spikeRamp * 0.07, 0.06, 0.26);
    const boostWeight = clamp(level < 5 ? 0.112 - (level - 1) * 0.008 : 0.066 - spikeRamp * 0.01, 0.046, 0.112);
    const shieldWeight = clamp(level < 5 ? 0.088 - (level - 1) * 0.01 : 0.046 - spikeRamp * 0.012, 0.028, 0.088);
    const slowWeight = clamp(level < 4 ? 0.028 : level < 7 ? 0.038 : 0.048 - spikeRamp * 0.01, 0.026, 0.048);
    const lifeWeight =
      this.lives >= 5
        ? 0
        : this.lives < GAME_CONFIG.baseLives
          ? clamp(0.034 - spikeRamp * 0.008, 0.02, 0.034)
          : this.lives === 4
            ? clamp(0.008 - spikeRamp * 0.003, 0.003, 0.008)
            : clamp(level < 5 ? 0.011 : 0.007, 0.004, 0.011);
    const energyWeight = clamp(level < 5 ? 0.39 - (level - 1) * 0.05 : 0.22 - spikeRamp * 0.07, 0.12, 0.39);

    return [
      { kind: "enemy", weight: enemyWeight },
      { kind: "mine", weight: mineWeight },
      { kind: "dart", weight: dartWeight },
      { kind: "boost", weight: boostWeight },
      { kind: "shield", weight: shieldWeight },
      { kind: "slow", weight: slowWeight },
      { kind: "life", weight: lifeWeight },
      { kind: "energy", weight: energyWeight }
    ];
  }

  private buildMotionForKind(kind: FallingKind, level: number): FallingMotionOptions {
    const spikeRamp = clamp((level - 5) / 6, 0, 1);

    switch (kind) {
      case "enemy":
        return {
          spinSpeed: randomRange(-0.9, 0.9),
          driftAmplitude: level >= 6 ? randomRange(8, 24) : 0,
          driftFrequency: level >= 6 ? randomRange(1.2, 2.2) : 0,
          driftPhase: Math.random() * Math.PI * 2
        };
      case "mine":
        return {
          spinSpeed: randomRange(-0.34, 0.34),
          driftAmplitude: level >= 5 ? randomRange(12 + spikeRamp * 10, 28 + spikeRamp * 16) : 0,
          driftFrequency: level >= 5 ? randomRange(1.4, 2.6 + spikeRamp * 0.6) : 0,
          driftPhase: Math.random() * Math.PI * 2
        };
      case "dart":
        {
          const lateralScale = 1 + spikeRamp * 0.9;
          return {
            lateralVelocity: randomRange(-42, 42) * lateralScale,
            driftAmplitude: randomRange(16 + spikeRamp * 14, 34 + spikeRamp * 26),
            driftFrequency: randomRange(1.9, 3.2 + spikeRamp * 0.9),
            driftPhase: Math.random() * Math.PI * 2,
            spinSpeed: randomRange(-2.4, 2.4),
            initialRotation: randomRange(-0.45, 0.45)
          };
        }
      case "energy":
        return {
          spinSpeed: randomRange(-1.3, 1.3),
          driftAmplitude: randomRange(4, 10),
          driftFrequency: randomRange(1.8, 2.6),
          driftPhase: Math.random() * Math.PI * 2,
          initialRotation: randomRange(-0.2, 0.2)
        };
      case "boost":
        return {
          spinSpeed: randomRange(-2, 2),
          driftAmplitude: randomRange(6, 16),
          driftFrequency: randomRange(1.6, 2.4),
          driftPhase: Math.random() * Math.PI * 2
        };
      case "shield":
        return {
          spinSpeed: randomRange(-1.2, 1.2)
        };
      case "slow":
        return {
          spinSpeed: randomRange(-1, 1)
        };
      case "life":
        return {
          spinSpeed: randomRange(-1.1, 1.1),
          driftAmplitude: randomRange(8, 22),
          driftFrequency: randomRange(1.5, 2.4),
          driftPhase: Math.random() * Math.PI * 2
        };
    }
  }

  private resolveSpawnSpeed(kind: FallingKind, difficulty: DifficultySnapshot): number {
    const base = difficulty.fallSpeed;
    const level = difficulty.level;
    const spikeRamp = clamp((level - 5) / 5, 0, 1);

    switch (kind) {
      case "mine":
        return base * randomRange(0.64 + spikeRamp * 0.06, 0.83 + spikeRamp * 0.1);
      case "dart":
        return base * randomRange(1.08 + spikeRamp * 0.18, 1.3 + spikeRamp * 0.28);
      case "energy":
      case "shield":
      case "slow":
      case "life":
        return base * randomRange(0.8, 0.98 + spikeRamp * 0.06);
      case "boost":
        return base * randomRange(0.75, 0.94 + spikeRamp * 0.04);
      case "enemy":
      default:
        return base * randomRange(0.82 + spikeRamp * 0.12, 1.08 + spikeRamp * 0.16);
    }
  }

  private updateObjects(deltaSeconds: number, difficulty: DifficultySnapshot): boolean {
    const frenzyMultiplier = this.frenzyTimer > 0 ? 1.7 : 1;
    const slowFieldMultiplier = this.slowFieldTimer > 0 ? 0.58 : 1;

    for (let i = this.activeObjects.length - 1; i >= 0; i -= 1) {
      const object = this.activeObjects[i];
      const isHazard = this.isHazardKind(object.kind);
      object.tick(deltaSeconds, isHazard ? slowFieldMultiplier : 1);

      const collides =
        distanceSquared(this.player.x, this.player.y, object.x, object.y) <
        (this.player.radius + object.radius) ** 2;

      if (collides) {
        if (isHazard) {
          const didFinish = this.applyHazardCollision(object, difficulty, frenzyMultiplier);
          if (didFinish) {
            return true;
          }
        } else {
          this.applyBonusCollision(object, difficulty, frenzyMultiplier);
        }

        this.recycleAtIndex(i);
        continue;
      }

      if (
        isHazard &&
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

      const outBottom = object.y - object.radius > this.heightPx + 36;
      const outSides = object.x + object.radius < -48 || object.x - object.radius > this.widthPx + 48;
      if (outBottom || outSides) {
        if (!isHazard) {
          this.combo = 0;
        }
        this.recycleAtIndex(i);
      }
    }

    return false;
  }

  private isHazardKind(kind: FallingKind): boolean {
    return kind === "enemy" || kind === "mine" || kind === "dart";
  }

  private applyHazardCollision(
    object: FallingObject,
    difficulty: DifficultySnapshot,
    frenzyMultiplier: number
  ): boolean {
    if (this.shieldTimer > 0) {
      const shieldBonus = object.kind === "mine" ? 42 : object.kind === "dart" ? 32 : 25;
      this.score += shieldBonus * difficulty.scoreMultiplier * frenzyMultiplier;
      this.emitBurst(object.x, object.y, 0x7db8ff, object.kind === "mine" ? 14 : 10);
      this.game.services.sound.play(
        object.kind === "mine" ? "blockMine" : object.kind === "dart" ? "blockDart" : "blockEnemy"
      );
      return false;
    }

    if (this.invulnerabilityTimer > 0) {
      return false;
    }

    const damage = 1;
    const hitFlash = object.kind === "mine" ? 0.48 : object.kind === "dart" ? 0.4 : 0.34;
    const invulnerability = object.kind === "dart" ? 1.25 : object.kind === "mine" ? 1.6 : 1.4;
    const burstColor = object.kind === "mine" ? 0xff355a : object.kind === "dart" ? 0xff855f : 0xff5a7a;
    const burstCount = object.kind === "mine" ? 14 : object.kind === "dart" ? 11 : 9;

    this.lives = Math.max(0, this.lives - damage);
    this.combo = 0;
    this.invulnerabilityTimer = invulnerability;
    this.slowFieldTimer = Math.max(this.slowFieldTimer, 1.6);
    this.flashAlpha = hitFlash;
    this.emitBurst(object.x, object.y, burstColor, burstCount);
    this.game.services.sound.play(
      object.kind === "mine" ? "hitMine" : object.kind === "dart" ? "hitDart" : "hitEnemy"
    );

    if (this.lives <= 0) {
      this.finishRun();
      return true;
    }

    return false;
  }

  private applyBonusCollision(
    object: FallingObject,
    difficulty: DifficultySnapshot,
    frenzyMultiplier: number
  ): void {
    switch (object.kind) {
      case "boost":
        this.shieldTimer = Math.min(10, this.shieldTimer + 4.5);
        this.frenzyTimer = Math.min(10, this.frenzyTimer + 4.5);
        this.score += 40 * difficulty.scoreMultiplier * frenzyMultiplier;
        this.emitBurst(object.x, object.y, 0x7db8ff, 11);
        this.game.services.sound.play("collectBoost");
        return;
      case "shield":
        this.shieldTimer = Math.min(12, this.shieldTimer + 5.5);
        this.score += 30 * difficulty.scoreMultiplier * frenzyMultiplier;
        this.emitBurst(object.x, object.y, 0x79d6ff, 10);
        this.game.services.sound.play("collectShield");
        return;
      case "slow":
        this.slowFieldTimer = Math.min(9, this.slowFieldTimer + 4.8);
        this.score += 28 * difficulty.scoreMultiplier * frenzyMultiplier;
        this.emitBurst(object.x, object.y, 0x72fff2, 10);
        this.game.services.sound.play("collectSlow");
        return;
      case "life":
        this.lives = Math.min(5, this.lives + 1);
        this.score += 34 * difficulty.scoreMultiplier * frenzyMultiplier;
        this.emitBurst(object.x, object.y, 0x8effa8, 12);
        this.game.services.sound.play("collectLife");
        return;
      case "energy":
      default:
        this.combo = Math.min(9, this.combo + 1);
        this.score += 18 * difficulty.scoreMultiplier * frenzyMultiplier * (1 + this.combo * 0.15);
        this.emitBurst(object.x, object.y, 0xffdc7c, 8);
        this.game.services.sound.play("collectEnergy");
    }
  }

  private finishRun(): void {
    const finalScore = Math.floor(this.score);
    const best = Math.max(finalScore, Math.floor(this.game.services.storage.getNumber("highScore", 0)));
    this.game.services.storage.setNumber("highScore", best);
    const defaultPlayerName = this.resolveFallbackPlayerName();
    const preferredName = this.game.services.storage.getObject<string>("playerAlias", "");
    const playerName = preferredName.trim() || defaultPlayerName;
    const runId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
    const leaderboard = this.game.services.leaderboard.record({
      runId,
      name: playerName,
      score: finalScore,
      survivalTime: this.elapsed,
      levelReached: this.level,
      platform: this.game.services.platform.name,
      dateISO: new Date().toISOString()
    });
    this.game.services.sound.stopGameplayLoop();
    this.game.services.sound.play("gameOver");
    void this.game.services.platform.reportScore(finalScore);

    this.game.switchScene(
      new GameOverScene(this.game, {
        score: finalScore,
        bestScore: best,
        survivalTime: this.elapsed,
        levelReached: this.level,
        runId,
        defaultPlayerName,
        leaderboard: leaderboard.slice(0, 5),
        playerName
      })
    );
  }

  private resolveFallbackPlayerName(): string {
    const platformName = this.game.services.platform.getUserDisplayName().trim();
    if (platformName && platformName.toLowerCase() !== "player") {
      return platformName;
    }

    const key = "anonPlayerName";
    const existing = this.game.services.storage.getObject<string>(key, "").trim();
    if (existing) {
      return existing;
    }

    const generated = `Player-${Math.floor(1000 + Math.random() * 9000)}`;
    this.game.services.storage.setObject(key, generated);
    return generated;
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
      const frenzyActive = this.frenzyTimer > 0;
      const slowFieldActive = this.slowFieldTimer > 0;
      if (!frenzyActive && !slowFieldActive) {
        return;
      }

      const color = frenzyActive && slowFieldActive ? 0x6fb9ff : frenzyActive ? 0x5f8bff : 0x6eece1;
      const alphaBase = frenzyActive ? 0.06 : 0.05;
      const alphaPulse = frenzyActive ? 0.02 : 0.015;
      this.flashOverlay.rect(0, 0, this.widthPx, this.heightPx).fill({
        color,
        alpha: alphaBase + Math.sin(this.elapsed * 7) * alphaPulse
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
    const statuses: string[] = [];

    if (this.shieldTimer > 0) {
      statuses.push(`SHIELD ${this.shieldTimer.toFixed(1)}s`);
    }
    if (this.frenzyTimer > 0) {
      statuses.push(`FRENZY ${this.frenzyTimer.toFixed(1)}s`);
    }
    if (this.slowFieldTimer > 0) {
      statuses.push(`SLOW FIELD ${this.slowFieldTimer.toFixed(1)}s`);
    }
    if (statuses.length > 0) {
      return `${prefix} | ${statuses.join(" | ")}`;
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
    this.game.services.sound.setGameplayPaused(next);

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
