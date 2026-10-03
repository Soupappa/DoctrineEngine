import { MIN_UNIT_COST, STAT_LIMITS } from "./constants";
import { getWeapon } from "./weapons";
import type { CostBreakdown, UnitDefinition, UnitStats, UnitTraits, WeaponDefinition } from "./types";

const TRAIT_COSTS: Record<keyof UnitTraits, number> = {
  stealth: 42,
  detector: 26,
  flying: 54,
  areaDamage: 48,
  regeneration: 34,
  repair: 26,
  builder: 36,
  suicide: -10,
  jammer: 38,
  decoy: 24,
  slow: 24,
  transport: 28,
  mining: 18
};

export function clampStat<K extends keyof UnitStats>(key: K, value: number): number {
  const limit = STAT_LIMITS[key];
  return Math.min(limit.max, Math.max(limit.min, value));
}

export function normalizeStats(stats: UnitStats): UnitStats {
  return {
    hp: clampStat("hp", stats.hp),
    damage: clampStat("damage", stats.damage),
    range: clampStat("range", stats.range),
    attackRate: clampStat("attackRate", stats.attackRate),
    speed: clampStat("speed", stats.speed),
    armor: clampStat("armor", stats.armor),
    vision: clampStat("vision", stats.vision)
  };
}

export function calculateUnitCost(input: Pick<UnitDefinition, "stats" | "traits" | "buildTime"> & { weapon?: WeaponDefinition }): CostBreakdown {
  const stats = normalizeStats(input.stats);
  const traits = input.traits;
  const weapon = input.weapon ?? getWeapon();
  const baseCost = 12;
  const notes: string[] = [];

  const hpCost = Math.pow(stats.hp, 1.15) * 0.42;
  const speedCost = Math.pow(stats.speed, 1.6) * 4.4;
  const armorCost = Math.pow(stats.armor + 1, 1.8) * 3.7;
  const visionCost = Math.pow(stats.vision, 1.25) * 1.6;
  const bodySensorCost = Math.pow(Math.max(stats.vision, weapon.range * 0.65), 1.18) * 1.4;
  const statCost = hpCost + speedCost + armorCost + visionCost + bodySensorCost;
  const weaponPower = Math.pow(weapon.damage + 1, 1.3) * 1.25 + Math.pow(weapon.range, 1.55) * 3.2 + Math.pow(weapon.attackRate, 1.38) * 12;
  const weaponEffects = weapon.armorPiercing * 80 + weapon.areaRadius * 1.25 + weapon.tracking * 26;
  const weaponCost = weapon.cost + weaponPower + weaponEffects;

  const traitCost = Object.entries(traits).reduce((total, [trait, enabled]) => {
    if (!enabled) return total;
    return total + (TRAIT_COSTS[trait as keyof UnitTraits] ?? 0);
  }, 0);

  let synergyPenalty = 0;
  synergyPenalty += Math.pow(stats.speed * weapon.range, 1.14) * 0.28;
  if (traits.stealth) synergyPenalty += Math.pow(weapon.damage + 1, 1.28) * 1.05;
  if (traits.flying) synergyPenalty += Math.pow(weapon.range, 1.55) * 2.7;
  if (traits.areaDamage || weapon.areaRadius > 0) synergyPenalty += Math.pow(weapon.attackRate * Math.max(8, weapon.areaRadius), 1.12) * 0.7;
  if (traits.regeneration) synergyPenalty += Math.pow(stats.armor + 1, 1.75) * 2.8;
  if (traits.builder && traits.flying) synergyPenalty += 62;
  if (traits.detector) synergyPenalty += Math.pow(stats.speed, 1.45) * 2.4;
  if (traits.jammer) synergyPenalty += Math.pow(weapon.range, 1.5) * 2.6;
  if (traits.stealth && traits.flying) synergyPenalty += 38;
  if ((traits.areaDamage || weapon.areaRadius > 0) && weapon.range > 7) synergyPenalty += 44;

  let weaknessDiscount = 0;
  if (stats.speed < 2.2) weaknessDiscount += (2.2 - stats.speed) * 11;
  if (stats.range < 2.2) weaknessDiscount += (2.2 - stats.range) * 9;
  if (stats.hp < 34) weaknessDiscount += (34 - stats.hp) * 0.55;
  if (input.buildTime > 7) weaknessDiscount += (input.buildTime - 7) * 5;
  if (traits.suicide) weaknessDiscount += 20;
  if (stats.vision < 4) weaknessDiscount += (4 - stats.vision) * 6;
  if (weapon.damage <= 0.5) weaknessDiscount += 32;

  weaknessDiscount = Math.min(weaknessDiscount, (baseCost + statCost + weaponCost + traitCost + synergyPenalty) * 0.32);

  const rawCost = baseCost + statCost + weaponCost + traitCost + synergyPenalty - weaknessDiscount;
  const finalCost = Math.round(Math.max(MIN_UNIT_COST, rawCost));

  if (synergyPenalty > 80) notes.push("Synergies dangereuses fortement taxees");
  if (weaknessDiscount > 25) notes.push("Faiblesses reconnues, remise plafonnee");
  return {
    baseCost,
    statCost,
    traitCost,
    synergyPenalty,
    weaknessDiscount,
    finalCost,
    notes
  };
}

export function validateUnit(definition: UnitDefinition): string[] {
  const issues: string[] = [];
  const stats = definition.stats;

  for (const key of Object.keys(STAT_LIMITS) as Array<keyof UnitStats>) {
    const limit = STAT_LIMITS[key];
    if (stats[key] < limit.min || stats[key] > limit.max) {
      issues.push(`${key} hors limites`);
    }
  }

  if (definition.traits.suicide && definition.traits.repair) {
    issues.push("Une unite suicide ne peut pas etre reparatrice dans ce prototype");
  }

  if (definition.traits.stealth && definition.stats.hp > 170 && definition.stats.damage > 42) {
    issues.push("Profil furtif lourd trop instable");
  }

  return issues;
}
