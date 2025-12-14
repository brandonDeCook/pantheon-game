import Phaser from "phaser";

const TEXTURE_KEY = "playerSpecialAttackBlast";
const FRAME_HEIGHT = 20;
const FRAME_RECTS = [
  { name: "charge", x: 0, width: 3 },
  { name: "start", x: 7, width: 15 },
  { name: "middle", x: 26, width: 16 },
  { name: "end", x: 46, width: 16 },
];

export default class PlayerSpecialLaser {
  constructor(scene) {
    this.scene = scene;
    PlayerSpecialLaser.ensureFrames(scene);
    this.chargeFlashDuration = 70;
    this.chargeFlashRepeats = 2;

    this.root = scene.add.container(0, 0);
    this.root.setDepth(20);
    this.root.setVisible(false);

    this.hitbox = scene.add.zone(0, 0, 1, FRAME_HEIGHT);
    scene.physics.add.existing(this.hitbox);
    this.hitbox.body.setAllowGravity(false);
    this.hitbox.body.setImmovable(true);
    this.hitbox.body.enable = false;
    this.hitbox.setOrigin(0, 0.5);
    this.hitboxDepth = 20;
    this.hitbox.setDepth(this.hitboxDepth);

    this.chargeSprite = scene.add
      .image(0, 0, TEXTURE_KEY, "charge")
      .setOrigin(0, 0.5);
    this.startSprite = scene.add
      .image(0, 0, TEXTURE_KEY, "start")
      .setOrigin(0, 0.5);
    this.endSprite = scene.add
      .image(0, 0, TEXTURE_KEY, "end")
      .setOrigin(0, 0.5);

    this.middleSegments = [];
    this.root.add([this.chargeSprite, this.startSprite, this.endSprite]);

    this.direction = 1;
    this.totalWidth = 0;
    this.damageHeight = 18;
    this.hitboxYOffset = 8;
    this.durationMs = 550;
    this.flashTween = null;
    this.beamPulseEvent = null;
    this.despawnTimer = null;
    this.onActivateCb = null;
    this.onCompleteCb = null;
    this.beamPulseInterval = 60;
    this.beamPulseColors = [0xffffff, 0xf8b800];
    this.chargeFlashColors = [0xffffff, 0xf8b800];
  }

  static ensureFrames(scene) {
    if (!scene.textures.exists(TEXTURE_KEY)) {
      return;
    }

    const texture = scene.textures.get(TEXTURE_KEY);
    if (texture.has("start")) {
      return;
    }

    FRAME_RECTS.forEach(({ name, x, width }) => {
      texture.add(name, 0, x, 0, width, FRAME_HEIGHT);
    });
  }

  fire({
    x,
    y,
    facingRight = true,
    middleRepeats = 3,
    durationMs = this.durationMs,
    onActivate = null,
    onComplete = null,
  } = {}) {
    this.onActivateCb = typeof onActivate === "function" ? onActivate : null;
    this.onCompleteCb = typeof onComplete === "function" ? onComplete : null;
    this.direction = facingRight ? 1 : -1;
    this.buildBeam(Math.max(0, middleRepeats));
    this.root.setScale(this.direction, 1);
    this.root.setPosition(x, y + 2);
    this.hitbox.setPosition(x, y + this.hitboxYOffset + 4);

    this.setSegmentsVisible({ charge: true, beam: false });
    this.root.setVisible(true);
    this.hitbox.body.enable = false;

    if (this.flashTween) {
      this.flashTween.stop();
      this.flashTween = null;
    }

    this.flashTween = this.scene.tweens.add({
      targets: this.chargeSprite,
      tint: {
        from: this.chargeFlashColors[0],
        to: this.chargeFlashColors[1],
      },
      yoyo: true,
      repeat: this.chargeFlashRepeats,
      duration: this.chargeFlashDuration,
      onComplete: () => {
        this.chargeSprite.setTint(this.chargeFlashColors[0]);
        this.activateBeam(durationMs);
      },
    });
  }

  buildBeam(middleRepeats) {
    this.middleSegments.forEach((segment) => {
      segment.destroy();
    });
    this.middleSegments = [];

    let offsetX = 0;
    this.chargeSprite.setPosition(offsetX, 0);
    offsetX += this.chargeSprite.width;

    this.startSprite.setPosition(offsetX, 0);
    offsetX += this.startSprite.width;

    for (let index = 0; index < middleRepeats; index++) {
      const middleSprite = this.scene.add
        .image(offsetX, 0, TEXTURE_KEY, "middle")
        .setOrigin(0, 0.5);
      this.middleSegments.push(middleSprite);
      this.root.add(middleSprite);
      offsetX += middleSprite.width;
    }

    this.endSprite.setPosition(offsetX, 0);
    offsetX += this.endSprite.width;

    this.totalWidth = offsetX;
    this.root.setSize(this.totalWidth, FRAME_HEIGHT);
    this.hitbox.setSize(this.totalWidth, this.damageHeight);
  }

  activateBeam(durationMs) {
    this.setSegmentsVisible({ charge: false, beam: true });
    this.flashTween = null;
    this.hitbox.body.enable = true;
    this.hitbox.body.setSize(this.totalWidth, this.damageHeight);
    this.hitbox.body.setOffset(
      this.direction < 0 ? -this.totalWidth : 0,
      -this.damageHeight * 0.5
    );
    this.startBeamPulse();
    if (this.onActivateCb) {
      this.onActivateCb();
    }

    if (this.despawnTimer) {
      this.despawnTimer.remove(false);
    }
    this.despawnTimer = this.scene.time.delayedCall(
      durationMs ?? this.durationMs,
      () => this.despawn(),
      null,
      this
    );
  }

  despawn() {
    this.hitbox.body.enable = false;
    this.hitbox.body.setVelocity(0, 0);
    this.root.setVisible(false);
    if (this.flashTween) {
      this.flashTween.stop();
      this.flashTween = null;
    }
    if (this.beamPulseEvent) {
      this.beamPulseEvent.remove(false);
      this.beamPulseEvent = null;
    }
    if (this.despawnTimer) {
      this.despawnTimer.remove(false);
      this.despawnTimer = null;
    }
    if (this.onCompleteCb) {
      this.onCompleteCb();
      this.onCompleteCb = null;
    }
    this.onActivateCb = null;
  }

  setSegmentsVisible({ charge, beam }) {
    this.chargeSprite.setVisible(charge);
    this.startSprite.setVisible(beam);
    this.endSprite.setVisible(beam);
    this.middleSegments.forEach((segment) => segment.setVisible(beam));
  }

  startBeamPulse() {
    if (this.beamPulseEvent) {
      this.beamPulseEvent.remove(false);
    }
    const targets = [this.startSprite, this.endSprite, ...this.middleSegments];
    let toggle = false;
    const applyTint = () => {
      toggle = !toggle;
      const color = this.beamPulseColors[toggle ? 1 : 0];
      targets.forEach((sprite) => sprite.setTint(color));
    };
    applyTint();
    this.beamPulseEvent = this.scene.time.addEvent({
      delay: this.beamPulseInterval,
      loop: true,
      callback: applyTint,
    });
  }

  destroy() {
    this.despawn();
    this.hitbox.destroy();
    this.root.destroy();
  }
}
