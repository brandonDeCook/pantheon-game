import Phaser from "phaser";

export default class TitleScene extends Phaser.Scene {
  constructor() {
    super({ key: "TitleScene" });
  }

  preload() {}

  create() {
    const centerX = this.scale.width * 0.5;
    const centerY = this.scale.height * 0.5;

    this.add.image(centerX, centerY, "title").setOrigin(0.5).setScale(3);

    const pressEnterText = this.add
      .text(centerX, centerY + 50, "PRESS ENTER", {
        fontFamily: "standard",
        fontSize: "24px",
        color: "#FFFFFF",
      })
      .setOrigin(0.5);

    let hasStarted = false;
    this.input.keyboard.on("keydown-ENTER", () => {
      if (hasStarted) return;
      hasStarted = true;
      this.sound.play("menuSelect");
      this.time.addEvent({
        delay: 175,
        repeat: 5,
        callback: () => {
          pressEnterText.visible = !pressEnterText.visible;
        },
      });

      this.time.delayedCall(175 * 6, () => {
        this.scene.start("GameScene");
      });
    });

    this.input.keyboard.on("keydown", () => {
      this.sound.play("menuMove");
    });
  }
}
