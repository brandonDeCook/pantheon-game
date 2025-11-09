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
    this.defaultLifespan = 1500;
    this.currentLifespan = this.defaultLifespan;
  }

  activate(x, y, velocityX, lifespan) {
    this.setPosition(x, y);
    this.setActive(true);
    this.setVisible(true);
    this.body.enable = true;
    this.body.setVelocity(velocityX, 0);
    this.setFlipX(velocityX < 0);
    this.currentLifespan = lifespan ?? this.defaultLifespan;
    this.startLifespan();
  }

  startLifespan() {
    if (this.lifespanTimer) {
      this.lifespanTimer.remove(false);
    }
    const duration = this.currentLifespan ?? this.defaultLifespan;
    this.lifespanTimer = this.scene.time.delayedCall(
      duration,
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
