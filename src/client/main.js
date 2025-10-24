import Phaser from 'phaser';
import TitleScene from './scenes/TitleScene.js';
import GameScene from './scenes/GameScene.js';
import PreloadScene from './scenes/PreloadScene.js';

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'game-container',
  pixelArt: true,
  roundPixels: true,      // helps snap to integer pixels
  render: {
    antialias: false,     // turn off WebGL smoothing
  },
  scale: {
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 200 }, debug: false }
  },
  scene: [PreloadScene, TitleScene, GameScene]
};

window.addEventListener('load', () => {
  new Phaser.Game(config);
});