const POWERUPS = Object.freeze([
  {
    frame: 0,
    label: "ICE $200",
    cost: 200,
    value: "ICE_ARROW",
    amount: 100,
  },
  {
    frame: 1,
    label: "HEAL $100",
    cost: 100,
    value: "HEAL_4",
    amount: 1,
  },
  {
    frame: 2,
    label: "PIERCE $350",
    cost: 350,
    value: "PIERCE_ARROW",
    amount: 150,
  },
]);

export const ICE_FREEZE_TINT = 0x0078f8;
export const ICE_FREEZE_FLASH_TINT = 0xffffff;
export const ICE_FREEZE_DURATION = 2000;

export function getAllPowerups() {
  return POWERUPS.map((entry) => ({ ...entry }));
}

export function findPowerupByFrame(frame) {
  return POWERUPS.find((entry) => entry.frame === frame) ?? null;
}

export function findPowerupByValue(value) {
  return POWERUPS.find((entry) => entry.value === value) ?? null;
}
