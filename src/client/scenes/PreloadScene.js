import Phaser from "phaser";

export default class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: "PreloadScene" });
    this.loadingText = null;
    this.dotCount = 0;
    this.minTimeReached = false;
  }

  preload() {
    const centerX = this.scale.width * 0.5;
    const centerY = this.scale.height * 0.5;

    this.loadingText = this.add
      .text(centerX, centerY, "LOADING.", {
        fontFamily: "standard",
        fontSize: "24px",
        color: "#FFFFFF",
      })
      .setOrigin(0.5);

    this.time.addEvent({
      delay: 250,
      loop: true,
      callback: () => {
        this.dotCount = (this.dotCount + 1) % 4;
        const dots = ".".repeat(this.dotCount);
        this.loadingText.setText("LOADING" + dots);
      },
    });

    this.time.delayedCall(2500, () => {
      this.minTimeReached = true;
    });

    this.load.aseprite(
      "explosion",
      "/assets/pantheon-explosion.png",
      "/assets/pantheon-explosion.json"
    );
    this.load.aseprite(
      "smallExplosion",
      "/assets/pantheon-small-explosion.png",
      "/assets/pantheon-small-explosion.json"
    );
    this.load.aseprite(
      "player",
      "/assets/gamejam50-pantheon-player.png",
      "/assets/gamejam50-pantheon-player.json"
    );
    this.load.aseprite(
      "skeleton",
      "/assets/pantheon-game-skeleton.png",
      "/assets/pantheon-game-skeleton.json"
    );
    this.load.aseprite(
      "bone",
      "/assets/pantheon-bone.png",
      "/assets/pantheon-bone.json"
    );
    this.load.aseprite(
      "badBat",
      "/assets/pantheon-bad-bat.png",
      "/assets/pantheon-bad-bat.json"
    );
    this.load.json("enemyWaves", "/assets/enemy-waves.json");
    this.load.aseprite(
      "healthBar",
      "/assets/pantheon-game-health-bar.png",
      "/assets/pantheon-game-health-bar.json"
    );
    this.load.image("arrow", "/assets/gamejam50-pantheon-projectile-arrow.png");
    this.load.image("title", "/assets/pantheon-title-screen.png");
    this.load.tilemapTiledJSON("level1", "/assets/pantheon-level1.json");
    this.load.image("tiles", "/assets/pantheon-tileset.png");
    this.load.audio("menuMove", "/assets/pantheon-menu-move.wav");
    this.load.audio("menuSelect", "/assets/pantheon-menu-select.wav");
    this.load.audio("arrowShoot", "/assets/pantheon-arrow-shoot.wav");
    this.load.audio("smallExplosion", "/assets/pantheon-small-explosion.wav");
    this.load.audio("explosion", "/assets/pantheon-explosion.wav");
    this.load.audio("playerHit", "/assets/pantheon-player-hit.wav");
    this.load.audio("hit", "/assets/pantheon-hit.wav");
    this.load.audio("playerHit2", "/assets/player-hit-damage.wav");
  }

  create() {
    this.anims.createFromAseprite("player");
    this.anims.createFromAseprite("explosion");
    this.anims.createFromAseprite("skeleton");
    this.anims.createFromAseprite("bone");
    this.anims.createFromAseprite("smallExplosion");
    this.anims.createFromAseprite("badBat");
    this.anims.createFromAseprite("healthBar");

    this.checkReadyToStart();
  }

  checkReadyToStart() {
    if (this.minTimeReached) {
      this.scene.start("TitleScene");
    } else {
      this.time.addEvent({
        delay: 100,
        callback: () => this.checkReadyToStart(),
        loop: false,
      });
    }
  }
}
