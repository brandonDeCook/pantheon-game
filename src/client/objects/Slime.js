import Phaser from "phaser";
import {
  ICE_FREEZE_TINT,
  ICE_FREEZE_FLASH_TINT,
  ICE_FREEZE_DURATION,
} from "../Constants.js";
import { playSoundWithDetune } from "../utils/sound.js";

const STATE_WALK = "WALK";
const STATE_JUMP = "JUMP";
const STATE_LAND = "LAND";

export default class Slime extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, "slime");
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.body.setSize(8, 8, false);
    this.body.setOffset(5, 6);
    this.setDepth(15);

    this.player = scene.player;
    this.speed = 20;
    this.state = STATE_WALK;
    this.maxHealth = 3;
    this.health = this.maxHealth;
    this.flashTimer = null;
    this.hitTimer = null;
    this.facingRight = true;
    this.isHit = false;

    this.jumpRangeToPlayer = Phaser.Math.Between(30, 50);
    this.jumpSpeedY = -100;
    this.jumpHorizontalVelocity = Phaser.Math.Between(35, 45);
    this.jumpCooldown = 1000;
    this.nextJumpTime = 0;
    this.jumpDirection = 0;
    this.lastHitDetune = null;

    this.on(
      Phaser.Animations.Events.ANIMATION_COMPLETE,
      this.onAnimComplete,
      this
    );

    this.play("slime-walk");
    this.isFrozen = false;
    this.freezeTimer = null;
    this.frozenAllowGravity = this.body?.allowGravity ?? true;
    this.frozenTweens = null;
  }

  preUpdate(time, delta) {
    super.preUpdate(time, delta);
  }

  update() {
    if (!this.active || !this.body) {
      return;
    }

    if (this.health <= 0) {
      this.die();
      return;
    }

    if (this.isHit) {
      this.updateHitEffects();
    }

    if (this.isFrozen) {
      return;
    }

    switch (this.state) {
      case STATE_JUMP:
        this.handleJumpState();
        break;
      case STATE_LAND:
        this.handleLandState();
        break;
      default:
        this.handleWalkState();
        break;
    }
  }

  handleWalkState() {
    if (!this.player || !this.player.active) {
      this.body.setVelocityX(0);
      this.anims.play("slime-walk", true);
      return;
    }

    const deltaX = this.player.x - this.x;
    const direction = Math.sign(deltaX);
    const distance = Math.abs(deltaX);

    if (
      this.isOnGround() &&
      direction !== 0 &&
      distance <= this.jumpRangeToPlayer &&
      this.scene.time.now >= this.nextJumpTime
    ) {
      this.startJump(direction);
      return;
    }

    this.body.setVelocityX(direction * this.speed);
    this.flipX = direction < 0;
    if (direction !== 0) {
      this.facingRight = direction > 0;
    }
    this.anims.play("slime-walk", true);
  }

  updateHitEffects() {
    if (!this.flashTimer) {
      this.flashTimer = this.scene.time.addEvent({
        delay: 75,
        callback: this.toggleFlash,
        callbackScope: this,
        loop: true,
      });
    }

    if (!this.hitTimer) {
      this.hitTimer = this.scene.time.addEvent({
        delay: 400,
        callback: this.endHitState,
        callbackScope: this,
      });
    }
  }

  handleJumpState() {
    this.anims.play("slime-jump", true);

    if (this.isOnGround() && this.body.velocity.y >= 0) {
      this.startLanding();
    }
  }

  handleLandState() {
    this.body.setVelocityX(0);
    this.anims.play("slime-land", true);
  }

  hit() {
    if (!this.active) {
      return;
    }

    this.health = Math.max(0, this.health - 1);
    this.lastHitDetune = playSoundWithDetune(this.scene, "hit", {
      lastDetune: this.lastHitDetune,
    });
    this.jumpDirection = 0;
    this.isHit = true;

    if (this.health <= 0) {
      this.die();
      return;
    }

    this.clearHitTimers();
    this.updateHitEffects();
  }

  startJump(direction) {
    this.state = STATE_JUMP;
    this.jumpDirection = direction;
    this.nextJumpTime = this.scene.time.now + this.jumpCooldown;
    this.body.setVelocityY(this.jumpSpeedY);
    this.body.setVelocityX(direction * this.jumpHorizontalVelocity);
    this.facingRight = direction > 0;
    this.flipX = direction < 0;
    this.anims.play("slime-jump", true);
  }

  startLanding() {
    if (this.state === STATE_LAND) {
      return;
    }

    this.state = STATE_LAND;
    this.jumpDirection = 0;
    this.body.setVelocityX(0);
    this.anims.play("slime-land", true);
  }

  endHitState() {
    this.hitFlashActive = false;
    this.clearHitTimers();
    if (this.health > 0) {
      this.isHit = false;
      this.restoreTint();
    }
  }

  toggleFlash() {
    if (this.hitFlashActive) {
      this.hitFlashActive = false;
      this.restoreTint();
      return;
    }
    const tintColor = this.isFrozen ? ICE_FREEZE_FLASH_TINT : 0x000000;
    this.applyTintColor(tintColor);
    this.hitFlashActive = true;
  }

  clearHitTimers() {
    if (this.flashTimer) {
      this.flashTimer.remove(false);
      this.flashTimer = null;
    }
    if (this.hitTimer) {
      this.hitTimer.remove(false);
      this.hitTimer = null;
    }
  }

  die() {
    if (!this.active) {
      return;
    }

    this.clearFreezeEffects(true);
    this.hitFlashActive = false;
    this.clearHitTimers();
    this.restoreTint();
    this.isHit = false;
    this.scene.player?.addSpecialCharge?.(10);
    this.scene.smallExplosions?.getFirstDead(true, this.x, this.y);
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
          : true;
      this.body.setAllowGravity(allowGravity);
    }
    this.frozenAllowGravity = undefined;
    if (this.frozenTweens) {
      this.frozenTweens.forEach((tween) => tween.resume());
      this.frozenTweens = null;
    }
    this.hitFlashActive = false;
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

  onAnimComplete(animation) {
    if (animation.key === "slime-land" && this.state === STATE_LAND) {
      this.state = STATE_WALK;
      this.restoreTint();
      this.anims.play("slime-walk", true);
    }
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

  isOnGround() {
    return !!this.body?.blocked?.down;
  }
}
