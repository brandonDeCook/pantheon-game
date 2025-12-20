import Phaser from "phaser";
import { findPowerupByValue } from "../Constants.js";
import { playSoundWithDetune } from "../utils/sound.js";
import PlayerSpecialLaser from "./PlayerSpecialLaser.js";

const DEFAULT_ARROW_POWERUP = {
  value: "DEFAULT_ARROW",
  frame: 3,
  amount: null,
};
const POWERUP_HIGHLIGHT_COLOR = 0xf8b800;
const SPECIAL_BAR_OUTLINE_COLOR = 0xfcfcfc;
const SPECIAL_BAR_FILL_COLOR = 0xf8b800;
const HUD_DEPTH = 10000;

export default class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, zoom, playerData = null) {
    super(scene, x, y, "player");

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.uiScale = 1 / zoom;

    this.defaultBodySize = { width: 4, height: 22, offsetX: 7, offsetY: 10 };
    this.crouchBodySize = { width: 4, height: 15, offsetX: 7, offsetY: 17 };
    this.body.setSize(this.defaultBodySize.width, this.defaultBodySize.height, false);
    this.body.setOffset(this.defaultBodySize.offsetX, this.defaultBodySize.offsetY);
    this.body.setGravityY(650);
    this.speed = 45;
    this.cursors = scene.input.keyboard.createCursorKeys();
    this.zkey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    this.xkey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X);
    this.skey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.facingRight = true;
    this.lastFired = 0;
    this.fireRate = 5000;
    this.state = "NONE";
    this.rollDistance = 40;
    this.rollDuration = 400;
    this.rollSpeed = this.rollDistance / (this.rollDuration / 1000);
    this.rollDirection = 0;
    this.rollTimer = null;
    this.rollCooldown = 900;
    this.lastRollTime = -this.rollCooldown;
    this.jumpVelocity = -220;
    this.jumpAnimationState = "GROUND";
    this.jumpAnimFinished = false;
    this.jumpHoldFrame = null;
    this.jumpAnimationsEnsured = false;
    this.specialFiring = false;
    this.specialLaser = new PlayerSpecialLaser(scene);
    this.ensureSpecialAnimations();
    this.play("player-idle");
    this.setCollideWorldBounds(true);
    this.arrowShootSound = scene.sound.add("arrowShoot");
    this.powerupSelectSound = scene.sound.add("powerupSelect");
    this.specialBlastSound = scene.sound.add("playerSpecialBlast");
    this.lastArrowDetune = null;
    this.setDepth(9001);

    this.playerHealth = { current: 5, max: 5, bars: [] };
    for (var index = 0; index < this.playerHealth.max; index++) {
      this.playerHealth.bars.push(
        scene.add.sprite(40 + index * 5, 26, "healthBar").setDepth(HUD_DEPTH)
      );
    }

    this.ArrowPowerups = this.buildArrowPowerups(playerData);
    this.currentArrowPowerupIndex = 0;
    this.arrowPowerupIcons = [];
    this.arrowPowerupAmountTexts = [];
    this.arrowPowerupHighlight = null;
    this.arrowPowerupStartX = 0;
    this.arrowPowerupSpacing = 20;
    this.arrowPowerupY = 22;
    this.renderArrowPowerups();
    this.specialCharge = 0;
    this.specialBar = null;
    this.specialBarFill = null;
    this.specialBarFlashTimer = null;
    this.specialBarWidth = 40;
    this.specialBarHeight = 6;
    this.specialChargePerKill = 10;
    this.initSpecialBar();
    this.shiftKey = scene.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.SHIFT
    );

    this.on(
      Phaser.Animations.Events.ANIMATION_COMPLETE,
      this.onAnimComplete.bind(this)
    );

    const playerHealthText = scene.add
      .text(0, 24, "PLAYER", {
        fontFamily: "standard",
        fontSize: "24px",
        color: "#FFFFFF",

      })
      .setScale(1 / zoom)
      .setDepth(HUD_DEPTH);

    this.coinText = scene.add
      .text(260, 24, "COINS:0", {
        fontFamily: "standard",
        fontSize: "24px",
        color: "#FFFFFF",
      })
      .setScale(1 / zoom)
      .setDepth(HUD_DEPTH);

    this.arrows = scene.physics.add.group({
      defaultKey: "arrow",
      frameQuantity: 10,
      allowGravity: false,
      runChildUpdate: true,
      active: false,
      visible: false,
    });
  }

  update(time, delta) {
    const { left, right, up, down } = this.cursors;
    const xJustPressed = Phaser.Input.Keyboard.JustDown(this.xkey);
    const sJustPressed = Phaser.Input.Keyboard.JustDown(this.skey);
    const upJustPressed = Phaser.Input.Keyboard.JustDown(up);
    const onGround = this.isOnGround();
    if (this.coinText) {
      const coins = this.scene.playerCoins ?? 0;
      this.coinText.setText(`COINS:${coins}`);
    }
    if (this.state === "DEAD") {
      if (this.body) {
        this.body.setVelocity(0, 0);
      }
      return;
    }

    if (sJustPressed) {
      this.fireSpecialLaser();
    }

    if (this.specialFiring) {
      if (this.body) {
        this.body.setVelocityX(0);
        this.body.setAccelerationX?.(0);
      }
      return;
    }

    if (this.state === "ROLL") {
      this.body.setVelocityX(this.rollDirection * this.rollSpeed);
      return;
    }

    if (this.state === "JUMP") {
      if (onGround && this.body && this.body.velocity.y >= 0) {
        this.completeJump();
      } else {
        this.handleJumpMovement(left, right);
        return;
      }
    }

    let jumpTriggered = false;
    if (!this.zkey.isDown) {
      jumpTriggered = this.canStartJump({
        upIsDown: up.isDown,
        downIsDown: down.isDown,
        onGround,
        upJustPressed,
      });
    }

    if (jumpTriggered) {
      this.startJump();
      return;
    }

    const rollDirection =
      right.isDown && !left.isDown
        ? 1
        : left.isDown && !right.isDown
        ? -1
        : 0;
    const canRollState = this.state === "NONE" || this.state === "HIT";
    const rollTriggered =
      canRollState &&
      rollDirection !== 0 &&
      this.xkey.isDown &&
      time - this.lastRollTime >= this.rollCooldown &&
      (xJustPressed ||
        Phaser.Input.Keyboard.JustDown(right) ||
        Phaser.Input.Keyboard.JustDown(left));
    if (rollTriggered) {
      this.startRoll(rollDirection, time);
      return;
    }

    if (this.zkey.isDown && !down.isDown) {
      this.body.setVelocityX(0);

      if (up.isDown) {
        this.flipX = false;
        this.play("player-arrow-fire-up", true);
      } else {
        this.play("player-arrow-fire-stand", true);

        if (left.isDown && this.facingRight) {
          this.facingRight = false;
          this.flipX = true;
        } else if (right.isDown && !this.facingRight) {
          this.facingRight = true;
          this.flipX = false;
        }
      }
    } else if (down.isDown) {
      this.applyCrouchCollider();
      if (left.isDown) {
        this.facingRight = false;
        this.flipX = true;
      } else if (right.isDown) {
        this.facingRight = true;
        this.flipX = false;
      }

      if (this.zkey.isDown) {
        this.anims.play("player-arrow-fire-crouch", true);
      } else {
        this.anims.play("player-crouch", true);
      }
      this.body.setVelocityX(0);
    } else if (right.isDown) {
      this.resetColliderSize();
      this.facingRight = true;
      this.flipX = false;
      this.anims.play("player-walk", true);
      this.body.setVelocityX(this.speed);
    } else if (left.isDown) {
      this.resetColliderSize();
      this.facingRight = false;
      this.flipX = true;
      this.anims.play("player-walk", true);
      this.body.setVelocityX(-this.speed);
    } else {
      this.resetColliderSize();
      this.body.setVelocityX(0);
      this.anims.play("player-idle", true);
    }

    if (this.state == "HIT") {
      if (!this.flashTimer) {
        this.flashTimer = this.scene.time.addEvent({
          delay: 75,
          callback: this.flash,
          callbackScope: this,
          loop: true,
        });
      }
    }

    if (
      this.shiftKey &&
      Phaser.Input.Keyboard.JustDown(this.shiftKey) &&
      Array.isArray(this.ArrowPowerups) &&
      this.ArrowPowerups.length > 1
    ) {
      this.powerupSelectSound?.play();
      this.selectNextArrowPowerup();
    }
  }

  startRoll(direction, triggerTime) {
    this.body.checkCollision.left = false;
    this.body.checkCollision.right = false;
    this.body.checkCollision.up = false;
    this.state = "ROLL";
    this.rollDirection = direction;
    this.lastRollTime = triggerTime ?? this.scene.time.now;
    this.facingRight = direction > 0;
    this.flipX = direction < 0;
    this.body.setVelocityX(this.rollDirection * this.rollSpeed);
    this.rollTimer?.remove(false);
    this.rollTimer = this.scene.time.addEvent({
      delay: this.rollDuration,
      callback: this.finishRollFromTimer,
      callbackScope: this,
    });
    this.play("player-roll", true);
  }

  finishRollFromTimer() {
    this.rollTimer = null;
    this.endRoll();
  }

  endRoll() {
    if (this.state !== "ROLL") {
      return;
    }

    if (this.rollTimer) {
      this.rollTimer.remove(false);
      this.rollTimer = null;
    }

    this.state = "NONE";
    this.body.checkCollision.left = true;
    this.body.checkCollision.right = true;
    this.body.checkCollision.up = true;
    this.rollDirection = 0;
    this.body.setVelocityX(0);
    this.body.checkCollision.none = false;
    this.play("player-idle", true);
  }

  isOnGround() {
    if (!this.body) {
      return false;
    }
    const body = this.body;
    if (typeof body.onFloor === "function" && body.onFloor()) {
      return true;
    }
    return (body.blocked && body.blocked.down) || (body.touching && body.touching.down) || false;
  }

  canStartJump({ upIsDown, downIsDown, onGround, upJustPressed }) {
    if (!onGround || !upIsDown || downIsDown) {
      return false;
    }

    if (this.state !== "NONE" && this.state !== "HIT") {
      return false;
    }

    return !!upJustPressed;
  }

  startJump() {
    if (!this.body) {
      return;
    }

    this.ensureJumpAnimations();
    this.state = "JUMP";
    this.jumpAnimFinished = false;
    this.jumpAnimationState = "ASCENT_START";
    this.body.setVelocityY(this.jumpVelocity);
    this.anims.play("player-jump", true);
  }

  handleJumpMovement(left, right) {
    if (!this.body) {
      return;
    }

    let direction = 0;
    if (left.isDown && !right.isDown) {
      direction = -1;
    } else if (right.isDown && !left.isDown) {
      direction = 1;
    }

    this.body.setVelocityX(direction * this.speed);
    if (direction !== 0) {
      this.facingRight = direction > 0;
      this.flipX = direction < 0;
    }

    if (this.body.velocity.y < 0) {
      this.showJumpRiseFrame();
    } else {
      this.playFallAnimation();
    }
  }

  showJumpRiseFrame(force = false) {
    if (!force && !this.jumpAnimFinished) {
      return;
    }

    if (this.jumpAnimationState === "ASCENT_HOLD") {
      return;
    }

    const frameName = this.getJumpHoldFrameName();
    if (frameName) {
      this.anims.stop();
      this.setFrame(frameName);
    } else {
      this.anims.play("player-jump", true);
    }

    this.jumpAnimationState = "ASCENT_HOLD";
  }

  playFallAnimation() {
    if (this.jumpAnimationState === "FALL") {
      return;
    }

    this.anims.play("player-fall", true);
    this.jumpAnimationState = "FALL";
  }

  completeJump() {
    if (this.state !== "JUMP") {
      return;
    }

    this.state = "NONE";
    this.jumpAnimationState = "GROUND";
    this.jumpAnimFinished = false;
    this.anims.play("player-idle", true);
  }

  getJumpHoldFrameName() {
    if (!this.jumpHoldFrame) {
      const jumpAnimation = this.anims.animationManager.get("player-jump");
      if (jumpAnimation && jumpAnimation.frames.length) {
        this.jumpHoldFrame =
          jumpAnimation.frames[jumpAnimation.frames.length - 1];
      }
    }

    return this.jumpHoldFrame?.frame?.name ?? null;
  }

  ensureJumpAnimations() {
    if (this.jumpAnimationsEnsured) {
      return;
    }

    const manager = this.scene.anims;
    manager.remove("player-jump");
    manager.create({
      key: "player-jump",
      frames: [
        { key: "player", frame: "10" },
        { key: "player", frame: "9" },
      ],
      frameRate: 10,
      repeat: 0,
    });

    manager.remove("player-fall");
    manager.create({
      key: "player-fall",
      frames: [{ key: "player", frame: "9" }],
      frameRate: 10,
      repeat: -1,
    });

    this.jumpAnimationsEnsured = true;
  }

  hit() {
    if (
      this.state === "DEAD" ||
      this.state === "ROLL" ||
      this.state === "HIT" ||
      this.specialFiring
    ) {
      return false;
    }

    if (this.playerHealth.current <= 0) {
      this.enterDeathState();
      return true;
    }

    this.scene.sound.play("playerHit");
    this.scene?.triggerHitFreeze?.();
    this.playerHealth.current = Math.max(0, this.playerHealth.current - 1);

    for (
      var index = this.playerHealth.bars.length - 1;
      index > this.playerHealth.current - 1;
      index--
    ) {
      var bar = this.playerHealth.bars[index];
      bar.setFrame("1");
    }

    if (this.playerHealth.current <= 0) {
      this.enterDeathState();
      return true;
    }

    this.state = "HIT";

    if (!this.hitTimer) {
      this.hitTimer = this.scene.time.addEvent({
        delay: 1500,
        callback: this.endHit,
        callbackScope: this,
        repeat: 0,
      });
    }

    return true;
  }

  endHit() {
    this.state = "NONE";
    if (this.flashTimer) {
      this.flashTimer.paused = true;
      this.flashTimer = undefined;
    }
    this.hitTimer = undefined;
    this.clearTint();

    if (this.state !== "DEAD" && this.body && !this.body.enable) {
      this.body.enable = true;
      this.body.checkCollision.none = false;
    }
  }

  enterDeathState() {
    if (this.state === "DEAD") {
      return;
    }

    this.state = "DEAD";
    this.playerHealth.current = 0;
    this.rollTimer?.remove(false);
    this.rollTimer = null;
    this.hitTimer?.remove(false);
    this.hitTimer = undefined;
    if (this.flashTimer) {
      this.flashTimer.remove(false);
      this.flashTimer = undefined;
    }
    this.clearTint();

    if (this.body) {
      this.body.setVelocity(0, 0);
    }

    this.playerHealth.bars.forEach((bar) => bar.setFrame("1"));

    this.play("player-lay-down", true);
    this.scene.events.emit("player-dead");
    if (this.body) {
      this.body.checkCollision.none = true;
      this.body.enable = false;
    }
  }

  flash() {
    if (this.isTinted) {
      this.clearTint();
    } else {
      this.setTint(0x000000);
    }
  }

  onAnimComplete() {
    if (!this.anims.currentAnim) {
      return;
    }

    const key = this.anims.currentAnim.key;
    const velocityBase = 250;

    if (
      (key === "player-arrow-fire-crouch" ||
        key === "player-arrow-fire-stand") &&
      this.zkey.isDown
    ) {
      let velocity = velocityBase;
      let xPosBuffer = 3;
      let yPosBuffer = key === "player-arrow-fire-stand" ? -1 : 6;

      if (this.flipX) {
        velocity *= -1;
        xPosBuffer *= -1;
      }

      const currentPowerup = this.getCurrentArrowPowerup();
      const arrow = this.arrows.getFirstDead(
        true,
        this.x + xPosBuffer,
        this.y + yPosBuffer
      );

      if (arrow) {
        this.applyArrowPowerupAppearance(arrow, currentPowerup);
        arrow.angle = 0.0;
        arrow.flipX = this.flipX;
        arrow.setActive(true);
        arrow.setVisible(true);
        arrow.startX = arrow.x;
        arrow.startY = arrow.y;
        if (arrow.body) {
          const baseWidth = arrow.width ?? arrow.displayWidth ?? arrow.body.width ?? 0;
          const baseHeight = arrow.height ?? arrow.displayHeight ?? arrow.body.height ?? 0;
          arrow.body.setSize(baseWidth + 1, baseHeight + 1, false);
        }
        arrow.body.setVelocityX(velocity);
        arrow.body.setVelocityY(0);
        arrow.body.enable = true;
        this.playArrowShootSound();
        this.consumeArrowPowerupUsage(currentPowerup);
      }
    } else if (key === "player-arrow-fire-up") {
      const currentPowerup = this.getCurrentArrowPowerup();
      const arrow = this.arrows.getFirstDead(true, this.x, this.y - 2);
      if (arrow) {
        this.applyArrowPowerupAppearance(arrow, currentPowerup);
        arrow.flipX = false;
        arrow.angle = -90.0;
        arrow.setActive(true);
        arrow.setVisible(true);
        arrow.startX = arrow.x;
        arrow.startY = arrow.y;
        if (arrow.body) {
          const baseWidth = arrow.width ?? arrow.displayWidth ?? arrow.body.width ?? 0;
          const baseHeight = arrow.height ?? arrow.displayHeight ?? arrow.body.height ?? 0;
          arrow.body.setSize(baseWidth + 1, baseHeight + 1, false);
        }
        arrow.body.setVelocityY(-velocityBase);
        arrow.body.setVelocityX(0);
        arrow.body.enable = true;
        this.playArrowShootSound();
        this.consumeArrowPowerupUsage(currentPowerup);
      }
    } else if (key === "player-jump" && this.state === "JUMP") {
      this.jumpAnimFinished = true;
      if (this.body && this.body.velocity.y < 0) {
        this.showJumpRiseFrame(true);
      }
    } else if (key === "player-roll") {
      this.endRoll();
    } else if (key === "player-lay-down" && this.state === "DEAD") {
      this.play("player-lay-down-idle", true);
    }
  }

  buildArrowPowerups(playerData) {
    const list = [
      {
        value: DEFAULT_ARROW_POWERUP.value,
        amount: DEFAULT_ARROW_POWERUP.amount,
        frame: DEFAULT_ARROW_POWERUP.frame,
      },
    ];

    const entries = Array.isArray(playerData?.powerups)
      ? playerData.powerups
      : [];

    entries.forEach((entry) => {
      const value = typeof entry === "string" ? entry : entry?.value;
      if (typeof value !== "string" || value.startsWith("HEAL_")) {
        return;
      }

      const def = findPowerupByValue(value);
      const entryAmount = Number.isFinite(entry?.amount) ? entry.amount : null;
      const defAmount = Number.isFinite(entryAmount)
        ? entryAmount
        : Number.isFinite(def?.amount)
        ? def.amount
        : 1;

      const existing = list.find((entry) => entry.value === value);
      if (existing) {
        if (existing.amount !== null && Number.isFinite(defAmount)) {
          existing.amount += defAmount;
        }
        return;
      }

      list.push({
        value,
        amount: defAmount,
        frame: def?.frame ?? DEFAULT_ARROW_POWERUP.frame,
      });
    });

    return list;
  }

  renderArrowPowerups() {
    if (Array.isArray(this.arrowPowerupIcons)) {
      this.arrowPowerupIcons.forEach((icon) => icon?.destroy());
    }
    this.arrowPowerupIcons = [];
    if (Array.isArray(this.arrowPowerupAmountTexts)) {
      this.arrowPowerupAmountTexts.forEach((text) => text?.destroy());
    }
    this.arrowPowerupAmountTexts = [];

    const lastBarX = 40 + Math.max(0, this.playerHealth.max - 1) * 5;
    this.arrowPowerupStartX = lastBarX + 20;
    this.arrowPowerupY = 16;
    this.arrowPowerupSpacing = 23;

    this.ArrowPowerups.forEach((powerup, index) => {
      const frame =
        typeof powerup.frame === "number"
          ? powerup.frame
          : DEFAULT_ARROW_POWERUP.frame;
      const icon = this.scene.add
        .image(
          this.arrowPowerupStartX + index * this.arrowPowerupSpacing,
          this.arrowPowerupY,
          "playerPowerups",
          frame
        )
        .setOrigin(0.5)
        .setDepth(HUD_DEPTH);
      this.arrowPowerupIcons.push(icon);

      const amountText = this.scene.add
        .text(
          icon.x,
          this.arrowPowerupY + 10,
          this.formatArrowAmount(powerup.amount),
          {
            fontFamily: "standard",
            fontSize: "24px",
            color: "#FFFFFF",
          }
        )
        .setOrigin(0.5, 0)
        .setScale(1 / (this.scene.zoom || 4))
        .setDepth(HUD_DEPTH);
      this.arrowPowerupAmountTexts.push(amountText);
    });

    this.ensureArrowPowerupHighlight();
    this.updateArrowPowerupHighlightPosition();
  }

  ensureArrowPowerupHighlight() {
    if (this.arrowPowerupHighlight && !this.arrowPowerupHighlight.destroyed) {
      this.arrowPowerupHighlight.setVisible(true);
      return;
    }

    const highlightSize = 16;
    this.arrowPowerupHighlight = this.scene.add
      .rectangle(0, 0, highlightSize, highlightSize)
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH + 1);
    this.arrowPowerupHighlight.setStrokeStyle(1, POWERUP_HIGHLIGHT_COLOR, 1);
    this.arrowPowerupHighlight.setFillStyle(0xffffff, 0);
  }

  updateArrowPowerupHighlightPosition() {
    if (!this.arrowPowerupHighlight) {
      return;
    }

    const index = Phaser.Math.Clamp(
      this.currentArrowPowerupIndex ?? 0,
      0,
      Math.max(0, this.arrowPowerupIcons.length - 1)
    );
    this.currentArrowPowerupIndex = index;

    const targetIcon = this.arrowPowerupIcons[index];
    if (!targetIcon) {
      this.arrowPowerupHighlight.setVisible(false);
      return;
    }

    this.arrowPowerupHighlight.setVisible(true);
    this.arrowPowerupHighlight.setPosition(targetIcon.x, targetIcon.y);
    this.arrowPowerupHighlight.setDepth((targetIcon.depth ?? 0) + 1);
  }

  selectNextArrowPowerup() {
    const total = this.ArrowPowerups?.length ?? 0;
    if (total <= 1) {
      this.currentArrowPowerupIndex = 0;
      return;
    }

    const nextIndex = (this.currentArrowPowerupIndex + 1) % total;
    this.currentArrowPowerupIndex = nextIndex;
    this.updateArrowPowerupHighlightPosition();
  }

  getCurrentArrowPowerup() {
    if (!Array.isArray(this.ArrowPowerups) || this.ArrowPowerups.length === 0) {
      return DEFAULT_ARROW_POWERUP;
    }

    const index = Phaser.Math.Clamp(
      this.currentArrowPowerupIndex ?? 0,
      0,
      this.ArrowPowerups.length - 1
    );
    this.currentArrowPowerupIndex = index;
    return this.ArrowPowerups[index] ?? DEFAULT_ARROW_POWERUP;
  }

  applyArrowPowerupAppearance(arrow, powerup) {
    if (!arrow) {
      return;
    }

    const value = powerup?.value ?? DEFAULT_ARROW_POWERUP.value;
    arrow.powerupValue = value;
    if (value === "ICE_ARROW") {
      arrow.setTintFill?.(0x0078f8);
    } else {
      arrow.clearTint?.();
    }
  }

  consumeArrowPowerupUsage(powerup) {
    if (!powerup || !Number.isFinite(powerup.amount)) {
      return;
    }

    powerup.amount = Math.max(0, powerup.amount - 1);
    this.updateArrowPowerupAmounts();
    if (powerup.amount > 0) {
      return;
    }

    this.handleArrowPowerupDepleted(powerup.value);
  }

  handleArrowPowerupDepleted(value) {
    if (!value || value === DEFAULT_ARROW_POWERUP.value) {
      this.currentArrowPowerupIndex = 0;
      this.updateArrowPowerupHighlightPosition();
      return;
    }

    this.removeArrowPowerup(value);
  }

  removeArrowPowerup(value) {
    if (!Array.isArray(this.ArrowPowerups) || this.ArrowPowerups.length === 0) {
      this.currentArrowPowerupIndex = 0;
      this.updateArrowPowerupHighlightPosition();
      return;
    }

    const targetIndex = this.ArrowPowerups.findIndex(
      (entry) => entry.value === value
    );
    if (targetIndex <= 0) {
      this.currentArrowPowerupIndex = 0;
      this.updateArrowPowerupHighlightPosition();
      return;
    }

    this.ArrowPowerups.splice(targetIndex, 1);
    this.currentArrowPowerupIndex = 0;
    this.renderArrowPowerups();
  }

  formatArrowAmount(amount) {
    if (!Number.isFinite(amount)) {
      return "INF";
    }
    return `x${amount}`;
  }

  updateArrowPowerupAmounts() {
    if (!Array.isArray(this.arrowPowerupAmountTexts)) {
      this.arrowPowerupAmountTexts = [];
    }
    this.ArrowPowerups.forEach((powerup, index) => {
      const text = this.arrowPowerupAmountTexts[index];
      if (!text) {
        return;
      }
      text.setText(this.formatArrowAmount(powerup.amount));
    });
  }

  applyCrouchCollider() {
    if (!this.body) {
      return;
    }
    this.body.setSize(this.crouchBodySize.width, this.crouchBodySize.height, false);
    this.body.setOffset(this.crouchBodySize.offsetX, this.crouchBodySize.offsetY);
  }

  resetColliderSize() {
    if (!this.body) {
      return;
    }
    this.body.setSize(this.defaultBodySize.width, this.defaultBodySize.height, false);
    this.body.setOffset(this.defaultBodySize.offsetX, this.defaultBodySize.offsetY);
  }

  playArrowShootSound() {
    this.lastArrowDetune = playSoundWithDetune(this.scene, "arrowShoot", {
      lastDetune: this.lastArrowDetune,
    });
  }

  handleSpecialFiringMovement(left, right) {
    if (!this.body) return;
    const movingRight = right.isDown && !left.isDown;
    const movingLeft = left.isDown && !right.isDown;
    if (movingRight) {
      this.resetColliderSize();
      this.facingRight = true;
      this.flipX = false;
      this.body.setVelocityX(this.speed);
    } else if (movingLeft) {
      this.resetColliderSize();
      this.facingRight = false;
      this.flipX = true;
      this.body.setVelocityX(-this.speed);
    } else {
      this.body.setVelocityX(0);
    }
  }

  initSpecialBar() {
    const barX = 180;
    const barY = 24;
    this.specialBar = this.scene.add
      .rectangle(barX, barY, this.specialBarWidth + 4, this.specialBarHeight + 4)
      .setOrigin(0.5, 0.5)
      .setStrokeStyle(2, SPECIAL_BAR_OUTLINE_COLOR, 1)
      .setDepth(HUD_DEPTH);

    this.specialBarFill = this.scene.add
      .rectangle(
        barX - this.specialBarWidth * 0.5,
        barY,
        this.specialBarWidth,
        this.specialBarHeight,
        SPECIAL_BAR_FILL_COLOR
      )
      .setOrigin(0, 0.5)
      .setDepth(HUD_DEPTH);
    this.updateSpecialBar();
  }

  setSpecialCharge(value) {
    this.specialCharge = Phaser.Math.Clamp(value, 0, 100);
    this.updateSpecialBar();
  }

  addSpecialCharge(percent) {
    const increment = Math.random() < 0.65 ? 5 : 10;
    const wasFull = this.specialCharge >= 100;
    this.setSpecialCharge(this.specialCharge + increment);
    if (this.specialCharge >= 100 && !wasFull) {
      this.startSpecialBarFlash();
    } else if (this.specialCharge < 100) {
      this.stopSpecialBarFlash();
    }
  }

  updateSpecialBar() {
    if (!this.specialBarFill) return;
    const ratio = Phaser.Math.Clamp(this.specialCharge / 100, 0, 1);
    const width = this.specialBarWidth * ratio;
    this.specialBarFill.setDisplaySize(width, this.specialBarHeight);
    this.specialBarFill.setVisible(width > 0);
    if (this.specialCharge < 100) {
      this.stopSpecialBarFlash();
    } else {
      this.startSpecialBarFlash();
    }
  }

  startSpecialBarFlash() {
    if (this.specialBarFlashTimer) {
      return;
    }
    let toggle = false;
    this.specialBarFlashTimer = this.scene.time.addEvent({
      delay: 120,
      loop: true,
      callback: () => {
        toggle = !toggle;
        const color = toggle ? SPECIAL_BAR_OUTLINE_COLOR : SPECIAL_BAR_FILL_COLOR;
        this.specialBarFill.setFillStyle(color);
      },
    });
  }

  stopSpecialBarFlash() {
    if (this.specialBarFlashTimer) {
      this.specialBarFlashTimer.remove(false);
      this.specialBarFlashTimer = null;
    }
    if (this.specialBarFill) {
      this.specialBarFill.setFillStyle(SPECIAL_BAR_FILL_COLOR);
    }
  }

  isSpecialReady() {
    return this.specialCharge >= 100;
  }

  ensureSpecialAnimations() {
    if (!this.scene) return;
    const anims = this.scene.anims;
    if (!anims.exists("player-special-charge")) {
      anims.create({
        key: "player-special-charge",
        frames: [{ key: "player", frame: 4 }],
        frameRate: 10,
        repeat: -1,
      });
    }

    if (!anims.exists("player-special-fire")) {
      anims.create({
        key: "player-special-fire",
        frames: [{ key: "player", frame: 5 }],
        frameRate: 10,
        repeat: -1,
      });
    }
  }

  fireSpecialLaser() {
    if (!this.active || this.state === "DEAD" || this.specialFiring){// || !this.isSpecialReady()) {
      return;
    }

    const facingRight = this.facingRight;
    const offsetX = facingRight ? 10 : -10;
    const laserX = this.x + offsetX;
    const laserY = this.y - 2;

    this.specialFiring = true;
    this.body?.setVelocityX(0);
    this.specialBlastSound?.stop();
    this.specialBlastSound?.play();
    this.play("player-special-charge", true);
    this.specialLaser.fire({
      x: laserX,
      y: laserY,
      facingRight,
      middleRepeats: 20,
      durationMs: 800,
      onActivate: () => {
        this.play("player-special-fire", true);
      },
      onComplete: () => {
        this.specialFiring = false;
        this.play("player-idle", true);
        this.setSpecialCharge(0);
        this.stopSpecialBarFlash();
      },
    });
  }
}
