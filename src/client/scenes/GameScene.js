import Phaser from "phaser";
import Skeleton from "../objects/Skeleton.js";
import SmallExplosion from "../objects/SmallExplosion.js";
import Explosion from "../objects/Explosion.js";
import Bone from "../objects/Bone.js";
import Player from "../objects/Player.js";

export default class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: "GameScene" });
  }

  preload() {}

  create() {
    const map = this.make.tilemap({ key: "level1" });
    const tileset = map.addTilesetImage("pantheon-tileset", "tiles");
    const groundLayer = map.createLayer("platforms", tileset, 0, 0);
    const backgroundLayer = map.createLayer("background", tileset, 0, 0);
    groundLayer.setCollisionBetween(1, 100);
    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

    const screenW = this.scale.width;
    const screenH = this.scale.height;
    const mapW = map.widthInPixels;
    const mapH = map.heightInPixels;
    const zoomX = screenW / mapW;
    const zoomY = screenH / mapH;
    const zoom = Math.min(zoomX, zoomY);

    this.cameras.main
      .setBounds(0, 0, mapW, mapH)
      .setZoom(zoom)
      .centerOn(mapW / 2, mapH / 2);

    this.player = new Player(this, 150, 150, zoom);

    this.skeletons = this.physics.add.group({
      classType: Skeleton,
      frameQuantity: 10,
      allowGravity: true,
      runChildUpdate: true,
      active: true,
      visible: true,
    });

    this.bones = this.physics.add.group({
      classType: Bone,
      frameQuantity: 20,
      allowGravity: false,
      runChildUpdate: true,
      active: true,
      visible: true,
    });

    this.smallExplosions = this.physics.add.group({
      classType: SmallExplosion,
      frameQuantity: 20,
      allowGravity: false,
      runChildUpdate: true,
      active: true,
      visible: true,
    });

    this.explosions = this.physics.add.group({
      classType: Explosion,
      frameQuantity: 5,
      allowGravity: false,
      runChildUpdate: true,
      active: false,
      visible: false,
    });

    this.physics.add.collider(this.player, groundLayer);
    this.physics.add.collider(this.skeletons, groundLayer);

    this.physics.add.overlap(
      this.player,
      this.skeletons,
      this.onPlayerOverlapSkeleton,
      null,
      this
    );

    this.physics.add.overlap(
      this.player.arrows,
      this.skeletons,
      this.onArrowOverlapSkeleton,
      null,
      this
    );

    this.physics.add.overlap(
      this.bones,
      this.player,
      this.onPlayerOverlapBones,
      null,
      this
    );

    this.testSkeleton = this.skeletons.getFirstDead(true, 300, 150);
  }

  update(time, delta) {
    this.player.update(time, delta);
    this.bones.children.each(
      function (bone) {
        bone.update(time, delta);
      }.bind(this)
    );
    this.testSkeleton.update(time, delta);
  }

  onArrowOverlapSkeleton(arrow, skeleton) {
    arrow.setActive(false);
    arrow.setVisible(false);
    arrow.body.enable = false;
    skeleton.hit();
  }

  onPlayerOverlapBones(player, bone) {
    bone.hit();
    player.hit();
  }

  onPlayerOverlapSkeleton(player, skeleton) {
    if (!player.active || !skeleton.active) return;
    player.hit();
  }
}
