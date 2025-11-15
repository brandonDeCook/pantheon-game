import Phaser from "phaser";
import PowerupData from "../data/PowerupData.js";

const BASE_WIDTH = 320;
const BASE_HEIGHT = 240;
const ZOOM = 4;
const DEFAULT_OPTION_COLOR = "#ffffff";
const HIGHLIGHT_OPTION_COLOR = "#F8B800";

export default class ShopKeeperScene extends Phaser.Scene {
  constructor() {
    super({ key: "ShopKeeperScene" });
    this.healthBars = [];
    this.nextWaveIndex = 0;
    this.wavesCompletedSnapshot = 0;
    this.shopKeeperSprite = null;
    this.shopInfoPanel = null;
    this.activeFlashEvent = null;
    this.activeFlashTimer = null;
    this.exitingShop = false;
  }

  init(data = {}) {
    const coins = Number.isFinite(data.playerCoins) ? data.playerCoins : 0;
    this.playerCoins = Math.max(0, coins);
    const waveCandidates = [
      data.nextWaveIndex,
      data.resumeWaveIndex,
      data.startWaveIndex,
    ];
    const nextWave = waveCandidates.find((value) => Number.isInteger(value));
    this.nextWaveIndex = Number.isInteger(nextWave) ? Math.max(0, nextWave) : 0;
    const wavesCompleted = Number.isInteger(data.wavesCompleted)
      ? data.wavesCompleted
      : 0;
    this.wavesCompletedSnapshot = Math.max(0, wavesCompleted);
    const health = data.playerHealth ?? {};
    const maxHealth = Number.isInteger(health.max) ? Math.max(0, health.max) : 5;
    const clampedCurrent = Number.isInteger(health.current)
      ? Phaser.Math.Clamp(health.current, 0, maxHealth || 0)
      : maxHealth;
    this.playerHealthSnapshot = {
      current: clampedCurrent,
      max: maxHealth,
    };
    const initialPowerups = Array.isArray(data.playerData?.powerups)
      ? [...data.playerData.powerups]
      : [];
    this.playerData = {
      coins: this.playerCoins,
      health: { ...this.playerHealthSnapshot },
      powerups: initialPowerups,
    };
    this.exitingShop = false;
  }

  preload() {}

