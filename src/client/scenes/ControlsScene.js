import Phaser from "phaser";

export default class ControlsScene extends Phaser.Scene {
  constructor() {
    super({ key: "ControlsScene" });
  }

  create() {
    const centerX = this.scale.width * 0.5;
    const centerY = this.scale.height * 0.5;

   const instructions = [
      "MOVEMENT: ARROW KEYS",
      "SHOOT: Z",
      "SHOOT UP: UP ARROW + Z",
      "ROLL: LEFT OR RIGHT ARROW + X",
      "JUMP: UP ARROW",
      "JUMP LEFT: UP ARROW + LEFT ARROW + X",
      "JUMP RIGHT: UP ARROW + RIGHT ARROW + X",
      "PAUSE: ENTER",
      "SHIFT: CHANGE WEAPON (IF AVAILABLE)"
    ];


    const lineSpacing = 32;
    const instructionsHeight = (instructions.length - 1) * lineSpacing;
    const titleY = centerY - instructionsHeight * 0.5 - 48;

    this.add
      .text(centerX, titleY, "CONTROLS", {
        fontFamily: "standard",
        fontSize: "32px",
        color: "#FFFFFF",
      })
      .setOrigin(0.5);

    instructions.forEach((line, index) => {
      this.add
        .text(centerX, titleY + 48 + index * lineSpacing, line, {
          fontFamily: "standard",
          fontSize: "24px",
          color: "#FFFFFF",
        })
        .setOrigin(0.5);
    });

    this.backText = this.add
      .text(centerX, this.scale.height - 40, "HIT ENTER TO GO BACK", {
        fontFamily: "standard",
        fontSize: "20px",
        color: "#FFFFFF",
      })
      .setOrigin(0.5);

    this.flashing = false;
    this.flashTimer = null;

    this.input.keyboard.on("keydown-ENTER", () => this.onConfirm());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
  }

  onConfirm() {
    if (this.flashing) return;
    this.flashing = true;
    this.sound.play("menuSelect");

    const totalDuration = 1000;
    const blinkInterval = 100;
    let elapsed = 0;

    this.flashTimer = this.time.addEvent({
      delay: blinkInterval,
      callback: () => {
        elapsed += blinkInterval;
        const nextColor =
          this.backText.style.color === "#FFFFFF" ? "#000000" : "#FFFFFF";
        this.backText.setColor(nextColor);

        if (elapsed >= totalDuration) {
          this.flashTimer.remove(false);
          this.flashTimer = null;
          this.backText.setColor("#FFFFFF");
          this.scene.start("TitleScene");
        }
      },
      loop: true,
    });
  }

  cleanup() {
    if (this.flashTimer) {
      this.flashTimer.remove(false);
      this.flashTimer = null;
    }
  }
}
