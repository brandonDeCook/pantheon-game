import Phaser from "phaser";

export default class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, zoom) {
    super(scene, x, y, "player");

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.body.setSize(8, 20, false);
    this.body.setOffset(4, 12);
    this.body.setGravityY(650);
    this.speed = 40;
    this.cursors = scene.input.keyboard.createCursorKeys();
    this.zkey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    this.xkey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X);
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
    this.play("player-idle");
    this.setCollideWorldBounds(true);
    this.arrowShootSound = scene.sound.add("arrowShoot");
    this.setDepth(9001);

    this.playerHealth = { current: 5, max: 5, bars: [] };
    for (var index = 0; index < this.playerHealth.max; index++) {
      this.playerHealth.bars.push(
        scene.add.sprite(40 + index * 5, 26, "healthBar")
      );
    }

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
      .setScale(1 / zoom);

    this.coinText = scene.add
      .text(264, 24, "COINS:0", {
        fontFamily: "standard",
        fontSize: "24px",
        color: "#FFFFFF",
      })
      .setScale(1 / zoom);

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

    const jumpTriggered = this.canStartJump({
      upIsDown: up.isDown,
      downIsDown: down.isDown,
      onGround,
      xJustPressed,
    });

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
      !down.isDown &&
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
      this.facingRight = true;
      this.flipX = false;
      this.anims.play("player-walk", true);
      this.body.setVelocityX(this.speed);
    } else if (left.isDown) {
      this.facingRight = false;
      this.flipX = true;
      this.anims.play("player-walk", true);
      this.body.setVelocityX(-this.speed);
    } else {
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

  canStartJump({ upIsDown, downIsDown, onGround, xJustPressed }) {
    if (!onGround || !upIsDown || downIsDown) {
      return false;
    }

    if (this.state !== "NONE") {
      return false;
    }

    return !!xJustPressed;
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
    if (this.state === "DEAD" || this.state === "ROLL" || this.state === "HIT") {
      return false;
    }

    if (this.playerHealth.current <= 0) {
      this.enterDeathState();
      return true;
    }

    this.scene.sound.play("playerHit");
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

      const arrow = this.arrows.getFirstDead(
        true,
        this.x + xPosBuffer,
        this.y + yPosBuffer
      );

      if (arrow) {
        arrow.angle = 0.0;
        arrow.flipX = this.flipX;
        arrow.setActive(true);
        arrow.setVisible(true);
        arrow.startX = arrow.x;
        arrow.startY = arrow.y;
        arrow.body.setVelocityX(velocity);
        arrow.body.setVelocityY(0);
        arrow.body.enable = true;
        this.arrowShootSound?.play();
      }
    } else if (key === "player-arrow-fire-up") {
      const arrow = this.arrows.getFirstDead(true, this.x, this.y - 2);
      if (arrow) {
        arrow.flipX = false;
        arrow.angle = -90.0;
        arrow.setActive(true);
        arrow.setVisible(true);
        arrow.startX = arrow.x;
        arrow.startY = arrow.y;
        arrow.body.setVelocityY(-velocityBase);
        arrow.body.setVelocityX(0);
        arrow.body.enable = true;
        this.arrowShootSound?.play();
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
}
