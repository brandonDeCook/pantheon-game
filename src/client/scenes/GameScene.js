import Phaser from "phaser";
import Skeleton from "../objects/Skeleton.js";
import SmallExplosion from "../objects/SmallExplosion.js";
import Explosion from "../objects/Explosion.js";
import Bone from "../objects/Bone.js";
import Player from "../objects/Player.js";
import Bat from "../objects/Bat.js";

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
    const mapW = map.widthInPixels;
    const mapH = map.heightInPixels;
    this.zoom = 4;

    this.cameras.main
      .setBounds(0, 0, mapW, mapH)
      .setZoom(this.zoom)
      .centerOn(mapW / 2, mapH / 2)
      .setRoundPixels(true);

    this.player = new Player(this, 150, 150, 4);

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

    this.bats = this.physics.add.group({
      classType: Bat,
      frameQuantity: 5,
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
    this.physics.add.collider(this.bats, groundLayer, this.onBatCollideGround, null, this);

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
      this.player.arrows,
      this.bats,
      this.onArrowOverlapBat,
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

    this.physics.add.overlap(
      this.player,
      this.bats,
      this.onPlayerOverlapBat,
      null,
      this
    );

    this.spawnPadding = -4;
    this.waveEvents = [];
    this.waveText = null;
    this.waveTextTimer = null;
    this.waveConfig = this.cache.json.get("enemyWaves") ?? { waves: [] };
    this.defaultWaveDelay = this.waveConfig.defaultIntervalMs ?? 120000;
    this.currentWaveIndex = 0;
    this.waveInProgress = false;
    this.waveEnemiesRemaining = 0;
    this.scheduleEnemyWaves();

    this.events.on(Phaser.Scenes.Events.SHUTDOWN, this.cleanupWaveEvents, this);
  }

  update(time, delta) {
    this.player.update(time, delta);
    this.bones.children.each(
      function (bone) {
        bone.update(time, delta);
      }.bind(this)
    );
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

  onBatCollideGround(bat) {
    if (!bat.active) return;
    bat.die();
  }

  onPlayerOverlapBat(player, bat) {
    if (!player.active || !bat.active) return;
    player.hit();
  }

  onArrowOverlapBat(arrow, bat) {
    if (!bat.active) return;
    arrow.setActive(false);
    arrow.setVisible(false);
    arrow.body.enable = false;
    bat.takeDamage(1);
  }

  scheduleEnemyWaves() {
    const waves = this.waveConfig.waves;
    if (!waves || !waves.length) {
      return;
    }

    this.queueWaveStart(0);
  }

  queueWaveStart(index) {
    const wave = this.waveConfig.waves[index];
    if (!wave) return;

    const baseDelay = index === 0 ? 0 : this.defaultWaveDelay;
    const delay = wave.startDelay ?? baseDelay;
    const timer = this.time.delayedCall(
      delay,
      () => this.startWave(index),
      null,
      this
    );
    this.waveEvents.push(timer);
  }

  startWave(index) {
    const wave = this.waveConfig.waves[index];
    if (!wave) return;

    this.currentWaveIndex = index;
    this.waveInProgress = true;
    let totalEnemies = 0;
    wave.spawns?.forEach((spawn) => {
      totalEnemies += spawn.count ?? 1;
    });
    this.waveEnemiesRemaining = totalEnemies;

    if (wave.name) {
      this.displayWaveName(wave.name);
    }

    if (this.waveEnemiesRemaining === 0) {
      this.finishWave();
      return;
    }

    wave.spawns?.forEach((spawnConfig) => {
      this.scheduleSpawn(spawnConfig);
    });
  }

  scheduleSpawn(spawnConfig) {
    const startOffset = spawnConfig.startOffset ?? 0;
    const count = spawnConfig.count ?? 1;
    const interval = spawnConfig.interval ?? 1000;

    const delayEvent = this.time.delayedCall(
      startOffset,
      () => {
        this.spawnEnemy(spawnConfig);
        if (count > 1) {
          let spawned = 1;
          const spawnEvent = this.time.addEvent({
            delay: interval,
            callback: () => {
              this.spawnEnemy(spawnConfig);
              spawned += 1;
              if (spawned >= count) {
                spawnEvent.remove(false);
              }
            },
            loop: true,
            callbackScope: this,
          });
          this.waveEvents.push(spawnEvent);
        }
      },
      null,
      this
    );
    this.waveEvents.push(delayEvent);
  }

  spawnEnemy(spawnConfig) {
    const { type, side = "left", y } = spawnConfig;
    const { x, y: spawnY } = this.getSpawnPoint(side, y, type);

    switch (type) {
      case "skeleton": {
        const skeleton = this.skeletons.getFirstDead(true, x, spawnY);
        if (skeleton) {
          skeleton.state = "WALK";
          skeleton.health = 4;
          this.registerWaveEnemy(skeleton);
        }
        else {
          this.handleFailedSpawn();
        }
        break;
      }
      case "bat": {
        const bat = this.bats.getFirstDead(true, x, spawnY);
        if (bat) {
          bat.hoverY = spawnY;
          bat.health = 3;
          bat.clearTint();
          bat.enterFlyState();
          this.registerWaveEnemy(bat);
        }
        else {
          this.handleFailedSpawn();
        }
        break;
      }
      default:
        break;
    }
  }

  getSpawnPoint(side, y, type) {
    const bounds = this.physics.world.bounds;
    const x =
      side === "right"
        ? bounds.width - this.spawnPadding
        : this.spawnPadding;
    let spawnY = y ?? 150;

    if (type === "bat" && y == null) {
      spawnY = 80;
    }

    spawnY = Phaser.Math.Clamp(spawnY, 32, bounds.height - 32);
    return { x, y: spawnY };
  }

  registerWaveEnemy(enemy) {
    if (!this.waveInProgress || !enemy) {
      return;
    }

    enemy.once(
      Phaser.GameObjects.Events.DESTROY,
      () => {
        this.waveEnemiesRemaining -= 1;
        this.tryCompleteWave();
      },
      this
    );
  }

  handleFailedSpawn() {
    if (!this.waveInProgress) {
      return;
    }
    this.waveEnemiesRemaining -= 1;
    this.tryCompleteWave();
  }

  tryCompleteWave() {
    if (this.waveInProgress && this.waveEnemiesRemaining <= 0) {
      this.finishWave();
    }
  }

  finishWave() {
    this.waveInProgress = false;
    const nextIndex = this.currentWaveIndex + 1;

    if (nextIndex >= (this.waveConfig.waves?.length ?? 0)) {
      return;
    }

    this.queueWaveStart(nextIndex);
  }

  cleanupWaveEvents() {
    this.waveEvents.forEach((event) => event?.remove(false));
    this.waveEvents = [];
    if (this.waveTextTimer) {
      this.waveTextTimer.remove(false);
      this.waveTextTimer = null;
    }
    this.waveText?.destroy();
  }

  displayWaveName(name) {
    if (this.waveText) {
      this.waveText.destroy();
    }

    const centerX = this.cameras.main.midPoint.x;
    const centerY = this.cameras.main.midPoint.y;
    this.waveText = this.add
      .text(centerX, centerY, name.toUpperCase(), {
        fontFamily: "standard",
        fontSize: "24px",
        color: "#FFFFFF",
      })
      .setOrigin(0.5)
      .setDepth(9999)
      .setScale(1 / this.cameras.main.zoom);

    let visible = true;
    if (this.waveTextTimer) {
      this.waveTextTimer.remove(false);
    }

    this.waveTextTimer = this.time.addEvent({
      delay: 250,
      repeat: 7,
      callback: () => {
        visible = !visible;
        if (this.waveText) {
          this.waveText.setVisible(visible);
        }

        if (this.waveTextTimer && this.waveTextTimer.getRepeatCount() === 0) {
          this.waveText.destroy();
          this.waveText = null;
          this.waveTextTimer = null;
        }
      },
      callbackScope: this,
    });
  }
}
