import Phaser from "phaser";

export default class Slash extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, "slashShot");
    scene.add.existing(this);
    scene.physics.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(15);
    this.body.setAllowGravity(false);
    this.body.setImmovable(true);
    this.body.setSize(this.width, this.height);
    this.lifespanTimer = null;
  }

  activate(x, y, velocityX) {
    this.setPosition(x, y);
    this.setActive(true);
    this.setVisible(true);
    this.body.enable = true;
    this.body.setVelocity(velocityX, 0);
    this.setFlipX(velocityX < 0);
    this.startLifespan();
  }

  startLifespan() {
    if (this.lifespanTimer) {
      this.lifespanTimer.remove(false);
    }
    this.lifespanTimer = this.scene.time.delayedCall(
      1500,
      () => this.despawn(),
      null,
      this
    );
  }

  despawn() {
    this.setActive(false);
    this.setVisible(false);
    this.body.enable = false;
    this.body.setVelocity(0, 0);
    if (this.lifespanTimer) {
      this.lifespanTimer.remove(false);
      this.lifespanTimer = null;
    }
  }
}
