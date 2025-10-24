import Phaser from "phaser";
export default class Bone extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, "bone");
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body.setAllowGravity(false);
    this.isActivated = false;
  }

  update(time, delta) {
    if (this.isActivated) {
      this.curve.getPoint(this.path.t, this.path.vec);
      this.body.x = this.path.vec.x;
      this.body.y = this.path.vec.y;
    }
  }

  activate(xDistanceFromPlayer) {
    this.anims.play({ key: "rotate", repeat: -1 });
    this.isActivated = true;
    this.path = { t: 0, vec: new Phaser.Math.Vector2() };

    var points = [];
    points.push(new Phaser.Math.Vector2(this.body.x, this.body.y));
    points.push(
      new Phaser.Math.Vector2(
        this.body.x - xDistanceFromPlayer / 2,
        this.body.y - 30
      )
    );
    points.push(
      new Phaser.Math.Vector2(this.body.x - xDistanceFromPlayer, 170)
    );

    this.curve = new Phaser.Curves.Spline(points);

    this.scene.tweens.add({
      targets: this.path,
      t: 1,
      ease: "Linear",
      duration: 1300,
      yoyo: false,
      repeat: 0,
      onComplete: this.hit.bind(this),
    });
  }

  hit() {
    if (this.active) {
      this.scene.smallExplosions.getFirstDead(true, this.x, this.y);
      this.destroy();
    }
  }
}
