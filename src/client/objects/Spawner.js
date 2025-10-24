import Phaser from 'phaser';
import Skeleton from './Skeleton.js';

export default class Spawner {
  constructor(scene, map) {
    this.scene = scene;
    this.map = map;
    this.timer = 0;
  }

  update(time, delta) {
    this.timer += delta;
    if (this.timer > 2000) {
      this.timer = 0;
      this.spawnSkeleton();
    }
  }

  spawnSkeleton() {
    const layer = this.map.getObjectLayer('Skeletons');
    const idx = Phaser.Math.Between(0, layer.objects.length - 1);
    const { x, y } = layer.objects[idx];
    new Skeleton(this.scene, x, y);
  }
}