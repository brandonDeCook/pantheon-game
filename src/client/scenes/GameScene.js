import Phaser from "phaser";
import Skeleton from "../objects/Skeleton.js";
import SmallExplosion from "../objects/SmallExplosion.js";
import Explosion from "../objects/Explosion.js";
import Bone from "../objects/Bone.js";
import Player from "../objects/Player.js";
import Bat from "../objects/Bat.js";
import Lizard from "../objects/Lizard.js";
import DemonSamurai from "../objects/DemonSamurai.js";
import Coin from "../objects/Coin.js";
import Slash from "../objects/Slash.js";
import Slime from "../objects/Slime.js";

export default class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: "GameScene" });
    this.playerCoins = 0;
    this.startWaveIndex = 0;
    this.isPaused = false;
    this.boundHandleGlobalKeyDown = null;
    this.pauseText = null;
    this.pauseFlashElapsed = 0;
    this.pauseFlashInterval = 350;
    this.pauseTextVisible = true;
    this.pauseSound = null;
    this.wavesCompleted = 0;
    this.pendingWaveIndex = 0;
    this.playerData = null;
    this.currentMapKey = null;
    this.map = null;
    this.groundLayer = null;
    this.backgroundLayer = null;
    this.boundaryWalls = null;
    this.mapColliders = [];
    this.isHitFreezeActive = false;
    this.hitFreezeTimeout = null;
  }

  init(data = {}) {
    // Reset map references in case the scene is restarted (e.g., after the shop)
    this.currentMapKey = null;
    this.map = null;
    this.groundLayer = null;
    this.backgroundLayer = null;
    this.boundaryWalls = null;
    this.mapColliders = [];

    if (typeof data.playerCoins === "number") {
      this.playerCoins = data.playerCoins;
    } else {
      this.playerCoins = 0;
    }

    const waveIndexData = Number.isInteger(data.nextWaveIndex)
      ? data.nextWaveIndex
      : Number.isInteger(data.resumeWaveIndex)
      ? data.resumeWaveIndex
      : data.startWaveIndex;

    if (Number.isInteger(waveIndexData)) {
      this.startWaveIndex = Math.max(0, waveIndexData);
    } else {
      this.startWaveIndex = 0;
    }

    const wavesCompletedValue = Number.isInteger(data.wavesCompleted)
      ? data.wavesCompleted
      : this.wavesCompleted;
    this.wavesCompleted = Math.max(0, wavesCompletedValue ?? 0);

    if (data && typeof data.playerData === "object") {
      this.playerData = {
        coins: Number.isFinite(data.playerData.coins)
          ? data.playerData.coins
          : this.playerCoins,
        health: { ...(data.playerData.health ?? {}) },
        powerups: Array.isArray(data.playerData.powerups)
          ? data.playerData.powerups.map((entry) =>
              typeof entry === "object" ? { ...entry } : entry
            )
          : [],
      };
    } else {
      this.playerData = null;
    }
  }

  preload() {}

  create() {
    this.waveConfig = this.cache.json.get("enemyWaves") ?? { waves: [] };
    this.defaultWaveDelay = this.waveConfig.defaultIntervalMs ?? 120000;
    this.zoom = 4;
    const startWave = this.getValidatedStartWaveIndex(
      this.waveConfig.waves?.length ?? 0
    );
    const mapKey = this.getWaveMapKey(startWave);

    this.setupMap(mapKey);

    this.player = new Player(this, 150, 150, 4, this.playerData);
    this.applyPlayerDataToPlayer();
    this.gameOverText = null;
    this.gameOverFlashTimer = null;
    this.events.on("player-dead", this.onPlayerDead, this);

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
      frameQuantity: 10,
      allowGravity: false,
      runChildUpdate: true,
      active: true,
      visible: true,
    });

    this.lizards = this.physics.add.group({
      classType: Lizard,
      frameQuantity: 6,
      allowGravity: true,
      runChildUpdate: true,
      active: true,
      visible: true,
    });

    this.coins = this.physics.add.group({
      classType: Coin,
      frameQuantity: 20,
      allowGravity: true,
      runChildUpdate: true,
      active: true,
      visible: true,
    });

    this.slashes = this.physics.add.group({
      classType: Slash,
      frameQuantity: 10,
      allowGravity: false,
      runChildUpdate: true,
      active: true,
      visible: true,
    });

    this.demonSamurai = this.physics.add.group({
      classType: DemonSamurai,
      frameQuantity: 3,
      allowGravity: true,
      runChildUpdate: true,
      active: true,
      visible: true,
    });

    this.slimes = this.physics.add.group({
      classType: Slime,
      frameQuantity: 10,
      allowGravity: true,
      runChildUpdate: true,
      active: true,
      visible: true,
    });

    this.explosions = this.physics.add.group({
      classType: Explosion,
      frameQuantity: 10,
      allowGravity: false,
      runChildUpdate: true,
      active: false,
      visible: false,
    });
    this.refreshMapColliders();
    this.physics.add.overlap(this.slashes, this.player, this.onSlashOverlapPlayer, null, this);

    this.physics.add.collider(
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
      this.player.arrows,
      this.slimes,
      this.onArrowOverlapSlime,
      null,
      this
    );

    this.physics.add.collider(
      this.bones,
      this.player,
      this.onPlayerOverlapBones,
      null,
      this
    );

    this.physics.add.collider(
      this.player,
      this.bats,
      this.onPlayerOverlapBat,
      null,
      this
    );

    this.physics.add.collider(
      this.player,
      this.slimes,
      this.onPlayerOverlapSlime,
      null,
      this
    );

    this.physics.add.collider(
      this.player,
      this.lizards,
      this.onPlayerOverlapLizard,
      null,
      this
    );

    this.physics.add.collider(
      this.player,
      this.demonSamurai,
      this.onPlayerOverlapDemon,
      null,
      this
    );

    this.physics.add.overlap(
      this.player.arrows,
      this.lizards,
      this.onArrowOverlapLizard,
      null,
      this
    );

    this.physics.add.overlap(
      this.player.arrows,
      this.demonSamurai,
      this.onArrowOverlapDemon,
      null,
      this
    );

    this.physics.add.overlap(
      this.player,
      this.coins,
      this.onPlayerOverlapCoin,
      null,
      this
    );

    this.physics.add.overlap(
      this.player.specialLaser.hitbox,
      this.skeletons,
      this.onLaserOverlapSkeleton,
      null,
      this
    );

    this.physics.add.overlap(
      this.player.specialLaser.hitbox,
      this.bats,
      this.onLaserOverlapBat,
      null,
      this
    );

    this.physics.add.overlap(
      this.player.specialLaser.hitbox,
      this.lizards,
      this.onLaserOverlapLizard,
      null,
      this
    );

    this.physics.add.overlap(
      this.player.specialLaser.hitbox,
      this.slimes,
      this.onLaserOverlapSlime,
      null,
      this
    );

    this.physics.add.overlap(
      this.player.specialLaser.hitbox,
      this.demonSamurai,
      this.onLaserOverlapDemon,
      null,
      this
    );

    this.spawnPadding = -2;
    this.waveEvents = [];
    this.waveText = null;
    this.waveTextTimer = null;
    this.currentWaveIndex = 0;
    this.waveInProgress = false;
    this.waveEnemiesRemaining = 0;
    this.scheduleEnemyWaves();
    this.laserDamageCooldowns = new WeakMap();

    this.pauseSound = this.sound.add("pause");
    this.input.setDefaultCursor("none");

    this.boundHandleGlobalKeyDown = this.handleGlobalKeyDown.bind(this);
    this.input.keyboard.on("keydown", this.boundHandleGlobalKeyDown);

    this.events.on(Phaser.Scenes.Events.SHUTDOWN, this.cleanupWaveEvents, this);
    this.events.on(Phaser.Scenes.Events.SHUTDOWN, this.cleanupGameOverUI, this);
    this.events.on(Phaser.Scenes.Events.SHUTDOWN, this.cleanupInputListeners, this);
    this.events.on(Phaser.Scenes.Events.SHUTDOWN, this.restoreCursor, this);
    this.events.on(Phaser.Scenes.Events.SHUTDOWN, this.cleanupHitFreeze, this);

    this.updateGlobalTimeScale();
  }

  update(time, delta) {
    this.updatePauseIndicator(delta);
    if (this.isPaused || this.isHitFreezeActive) {
      return;
    }

    this.player.update(time, delta);
    this.bones.children.each(
      function (bone) {
        bone.update(time, delta);
      }.bind(this)
    );
  }

  isIceArrow(arrow) {
    return arrow?.powerupValue === "ICE_ARROW";
  }

  tryApplyIceEffect(arrow, target) {
    if (!this.isIceArrow(arrow)) {
      return;
    }
    this.sound.play("iceHit");
    if (typeof target?.freeze === "function") {
      target.freeze();
    }
  }

  onArrowOverlapSkeleton(arrow, skeleton) {
    arrow.setActive(false);
    arrow.setVisible(false);
    arrow.body.enable = false;
    this.tryApplyIceEffect(arrow, skeleton);
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
    bat.die();
  }

  onPlayerOverlapLizard(player, lizard) {
    if (!player.active || !lizard.active) return;
    player.hit();
  }

  onArrowOverlapBat(arrow, bat) {
    if (!bat.active) return;
    arrow.setActive(false);
    arrow.setVisible(false);
    arrow.body.enable = false;
    this.tryApplyIceEffect(arrow, bat);
    bat.takeDamage(1);
  }

  onArrowOverlapLizard(arrow, lizard) {
    if (!lizard.active) return;
    arrow.setActive(false);
    arrow.setVisible(false);
    arrow.body.enable = false;
    this.tryApplyIceEffect(arrow, lizard);
    lizard.takeDamage(1);
  }

  onPlayerOverlapCoin(player, coin) {
    if (!coin.active || !coin.canBeCollected) return;
    this.sound.play("coinPickup");
    this.playerCoins += coin.value ?? 0;
    coin.collect();
  }

  onArrowOverlapSlime(arrow, slime) {
    if (!slime.active) return;
    arrow.setActive(false);
    arrow.setVisible(false);
    arrow.body.enable = false;
    this.tryApplyIceEffect(arrow, slime);
    slime.hit();
  }

  onPlayerOverlapDemon(player, demon) {
    if (!player.active || !demon.active) return;
    player.hit();
  }

  onArrowOverlapDemon(arrow, demon) {
    if (!demon.active) return;
    arrow.setActive(false);
    arrow.setVisible(false);
    arrow.body.enable = false;
    this.tryApplyIceEffect(arrow, demon);
    demon.takeDamage(1);
  }

  canDamageWithLaser(target) {
    if (!target) return false;
    const now = this.time.now;
    const last = this.laserDamageCooldowns.get(target) ?? -Infinity;
    const cooldownMs = 150;
    if (now - last < cooldownMs) {
      return false;
    }
    this.laserDamageCooldowns.set(target, now);
    return true;
  }

  onLaserOverlapSkeleton(laser, skeleton) {
    if (!skeleton.active || !this.canDamageWithLaser(skeleton)) return;
    skeleton.hit();
  }

  onLaserOverlapBat(laser, bat) {
    if (!bat.active || !this.canDamageWithLaser(bat)) return;
    bat.takeDamage(1);
  }

  onLaserOverlapLizard(laser, lizard) {
    if (!lizard.active || !this.canDamageWithLaser(lizard)) return;
    lizard.takeDamage(1);
  }

  onLaserOverlapSlime(laser, slime) {
    if (!slime.active || !this.canDamageWithLaser(slime)) return;
    slime.hit();
  }

  onLaserOverlapDemon(laser, demon) {
    if (!demon.active || !this.canDamageWithLaser(demon)) return;
    demon.takeDamage(1);
  }

  onSlashOverlapPlayer(player, slash) {
    if (!player.active || !slash.active) return;
    const playerWasHit = player.hit();
    if (playerWasHit) {
      slash.despawn();
    }
  }

  onPlayerOverlapSlime(player, slime) {
    if (!player.active || !slime.active) return;
    player.hit();
  }

  onPlayerDead() {
    if (this.gameOverText) {
      return;
    }

    const centerX = this.scale.width * 0.5;
    const centerY = this.scale.height * 0.5;
    this.gameOverText = this.add
      .text(centerX, centerY, "GAME OVER", {
        fontFamily: "standard",
        fontSize: "32px",
        color: "#FFFFFF",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setScale(1 / this.zoom)
      .setDepth(10000);

    this.gameOverFlashTimer = this.time.addEvent({
      delay: 400,
      loop: true,
      callback: () => {
        if (this.gameOverText) {
          this.gameOverText.visible = !this.gameOverText.visible;
        }
      },
    });
  }

  getWaveMapKey(waveIndex) {
    const waves = this.waveConfig?.waves;
    const waveLevel = Number.isInteger(waves?.[waveIndex]?.level)
      ? waves[waveIndex].level
      : this.waveConfig?.level;
    const levelNumber = Number.isInteger(waveLevel) ? waveLevel : 1;
    return levelNumber === 2 ? "level2" : "level1";
  }

  setupMap(mapKey) {
    this.destroyMapColliders();
    this.cleanupMapLayers();

    const map = this.make.tilemap({ key: mapKey });
    const tileset = map.addTilesetImage("pantheon-tileset", "tiles");
    const groundLayer = map.createLayer("platforms", tileset, 0, 0);
    const backgroundLayer = map.createLayer("background", tileset, 0, 0);
    groundLayer.setCollisionBetween(1, 100);
    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);

    this.cameras.main
      .setBounds(0, 0, map.widthInPixels, map.heightInPixels)
      .setZoom(this.zoom)
      .centerOn(map.widthInPixels / 2, map.heightInPixels / 2)
      .setRoundPixels(true);

    const wallThickness = 32;
    const wallHeight = map.heightInPixels + 200;
    const boundaryWalls = this.physics.add.staticGroup();
    const leftWall = this.add
      .rectangle(
        -wallThickness / 2,
        map.heightInPixels / 2,
        wallThickness,
        wallHeight
      )
      .setOrigin(0.5)
      .setVisible(false);
    const rightWall = this.add
      .rectangle(
        map.widthInPixels + wallThickness / 2,
        map.heightInPixels / 2,
        wallThickness,
        wallHeight
      )
      .setOrigin(0.5)
      .setVisible(false);
    this.physics.add.existing(leftWall, true);
    this.physics.add.existing(rightWall, true);
    boundaryWalls.add(leftWall);
    boundaryWalls.add(rightWall);

    this.currentMapKey = mapKey;
    this.map = map;
    this.groundLayer = groundLayer;
    this.backgroundLayer = backgroundLayer;
    if (this.boundaryWalls) {
      this.boundaryWalls.clear(true, true);
      this.boundaryWalls.destroy();
    }
    this.boundaryWalls = boundaryWalls;
    this.recenterPlayerToBounds();
  }

  cleanupMapLayers() {
    const walls = this.boundaryWalls;
    if (walls) {
      if (walls.children?.size !== undefined) {
        walls.clear(true, true);
      }
      walls.destroy?.();
      this.boundaryWalls = null;
    }
    this.groundLayer?.destroy();
    this.backgroundLayer?.destroy();
    this.map?.destroy();
    this.groundLayer = null;
    this.backgroundLayer = null;
    this.map = null;
  }

  destroyMapColliders() {
    this.mapColliders.forEach((collider) => collider?.destroy());
    this.mapColliders = [];
  }

  refreshMapColliders() {
    this.destroyMapColliders();
    if (!this.groundLayer) {
      return;
    }

    const colliders = [];
    if (this.player) {
      colliders.push(this.physics.add.collider(this.player, this.groundLayer));
    }
    if (this.skeletons) {
      colliders.push(this.physics.add.collider(this.skeletons, this.groundLayer));
    }
    if (this.bats) {
      colliders.push(
        this.physics.add.collider(
          this.bats,
          this.groundLayer,
          this.onBatCollideGround,
          null,
          this
        )
      );
    }
    if (this.slimes) {
      colliders.push(this.physics.add.collider(this.slimes, this.groundLayer));
    }
    if (this.lizards) {
      colliders.push(this.physics.add.collider(this.lizards, this.groundLayer));
    }
    if (this.coins) {
      colliders.push(this.physics.add.collider(this.coins, this.groundLayer));
    }
    if (this.demonSamurai) {
      colliders.push(this.physics.add.collider(this.demonSamurai, this.groundLayer));
    }

    if (this.boundaryWalls) {
      colliders.push(this.physics.add.collider(this.boundaryWalls, this.skeletons));
      colliders.push(this.physics.add.collider(this.boundaryWalls, this.slimes));
      colliders.push(this.physics.add.collider(this.boundaryWalls, this.lizards));
      colliders.push(this.physics.add.collider(this.boundaryWalls, this.demonSamurai));
    }

    this.mapColliders = colliders;
  }

  ensureMap(mapKey) {
    if (!mapKey || this.currentMapKey === mapKey) {
      return;
    }
    this.setupMap(mapKey);
    this.refreshMapColliders();
  }

  ensureMapForWave(waveIndex) {
    const mapKey = this.getWaveMapKey(waveIndex);
    this.ensureMap(mapKey);
  }

  recenterPlayerToBounds() {
    if (!this.player || !this.physics?.world?.bounds) {
      return;
    }
    const bounds = this.physics.world.bounds;
    const clampedX = Phaser.Math.Clamp(this.player.x, bounds.x + 16, bounds.width - 16);
    const clampedY = Phaser.Math.Clamp(this.player.y, bounds.y + 16, bounds.height - 16);
    this.player.setPosition(clampedX, clampedY);
  }

  scheduleEnemyWaves() {
    const waves = this.waveConfig.waves;
    if (!waves || !waves.length) {
      return;
    }

    const startIndex = this.getValidatedStartWaveIndex(waves.length);
    this.pendingWaveIndex = startIndex;
    this.queueWaveStart(startIndex, true);
  }

  queueWaveStart(index, immediate = false) {
    const wave = this.waveConfig.waves[index];
    if (!wave) return;

    const baseDelay = immediate ? 0 : index === 0 ? 0 : this.defaultWaveDelay;
    const delay = immediate ? 0 : wave.startDelay ?? baseDelay;
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

    this.ensureMapForWave(index);
    this.currentWaveIndex = index;
    this.pendingWaveIndex = index;
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
          this.registerWaveEnemy(skeleton);
        } else {
          this.handleFailedSpawn();
        }
        break;
      }
      case "bat": {
        const bat = this.bats.getFirstDead(true, x, spawnY);
        if (bat) {
          bat.hoverY = spawnY;
          bat.clearTint();
          bat.enterFlyState();
          this.registerWaveEnemy(bat);
        } else {
          this.handleFailedSpawn();
        }
        break;
      }
      case "lizard": {
        const lizard = this.lizards.getFirstDead(true, x, spawnY);
        if (lizard) {
          lizard.clearTint();
          if (lizard.body) {
            lizard.body.setVelocity(0, 0);
          }
          lizard.play("lizard-walk", true);
          this.registerWaveEnemy(lizard);
        } else {
          this.handleFailedSpawn();
        }
        break;
      }
      case "demonSamurai": {
        const demon = this.demonSamurai.getFirstDead(true, x, spawnY);
        if (demon) {
          demon.clearTint();
          if (demon.body) {
            demon.body.setVelocity(0, 0);
          }
          demon.play("samurai-demon-walk", true);
          this.registerWaveEnemy(demon);
        } else {
          this.handleFailedSpawn();
        }
        break;
      }
      case "slime": {
        const slime = this.slimes.getFirstDead(true, x, spawnY);
        if (slime) {
          slime.state = "WALK";
          slime.body.setVelocity(0, 0);
          slime.clearHitTimers?.();
          slime.clearTint();
          slime.jumpDirection = 0;
          slime.nextJumpTime = this.time.now;
          slime.facingRight = true;
          slime.play("slime-walk", true);
          this.registerWaveEnemy(slime);
        } else {
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
    this.wavesCompleted += 1;
    this.pendingWaveIndex = nextIndex;

    if (this.shouldVisitShop()) {
      this.triggerShopVisit(nextIndex);
      return;
    }

    if (nextIndex >= (this.waveConfig.waves?.length ?? 0)) {
      return;
    }

    this.queueWaveStart(nextIndex);
  }

  shouldVisitShop() {
    if (this.wavesCompleted === 0) {
      return false;
    }

    return this.wavesCompleted % 3 === 0 || this.wavesCompleted % 5 === 0;
  }

  triggerShopVisit(nextIndex) {
    if (nextIndex >= (this.waveConfig.waves?.length ?? 0)) {
      return;
    }

    this.cleanupWaveEvents();
    const camera = this.cameras.main;
    const startShop = () => {
      camera?.off(
        Phaser.Cameras.Scene2D.Events.FLASH_COMPLETE,
        startShop
      );
      this.scene.start("ShopKeeperScene", {
        resumeWaveIndex: nextIndex,
        nextWaveIndex: nextIndex,
        playerCoins: this.playerCoins,
        playerHealth: {
          current: this.player?.playerHealth?.current ?? 0,
          max: this.player?.playerHealth?.max ?? 0,
        },
        wavesCompleted: this.wavesCompleted,
        playerData: this.buildPlayerDataSnapshot(),
      });
    };

    const executeTransition = () => {
      if (!camera) {
        startShop();
        return;
      }

      const overlay = this.add
        .rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 1)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(99999)
        .setAlpha(0);

      const flashDuration = 1200;
      const flashInterval = 80;
      let elapsed = 0;
      let visible = false;

      this.time.delayedCall(3000, () => {
        const flashTimer = this.time.addEvent({
          delay: flashInterval,
          loop: true,
          callback: () => {
            elapsed += flashInterval;
            visible = !visible;
            overlay.setAlpha(visible ? 1 : 0);

            if (elapsed >= flashDuration) {
              flashTimer.remove(false);
              overlay.destroy();
              startShop();
            }
          },
        });
      });
    };

    executeTransition();
  }

  getValidatedStartWaveIndex(totalWaves) {
    if (!Number.isInteger(this.startWaveIndex)) {
      return 0;
    }

    if (this.startWaveIndex < 0 || this.startWaveIndex >= totalWaves) {
      return 0;
    }

    return this.startWaveIndex;
  }

  cleanupGameOverUI() {
    if (this.gameOverFlashTimer) {
      this.gameOverFlashTimer.remove(false);
      this.gameOverFlashTimer = null;
    }

    if (this.gameOverText) {
      this.gameOverText.destroy();
      this.gameOverText = null;
    }

    this.events.off("player-dead", this.onPlayerDead, this);
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

  getPlayerPowerupsSnapshot() {
    if (!Array.isArray(this.player?.ArrowPowerups)) {
      return [];
    }

    return this.player.ArrowPowerups
      .filter(
        (powerup) =>
          powerup &&
          typeof powerup.value === "string" &&
          powerup.value !== "DEFAULT_ARROW"
      )
      .map((powerup) => {
        const snapshot = { value: powerup.value };
        if (Number.isFinite(powerup.amount)) {
          snapshot.amount = powerup.amount;
        }
        return snapshot;
      });
  }

  buildPlayerDataSnapshot() {
    const coins = this.playerCoins ?? 0;
    const health = {
      current: this.player?.playerHealth?.current ?? 0,
      max: this.player?.playerHealth?.max ?? 0,
    };
    const powerups = this.getPlayerPowerupsSnapshot();
    return { coins, health, powerups };
  }

  applyPlayerDataToPlayer() {
    if (!this.player || !this.player.playerHealth) {
      return;
    }

    const healthData = this.playerData?.health;
    if (!healthData) {
      return;
    }

    const playerHealth = this.player.playerHealth;
    const bars = Array.isArray(playerHealth.bars) ? playerHealth.bars : [];
    const maxBarCount = bars.length || playerHealth.max || 0;

    const requestedMax = Number.isInteger(healthData.max)
      ? Math.max(0, healthData.max)
      : playerHealth.max ?? maxBarCount;
    const clampedMax =
      maxBarCount > 0 ? Math.min(requestedMax, maxBarCount) : requestedMax;

    const requestedCurrent = Number.isInteger(healthData.current)
      ? healthData.current
      : requestedMax;
    const clampedCurrent = Phaser.Math.Clamp(
      requestedCurrent,
      0,
      clampedMax || 0
    );

    if (clampedMax > 0) {
      playerHealth.max = clampedMax;
    }
    playerHealth.current = clampedCurrent;

    bars.forEach((bar, index) => {
      if (!bar) {
        return;
      }
      const visible = clampedMax <= 0 ? false : index < clampedMax;
      bar.setVisible(visible);
      if (!visible) {
        return;
      }
      bar.setFrame(index < clampedCurrent ? "0" : "1");
    });
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

  handleGlobalKeyDown(event) {
    if (!event || event.code !== "Enter") {
      return;
    }

    this.togglePause();
  }

  togglePause() {
    const nextState = !this.isPaused;
    this.setPausedState(nextState);
    this.pauseSound?.play();
  }

  updateGlobalTimeScale() {
    const scale = this.isPaused || this.isHitFreezeActive ? 0 : 1;
    if (this.time) {
      this.time.timeScale = scale;
    }
    if (this.anims) {
      this.anims.globalTimeScale = scale;
    }
    if (this.physics?.world) {
      this.physics.world.timeScale = scale;
      this.physics.world.isPaused = scale === 0;
    }
    if (this.tweens) {
      this.tweens.timeScale = scale;
    }
  }

  triggerHitFreeze() {
    const slowmoDurationMs = 200;

    this.isHitFreezeActive = true;
    this.updateGlobalTimeScale();

    if (this.hitFreezeTimeout) {
      clearTimeout(this.hitFreezeTimeout);
    }

    this.hitFreezeTimeout = setTimeout(() => {
      this.isHitFreezeActive = false;
      this.hitFreezeTimeout = null;
      this.updateGlobalTimeScale();
    }, slowmoDurationMs);
  }

  cleanupHitFreeze() {
    if (this.hitFreezeTimeout) {
      clearTimeout(this.hitFreezeTimeout);
      this.hitFreezeTimeout = null;
    }
    this.isHitFreezeActive = false;
    this.updateGlobalTimeScale();
  }

  setPausedState(paused) {
    this.isPaused = paused;
    if (this.physics && this.physics.world) {
      this.physics.world.isPaused = paused;
    }
    this.updateGlobalTimeScale();

    if (paused) {
      this.showPauseIndicator();
    } else {
      this.hidePauseIndicator();
    }
  }

  cleanupInputListeners() {
    if (this.boundHandleGlobalKeyDown) {
      this.input.keyboard.off("keydown", this.boundHandleGlobalKeyDown);
      this.boundHandleGlobalKeyDown = null;
    }
  }

  restoreCursor() {
    this.input?.setDefaultCursor?.("url('/assets/cursors/standard.png'), pointer");
  }

  showPauseIndicator() {
    if (this.pauseText) {
      return;
    }

    const centerX = this.cameras.main.midPoint.x;
    const centerY = this.cameras.main.midPoint.y;
    this.pauseText = this.add
      .text(centerX, centerY, "PAUSE", {
        fontFamily: "standard",
        fontSize: "24px",
        color: "#FFFFFF",
      })
      .setOrigin(0.5)
      .setDepth(9999)
      .setScale(1 / this.cameras.main.zoom);

    this.pauseFlashElapsed = 0;
    this.pauseTextVisible = true;
    this.pauseText.setVisible(true);
  }

  hidePauseIndicator() {
    if (this.pauseText) {
      this.pauseText.destroy();
      this.pauseText = null;
    }
    this.pauseFlashElapsed = 0;
    this.pauseTextVisible = true;
  }

  updatePauseIndicator(delta = 0) {
    if (!this.pauseText) {
      return;
    }

    this.pauseFlashElapsed += delta;
    if (this.pauseFlashElapsed >= this.pauseFlashInterval) {
      this.pauseFlashElapsed = 0;
      this.pauseTextVisible = !this.pauseTextVisible;
      this.pauseText.setVisible(this.pauseTextVisible);
    }
  }

  spawnCoin(x, y) {
    if (!this.coins) return;
    if (Phaser.Math.Between(0, 100) > 35) {
      return;
    }

    const coin = this.coins.getFirstDead(true, x, y);
    if (!coin) return;

    const value = Phaser.Math.Between(5, 30);
    coin.activate(x, Math.max(y - 10, 0), value);
  }
}
