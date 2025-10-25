import Phaser from "phaser";

export default class Skeleton extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, "skeleton");
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCollideWorldBounds(true);
    this.body.setSize(10, 22, false);
    this.body.setOffset(4, 10);
    
    this.state = "WALK";
    this.health = 4;
    this.speed = 50;
    this.throwSpeed = 3000;
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
    this.maxConsecutiveThrows = 2;
    this.remainingThrows = this.maxConsecutiveThrows;
    
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

    switch (this.state) {
      case "HIT":
        this.updateHitState();
        break;
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

  updateHitState() {
    this.anims.play("skeleton-hit", true);
    this.body.setVelocityX(0);
    
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
    if (this.state === "HIT") return;
    
    this.state = "HIT";
    this.scene.sound.play("hit");
    this.health--;
    this.clearTimer('punchAttackTimer');
    this.cancelPunchGlide();
  }

  determineDirection() {
    const playerToRight = this.scene.player.x > this.x;
    
    if (playerToRight !== this.facingRight) {
      this.facingRight = playerToRight;
      this.flipX = !playerToRight;
    }
    
    this.body.setVelocityX(playerToRight ? 20 : -20);
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
    if (this.isTinted) {
      this.clearTint();
    } else {
      this.setTint(0x000000);
    }
  }

  endHit() {
    this.state = "WALK";
    this.clearTimer('flashTimer');
    this.clearTimer('hitTimer');
    this.clearTint();
  }

  die() {
    this.scene.explosions.getFirstDead(true, this.x - 2, this.y + 3);
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
    this.throwAttackRangeX = Phaser.Math.Between(100, 150);
    this.punchAttackRangeX = Phaser.Math.Between(0, 80);
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
      this.cancelPunchGlide();
      this.punchGlideTween = this.scene.tweens.add({
        targets: this,
        x: this.x + glideDistance,
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

  destroy() {
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
