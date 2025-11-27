import Phaser from "phaser";
import {
  ICE_FREEZE_TINT,
  ICE_FREEZE_FLASH_TINT,
  ICE_FREEZE_DURATION,
} from "../Constants.js";

export default class Skeleton extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, "skeleton");
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCollideWorldBounds(true);
    this.body.setSize(6, 20, false);
    this.body.setOffset(4, 12);
    this.state = "WALK";
    this.health = 5;
    this.speed = 24;
    this.throwSpeed = 2500;
    this.facingRight = true;
    
    this.throwAttackTimer = null;
    this.punchAttackTimer = null;
    this.throwAttackResetTimer = null;
    this.hitTimer = null;
    this.flashTimer = null;
    this.idleTimer = null;
    this.readyToThrow = true;
    this.punchGlideStarted = false;
    this.punchGlideTween = null;
    this.maxConsecutiveThrows = 3;
    this.remainingThrows = this.maxConsecutiveThrows;
    this.isHit = false;
    this.isFrozen = false;
    this.freezeTimer = null;
    this.frozenAllowGravity = undefined;
    this.frozenTweens = null;
    this.defaultAllowGravity = this.body?.allowGravity ?? true;
    this.hitFlashActive = false;
    
    this.resetAttackRanges();
    this.currentAttackAtX = 0;
    this.currentXDistanceFromPlayer = 0;
    
    this.on(Phaser.Animations.Events.ANIMATION_UPDATE, this.onAnimUpdate.bind(this));
    this.on(Phaser.Animations.Events.ANIMATION_UPDATE, this.onAnimComplete.bind(this));
  }

  update(time, delta) {
    if (!this.active) return;

    if (this.health <= 0) {
      this.die();
      return;
    }

    if (this.state !== "THROW_ATTACK") {
      this.currentXDistanceFromPlayer = this.x - this.scene.player.x;
    }

    if (this.isHit) {
      this.updateHitEffects();
    }

    if (this.isFrozen) {
      return;
    }

    switch (this.state) {
      case "THROW_ATTACK":
        this.updateThrowAttackState();
        break;
      case "PUNCH_ATTACK":
        this.updatePunchAttackState();
        break;
      case "WALK":
        this.updateWalkState();
        break;
    }
  }

  updateHitEffects() {
    if (!this.hitTimer) {
      this.hitTimer = this.scene.time.addEvent({
        delay: 400,
        callback: this.endHit,
        callbackScope: this,
      });
    }

    if (!this.flashTimer) {
      this.flashTimer = this.scene.time.addEvent({
        delay: 75,
        callback: this.flash,
        callbackScope: this,
        loop: true,
      });
    }
  }

  updateThrowAttackState() {
    this.body.setVelocityX(0);

    if (this.readyToThrow) {
      this.anims.play("skeleton-throw-attack", true);
    } else {
      this.anims.play("skeleton-idle", true);

      if (!this.idleTimer) {
        this.idleTimer = this.scene.time.addEvent({
          delay: this.throwSpeed,
          callback: this.endIdle,
          callbackScope: this,
        });
      }
    }

    const playerMoved =
      Math.abs(this.scene.player.x - this.currentAttackAtX) > 10;
    if (playerMoved && !this.throwAttackResetTimer || !this.remainingThrows) {
      this.throwAttackResetTimer = this.scene.time.addEvent({
        delay: 2000,
        callback: this.throwAttackReset,
        callbackScope: this,
      });
    }
  }

  updatePunchAttackState() {
    this.body.setVelocityX(0);
    this.anims.play("skeleton-punch-attack", true);
  }

  updateWalkState() {
    this.anims.play("skeleton-walk", true);
    this.determineDirection();
     
    const inThrowAttackRange =
      Math.abs(this.currentXDistanceFromPlayer) < this.throwAttackRangeX;
    const inPunchAttackRange = Math.abs(this.currentXDistanceFromPlayer) < this.punchAttackRangeX;
    if (inThrowAttackRange && !this.throwAttackTimer && this.remainingThrows > 0) {
      this.startThrowAttackTimer();
    }
    if (inPunchAttackRange && !this.punchAttackTimer) {
      this.startPunchAttackTimer();
    }
  }

  startThrowAttackTimer() {
    this.throwAttackTimer = this.scene.time.addEvent({
      delay: Phaser.Math.Between(500, 2500),
      callback: this.throwAttack,
      callbackScope: this,
    });
  }

  startPunchAttackTimer() {
    this.punchAttackTimer = this.scene.time.addEvent({
      delay: Phaser.Math.Between(200, 600),
      callback: this.punchAttack,
      callbackScope: this,
    });
  }

  hit() {
    if (!this.active) {
      return;
    }

    this.scene.sound.play("hit");
    this.health = Math.max(0, this.health - 1);

    if (this.health <= 0) {
      this.die();
      return;
    }

    this.isHit = true;
    this.clearTimer("punchAttackTimer");
    this.cancelPunchGlide();
    this.clearTimer("hitTimer");
    this.clearTimer("flashTimer");
  }

  determineDirection() {
    const playerToRight = this.scene.player.x > this.x;
    
    if (playerToRight !== this.facingRight) {
      this.facingRight = playerToRight;
      this.flipX = !playerToRight;
    }
    
    this.body.setVelocityX(playerToRight ? this.speed : -(this.speed));
  }

  throwAttack() {
    this.state = "THROW_ATTACK";
    this.clearTimer('throwAttackTimer');
    this.currentAttackAtX = this.scene.player.x;    
  }
  
  punchAttack() {
    this.state = "PUNCH_ATTACK";
    this.clearTimer('punchAttackTimer');
    this.cancelPunchGlide();
    this.body.setVelocityX(0);
    this.punchGlideStarted = false;
  }

  throwAttackReset() {
    this.clearTimer('throwAttackTimer');
    this.clearTimer('throwAttackResetTimer');
    this.clearTimer('idleTimer');
    this.clearTimer('punchAttackTimer');
    this.cancelPunchGlide();
    this.resetAttackRanges();
    this.state = "WALK";
    this.readyToThrow = true;
  }

  endIdle() {
    this.clearTimer('idleTimer');
    this.readyToThrow = true;
  }

  flash() {
    if (this.hitFlashActive) {
      this.hitFlashActive = false;
      this.restoreTint();
      return;
    }
    const tintColor = this.isFrozen ? ICE_FREEZE_FLASH_TINT : 0x000000;
    this.applyTintColor(tintColor);
    this.hitFlashActive = true;
  }

  endHit() {
    this.isHit = false;
    this.clearTimer('flashTimer');
    this.clearTimer('hitTimer');
    this.hitFlashActive = false;
    this.restoreTint();
  }

  die() {
    this.clearFreezeEffects(true);
    this.scene.explosions.getFirstDead(true, this.x - 2, this.y + 3);
    this.scene.spawnCoin(this.x, this.y);
    this.clearTimer('throwAttackTimer');
    this.clearTimer('punchAttackTimer');
    this.cancelPunchGlide();
    this.destroy();
  }

  clearTimer(timerName) {
    if (this[timerName]) {
      this[timerName].paused = true;
      this[timerName] = null;
    }
  }

  resetAttackRanges() {
    this.throwAttackRangeX = Phaser.Math.Between(125, 160);
    this.punchAttackRangeX = Phaser.Math.Between(15, 80);
  }

  onAnimUpdate(animation, frame) {
    if (animation.key === "skeleton-throw-attack" && frame.index === 2) {
      const bone = this.scene.bones.getFirstDead(true, this.x, this.y - 5);
      bone.activate(this.currentXDistanceFromPlayer);
      this.remainingThrows = Math.max(0, this.remainingThrows - 1);
    }
    if (
      animation.key === "skeleton-punch-attack" &&
      frame.isLast &&
      this.state === "PUNCH_ATTACK" &&
      !this.punchGlideStarted
    ) {
      this.punchGlideStarted = true;
      const direction = this.facingRight ? 1 : -1;
      const glideDistance = 60 * direction;
      const bounds = this.scene.physics.world.bounds;
      const halfWidth = (this.body?.width ?? this.width ?? 0) * 0.5;
      const minX = bounds.left + halfWidth;
      const maxX = bounds.right - halfWidth;
      const targetX = Phaser.Math.Clamp(this.x + glideDistance, minX, maxX);
      const actualDistance = targetX - this.x;
      if (actualDistance === 0) {
        this.endPunchAttack();
        return;
      }
      this.cancelPunchGlide();
      this.punchGlideTween = this.scene.tweens.add({
        targets: this,
        x: targetX,
        duration: 750,
        ease: "Sine.easeOut",
        onComplete: () => {
          this.punchGlideTween = null;
          this.endPunchAttack();
        },
      });
    }
  }

  onAnimComplete(animation, frame) {
    if (animation.key === "skeleton-throw-attack") {
      this.readyToThrow = false;
    }
  }
  
  endPunchAttack() {
    this.cancelPunchGlide();
    if (this.state === "PUNCH_ATTACK") {
      this.state = "WALK";
    }
  }

  cancelPunchGlide() {
    if (this.punchGlideTween) {
      this.punchGlideTween.stop();
      this.punchGlideTween.remove();
      this.punchGlideTween = null;
    }
    this.punchGlideStarted = false;
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
    this.hitFlashActive = false;
    this.frozenTweens = this.scene.tweens?.getTweensOf(this) ?? [];
    this.frozenTweens.forEach((tween) => tween.pause());
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
          : this.defaultAllowGravity;
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
          : this.defaultAllowGravity;
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

  destroy() {
    this.clearFreezeEffects(true);
    this.clearTimer('throwAttackTimer');
    this.clearTimer('throwAttackResetTimer');
    this.clearTimer('punchAttackTimer');
    this.cancelPunchGlide();
    this.clearTimer('hitTimer');
    this.clearTimer('flashTimer');
    this.clearTimer('idleTimer');
    super.destroy();
  }
}
