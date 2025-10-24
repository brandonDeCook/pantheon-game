import Phaser from "phaser";

export default class TitleScene extends Phaser.Scene {
  constructor() {
    super({ key: "TitleScene" });
  }

  preload() {}

  create() {
    this.add.image(400, 300, "title").setOrigin(0.5).setScale(3);

    const pressEnterText = this.add
      .text(400, 350, "PRESS ENTER", {
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
