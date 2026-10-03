import weaponsData from "../data/weapons.json";
import type { WeaponDefinition } from "./types";

export const WEAPONS = weaponsData as WeaponDefinition[];

export function getWeapon(id?: string): WeaponDefinition {
  return WEAPONS.find((weapon) => weapon.id === id) ?? WEAPONS[0];
}

export function createConfiguredWeapon(baseId: string, tuning: Partial<Pick<WeaponDefinition, "damage" | "range" | "attackRate" | "armorPiercing" | "areaRadius" | "tracking">>): WeaponDefinition {
  const base = getWeapon(baseId);
  const damage = clamp(tuning.damage ?? base.damage, 1, 70);
  const range = clamp(tuning.range ?? base.range, 0.8, 12);
  const attackRate = clamp(tuning.attackRate ?? base.attackRate, 0.25, 3);
  const armorPiercing = clamp(tuning.armorPiercing ?? base.armorPiercing, 0, 0.8);
  const areaRadius = clamp(tuning.areaRadius ?? base.areaRadius, 0, 42);
  const tracking = clamp(tuning.tracking ?? base.tracking, 0, 1);
  const cost =
    base.cost * 0.28 +
    Math.pow(damage + 1, 1.22) * 1.3 +
    Math.pow(range, 1.38) * 3.5 +
    Math.pow(attackRate, 1.24) * 18 +
    armorPiercing * 92 +
    areaRadius * 1.45 +
    tracking * 30;

  return {
    ...base,
    id: `${base.id}_custom_${Math.round(damage)}_${Math.round(range * 10)}_${Math.round(attackRate * 100)}_${Math.round(armorPiercing * 100)}_${Math.round(areaRadius)}_${Math.round(tracking * 100)}`,
    name: `${base.name} mod`,
    damage,
    range,
    attackRate,
    armorPiercing,
    areaRadius,
    tracking,
    cost: Math.round(cost)
  };
}

export function weaponTags(weapon: WeaponDefinition): string {
  return weapon.tags.join(", ");
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
