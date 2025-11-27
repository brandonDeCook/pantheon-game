import Phaser from "phaser";
import {
  ICE_FREEZE_TINT,
  ICE_FREEZE_FLASH_TINT,
  ICE_FREEZE_DURATION,
} from "../Constants.js";

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
    this.isFrozen = false;
    this.freezeTimer = null;
    this.frozenAllowGravity = this.body?.allowGravity ?? true;
    this.frozenTweens = null;
    this.hitFlashActive = false;
  }

  preUpdate(time, delta) {
    super.preUpdate(time, delta);
  }

  update() {
    if (!this.active || !this.body) {
      return;
    }

    if (this.isFrozen) {
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
        if (this.hitFlashActive) {
          this.hitFlashActive = false;
          this.restoreTint();
          return;
        }
        const tintColor = this.isFrozen ? ICE_FREEZE_FLASH_TINT : 0x000000;
        this.applyTintColor(tintColor);
        this.hitFlashActive = true;
      },
      callbackScope: this,
    });

    const totalDuration =
      (this.damageFlashTimer.repeat + 1) * this.damageFlashTimer.delay;

    this.damageFlashCleanupTimer = this.scene.time.delayedCall(
      totalDuration,
      () => {
        this.restoreTint();
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
    this.clearFreezeEffects(true);
    this.clearReacquireTimer();
    this.clearTint();
    this.scene.explosions?.getFirstDead(true, this.x, this.y);
    this.scene.spawnCoin(this.x, this.y);
    this.destroy();
  }

  freeze(duration = ICE_FREEZE_DURATION) {
    if (!this.active) {
      return;
    }

    if (this.freezeTimer) {
      this.freezeTimer.remove(false);
      this.freezeTimer = this.scene.time.delayedCall(
        duration,
        this.endFreeze,
        null,
        this
      );
      return;
    }

    this.isFrozen = true;
    if (this.body) {
      this.frozenAllowGravity = this.body.allowGravity;
      this.body.setVelocity(0, 0);
      this.body.setAllowGravity(false);
    }
    this.frozenTweens = this.scene.tweens?.getTweensOf(this) ?? [];
    this.frozenTweens.forEach((tween) => tween.pause());
    this.hitFlashActive = false;
    this.applyTintColor(ICE_FREEZE_TINT);
    this.freezeTimer = this.scene.time.delayedCall(
      duration,
      this.endFreeze,
      null,
      this
    );
  }

  endFreeze() {
    if (this.freezeTimer) {
      this.freezeTimer.remove(false);
      this.freezeTimer = null;
    }
    if (!this.isFrozen) {
      return;
    }
    this.isFrozen = false;
    if (this.body) {
      const allowGravity =
        this.frozenAllowGravity !== undefined
          ? this.frozenAllowGravity
          : true;
      this.body.setAllowGravity(allowGravity);
    }
    this.frozenAllowGravity = undefined;
    if (this.frozenTweens) {
      this.frozenTweens.forEach((tween) => tween.resume());
      this.frozenTweens = null;
    }
    this.clearTint();
  }

  clearFreezeEffects(forceStopTweens = false) {
    if (this.freezeTimer) {
      this.freezeTimer.remove(false);
      this.freezeTimer = null;
    }
    if (!this.isFrozen) {
      return;
    }
    this.isFrozen = false;
    if (this.body) {
      const allowGravity =
        this.frozenAllowGravity !== undefined
          ? this.frozenAllowGravity
          : true;
      this.body.setAllowGravity(allowGravity);
    }
    this.frozenAllowGravity = undefined;
    if (this.frozenTweens) {
      this.frozenTweens.forEach((tween) => {
        if (forceStopTweens) {
          tween.stop();
        } else {
          tween.resume();
        }
      });
      this.frozenTweens = null;
    }
    this.hitFlashActive = false;
    this.restoreTint();
  }

  applyTintColor(color) {
    if (typeof this.setTintFill === "function") {
      this.setTintFill(color);
    } else {
      this.setTint(color);
    }
  }

  restoreTint() {
    if (this.isFrozen) {
      this.applyTintColor(ICE_FREEZE_TINT);
    } else {
      this.clearTint();
    }
  }

  destroy(fromScene) {
    this.clearFreezeEffects(true);
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
