import Phaser from "phaser";

export default class Coin extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, value = 10) {
    super(scene, x, y, "coin");
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.value = value;
    this.body.setAllowGravity(true);
    this.body.setImmovable(false);
    this.body.setCollideWorldBounds(true);
    this.body.setBounce(0.2);
    this.body.setDragX(600);
    this.anims.play("coin-idle", true);

    this.lifespanTimer = null;
    this.flashTimer = null;
  }

  setValue(amount) {
    this.value = amount;
    return this;
  }

  activate(x, y, value) {
    this.setPosition(x, y)
      .setActive(true)
      .setVisible(true)
      .setValue(value);
    this.play("coin-idle", true);
    if (this.body) {
      this.body.enable = true;
      this.body.setVelocity(
        Phaser.Math.Between(0, 0),
        Phaser.Math.Between(40, 120)
      );
    }
    this.startLifespan();
  }

  startLifespan() {
    if (this.lifespanTimer) {
      this.lifespanTimer.remove(false);
    }
    if (this.flashTimer) {
      this.flashTimer.remove(false);
      this.flashTimer = null;
    }

    this.play("coin-idle", true);

    const flashStart = 6000;
    this.lifespanTimer = this.scene.time.delayedCall(
      flashStart,
      () => {
        this.startFlash();
        this.scene.time.delayedCall(1000, () => this.despawn(), null, this);
      },
      null,
      this
    );
  }

  startFlash() {
    this.flashTimer = this.scene.time.addEvent({
      delay: 100,
      callback: () => {
        this.setVisible(!this.visible);
      },
      repeat: 9,
      callbackScope: this,
    });
  }

  despawn() {
    this.setActive(false);
    this.setVisible(false);
    if (this.body) {
      this.body.enable = false;
      this.body.setVelocity(0, 0);
    }
    if (this.flashTimer) {
      this.flashTimer.remove(false);
      this.flashTimer = null;
    }
    if (this.lifespanTimer) {
      this.lifespanTimer.remove(false);
      this.lifespanTimer = null;
    }
  }

  collect() {
    this.despawn();
  }
}
