import Phaser from "phaser";

export default class Bat extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, "badBat");
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.body.setAllowGravity(false);
    this.body.setSize(10, 10, false);
    this.body.setOffset(2, 4);
    this.setDepth(20);

    this.player = scene.player;
    this.state = "FLY";
    this.hoverY = y;
    this.flySpeed = 25;
    this.verticalDriftSpeed = 30;
    this.attackDiveSpeed = 120;
    this.attackThreshold = 4;
    this.attackTargetY = null;
    this.flipX = true;
    this.attackRecoveryY = this.hoverY;
    this.health = 3;
    this.invulnerable = false;
    this.hitTimer = null;
    this.flashTimer = null;
    this.attackDelayTimer = null;
    this.attackShakeTween = null;

    this.enterFlyState();
  }

  startAttackShake() {
    if (this.attackShakeTween) {
      this.attackShakeTween.stop();
    } else {
      const amplitude = 2;
      this.attackShakeTween = this.scene.tweens.add({
        targets: this,
        x: {
          from: this.x - amplitude,
          to: this.x + amplitude,
        },
        yoyo: true,
        duration: 60,
        repeat: 4,
        onComplete: () => {
          this.attackShakeTween = null;
        },
      });
    }
  }

  enterFlyState() {
    this.state = "FLY";
    this.attackTargetY = null;
    this.body.setVelocityY(0);
    this.anims.play("bat-fly", true);
  }

  enterAttackState() {
    if (this.state === "ATTACK") {
      return;
    }

    this.state = "ATTACK";
    this.anims.play("bat-dive", true);
    this.attackTargetY = null;
  }

  triggerAttack() {
    this.enterAttackState();
  }

  takeDamage(amount = 1) {
    if (!this.active || this.state === "HIT") return;
    this.health -= amount;
    if (this.health <= 0) {
      this.die();
    } else {
      this.enterHitState();
    }
  }

  die() {
    if (!this.active) return;
    this.scene.smallExplosions?.getFirstDead(true, this.x, this.y);
    this.destroy();
  }

  update() {
    if (!this.player || !this.player.active || !this.body) {
      return;
    }

    if (this.state === "FLY") {
      this.handleFlyState();
    } else if (this.state === "HIT") {
      this.handleHitState();
    } else if (this.state === "ATTACK") {
      this.handleAttackState();
    }
  }

  handleFlyState() {
    const deltaX = this.player.x - this.x;
    const direction = Math.sign(deltaX);
    this.body.setVelocityX(direction * this.flySpeed);
    this.flipX = direction < 0;

    const hoverDelta = this.hoverY - this.y;
    this.body.setVelocityY(
      Phaser.Math.Clamp(
        hoverDelta * 2,
        -this.verticalDriftSpeed,
        this.verticalDriftSpeed
      )
    );

    const alignedWithPlayer =
      Math.abs(deltaX) <= this.attackThreshold && this.y < this.player.y;

    if (alignedWithPlayer) {
      this.enterAttackState();
    } else {
      this.anims.play("bat-fly", true);
    }
  }

  handleAttackState() {
    this.body.setVelocityX(0);
    if (!this.attackDelayTimer) {
      this.startAttackShake();
      this.attackDelayTimer = this.scene.time.delayedCall(
        500,
        () => {
          this.attackDelayTimer = null;
          if (this.state === "ATTACK" && this.body) {
            this.anims.play("bat-dive", true);
            this.body.setVelocityY(this.attackDiveSpeed);
          }
        },
        null,
        this
      );
    }
  }

  enterHitState() {
    if (this.state === "HIT") {
      return;
    }
    this.state = "HIT";
    this.clearAttackPrep();
    if (this.body) {
      this.body.setVelocity(0, 0);
    }
    this.anims.play("bat-fly", true);
    this.handleHitState();
  }

  handleHitState() {
    this.body.setVelocity(0, 0);
    this.anims.play("bat-fly", true);

    if (!this.flashTimer) {
      this.flashTimer = this.scene.time.addEvent({
        delay: 75,
        loop: true,
        callback: () => {
          if (!this.isTinted) {
            this.setTint(0xff0000);
          } else {
            this.clearTint();
          }
        },
      });
    }

    if (!this.hitTimer) {
      this.hitTimer = this.scene.time.addEvent({
        delay: 250,
        callback: this.endHitState,
        callbackScope: this,
      });
    }
  }

  endHitState() {
    this.clearTint();
    if (this.flashTimer) {
      this.flashTimer.remove(false);
      this.flashTimer = null;
    }
    if (this.hitTimer) {
      this.hitTimer.remove(false);
      this.hitTimer = null;
    }
    this.enterFlyState();
  }

  destroy() {
    if (this.flashTimer) {
      this.flashTimer.remove(false);
    }
    if (this.hitTimer) {
      this.hitTimer.remove(false);
    }
    this.clearAttackPrep();
    super.destroy();
  }

  clearAttackPrep() {
    if (this.attackDelayTimer) {
      this.attackDelayTimer.remove(false);
      this.attackDelayTimer = null;
    }
    if (this.attackShakeTween) {
      this.attackShakeTween.stop();
      this.attackShakeTween = null;
    }
  }
}
