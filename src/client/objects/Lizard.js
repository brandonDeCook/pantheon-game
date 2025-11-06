import Phaser from "phaser";

export default class Lizard extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, "lizard");
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.body.setSize(12, 22, false);
    this.body.setOffset(2, 10);
    this.body.setCollideWorldBounds(true);

    this.player = scene.player;
    this.maxHealth = 16;
    this.health = this.maxHealth;
    this.speed = 20;

    this.damageFlashTimer = null;
    this.damageFlashCleanupTimer = null;

    this.reacquireDelay = 1500;
    this.reacquireTimer = null;
    const initialDelta = this.player ? Math.sign(this.player.x - x) : 1;
    this.currentDirection = initialDelta === 0 ? 1 : initialDelta;
    this.pendingDirection = null;

    this.play("lizard-walk");
  }

  preUpdate(time, delta) {
    super.preUpdate(time, delta);
  }

  update() {
    if (!this.active || !this.body) {
      return;
    }

    if (!this.player || !this.player.active) {
      this.body.setVelocityX(0);
      this.anims.play("lizard-walk", true);
      return;
    }

    const deltaX = this.player.x - this.x;
    const desiredDirection = Math.sign(deltaX);

    if (
      desiredDirection !== 0 &&
      desiredDirection !== this.currentDirection &&
      !this.reacquireTimer
    ) {
      this.pendingDirection = desiredDirection;
      this.beginReacquireDelay();
    }

    if (this.reacquireTimer) {
      this.body.setVelocityX(this.currentDirection * this.speed);
      this.flipX = this.currentDirection < 0;
      this.anims.play("lizard-walk", true);
      return;
    }

    if (desiredDirection !== 0) {
      this.currentDirection = desiredDirection;
    }

    this.body.setVelocityX(this.currentDirection * this.speed);
    this.flipX = this.currentDirection < 0;
    this.anims.play("lizard-walk", true);
  }

  takeDamage(amount = 1) {
    if (!this.active) return;
    this.health = Math.max(0, this.health - amount);
    this.startDamageFlash();

    if (this.health <= 0) {
      this.die();
    }
  }

  startDamageFlash() {
    if (this.damageFlashTimer) {
      return;
    }

    this.damageFlashTimer = this.scene.time.addEvent({
      delay: 75,
      repeat: 4,
      callback: () => {
        if (!this.isTinted) {
          this.setTint(0x000000);
        } else {
          this.clearTint();
        }
      },
      callbackScope: this,
    });

    const totalDuration =
      (this.damageFlashTimer.repeat + 1) * this.damageFlashTimer.delay;

    this.damageFlashCleanupTimer = this.scene.time.delayedCall(
      totalDuration,
      () => {
        this.clearTint();
        if (this.damageFlashTimer) {
          this.damageFlashTimer.remove(false);
          this.damageFlashTimer = null;
        }
        this.damageFlashCleanupTimer = null;
      },
      null,
      this
    );
  }

  die() {
    if (!this.active) return;
    this.clearReacquireTimer();
    this.clearTint();
    this.scene.explosions?.getFirstDead(true, this.x, this.y);
    this.scene.spawnCoin(this.x, this.y);
    this.destroy();
  }

  destroy(fromScene) {
    this.clearReacquireTimer();
    if (this.damageFlashTimer) {
      this.damageFlashTimer.remove(false);
      this.damageFlashTimer = null;
    }
    if (this.damageFlashCleanupTimer) {
      this.damageFlashCleanupTimer.remove(false);
      this.damageFlashCleanupTimer = null;
    }
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
}
