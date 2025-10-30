import Phaser from "phaser";

export default class Slime extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, "slime");
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.body.setSize(10, 10, false);
    this.body.setOffset(4, 4);
    this.setDepth(15);

    this.player = scene.player;
    this.speed = 15;
    this.state = "WALK";
    this.maxHealth = 4;
    this.health = this.maxHealth;
    this.flashTimer = null;
    this.hitTimer = null;

    this.play("slime-walk");
  }

  update() {
    if (!this.active || !this.body) {
      return;
    }

    if (this.health <= 0) {
      this.die();
      return;
    }

    if (this.state === "HIT") {
      this.handleHitState();
    } else {
      this.handleWalkState();
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
    this.body.setVelocityX(direction * this.speed);
    this.flipX = direction < 0;
    this.anims.play("slime-walk", true);
  }

  handleHitState() {
    this.body.setVelocityX(0);
    this.anims.play("slime-walk", true);

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

  hit() {
    if (!this.active) {
      return;
    }

    this.health = Math.max(0, this.health - 1);
    this.state = "HIT";
    this.scene.sound.play("hit");

    if (this.health <= 0) {
      this.die();
      return;
    }

    this.clearHitTimers();
    this.handleHitState();
  }

  endHitState() {
    this.clearHitTimers();
    if (this.health > 0) {
      this.state = "WALK";
      this.clearTint();
    }
  }

  toggleFlash() {
    if (this.isTinted) {
      this.clearTint();
    } else {
      this.setTint(0x000000);
    }
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

    this.clearHitTimers();
    this.clearTint();
    this.scene.smallExplosions?.getFirstDead(true, this.x, this.y);
    this.destroy();
  }
}
