import Phaser from "phaser";

export default class TitleScene extends Phaser.Scene {
  constructor() {
    super({ key: "TitleScene" });
  }

  preload() {}

  create() {
    const centerX = this.scale.width * 0.5;
    const centerY = this.scale.height * 0.5;

    this.add.image(centerX, centerY - 60, "title").setOrigin(0.5).setScale(3);

    this.menuOptions = ["START", "CONTROLS"];
    this.selectedIndex = 0;
    this.secretBuffer = "";
    this.secretWaveIndex = null;

    this.optionTexts = this.menuOptions.map((label, index) =>
      this.add
        .text(centerX, centerY + index * 40, label, {
          fontFamily: "standard",
          fontSize: "24px",
          color: "#FFFFFF",
        })
        .setOrigin(0.5)
    );

    this.updateSelection();

    this.input.keyboard.on("keydown-UP", () => this.changeSelection(-1));
    this.input.keyboard.on("keydown-DOWN", () => this.changeSelection(1));
    this.input.keyboard.on("keydown-ENTER", () => this.confirmSelection());
    this.input.keyboard.on("keydown", this.handleSecretInput, this);

    this.flashing = false;
    this.flashTimer = null;

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
  }

  changeSelection(direction) {
    if (this.flashing) return;
    this.selectedIndex = Phaser.Math.Wrap(
      this.selectedIndex + direction,
      0,
      this.menuOptions.length
    );
    this.sound.play("menuMove");
    this.updateSelection();

    if (this.menuOptions[this.selectedIndex] !== "START") {
      this.resetSecretCode();
    }
  }

  updateSelection() {
    this.optionTexts.forEach((text, index) => {
      text.setColor(index === this.selectedIndex ? "#F8B800" : "#FFFFFF");
    });
  }

  confirmSelection() {
    if (this.flashing) return;
    this.flashing = true;
    this.sound.play("menuSelect");

    const totalDuration = 1000;
    const blinkInterval = 100;
    let elapsed = 0;
    let toggleOn = false;
    const selectedText = this.optionTexts[this.selectedIndex];

    this.flashTimer = this.time.addEvent({
      delay: blinkInterval,
      callback: () => {
        elapsed += blinkInterval;
        const nextColor = toggleOn ? "#FFFFFF" : "#000000";
        selectedText.setColor(nextColor);
        toggleOn = !toggleOn;

        if (elapsed >= totalDuration) {
          this.flashTimer.remove(false);
          this.flashTimer = null;
          const selected = this.menuOptions[this.selectedIndex];
          const targetScene =
            selected === "START" ? "GameScene" : "ControlsScene";
          const sceneData =
            selected === "START" && typeof this.secretWaveIndex === "number"
              ? { startWaveIndex: this.secretWaveIndex }
              : undefined;
          this.scene.start(targetScene, sceneData);
        }
      },
      loop: true,
    });
  }

  handleSecretInput(event) {
    if (
      this.flashing ||
      this.menuOptions[this.selectedIndex] !== "START" ||
      !event.key
    ) {
      return;
    }

    if (event.key === "Backspace") {
      this.secretBuffer = this.secretBuffer.slice(0, -1);
      return;
    }

    if (event.key.length !== 1) {
      return;
    }

    const lower = event.key.toLowerCase();
    if (!/[a-z0-9]/.test(lower)) {
      return;
    }

    this.secretBuffer += lower;
    if (this.secretBuffer.length > 16) {
      this.secretBuffer = this.secretBuffer.slice(-16);
    }

    const match = this.secretBuffer.match(/garb(\d+)$/);
    if (match) {
      this.secretWaveIndex = parseInt(match[1], 10);
    }
  }

  resetSecretCode() {
    this.secretBuffer = "";
    this.secretWaveIndex = null;
  }

  cleanup() {
    if (this.flashTimer) {
      this.flashTimer.remove(false);
      this.flashTimer = null;
    }
    this.input.keyboard.off("keydown", this.handleSecretInput, this);
  }
}
