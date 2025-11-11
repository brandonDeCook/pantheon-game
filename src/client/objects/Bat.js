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
    this.attackDiveSpeed = 160;
    this.attackThreshold = 4;
    this.flipX = true;
    this.health = 3;
    this.invulnerable = false;
    this.flashTimer = null;
    this.flashCleanupTimer = null;
    this.diving = false;

    this.enterFlyState();
  }

  enterFlyState() {
    this.state = "FLY";
    if (this.body) {
      this.body.setVelocityY(0);
      this.body.setVelocityX(0);
    }
    this.anims.play("bat-fly", true);
    this.diving = false;
    if (this.shakeTween) {
      this.shakeTween.stop();
      this.shakeTween = null;
    }
  }

  enterAttackState() {
    if (this.state === "ATTACK") {
      return;
    }

    this.prepareDive();
  }

  prepareDive() {
    this.state = "ATTACK";
    this.diving = false;
    if (this.body) {
      this.body.setVelocityX(0);
      this.body.setVelocityY(0);
    }
    this.anims.play("bat-fly", true);
    this.startShake();
    this.scene.time.delayedCall(
      500,
      () => {
        if (this.state === "ATTACK" && !this.diving) {
          this.startDive();
        }
      },
      null,
      this
    );
  }

  triggerAttack() {
    this.enterAttackState();
  }

  takeDamage(amount = 1) {
    if (!this.active || this.state === "HIT") return;
    this.health -= amount;
    if (this.health <= 0) {
      this.die();
      return;
    }
    this.startDamageFlash();
  }

  die() {
    if (!this.active) return;
    this.diving = false;
    this.scene.smallExplosions?.getFirstDead(true, this.x, this.y);
    this.scene.spawnCoin(this.x, this.y);
    this.destroy();
  }

  update() {
    if (!this.player || !this.player.active || !this.body) {
      return;
    }

    if (this.state === "FLY") {
      this.handleFlyState();
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
    if (!this.diving) {
      this.body.setVelocityX(0);
      this.body.setVelocityY(0);
      return;
    }

    this.body.setVelocityX(0);
    this.body.setVelocityY(this.attackDiveSpeed);
    this.anims.play("bat-dive", true);

    const bounds = this.scene.physics.world.bounds;
    if (this.y >= bounds.bottom - 4) {
      this.die();
    }
  }

  startShake() {
    if (this.shakeTween) {
      this.shakeTween.stop();
    }

    const amplitude = 2;
    this.shakeTween = this.scene.tweens.add({
      targets: this,
      x: this.x + amplitude,
      duration: 60,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: 3,
      onComplete: () => {
        this.shakeTween = null;
      },
    });
  }

  startDive() {
    if (!this.active || !this.body) {
      return;
    }

    this.diving = true;
    this.body.setVelocityX(0);
    this.body.setVelocityY(this.attackDiveSpeed);
    this.anims.play("bat-dive", true);
    this.scene.sound.play("badBatDive");
  }

  destroy() {
    if (this.flashTimer) {
      this.flashTimer.remove(false);
    }
    if (this.flashCleanupTimer) {
      this.flashCleanupTimer.remove(false);
      this.flashCleanupTimer = null;
    }
    this.clearAttackPrep();
    super.destroy();
  }

  clearAttackPrep() {
    this.diving = false;
    if (this.shakeTween) {
      this.shakeTween.stop();
      this.shakeTween = null;
    }
    if (this.flashCleanupTimer) {
      this.flashCleanupTimer.remove(false);
      this.flashCleanupTimer = null;
    }
  }

  startDamageFlash() {
    if (this.flashTimer) {
      return;
    }

    this.flashTimer = this.scene.time.addEvent({
      delay: 75,
      repeat: 5,
      callback: () => {
        if (!this.isTinted) {
          this.setTint(0xff0000);
        } else {
          this.clearTint();
        }
      },
      callbackScope: this,
    });
    const totalDuration = (this.flashTimer.repeat + 1) * this.flashTimer.delay;
    this.flashCleanupTimer = this.scene.time.delayedCall(
      totalDuration,
      () => {
        this.clearTint();
        if (this.flashTimer) {
          this.flashTimer.remove(false);
          this.flashTimer = null;
        }
        this.flashCleanupTimer = null;
      },
      null,
      this
    );
  }
}
