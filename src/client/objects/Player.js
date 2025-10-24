import Phaser from "phaser";

export default class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, zoom) {
    super(scene, x, y, "player");

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.speed = 40;
    this.cursors = scene.input.keyboard.createCursorKeys();
    this.zkey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    this.facingRight = true;
    this.lastFired = 0;
    this.fireRate = 500;
    this.play("player-idle");
    this.setCollideWorldBounds(true);
    this.arrowShootSound = scene.sound.add("arrowShoot");
    this.setDepth(9001);

    this.playerHealth = { current: 5, max: 5, bars: [] };
    for (var index = 0; index < this.playerHealth.max; index++) {
      this.playerHealth.bars.push(
        scene.add.sprite(68 + index * 5, 24, "healthBar")
      );
    }

    this.on(
      Phaser.Animations.Events.ANIMATION_COMPLETE,
      this.onAnimComplete.bind(this)
    );

    const playerHealthText = scene.add
      .text(245, 200, "PLAYER", {
        fontFamily: "standard",
        fontSize: "24px",
        color: "#FFFFFF",
      })
      .setScrollFactor(0)
      .setScale(1 / zoom)
      .setDepth(100);

    this.arrows = scene.physics.add.group({
      defaultKey: "arrow",
      frameQuantity: 10,
      allowGravity: false,
      runChildUpdate: true,
      active: false,
      visible: false,
    });
  }

  update(time, delta) {
    const { left, right, up, down } = this.cursors;

    if (this.zkey.isDown && !down.isDown) {
      this.body.setVelocityX(0);

      if (up.isDown) {
        this.flipX = false;
        this.play("player-arrow-fire-up", true);
      } else {
        this.play("player-arrow-fire-stand", true);

        if (left.isDown && this.facingRight) {
          this.facingRight = false;
          this.flipX = true;
        } else if (right.isDown && !this.facingRight) {
          this.facingRight = true;
          this.flipX = false;
        }
      }
    } else if (down.isDown) {
      if (left.isDown) {
        this.facingRight = false;
        this.flipX = true;
      } else if (right.isDown) {
        this.facingRight = true;
        this.flipX = false;
      }

      if (this.zkey.isDown) {
        this.anims.play("player-arrow-fire-crouch", true);
      } else {
        this.anims.play("player-crouch", true);
      }
      this.body.setVelocityX(0);
    } else if (right.isDown) {
      this.facingRight = true;
      this.flipX = false;
      this.anims.play("player-walk", true);
      this.body.setVelocityX(this.speed);
    } else if (left.isDown) {
      this.facingRight = false;
      this.flipX = true;
      this.anims.play("player-walk", true);
      this.body.setVelocityX(-this.speed);
    } else {
      this.body.setVelocityX(0);
      this.anims.play("player-idle", true);
    }

    if (this.state == "HIT") {
      if (!this.flashTimer) {
        this.flashTimer = this.scene.time.addEvent({
          delay: 75,
          callback: this.flash,
          callbackScope: this,
          loop: true,
        });
      }
    }
  }

  hit() {
    if (this.playerHealth.current > 0 && this.state != "HIT") {
      this.state = "HIT";
      this.scene.sound.play("playerHit");
      this.playerHealth.current -= 1;

      for (
        var index = this.playerHealth.bars.length - 1;
        index > this.playerHealth.current - 1;
        index--
      ) {
        var bar = this.playerHealth.bars[index];
        bar.setFrame("1");
      }

      if (!this.hitTimer) {
        this.hitTimer = this.scene.time.addEvent({
          delay: 1500,
          callback: this.endHit,
          callbackScope: this,
          repeat: 0,
        });
      }
    }
  }

  endHit() {
    this.state = "NONE";
    this.flashTimer.paused = true;
    this.flashTimer = undefined;
    this.hitTimer = undefined;
    this.clearTint();
  }

  flash() {
    if (this.isTinted) {
      this.clearTint();
    } else {
      this.setTint(0x000000);
    }
  }

  onAnimComplete() {
    if (!this.anims.currentAnim) {
      return;
    }

    const key = this.anims.currentAnim.key;
    const velocityBase = 250;

    if (
      (key === "player-arrow-fire-crouch" ||
        key === "player-arrow-fire-stand") &&
      this.zkey.isDown
    ) {
      let velocity = velocityBase;
      let xPosBuffer = 3;
      let yPosBuffer = key === "player-arrow-fire-stand" ? -1 : 6;

      if (this.flipX) {
        velocity *= -1;
        xPosBuffer *= -1;
      }

      const arrow = this.arrows.getFirstDead(
        true,
        this.x + xPosBuffer,
        this.y + yPosBuffer
      );

      if (arrow) {
        arrow.angle = 0.0;
        arrow.flipX = this.flipX;
        arrow.setActive(true);
        arrow.setVisible(true);
        arrow.startX = arrow.x;
        arrow.startY = arrow.y;
        arrow.body.setVelocityX(velocity);
        arrow.body.setVelocityY(0);
        arrow.body.enable = true;
        this.arrowShootSound?.play();
      }
    } else if (key === "player-arrow-fire-up") {
      const arrow = this.arrows.getFirstDead(true, this.x, this.y - 2);
      if (arrow) {
        arrow.flipX = false;
        arrow.angle = -90.0;
        arrow.setActive(true);
        arrow.setVisible(true);
        arrow.startX = arrow.x;
        arrow.startY = arrow.y;
        arrow.body.setVelocityY(-velocityBase);
        arrow.body.setVelocityX(0);
        arrow.body.enable = true;
        this.arrowShootSound?.play();
      }
    }
  }
}
