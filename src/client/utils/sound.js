import Phaser from "phaser";

export function playSoundWithDetune(scene, soundKey, options = {}) {
  if (!scene?.sound) return options.lastDetune ?? null;
  const minDetune = options.minDetune ?? -200;
  const maxDetune = options.maxDetune ?? 1000;
  const minDiff = options.minDiff ?? 100;
  const lastDetune =
    options.lastDetune === 0 || Number.isFinite(options.lastDetune)
      ? options.lastDetune
      : null;

  const sound = scene.sound.get(soundKey) ?? scene.sound.add(soundKey);
  let detune = Phaser.Math.Between(minDetune, maxDetune);

  if (lastDetune !== null) {
    let attempts = 0;
    while (Math.abs(detune - lastDetune) < minDiff && attempts < 10) {
      detune = Phaser.Math.Between(minDetune, maxDetune);
      attempts += 1;
    }

    if (Math.abs(detune - lastDetune) < minDiff) {
      detune =
        lastDetune > 0
          ? Math.max(minDetune, lastDetune - minDiff)
          : Math.min(maxDetune, lastDetune + minDiff);
    }
  }

  sound?.play({ detune });
  return detune;
}
