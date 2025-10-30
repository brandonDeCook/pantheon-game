import Phaser from "phaser";
import TitleScene from "./scenes/TitleScene.js";
import GameScene from "./scenes/GameScene.js";
import PreloadScene from "./scenes/PreloadScene.js";
import "./styles.css";

const BASE_WIDTH = 320;
const BASE_HEIGHT = 240;
export const SCALE_4X = 4;

const config = {
  type: Phaser.AUTO,
  width: BASE_WIDTH * SCALE_4X,
  height: BASE_HEIGHT * SCALE_4X,
  parent: "game-container",
  pixelArt: true,
  render: { antialias: false },
  scale: {
    mode: Phaser.Scale.NONE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: { default: "arcade", arcade: { gravity: { y: 200 }, debug: false } },
  scene: [PreloadScene, TitleScene, GameScene],
};

window.addEventListener("load", () => {
  new Phaser.Game(config);
});
