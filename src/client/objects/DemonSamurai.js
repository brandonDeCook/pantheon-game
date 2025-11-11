import Phaser from "phaser";

export default class DemonSamurai extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, "demonSamurai");
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.body.setSize(16, 28, false);
    this.body.setOffset(12, 30);
    this.body.setCollideWorldBounds(true);

    this.speed = 18;
    this.maxHealth = 38;
    this.health = this.maxHealth;

    this.player = scene.player;
    this.flashTimer = null;
    this.flashCleanupTimer = null;

    this.reacquireDelay = 1500;
    this.reacquireTimer = null;
    const initialDir = this.player ? Math.sign(this.player.x - x) || 1 : 1;
    this.currentDirection = initialDir;
    this.pendingDirection = null;

    this.state = "WALK";
    this.attacksRemaining = 0;
    this.walkTimer = null;
    this.attackIdleTimer = null;
    this.jumpAttackRange = 250;
    this.jumpHorizontalSpeed = 160;
    this.jumpUpVelocity = -260;
    this.jumpDownVelocity = 460;
    this.jumpPauseDuration = 150;
    this.jumpOverThreshold = 8;
    this.jumpTargetX = null;
    this.jumpInitialDirection = null;
    this.jumpPauseTimer = null;
    this.jumpStartY = null;

    this.on(Phaser.Animations.Events.ANIMATION_COMPLETE, this.onAnimComplete, this);

    this.anims.play("samurai-demon-walk", true);
    this.startWalkCycle();
  }

  preUpdate(time, delta) {
    super.preUpdate(time, delta);
  }

  update() {
    if (!this.active || !this.body) return;

    if (this.state === "JUMP_ASCEND") {
      this.handleJumpAscend();
      return;
    }

    if (this.state === "JUMP_PAUSE") {
      this.body.setVelocity(0, 0);
      return;
    }

    if (this.state === "JUMP_SLAM") {
      this.handleJumpSlam();
      return;
    }

    if (this.state === "ATTACK" || this.state === "ATTACK_IDLE") {
      this.body.setVelocityX(0);
      return;
    }

    if (!this.player || !this.player.active) {
      this.body.setVelocityX(0);
      this.anims.play("samurai-demon-walk", true);
      return;
    }

    const deltaX = this.player.x - this.x;
    const desiredDirection = Math.sign(deltaX) || this.currentDirection || 1;

    if (
      desiredDirection !== 0 &&
      desiredDirection !== this.currentDirection &&
      !this.reacquireTimer
    ) {
      this.pendingDirection = desiredDirection;
      this.beginReacquireDelay();
    }

    if (!this.reacquireTimer && desiredDirection !== 0) {
      this.currentDirection = desiredDirection;
    }

    const direction = this.currentDirection || 1;
    this.body.setVelocityX(direction * this.speed);
    this.flipX = direction > 0;
    this.anims.play("samurai-demon-walk", true);
  }

  takeDamage(amount = 1) {
    if (!this.active) return;
    this.health = Math.max(0, this.health - amount);
    this.scene.sound.play("hit");
    this.startDamageFlash();

    if (this.health <= 0) {
      this.die();
    }
  }

  startDamageFlash() {
    if (this.flashTimer) return;

    this.flashTimer = this.scene.time.addEvent({
      delay: 75,
      repeat: 4,
      callback: () => {
        if (this.isTinted) {
          this.clearTint();
        } else {
          this.setTint(0x000000);
        }
      },
      callbackScope: this,
    });

    const totalDuration = (this.flashTimer.repeat + 1) * this.flashTimer.delay;
    this.flashCleanupTimer = this.scene.time.delayedCall(
      totalDuration,
      () => {
        this.clearTint();
        this.flashTimer?.remove(false);
        this.flashTimer = null;
        this.flashCleanupTimer = null;
      },
      null,
      this
    );
  }

  die() {
    if (!this.active) return;
    this.clearReacquireTimer();
    this.clearWalkTimer();
    this.clearAttackIdleTimer();
    this.clearJumpPauseTimer();
    this.jumpTargetX = null;
    this.jumpInitialDirection = null;
    this.jumpStartY = null;
    this.body?.setAllowGravity(true);

    const offsets = [-10, 10];
    offsets.forEach((offset) => {
      this.scene.smallExplosions?.getFirstDead(true, this.x + offset, this.y);
    });
    this.scene.spawnCoin(this.x, this.y);
    this.destroy();
  }

  destroy(fromScene) {
    this.flashTimer?.remove(false);
    this.flashTimer = null;
    this.flashCleanupTimer?.remove(false);
    this.flashCleanupTimer = null;
    this.clearReacquireTimer();
    this.clearWalkTimer();
    this.clearAttackIdleTimer();
    this.clearJumpPauseTimer();
    this.jumpTargetX = null;
    this.jumpInitialDirection = null;
    this.jumpStartY = null;
    super.destroy(fromScene);
  }

  beginReacquireDelay() {
    this.clearReacquireTimer();
    this.reacquireTimer = this.scene.time.delayedCall(
      this.reacquireDelay,
      () => {
        if (this.pendingDirection !== null) {
          this.currentDirection = this.pendingDirection;
        }
        this.pendingDirection = null;
        this.clearReacquireTimer();
      },
      null,
      this
    );
  }

  clearReacquireTimer() {
    if (this.reacquireTimer) {
      this.reacquireTimer.remove(false);
      this.reacquireTimer = null;
    }
  }

  startWalkCycle() {
    this.state = "WALK";
    this.attacksRemaining = 0;
    this.jumpStartY = null;
    this.body?.setAllowGravity(true);
    this.clearWalkTimer();
    this.walkTimer = this.scene.time.delayedCall(
      Phaser.Math.Between(2000, 4000),
      () => {
        this.walkTimer = null;
        this.beginAttackSequence();
      },
      null,
      this
    );
  }

  clearWalkTimer() {
    if (this.walkTimer) {
      this.walkTimer.remove(false);
      this.walkTimer = null;
    }
  }

  beginAttackSequence() {
    if (!this.active) {
      this.startWalkCycle();
      return;
    }
    this.attacksRemaining = Phaser.Math.Between(2, 4);
    this.performAttack();
  }

  performAttack() {
    if (!this.active) return;
    this.alignDirectionToPlayer();
    if (this.shouldDoJumpAttack()) {
      this.startJumpAttack();
      return;
    }
    this.startSlashAttack();
  }

  startSlashAttack() {
    this.state = "ATTACK";
    this.body?.setAllowGravity(true);
    this.body?.setVelocityX(0);
    this.spawnSlash();
    this.playAttackSound();
    this.anims.play("samurai-demon-attack", true);
  }

  shouldDoJumpAttack() {
    if (!this.player || !this.player.active) {
      return false;
    }

    const distance = Phaser.Math.Distance.Between(
      this.x,
      this.y,
      this.player.x,
      this.player.y
    );

    if (distance >= this.jumpAttackRange) {
      return false;
    }

    return Phaser.Math.FloatBetween(0, 1) <= 0.35;
  }

  startJumpAttack() {
    if (!this.body) {
      this.startSlashAttack();
      return;
    }

    if (!this.player || !this.player.active) {
      this.startSlashAttack();
      return;
    }

    this.state = "JUMP_ASCEND";
    this.body.setAllowGravity(true);
    this.clearJumpPauseTimer();
    this.alignDirectionToPlayer();
    this.jumpInitialDirection = this.currentDirection || 1;
    if (this.jumpInitialDirection === 0) {
      this.jumpInitialDirection = 1;
    }
    this.jumpTargetX = this.player.x + this.jumpInitialDirection * 8;
    this.jumpStartY = this.y;
    this.body.setVelocityX(this.jumpInitialDirection * this.jumpHorizontalSpeed);
    this.body.setVelocityY(this.jumpUpVelocity);
    this.flipX = this.jumpInitialDirection > 0;
    this.anims.play("samurai-demon-jump", true);
  }

  handleJumpAscend() {
    if (!this.body) return;

    const direction = this.jumpInitialDirection || 1;
    this.body.setVelocityX(direction * this.jumpHorizontalSpeed);

    const targetX =
      this.jumpTargetX ??
      (this.player && this.player.active
        ? this.player.x
        : this.x + direction * this.jumpOverThreshold);

    const closeEnough = Math.abs(this.x - targetX) <= this.jumpOverThreshold;
    const passedTarget =
      (direction > 0 && this.x >= targetX) ||
      (direction < 0 && this.x <= targetX);

    const hasClearedPlayer = closeEnough || passedTarget;
    const hasReachedApex = this.body.velocity.y >= 0;
    const hasClearedMinimumHeight =
      this.jumpStartY === null || this.y <= this.jumpStartY - 12;

    if (hasClearedPlayer && (hasClearedMinimumHeight || hasReachedApex)) {
      this.beginJumpPause();
      return;
    }
  }

  beginJumpPause() {
    if (this.state !== "JUMP_ASCEND" || !this.body) return;
    this.state = "JUMP_PAUSE";
    this.body.setVelocity(0, 0);
    this.body.setAllowGravity(false);
    this.clearJumpPauseTimer();
    this.anims.play("samurai-demon-down-attack", true);
    this.jumpPauseTimer = this.scene.time.delayedCall(
      this.jumpPauseDuration,
      () => this.beginJumpSlam(),
      null,
      this
    );
  }

  beginJumpSlam() {
    if (this.state !== "JUMP_PAUSE" || !this.body) return;
    this.clearJumpPauseTimer();
    this.state = "JUMP_SLAM";
    this.body.setAllowGravity(true);
    this.body.setVelocity(0, this.jumpDownVelocity);
    this.anims.play("samurai-demon-down-attack", true);
  }

  handleJumpSlam() {
    if (!this.body) return;
    this.body.setVelocityX(0);
    if (this.body.velocity.y < this.jumpDownVelocity) {
      this.body.setVelocityY(this.jumpDownVelocity);
    }
    if (this.body.blocked.down || this.body.touching.down) {
      this.finishJumpAttack();
    }
  }

  finishJumpAttack() {
    if (this.state !== "JUMP_SLAM") {
      return;
    }
    
    this.scene.cameras?.main?.shake(75, 0.001);
    this.scene.sound.play("stomp", { volume: 3.0 });
    this.spawnGroundShockwaveSlashes();
    this.body?.setVelocity(0, 0);
    this.body?.setAllowGravity(true);
    this.jumpTargetX = null;
    this.jumpInitialDirection = null;
    this.jumpStartY = null;
    this.clearJumpPauseTimer();

    this.attacksRemaining = Math.max(0, this.attacksRemaining - 1);

    if (this.attacksRemaining > 0) {
      this.startAttackIdle();
    } else {
      this.startWalkCycle();
    }
  }

  clearJumpPauseTimer() {
    if (this.jumpPauseTimer) {
      this.jumpPauseTimer.remove(false);
      this.jumpPauseTimer = null;
    }
  }

  startAttackIdle() {
    this.state = "ATTACK_IDLE";
    this.body?.setAllowGravity(true);
    this.body?.setVelocityX(0);
    this.anims.play("samurai-demon-idle", true);
    this.clearAttackIdleTimer();
    this.attackIdleTimer = this.scene.time.delayedCall(
      Phaser.Math.Between(1000, 2000),
      () => {
        this.attackIdleTimer = null;
        this.performAttack();
      },
      null,
      this
    );
  }

  clearAttackIdleTimer() {
    if (this.attackIdleTimer) {
      this.attackIdleTimer.remove(false);
      this.attackIdleTimer = null;
    }
  }

  onAnimComplete(animation) {
    if (animation.key === "samurai-demon-attack" && this.state === "ATTACK") {
      this.attacksRemaining -= 1;
      if (this.attacksRemaining > 0) {
        this.startAttackIdle();
      } else {
        this.startWalkCycle();
      }
    }
  }

  playAttackSound() {
    this.scene.sound.play("slash", { volume: 2.25 });
  }

  spawnSlash() {
    if (!this.scene?.slashes) return;
    this.scene.time.delayedCall(
      100,
      () => {
        if (!this.active) return;
        const slash = this.scene.slashes.getFirstDead(true, this.x, this.y);
        if (!slash) return;
        const direction = this.currentDirection || 1;
        const offsetX = direction * 8;
        const offsetY = 10;
        const velocity = direction * 180;
        slash.activate(this.x + offsetX, this.y + offsetY, velocity);
      },
      null,
      this
    );
  }

  spawnGroundShockwaveSlashes() {
    if (!this.scene?.slashes) return;

    const baseY = this.body ? this.body.bottom - 4 : this.y + 10;
    const lifespan = 250;
    const speed = 220;

    [-1, 1].forEach((direction) => {
      const slash = this.scene.slashes.getFirstDead(true, this.x, baseY);
      if (!slash) return;
      slash.activate(this.x, baseY, direction * speed, lifespan);
    });
  }

  alignDirectionToPlayer() {
    if (!this.player || !this.player.active) return;
    const deltaX = this.player.x - this.x;
    const direction = Math.sign(deltaX) || this.currentDirection || 1;
    this.currentDirection = direction;
    this.flipX = direction > 0;
  }
}