  create() {
    this.cameras.main
      .setBounds(0, 0, BASE_WIDTH, BASE_HEIGHT)
      .setZoom(ZOOM)
      .centerOn(BASE_WIDTH / 2, BASE_HEIGHT / 2);

    this.add
      .image(BASE_WIDTH * 0.5, BASE_HEIGHT * 0.5, "shopBackground")
      .setOrigin(0.5)
      .setScale(2);

    const shopKeeper = this.add
      .image(BASE_WIDTH * 0.5 - 45, BASE_HEIGHT * 0.5 - 13, "shopKeeper")
      .setOrigin(0.5)
      .setScale(2)
      .setAlpha(0);
    this.shopKeeperSprite = shopKeeper;

    const infoPanel = this.add
      .rectangle(
        BASE_WIDTH * 0.5 + 50,
        BASE_HEIGHT * 0.8 - 80,
        110,
        100,
        0x000000
      )
      .setAlpha(0);
    this.shopInfoPanel = infoPanel;

    const panelText = this.add
      .text(infoPanel.x - 50, infoPanel.y - 48, "", {
        fontFamily: "standard",
        fontSize: "24px",
        color: "#ffffff",
        lineSpacing: 2,
      })
      .setScale(1 / ZOOM)
      .setDepth(10000)
      .setAlpha(0);

    this.renderPlayerStatus();

    const messages = [
      "Welcome wanderer.",
      "What do you need?"
    ];

    const selectableOptions = [];
    let selectedIndex = 0;

    const confirmState = {
      active: false,
      choiceIndex: 0,
      objects: [],
      option: null,
      yesText: null,
      noText: null,
    };

    const updateHighlight = () => {
      selectableOptions.forEach((option, index) => {
        option.label.setColor(index === selectedIndex ? HIGHLIGHT_OPTION_COLOR : DEFAULT_OPTION_COLOR);
      });
    };

    const updateConfirmHighlight = () => {
      if (!confirmState.active) return;
      if (confirmState.yesText) {
        confirmState.yesText.setColor(
          confirmState.choiceIndex === 0 ? HIGHLIGHT_OPTION_COLOR : DEFAULT_OPTION_COLOR
        );
      }
      if (confirmState.noText) {
        confirmState.noText.setColor(
          confirmState.choiceIndex === 1 ? HIGHLIGHT_OPTION_COLOR : DEFAULT_OPTION_COLOR
        );
      }
    };

    const closeConfirm = () => {
      confirmState.objects.forEach((obj) => obj?.destroy());
      confirmState.objects = [];
      confirmState.yesText = null;
      confirmState.noText = null;
      confirmState.option = null;
      confirmState.choiceIndex = 0;
      confirmState.active = false;
    };

    const openConfirm = (option) => {
      if (confirmState.active) return;
      confirmState.active = true;
      confirmState.option = option;
      confirmState.choiceIndex = 0;

      const modalX = BASE_WIDTH * 0.5;
      const modalY = BASE_HEIGHT * 0.5;
      const rect = this.add.rectangle(modalX, modalY, 100, 25, 0x000000).setDepth(5000);
      const prompt = this.add
        .text(modalX, modalY - 8, "ARE YOU SURE?", {
          fontFamily: "standard",
          fontSize: "24px",
          color: "#ffffff",
        })
        .setOrigin(0.5)
        .setScale(1 / ZOOM)
        .setDepth(5001);

      const yesText = this.add
        .text(modalX - 20, modalY + 5, "YES", {
          fontFamily: "standard",
          fontSize: "24px",
          color: DEFAULT_OPTION_COLOR,
        })
        .setOrigin(0.5)
        .setScale(1 / ZOOM)
        .setDepth(5001);

      const noText = this.add
        .text(modalX + 20, modalY + 5, "NO", {
          fontFamily: "standard",
          fontSize: "24px",
          color: DEFAULT_OPTION_COLOR,
        })
        .setOrigin(0.5)
        .setScale(1 / ZOOM)
        .setDepth(5001);

      confirmState.objects = [rect, prompt, yesText, noText];
      confirmState.yesText = yesText;
      confirmState.noText = noText;
      updateConfirmHighlight();
    };

    const bindNavigation = () => {
      this.input.keyboard.on("keydown-UP", () => {
        if (confirmState.active) return;
        if (!selectableOptions.length) return;
        selectedIndex = Phaser.Math.Wrap(selectedIndex - 1, 0, selectableOptions.length);
        this.sound.play("menuMove");
        updateHighlight();
      });

      this.input.keyboard.on("keydown-DOWN", () => {
        if (confirmState.active) return;
        if (!selectableOptions.length) return;
        selectedIndex = Phaser.Math.Wrap(selectedIndex + 1, 0, selectableOptions.length);
        this.sound.play("menuMove");
        updateHighlight();
      });

      this.input.keyboard.on("keydown-LEFT", () => {
        if (!confirmState.active) return;
        confirmState.choiceIndex = Phaser.Math.Wrap(confirmState.choiceIndex - 1, 0, 2);
        this.sound.play("menuMove");
        updateConfirmHighlight();
      });

      this.input.keyboard.on("keydown-RIGHT", () => {
        if (!confirmState.active) return;
        confirmState.choiceIndex = Phaser.Math.Wrap(confirmState.choiceIndex + 1, 0, 2);
        this.sound.play("menuMove");
        updateConfirmHighlight();
      });

      this.input.keyboard.on("keydown-ENTER", () => {
        if (confirmState.active) {
          if (confirmState.choiceIndex === 0 && confirmState.option) {
            if (confirmState.option.type === "powerup") {
              const applied = this.validateAndApplyPowerUp(confirmState.option.data);
              this.sound.play(applied ? "pantheon-menu-success" : "pantheon-menu-invalid");
            } else if (confirmState.option.type === "leave") {
              this.handleLeaveSelection();
            }
          }
          closeConfirm();
          return;
        }

        const selected = selectableOptions[selectedIndex];
        if (!selected) {
          return;
        }
        if (selected.type === "powerup") {
          const cost = selected.data?.cost ?? Number.POSITIVE_INFINITY;
          if ((this.playerCoins ?? 0) < cost) {
            this.sound.play("pantheon-menu-invalid");
            return;
          }
          openConfirm(selected);
          return;
        }

        if (selected.type === "leave") {
          openConfirm(selected);
        }
      });
    };

    const showPowerups = () => {
      const panelLeft = infoPanel.x - infoPanel.width * 0.5;
      const iconX = panelLeft + 2;
      const textOffset = 21;
      const iconStartY = panelText.y + panelText.displayHeight + 5;
      const iconSize = 16;
      const spacing = 4;
      const powerupData = PowerupData.getAll();

      powerupData.forEach((entry, index) => {
        const y = iconStartY + index * (iconSize + spacing);
        this.add
          .image(iconX, y, "playerPowerups", entry.frame)
          .setOrigin(0, 0);

        const label = this.add
          .text(iconX + textOffset, y + iconSize * 0.5, entry.label, {
            fontFamily: "standard",
            fontSize: "24px",
            color: DEFAULT_OPTION_COLOR,
          })
          .setOrigin(0, 0.5)
          .setScale(1 / ZOOM);

        selectableOptions.push({ label, type: "powerup", data: entry });
      });

      const leaveY = iconStartY + powerupData.length * (iconSize + spacing);
      this.add.rectangle(iconX, leaveY, iconSize, iconSize, 0x7c7c7c).setOrigin(0, 0);

      const leaveLabel = this.add
        .text(iconX + textOffset, leaveY + iconSize * 0.5, "LEAVE", {
          fontFamily: "standard",
          fontSize: "24px",
          color: DEFAULT_OPTION_COLOR,
        })
        .setOrigin(0, 0.5)
        .setScale(1 / ZOOM);

      selectableOptions.push({ label: leaveLabel, type: "leave" });

      updateHighlight();
      bindNavigation();
    };

    const startTyping = () => {
      panelText.setAlpha(1);
      panelText.setText("");

      let messageIndex = 0;
      let charIndex = 0;

      const typingEvent = this.time.addEvent({
        delay: 60,
        loop: true,
        callback: () => {
          const currentMessage = messages[messageIndex];

          if (!currentMessage) {
            typingEvent.remove();
            showPowerups();
            return;
          }

          if (charIndex < currentMessage.length) {
            panelText.text += currentMessage.charAt(charIndex);
            charIndex += 1;
            return;
          }

          if (messageIndex < messages.length - 1) {
            panelText.text += "\n";
          }

          messageIndex += 1;
          charIndex = 0;

          if (messageIndex >= messages.length) {
            typingEvent.remove();
            showPowerups();
          }
        },
      });
    };

    this.startShopFlash(() => {
      startTyping();
    });
  }

