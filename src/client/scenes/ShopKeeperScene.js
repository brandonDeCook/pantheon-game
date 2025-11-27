import Phaser from "phaser";
import { findPowerupByValue, getAllPowerups } from "../Constants.js";

const BASE_WIDTH = 320;
const BASE_HEIGHT = 240;
const ZOOM = 4;
const DEFAULT_OPTION_COLOR = "#ffffff";
const HIGHLIGHT_OPTION_COLOR = "#F8B800";
const DEFAULT_ARROW_POWERUP = { value: "DEFAULT_ARROW", frame: 3, amount: null };
const POWERUP_HIGHLIGHT_COLOR = 0xf8b800;

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
    this.ArrowPowerups = [];
    this.currentArrowPowerupIndex = 0;
    this.arrowPowerupIcons = [];
    this.arrowPowerupAmountTexts = [];
    this.arrowPowerupHighlight = null;
    this.arrowPowerupStartX = 0;
    this.arrowPowerupSpacing = 20;
    this.arrowPowerupY = 22;
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
      ? data.playerData.powerups.map((entry) =>
          typeof entry === "object" ? { ...entry } : entry
        )
      : [];
    this.playerData = {
      coins: this.playerCoins,
      health: { ...this.playerHealthSnapshot },
      powerups: initialPowerups,
    };
    this.exitingShop = false;
    this.ArrowPowerups = this.buildArrowPowerups(this.playerData);
    this.currentArrowPowerupIndex = 0;
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
    this.renderArrowPowerups();

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
      const powerupData = getAllPowerups();

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

  buildArrowPowerups(playerData) {
    const list = [
      {
        value: DEFAULT_ARROW_POWERUP.value,
        amount: DEFAULT_ARROW_POWERUP.amount,
        frame: DEFAULT_ARROW_POWERUP.frame,
      },
    ];

    const entries = Array.isArray(playerData?.powerups)
      ? playerData.powerups
      : [];

    entries.forEach((entry) => {
      const value = typeof entry === "string" ? entry : entry?.value;
      if (typeof value !== "string" || value.startsWith("HEAL_")) {
        return;
      }

      const def = findPowerupByValue(value);
      const entryAmount = Number.isFinite(entry?.amount) ? entry.amount : null;
      const defAmount = Number.isFinite(entryAmount)
        ? entryAmount
        : Number.isFinite(def?.amount)
        ? def.amount
        : 1;

      const existing = list.find((entry) => entry.value === value);
      if (existing) {
        if (existing.amount !== null && Number.isFinite(defAmount)) {
          existing.amount += defAmount;
        }
        return;
      }

      list.push({
        value,
        amount: defAmount,
        frame: def?.frame ?? DEFAULT_ARROW_POWERUP.frame,
      });
    });

    return list;
  }

  renderArrowPowerups() {
    if (Array.isArray(this.arrowPowerupIcons)) {
      this.arrowPowerupIcons.forEach((icon) => icon?.destroy());
    }
    this.arrowPowerupIcons = [];
    if (Array.isArray(this.arrowPowerupAmountTexts)) {
      this.arrowPowerupAmountTexts.forEach((text) => text?.destroy());
    }
    this.arrowPowerupAmountTexts = [];

    const lastBar = this.healthBars[this.healthBars.length - 1];
    const lastBarX = lastBar?.x ?? 73;
    this.arrowPowerupStartX = lastBarX + 20;
    this.arrowPowerupY = 40;
    this.arrowPowerupSpacing = 23;

    this.ArrowPowerups.forEach((powerup, index) => {
      const frame =
        typeof powerup.frame === "number"
          ? powerup.frame
          : DEFAULT_ARROW_POWERUP.frame;
      const icon = this.add
        .image(
          this.arrowPowerupStartX + index * this.arrowPowerupSpacing,
          this.arrowPowerupY,
          "playerPowerups",
          frame
        )
        .setOrigin(0.5);
      this.arrowPowerupIcons.push(icon);

      const amountText = this.add
        .text(
          icon.x,
          this.arrowPowerupY + 10,
          this.formatArrowAmount(powerup.amount),
          {
            fontFamily: "standard",
            fontSize: "24px",
            color: "#FFFFFF",
          }
        )
        .setOrigin(0.5, 0)
        .setScale(1 / ZOOM);
      this.arrowPowerupAmountTexts.push(amountText);
    });

    this.ensureArrowPowerupHighlight();
    this.updateArrowPowerupHighlightPosition();
  }

  ensureArrowPowerupHighlight() {
    if (this.arrowPowerupHighlight && !this.arrowPowerupHighlight.destroyed) {
      this.arrowPowerupHighlight.setVisible(true);
      return;
    }

    const highlightSize = 16;
    this.arrowPowerupHighlight = this.add.rectangle(0, 0, highlightSize, highlightSize).setOrigin(0.5);
    this.arrowPowerupHighlight.setStrokeStyle(1, POWERUP_HIGHLIGHT_COLOR, 1);
    this.arrowPowerupHighlight.setFillStyle(0xffffff, 0);
  }

  updateArrowPowerupHighlightPosition() {
    if (!this.arrowPowerupHighlight) {
      return;
    }

    const index = Phaser.Math.Clamp(
      this.currentArrowPowerupIndex ?? 0,
      0,
      Math.max(0, this.arrowPowerupIcons.length - 1)
    );
    this.currentArrowPowerupIndex = index;

    const targetIcon = this.arrowPowerupIcons[index];
    if (!targetIcon) {
      this.arrowPowerupHighlight.setVisible(false);
      return;
    }

    this.arrowPowerupHighlight.setVisible(true);
    this.arrowPowerupHighlight.setPosition(targetIcon.x, targetIcon.y);
    this.arrowPowerupHighlight.setDepth((targetIcon.depth ?? 0) + 1);
  }

  formatArrowAmount(amount) {
    if (!Number.isFinite(amount)) {
      return "INF";
    }
    return `x${amount}`;
  }

  updateArrowPowerupAmounts() {
    if (!Array.isArray(this.arrowPowerupAmountTexts)) {
      this.arrowPowerupAmountTexts = [];
    }
    this.ArrowPowerups.forEach((powerup, index) => {
      const text = this.arrowPowerupAmountTexts[index];
      if (!text) {
        return;
      }
      text.setText(this.formatArrowAmount(powerup.amount));
    });
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

    const hasPowerup = this.playerData.powerups.some((entry) =>
      typeof entry === "string" ? entry === value : entry?.value === value
    );
    if (hasPowerup) {
      return false;
    }

    spendCoins();
    const amount = Number.isFinite(powerupData.amount) ? powerupData.amount : 1;
    this.playerData.powerups.push({ value, amount });
    this.ArrowPowerups = this.buildArrowPowerups(this.playerData);
    this.renderArrowPowerups();
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
