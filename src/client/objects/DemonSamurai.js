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
    this.maxHealth = 24;
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

    this.on(Phaser.Animations.Events.ANIMATION_COMPLETE, this.onAnimComplete, this);

    this.anims.play("samurai-demon-walk", true);
    this.startWalkCycle();
  }

  preUpdate(time, delta) {
    super.preUpdate(time, delta);
  }

  update() {
    if (!this.active || !this.body) return;

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
    this.state = "ATTACK";
    this.body?.setVelocityX(0);
    this.alignDirectionToPlayer();
    this.spawnSlash();
    this.playAttackSound();
    this.anims.play("samurai-demon-attack", true);
  }

  startAttackIdle() {
    this.state = "ATTACK_IDLE";
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
    this.scene.sound.play("slash", { volume: 2.0 });
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

  alignDirectionToPlayer() {
    if (!this.player || !this.player.active) return;
    const deltaX = this.player.x - this.x;
    const direction = Math.sign(deltaX) || this.currentDirection || 1;
    this.currentDirection = direction;
    this.flipX = direction > 0;
  }
 }