  renderPlayerStatus() {
    const health = this.playerData?.health ?? { current: 5, max: 5 };

    this.add
      .text(33, 49, "PLAYER", {
        fontFamily: "standard",
        fontSize: "24px",
        color: "#FFFFFF",
      })
      .setScale(1 / ZOOM);

    this.healthBars.forEach((bar) => bar?.destroy());
    this.healthBars = [];
    for (let index = 0; index < health.max; index += 1) {
      const bar = this.add.sprite(73 + index * 5, 51, "healthBar");
      this.healthBars.push(bar);
      if (index >= health.current) {
        bar.setFrame("1");
      }
    }

    const coins = Number.isFinite(this.playerData?.coins)
      ? this.playerData.coins
      : this.playerCoins ?? 0;
    this.shopCoinText = this.add
      .text(230, 49, `COINS:${coins}`, {
        fontFamily: "standard",
        fontSize: "24px",
        color: "#FFFFFF",
      })
      .setScale(1 / ZOOM);

    this.updateHealthDisplay();
  }

  handleLeaveSelection() {
    if (this.exitingShop) {
      return;
    }
    this.exitingShop = true;
    const coins = Number.isFinite(this.playerData?.coins)
      ? this.playerData.coins
      : this.playerCoins ?? 0;
    const health =
      this.playerData?.health ??
      this.playerHealthSnapshot ??
      { current: 0, max: 0 };
    const playerData = {
      ...this.playerData,
      coins,
      health,
    };
    const resumeWaveIndex = Number.isInteger(this.nextWaveIndex)
      ? Math.max(0, this.nextWaveIndex)
      : 0;
    const wavesCompleted = Number.isInteger(this.wavesCompletedSnapshot)
      ? Math.max(0, this.wavesCompletedSnapshot)
      : 0;

    const startGameScene = () => {
      this.scene.start("GameScene", {
        resumeWaveIndex,
        nextWaveIndex: resumeWaveIndex,
        playerCoins: coins,
        playerHealth: health,
        playerData,
        wavesCompleted,
      });
    };

    this.startShopFlash(() => {
      startGameScene();
    });
  }

