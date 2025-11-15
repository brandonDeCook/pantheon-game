const POWERUPS = Object.freeze([
  {
    frame: 0,
    label: "ICE $250",
    cost: 250,
    value: "ICE_ARROW",
  },
  {
    frame: 1,
    label: "HEAL $100",
    cost: 100,
    value: "HEAL_4",
  },
  {
    frame: 2,
    label: "PIERCE $350",
    cost: 350,
    value: "PIERCE_ARROW",
  },
]);

export default class PowerupData {
  static getAll() {
    return POWERUPS.map((entry) => ({ ...entry }));
  }

  static findByFrame(frame) {
    return POWERUPS.find((entry) => entry.frame === frame) ?? null;
  }

  static findByValue(value) {
    return POWERUPS.find((entry) => entry.value === value) ?? null;
  }
}