  validateAndApplyPowerUp(powerupData) {
    if (!powerupData) {
      return false;
    }

    const cost = Number.isFinite(powerupData.cost) ? powerupData.cost : Number.POSITIVE_INFINITY;
    const availableCoins = this.playerCoins ?? 0;
    if (availableCoins < cost) {
      return false;
    }

    const value = powerupData.value;
    if (!value) {
      return false;
    }

    if (!this.playerData) {
      this.playerData = { coins: this.playerCoins ?? 0, health: { ...this.playerHealthSnapshot }, powerups: [] };
    } else if (!Array.isArray(this.playerData.powerups)) {
      this.playerData.powerups = [];
    }

    const spendCoins = () => {
      this.playerCoins = availableCoins - cost;
      if (this.shopCoinText) {
        this.shopCoinText.setText(`COINS:${this.playerCoins}`);
      }
      this.playerData.coins = this.playerCoins;
    };

    if (value === "HEAL_4") {
      const health = this.playerData.health ?? { current: 0, max: 0 };
      const maxHealth = Number.isFinite(health.max) ? health.max : 0;
      const currentHealth = Number.isFinite(health.current) ? health.current : 0;
      if (maxHealth <= 0 || currentHealth >= maxHealth) {
        return false;
      }
      const healAmount = 4;
      const newHealth = Math.min(maxHealth, currentHealth + healAmount);
      spendCoins();
      this.playerData.health = { ...health, current: newHealth, max: maxHealth };
      this.playerHealthSnapshot = { current: newHealth, max: maxHealth };
      this.updateHealthDisplay();
      return true;
    }

    if (this.playerData.powerups.includes(value)) {
      return false;
    }

    spendCoins();
    this.playerData.powerups.push(value);
    return true;
  }

  updateHealthDisplay() {
    if (!Array.isArray(this.healthBars)) {
      this.healthBars = [];
    }
    const health = this.playerData?.health ?? { current: 0, max: 0 };
    this.healthBars.forEach((bar, index) => {
      if (!bar) {
        return;
      }
      if (index >= health.max) {
        bar.setVisible(false);
        return;
      }
      bar.setVisible(true);
      if (index >= health.current) {
        bar.setFrame("1");
      } else {
        bar.setFrame("0");
      }
    });
  }

  startShopFlash(onComplete) {
    if (!this.shopKeeperSprite || !this.shopInfoPanel) {
      onComplete?.();
      return;
    }

    if (this.activeFlashEvent) {
      this.activeFlashEvent.remove(false);
      this.activeFlashEvent = null;
    }

    if (this.activeFlashTimer) {
      this.activeFlashTimer.remove(false);
      this.activeFlashTimer = null;
    }

    let visible = false;
    const flashInterval = 80;
    const flashDuration = 1100;

    this.activeFlashEvent = this.time.addEvent({
      delay: flashInterval,
      loop: true,
      callback: () => {
        visible = !visible;
        this.shopKeeperSprite.setAlpha(visible ? 1 : 0);
        this.shopInfoPanel.setAlpha(visible ? 1 : 0);
      },
    });

    this.activeFlashTimer = this.time.delayedCall(flashDuration, () => {
      this.activeFlashEvent?.remove(false);
      this.activeFlashEvent = null;
      this.activeFlashTimer = null;
      this.shopKeeperSprite.setAlpha(1);
      this.shopInfoPanel.setAlpha(1);
      onComplete?.();
    });
  }
}
